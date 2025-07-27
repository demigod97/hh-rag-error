import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, AlertTriangle, RefreshCw } from "lucide-react";
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
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Info } from 'lucide-react';
import { ReportDisplay } from '@/components/ui/report-display';
import type { Database } from '@/lib/database.types';

// Define proper types using the correct database schema
type DatabaseMessage = Database['public']['Tables']['chat_messages']['Row'];

interface CitationData {
  title?: string;
  content?: string;
  source?: string;
  page?: number;
}

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
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface ChatStreamProps {
  sessionId: string;
  notebookId?: string;
  onNewSession?: (sessionId: string) => void;
}

/**
 * Enhanced content renderer with better UX
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

      // FIXED: Handle the "Workflow was started" message at string level
      if (content.trim() === '{"message":"Workflow was started"}' || 
          content.trim() === 'Workflow was started') {
        return (
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <div>
              <p className="font-medium text-foreground">Processing your request...</p>
              <p className="text-sm text-muted-foreground">This may take a moment as I analyze your documents.</p>
            </div>
          </div>
        );
      }

      // Try to parse as JSON first to check for report format
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && parsed.action === 'report') {
          return <ReportDisplay data={parsed} />;
        }
      } catch {
        // Not JSON, continue with normal string processing
      }

      // Check if content looks like markdown
      const hasMarkdown = /^#\s|^##\s|^###\s|^\*\*.*\*\*|^\*.*\*|^- |^\d+\.|^```/.test(content);
      
      if (hasMarkdown) {
        return <MarkdownRenderer content={content} />;
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
      
      // Check for report action first
      if (obj.action === 'report' && typeof obj.topic === 'string') {
        return <ReportDisplay data={obj as { action: string; topic: string; address?: string; markdown?: string; }} />;
      }
      
      // Check for common response patterns from n8n
      if ('content' in obj && typeof obj.content === 'string') {
        return renderMessageContent(obj.content);
      }
      
      if ('message' in obj && typeof obj.message === 'string') {
        // Handle the specific "Workflow was started" case
        if (obj.message === 'Workflow was started') {
          return (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <div>
                <p className="font-medium text-foreground">Processing your request...</p>
                <p className="text-sm text-muted-foreground">This may take a moment as I analyze your documents.</p>
              </div>
            </div>
          );
        }
        return renderMessageContent(obj.message);
      }
      
      if ('response' in obj && typeof obj.response === 'string') {
        return renderMessageContent(obj.response);
      }

      // Render as formatted JSON for debugging
      return (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Technical Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-32 bg-background p-2 rounded">
              {JSON.stringify(obj, null, 2)}
            </pre>
          </CardContent>
        </Card>
      );
    }

    // Handle primitive types
    if (typeof content === 'number' || typeof content === 'boolean') {
      return <span>{String(content)}</span>;
    }

    // Fallback for any other type
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unsupported content type: {typeof content}
        </AlertDescription>
      </Alert>
    );

  } catch (error) {
    // Ultimate fallback - should never reach here but ensures no crashes
    console.error('Error rendering message content:', error, { content });
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error displaying message
        </AlertDescription>
      </Alert>
    );
  }
};

export const ChatStream = ({ sessionId, notebookId, onNewSession }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [citationData, setCitationData] = useState<Record<string, CitationData>>({});
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

        if (error) {
          console.error('Error loading chat history:', error);
          throw error;
        }

        if (chatMessages && chatMessages.length > 0) {
          console.log('Loaded chat messages:', chatMessages);
          const formattedMessages: Message[] = chatMessages.map((msg: DatabaseMessage) => ({
            id: msg.id,
            type: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.created_at || new Date().toISOString(),
            metadata: msg.retrieval_metadata as Record<string, unknown> | undefined
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

  // Real-time subscription for new messages with enhanced debugging
  useEffect(() => {
    if (!sessionId) return;

    console.log('Setting up real-time subscription for session:', sessionId);

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
          console.log('Real-time message received:', payload);
          const newMessage = payload.new as DatabaseMessage;
          
          // Enhanced debugging
          console.log('New message fields:', Object.keys(newMessage));
          console.log('Message content:', newMessage.content);
          console.log('Message role:', newMessage.role);
          
          setMessages(prev => {
            // Check if message already exists
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('Message already exists, skipping:', newMessage.id);
              return prev;
            }
            
            console.log('Adding new message from real-time:', newMessage);
            
            // Create new message with correct field mapping
            const newMsg: Message = {
              id: newMessage.id,
              type: newMessage.role as 'user' | 'assistant',
              content: newMessage.content,
              timestamp: newMessage.created_at || new Date().toISOString(),
              metadata: newMessage.retrieval_metadata as Record<string, unknown> | undefined
            };
            
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Subscription includes error handling in the callback

    return () => {
      console.log('Unsubscribing from real-time for session:', sessionId);
      subscription.unsubscribe();
    };
  }, [sessionId]);

  // Add this effect to debug the subscription
  useEffect(() => {
    console.log('Current messages:', messages.map(m => ({ id: m.id, type: m.type, content: m.content.substring(0, 50) })));
  }, [messages]);

  // Test environment and real-time on mount
  useEffect(() => {
    console.log('🔍 Debugging Chat Environment:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Session ID:', sessionId);
    console.log('Testing real-time configuration...');
    
    // Test real-time connection
    setTimeout(() => {
      testRealtimeConnection();
    }, 1000);
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
    
    // Add user message immediately with temp ID
    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      type: "user",
      content: messageContent,
      timestamp: new Date().toISOString()
    };
    
    setMessages(m => [...m, tempUserMessage]);
    setIsLoading(true);
    setInputValue('');
    
    // Add thinking message with animation
    const thinkingMessage: Message = {
      id: `thinking-${Date.now()}`,
      type: "assistant",
      content: "thinking",
      timestamp: new Date().toISOString()
    };
    setMessages(m => [...m, thinkingMessage]);
    
    try {
      console.log('Sending chat message...');
      const res = await handleAsyncError(
        () => sendChat(sessionId, messageContent),
        { operation: 'send_chat_message', sessionId, messageLength: messageContent.length }
      );
      
      console.log('Chat response received:', res);
      
      // Remove thinking message immediately
      setMessages(m => m.filter(msg => msg.content !== "thinking"));
      
      // Handle the AI response - don't add it locally, let real-time subscription handle it
      // The real-time subscription will automatically add the assistant message from the database
      
    } catch (error) {
      console.error('Chat error:', error);
      setChatError(error.message || 'Failed to send message');
      setMessages(m => {
        const withoutThinking = m.filter(msg => msg.content !== "thinking");
        return [
          ...withoutThinking,
          {
            id: `error-${Date.now()}`,
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

  // Manual refresh function for debugging
  const handleManualRefresh = async () => {
    console.log('Manual refresh triggered');
    try {
      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error in manual refresh:', error);
        return;
      }

      console.log('Manual refresh - found messages:', chatMessages);
      
      if (chatMessages && chatMessages.length > 0) {
        const formattedMessages: Message[] = chatMessages.map((msg: DatabaseMessage) => ({
          id: msg.id,
          type: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.created_at || new Date().toISOString(),
          metadata: msg.retrieval_metadata as Record<string, unknown> | undefined
        }));

        // Keep welcome message and add all messages
        setMessages([messages[0], ...formattedMessages]);
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    }
  };

  // Test real-time connection
  const testRealtimeConnection = () => {
    console.log('Testing real-time connection...');
    
    // Test basic connection
    const testChannel = supabase.channel('test-connection')
      .on('presence', { event: 'sync' }, () => {
        console.log('Real-time presence sync working');
      })
      .subscribe((status) => {
        console.log('Test channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time connection is working');
          setTimeout(() => {
            testChannel.unsubscribe();
          }, 2000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time connection failed');
        }
      });
  };

  // Enhanced thinking animation component
  const ThinkingAnimation = () => (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      {thinkingAnimation ? (
        <Lottie 
          animationData={thinkingAnimation} 
          loop 
          style={{ width: 60, height: 30 }}
        />
      ) : (
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      )}
      <div>
        <p className="font-medium text-foreground">Town Planner Assistant is thinking...</p>
        <p className="text-sm text-muted-foreground">Analyzing your documents and generating a response</p>
      </div>
    </div>
  );

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
                    <ThinkingAnimation />
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
              <InlineError message={chatError} />
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex items-center">
              <NetworkIndicator showLabel={false} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              className="flex-shrink-0"
              title="Refresh messages"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
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