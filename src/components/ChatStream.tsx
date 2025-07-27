import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import Lottie from "lottie-react";
import { sendChat } from "@/lib/api";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { fetchCitation } from "@/lib/api";
import { InlineError } from "@/components/ui/error-display";
import { FloatingNewChatButton } from "@/components/NewChatButton";
import { NetworkIndicator } from "@/components/NetworkStatus";
import { supabase } from "@/lib/api";

// Load thinking animation from public folder
const useThinkingAnimation = () => {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch('/lottie/thinking.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error('Failed to load thinking animation:', error));
  }, []);

  return animationData;
};

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  avatar?: string;
  metadata?: any;
  timestamp?: string;
}

interface ChatStreamProps {
  sessionId: string;
  notebookId?: string;
  onNewSession?: (sessionId: string) => void;
}

/**
 * Bulletproof content renderer that safely handles any data type
 * Never throws runtime errors - always provides fallback rendering
 */
const renderMessageContent = (content: unknown): JSX.Element => {
  try {
    // Handle null/undefined
    if (content == null) {
      return <span className="text-muted-foreground italic">No content</span>;
    }

    // Handle string content (most common case)
    if (typeof content === 'string') {
      if (content.trim() === '') {
        return <span className="text-muted-foreground italic">Empty message</span>;
      }

      // Process citation chips like [1], [2], etc.
      const citationRegex = /\[(\d+)\]/g;
      const parts = content.split(citationRegex);
      
      return (
        <>
          {parts.map((part, index) => {
            if (index % 2 === 1) {
              // This is a citation number
              const citationId = part;
              return (
                <Popover key={index}>
                  <PopoverTrigger asChild>
                    <Badge 
                      variant="secondary" 
                      className="cursor-pointer mx-1 hover:bg-secondary/80"
                      data-testid="citation-chip"
                    >
                      [{citationId}]
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" data-testid="citation-popover">
                    <div className="text-sm">
                      <p className="font-medium">Citation {citationId}</p>
                      <p className="text-muted-foreground mt-1">
                        Loading citation details...
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </>
      );
    }

    // Handle object content (JSON responses from n8n)
    if (typeof content === 'object') {
      // Handle arrays
      if (Array.isArray(content)) {
        if (content.length === 0) {
          return <span className="text-muted-foreground italic">Empty list</span>;
        }
        
        return (
          <div className="space-y-2">
            {content.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-1">•</span>
                <div className="flex-1">
                  {renderMessageContent(item)}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // Handle objects
      const obj = content as Record<string, unknown>;
      
      // Check for common response patterns from n8n
      if ('content' in obj && typeof obj.content === 'string') {
        return renderMessageContent(obj.content);
      }
      
      if ('message' in obj && typeof obj.message === 'string') {
        return renderMessageContent(obj.message);
      }
      
      if ('response' in obj && typeof obj.response === 'string') {
        return renderMessageContent(obj.response);
      }

      // Render as formatted JSON for debugging
      return (
        <details className="bg-muted/50 rounded p-2 text-xs">
          <summary className="cursor-pointer font-medium">
            Object Response (click to expand)
          </summary>
          <pre className="mt-2 whitespace-pre-wrap overflow-auto max-h-32">
            {JSON.stringify(obj, null, 2)}
          </pre>
        </details>
      );
    }

    // Handle primitive types
    if (typeof content === 'number' || typeof content === 'boolean') {
      return <span>{String(content)}</span>;
    }

    // Fallback for any other type
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="w-4 h-4" />
        <span>Unsupported content type: {typeof content}</span>
      </div>
    );

  } catch (error) {
    // Ultimate fallback - should never reach here but ensures no crashes
    console.error('Error rendering message content:', error, { content });
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        <span>Error displaying message</span>
      </div>
    );
  }
};

export const ChatStream = ({ sessionId, notebookId, onNewSession }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [citationData, setCitationData] = useState<Record<string, any>>({});
  const [chatError, setChatError] = useState<string>("");
  const { handleAsyncError } = useErrorHandler();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! How can I assist you with your town planning needs today? I can help you with zoning regulations, permit applications, and more.",
      timestamp: new Date().toISOString()
    },
  ]);
  const thinkingAnimation = useThinkingAnimation();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history from database
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        // Clear existing messages except welcome message
        setMessages(prev => [prev[0]]);
        
        const { data: chatMessages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (chatMessages && chatMessages.length > 0) {
          const formattedMessages: Message[] = chatMessages.map(msg => ({
            id: msg.id,
            type: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.created_at || new Date().toISOString(),
            metadata: msg.retrieval_metadata
          }));

          // Keep the welcome message and add history
          setMessages(prev => [prev[0], ...formattedMessages]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // Don't show error to user for chat history loading
      }
    };

    if (sessionId) {
      loadChatHistory();
    }
  }, [sessionId]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!sessionId) return;

    const subscription = supabase
      .channel(`chat-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Only add if it's not from current user to avoid duplicates
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            
            return [...prev, {
              id: newMessage.id,
              type: newMessage.role,
              content: newMessage.content,
              timestamp: newMessage.created_at,
              metadata: newMessage.retrieval_metadata
            }];
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);

  const handleCitationHover = async (citationId: string) => {
    if (!citationData[citationId]) {
      try {
        const data = await fetchCitation(citationId);
        setCitationData(prev => ({ ...prev, [citationId]: data }));
      } catch (error) {
        console.error('Failed to fetch citation:', error);
      }
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setChatError("");
    const messageContent = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: messageContent,
      timestamp: new Date().toISOString()
    };
    
    setMessages(m => [...m, userMessage]);
    setIsLoading(true);
    setInputValue('');
    
    // Add thinking message with animation
    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: "thinking",
      timestamp: new Date().toISOString()
    };
    setMessages(m => [...m, thinkingMessage]);
    
    try {
      const res = await handleAsyncError(
        () => sendChat(sessionId, messageContent),
        { operation: 'send_chat_message', sessionId, messageLength: messageContent.length }
      );
      
      // Remove thinking message and add actual response
      setMessages(m => {
        const withoutThinking = m.slice(0, -1);
        return [
          ...withoutThinking,
          { 
            id: res.aiMessage.id, 
            type: 'assistant', 
            content: res.aiMessage.content,
            timestamp: new Date().toISOString()
          }
        ];
      });
    } catch (error) {
      setChatError(error.message || 'Failed to send message');
      setMessages(m => {
        const withoutThinking = m.slice(0, -1);
        return [
          ...withoutThinking,
          {
            id: Date.now().toString(),
            type: "assistant",
            content: "Sorry, I encountered an error processing your message. Please try again.",
            timestamp: new Date().toISOString()
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ComponentErrorBoundary>
      <div className="flex-1 flex flex-col bg-background h-full">
        {/* Floating New Chat Button - shows on mobile when messages exist */}
        {messages.length > 1 && ( // Show if more than just welcome message
          <div className="lg:hidden">
            <FloatingNewChatButton
              notebookId={notebookId}
              onNewSession={onNewSession}
              currentSessionId={sessionId}
              showConfirmation={true}
            />
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4 mobile-scroll">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'assistant' && (
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="w-4 h-4 bg-primary-foreground rounded-sm" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-chat-user text-primary-foreground'
                    : 'bg-chat-assistant text-foreground'
                }`}
              >
                <div className="text-sm leading-relaxed">
                  {message.content === "thinking" && message.type === 'assistant' ? (
                    <div className="flex items-center gap-2" data-testid="thinking-animation">
                      {thinkingAnimation ? (
                        <Lottie 
                          animationData={thinkingAnimation} 
                          loop 
                          style={{ width: 60, height: 30 }}
                        />
                      ) : (
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      )}
                      <span className="text-muted-foreground">Town Planner Assistant is thinking...</span>
                    </div>
                  ) : (
                    renderMessageContent(message.content)
                  )}
                </div>
                {message.timestamp && (
                  <div className="text-xs text-muted-foreground mt-1 opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              {message.type === 'user' && (
                <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                  <AvatarFallback className="bg-muted text-xs">U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t p-4">
          {/* Chat Error Display */}
          {chatError && (
            <div className="mb-4">
              <InlineError 
                message={chatError} 
                retry={() => {
                  setChatError("");
                  handleSend();
                }}
              />
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex items-center">
              <NetworkIndicator showLabel={false} />
            </div>
            <Input
              placeholder="Ask about your documents..."
              className="flex-1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <Button 
              size="sm" 
              className="px-6" 
              disabled={isLoading || !inputValue.trim()} 
              onClick={handleSend}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};