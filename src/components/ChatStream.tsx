import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, AlertTriangle, RefreshCw, Copy, RotateCcw, ThumbsUp, ThumbsDown, MoreHorizontal, Paperclip, X, File, FileText, Image, Upload, Clock, Check, CheckCheck, AlertCircle, Search, Filter, Calendar, User, MessageSquare } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import Lottie from "lottie-react";
import { sendChat } from "@/lib/api";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { fetchCitation } from "@/lib/api";
import { InlineError } from "@/components/ui/error-display";
import { FloatingNewChatButton } from "@/components/NewChatButton";
import { NetworkIndicator } from "@/components/NetworkStatus";
import { supabase } from "@/lib/api";
import { EnhancedMarkdownRenderer } from '@/components/ui/enhanced-markdown-renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Info, Loader2 } from 'lucide-react';
import { ReportDisplay } from '@/components/ui/report-display';
import { EnhancedReportViewer } from '@/components/ui/enhanced-report-viewer';
import { ChatReportViewer } from '@/components/ui/chat-report-viewer';
import { ReportLink } from '@/components/ui/report-link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Citation, transformChunksToCitations, parseContentToSegments, EnhancedContent } from '@/types/citation';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from "@/hooks/use-toast";
import type { Database } from '@/lib/database.types';

// Define proper types using the correct database schema
type DatabaseMessage = Database['public']['Tables']['chat_messages']['Row'];

interface CitationData {
  title?: string;
  content?: string;
  source?: string;
  page?: number;
}

interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
  uploadProgress?: number;
  uploadedUrl?: string;
}

interface SearchResult {
  message: Message;
  sessionId: string;
  sessionTitle?: string;
  matchType: 'content' | 'timestamp';
  relevanceScore: number;
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
  feedback?: 'like' | 'dislike' | null;
  status?: 'sending' | 'delivered' | 'read' | 'failed';
}

interface ChatStreamProps {
  sessionId: string;
  notebookId?: string;
  onNewSession?: (sessionId: string) => void;
  onCitationClick?: (citation: Citation) => void;
}

interface ReportFallbackData {
  topic?: string;
  title?: string;
  address?: string;
  action?: string;
}

// Function to fetch report content from database - Fixed to use robust getReportContent
const fetchReportContent = async (reportId: string): Promise<{ content: string; metadata: Record<string, unknown> } | null> => {
  try {
    console.log('🔄 Fetching report content for ID:', reportId);
    
    // Get current user for security check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ User authentication required to fetch reports');
      throw new Error('Authentication required');
    }
    
    // First get the report metadata
    const { data: reportMeta, error: metaError } = await supabase
      .from('report_generations')
      .select('title, topic, address, file_format, metadata, user_id')
      .eq('id', reportId)
      .eq('user_id', user.id) // Explicit user filtering for security
      .single();

    if (metaError) {
      console.error('❌ Error fetching report metadata:', metaError);
      throw metaError;
    }

    if (!reportMeta) {
      console.warn('⚠️ No report found with ID:', reportId);
      return null;
    }

    console.log('✅ Report metadata fetched:', {
      title: reportMeta.title,
      hasMetadata: !!reportMeta.metadata
    });

    // Use the robust getReportContent function that ReportsPanel uses
    const { getReportContent } = await import('@/lib/api');
    const content = await getReportContent(reportId);
    
    console.log('✅ Report content fetched successfully:', {
      contentLength: content.length,
      preview: content.substring(0, 100) + '...'
    });
    
    return {
      content,
      metadata: {
        title: reportMeta.title,
        topic: reportMeta.topic,
        address: reportMeta.address,
        file_format: reportMeta.file_format,
        ...(reportMeta.metadata as Record<string, unknown> || {})
      }
    };
  } catch (error) {
    console.error('❌ Failed to fetch report content:', error);
    return null;
  }
};

// Component to handle async report rendering
const AsyncReportRenderer: React.FC<{ 
  reportId: string; 
  fallbackData: ReportFallbackData; 
}> = ({ reportId, fallbackData }) => {
  const [reportData, setReportData] = useState<{ content: string; metadata: Record<string, unknown> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchReportContent(reportId);
      
      if (data) {
        setReportData(data);
      } else {
        setError('Failed to load report content');
      }
      
      setIsLoading(false);
    };

    if (reportId) {
      loadReport();
    }
  }, [reportId]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Loading report...</p>
              <p className="text-sm text-muted-foreground">Fetching content from database</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !reportData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'No report content available'}
        </AlertDescription>
      </Alert>
    );
  }

  const { content, metadata } = reportData;

  if (!content || !content.trim()) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Report content is empty or still being generated.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ChatReportViewer
      title={(metadata.title as string) || fallbackData.topic || 'Planning Report'}
      topic={(metadata.topic as string) || fallbackData.topic || 'Planning Report'}
      address={(metadata.address as string) || fallbackData.address}
      content={content}
      metadata={{
        created_at: new Date().toISOString(),
        file_format: metadata.file_format,
        ...metadata
      }}
      onDownload={() => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${((metadata.title as string) || 'report').replace(/\s+/g, '-').toLowerCase()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }}
      onPrint={() => window.print()}
      onShare={async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: (metadata.title as string) || 'Planning Report',
              text: `Planning Report: ${(metadata.title as string)}`,
              url: window.location.href,
            });
          } catch (err) {
            console.log('Error sharing:', err);
          }
        }
      }}
    />
  );
};

/**
 * Enhanced content renderer with template-style citations
 */
const renderMessageContent = (message: Message, onCitationClick?: (citation: Citation) => void): JSX.Element => {
  return renderMessageContentInternal(message.content, message.metadata, onCitationClick);
};

const renderMessageContentInternal = (content: unknown, metadata?: Record<string, unknown>, onCitationClick?: (citation: Citation) => void): JSX.Element => {
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

      // Handle action:none messages
      if (content.trim() === '{"action":"none"}') {
        return (
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="text-primary">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">No action required</p>
              <p className="text-sm text-muted-foreground">I understand your message but no specific action is needed.</p>
            </div>
          </div>
        );
      }

            // Only try to parse as JSON if it looks like JSON (starts with { or [)
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(content);
          console.log('🔍 Parsed JSON content:', parsed);
          
          // FIXED: Handle multiple report action types
          if (parsed && typeof parsed === 'object' && 
              (parsed.action === 'report' || parsed.action === 'change_report' || parsed.action === 'generate_report')) {
            
            console.log('📊 Report detected with action:', parsed.action);
            console.log('📊 Report data fields:', Object.keys(parsed));
            
            // Extract content from various possible fields
            const reportContent = parsed.response_markdown || 
                                 parsed.markdown || 
                                 parsed.content || 
                                 parsed.generated_content ||
                                 parsed.response ||
                                 '';
            
            console.log('📊 Markdown content available:', !!reportContent);
            console.log('📊 Content length:', reportContent?.length || 0);
            console.log('📊 Sample content preview:', reportContent ? reportContent.substring(0, 200) + '...' : 'No content');
            
            // If we have direct content, use EnhancedReportViewer
            if (reportContent && reportContent.trim()) {
              console.log('✅ Using EnhancedReportViewer with direct content');
                          return (
              <ChatReportViewer
                title={parsed.topic || parsed.title || 'Planning Report'}
                topic={parsed.topic || parsed.title || 'Planning Report'}
                address={parsed.address || parsed.location}
                content={reportContent}
                metadata={{
                  created_at: new Date().toISOString(),
                  sections: parsed.sections,
                  reportId: (parsed.id || parsed.report_id) as string,
                  ...parsed.metadata
                }}
                onDownload={() => {
                  const blob = new Blob([reportContent], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${(parsed.topic || 'report').replace(/\s+/g, '-').toLowerCase()}.md`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                onPrint={() => window.print()}
                onShare={async () => {
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: parsed.topic || 'Planning Report',
                        text: `Planning Report: ${parsed.topic}`,
                        url: window.location.href,
                      });
                    } catch (err) {
                      console.log('Error sharing:', err);
                    }
                  }
                }}
              />
            );
            } else {
              // Check if we have a report ID to fetch content from database
              const reportIdFromMetadata = metadata?.report_id || (metadata?.id as string);
              const reportId = (parsed.id || parsed.report_id || reportIdFromMetadata) as string;
              
              // Enhanced debugging for report ID extraction
              console.log('🔍 Report ID extraction debug:', {
                'parsed.id': parsed.id,
                'parsed.report_id': parsed.report_id,
                'metadata?.report_id': metadata?.report_id,
                'metadata?.id': metadata?.id,
                'final reportId': reportId,
                'has reportId': !!reportId
              });
              
              if (reportId) {
                console.log('🔄 No direct content, using AsyncReportRenderer with ID:', reportId);
                return (
                  <AsyncReportRenderer
                    reportId={reportId}
                    fallbackData={{
                      topic: parsed.topic || parsed.title || 'Planning Report',
                      title: parsed.title || parsed.topic || 'Planning Report',
                      address: parsed.address || parsed.location,
                      action: parsed.action
                    }}
                  />
                );
                        } else {
            // Final fallback to ReportLink - shows a link to open in Reports Panel
            console.log('⚠️ No direct content and no report ID, showing report link');
                         return (
               <ReportLink
                 title={parsed.topic || parsed.title || 'Planning Report'}
                 topic={parsed.topic || parsed.title || 'Planning Report'}
                 address={parsed.address || parsed.location}
                 status="generated"
                 createdAt={new Date().toISOString()}
                 onOpenReport={() => {
                   console.log('Report available in Reports Panel');
                   // For now, just provide guidance to the user
                   // In the future, this could trigger a tab switch or panel highlight
                 }}
               />
             );
          }
            }
          }
        } catch (error) {
          // Only log JSON parsing errors if we expected JSON (silently fail for regular text)
          console.warn('⚠️ Content looked like JSON but failed to parse:', error.message);
          // Continue with normal string processing
        }
      }

      // Check if we have citation data from chunks_retrieved
      const chunksRetrieved = (metadata?.chunks_retrieved as unknown[]) || [];
      const sourcesCited = (metadata?.sources_cited as unknown[]) || [];
      
      // Check if content has citations and we have chunk data
      const hasCitations = /(?:Chunk \d+|Chunk #\d+|Citation \d+|Source \d+|\[\d+\])/i.test(content) && 
                          (chunksRetrieved.length > 0 || sourcesCited.length > 0);
      
      if (hasCitations && onCitationClick) {
        // Transform database chunks to citation format
        const citations = transformChunksToCitations(chunksRetrieved, sourcesCited);
        
        // Parse content into segments with citation references
        const segments = parseContentToSegments(content, citations);
        
        // Create enhanced content structure
        const enhancedContent: EnhancedContent = {
          segments,
          citations
        };
        
        return (
          <EnhancedMarkdownRenderer 
            content={enhancedContent}
            onCitationClick={onCitationClick}
            className="citation-content"
          />
        );
      }
      
      // Check if content looks like markdown
      const hasMarkdown = /^#\s|^##\s|^###\s|^\*\*.*\*\*|^\*.*\*|^- |^\d+\.|^```/.test(content);
      
      if (hasMarkdown) {
        return <EnhancedMarkdownRenderer content={content} onCitationClick={onCitationClick} />;
      }

      // Fallback: Process simple citation chips like [1], [2], etc. (for backward compatibility)
      const citationRegex = /\[(\d+)\]/g;
      const parts = content.split(citationRegex);
      
      if (parts.length > 1) {
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
      
      // Return plain content if no citations or markdown detected
      return <span>{content}</span>;
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
                  {renderMessageContentInternal(item, metadata, onCitationClick)}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // Handle objects
      const obj = content as Record<string, unknown>;
      
      // FIXED: Check for multiple report action types
      if ((obj.action === 'report' || obj.action === 'change_report' || obj.action === 'generate_report') && 
          typeof obj.topic === 'string') {
        
        console.log('📊 Object-based report detected with action:', obj.action);
        console.log('📊 Object report data fields:', Object.keys(obj));
        
        // Extract content from various possible fields
        const reportContent = (obj.response_markdown || 
                              obj.markdown || 
                              obj.content || 
                              obj.generated_content ||
                              obj.response ||
                              '') as string;
        
        console.log('📊 Object markdown content available:', !!reportContent);
        console.log('📊 Content length:', reportContent?.length || 0);
        console.log('📊 Object sample content preview:', reportContent ? reportContent.substring(0, 200) + '...' : 'No content');
        
        // If we have direct content, use ChatReportViewer with citation support
        if (reportContent && reportContent.trim()) {
          console.log('✅ Using ChatReportViewer with direct object content');
          return (
            <ChatReportViewer
              title={(obj.topic || obj.title || 'Planning Report') as string}
              topic={(obj.topic || obj.title || 'Planning Report') as string}
              address={(obj.address || obj.location) as string}
              content={reportContent}
              metadata={{
                created_at: new Date().toISOString(),
                sections: obj.sections,
                reportId: (obj.id || obj.report_id) as string,
                chunks_retrieved: metadata?.chunks_retrieved,
                sources_cited: metadata?.sources_cited,
                ...obj.metadata as Record<string, unknown>
              }}
              onDownload={() => {
                const blob = new Blob([reportContent], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${((obj.topic || 'report') as string).replace(/\s+/g, '-').toLowerCase()}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              onPrint={() => window.print()}
              onShare={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: (obj.topic || 'Planning Report') as string,
                      text: `Planning Report: ${obj.topic}`,
                      url: window.location.href,
                    });
                  } catch (err) {
                    console.log('Error sharing:', err);
                  }
                }
              }}
            />
          );
        } else {
          // Check if we have a report ID to fetch content from database
          const reportIdFromMetadata = metadata?.report_id || (metadata?.id as string);
          const reportId = (obj.id || obj.report_id || reportIdFromMetadata) as string;
          
          // Enhanced debugging for object-based report ID extraction
          console.log('🔍 Object report ID extraction debug:', {
            'obj.id': obj.id,
            'obj.report_id': obj.report_id,
            'metadata?.report_id': metadata?.report_id,
            'metadata?.id': metadata?.id,
            'final reportId': reportId,
            'has reportId': !!reportId
          });
          
          if (reportId) {
            console.log('🔄 No direct object content, using AsyncReportRenderer with ID:', reportId);
            return (
              <AsyncReportRenderer
                reportId={reportId}
                fallbackData={{
                  topic: (obj.topic || obj.title || 'Planning Report') as string,
                  title: (obj.title || obj.topic || 'Planning Report') as string,
                  address: (obj.address || obj.location) as string,
                  action: obj.action as string
                }}
              />
            );
          } else {
            // Final fallback to ReportLink - shows a link to open in Reports Panel
            console.log('⚠️ No direct object content and no report ID, showing report link');
                         return (
               <ReportLink
                 title={(obj.topic || obj.title || 'Planning Report') as string}
                 topic={(obj.topic || obj.title || 'Planning Report') as string}
                 address={(obj.address || obj.location) as string}
                 status="generated"
                 createdAt={new Date().toISOString()}
                 onOpenReport={() => {
                   console.log('Report available in Reports Panel');
                   // For now, just provide guidance to the user
                   // In the future, this could trigger a tab switch or panel highlight
                 }}
               />
             );
          }
        }
      }
      
      // Check for common response patterns from n8n
      if ('content' in obj && typeof obj.content === 'string') {
        return renderMessageContentInternal(obj.content, metadata, onCitationClick);
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
        return renderMessageContentInternal(obj.message, metadata, onCitationClick);
      }
      
      if ('response' in obj && typeof obj.response === 'string') {
        return renderMessageContentInternal(obj.response, metadata, onCitationClick);
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

export const ChatStream = ({ sessionId, notebookId, onNewSession, onCitationClick }: ChatStreamProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [citationData, setCitationData] = useState<Record<string, CitationData>>({});
  const [chatError, setChatError] = useState<string>("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    messageType: 'all' as 'all' | 'user' | 'assistant',
    dateRange: 'all' as 'all' | 'today' | 'week' | 'month',
    currentSessionOnly: false
  });
  const { handleAsyncError } = useErrorHandler();
  const { user, loading: authLoading, signIn } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: user 
        ? `Hello${user.email ? ` ${user.email.split('@')[0]}` : ''}! How can I assist you with your town planning needs today? I can help you with zoning regulations, permit applications, and more.`
        : "Hello! Please sign in to start chatting about your town planning needs. I can help you with zoning regulations, permit applications, and more.",
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

  // Update welcome message when auth state changes
  useEffect(() => {
    setMessages(prev => [
      {
        ...prev[0],
        content: user 
          ? `Hello${user.email ? ` ${user.email.split('@')[0]}` : ''}! How can I assist you with your town planning needs today? I can help you with zoning regulations, permit applications, and more.`
          : "Hello! Please sign in to start chatting about your town planning needs. I can help you with zoning regulations, permit applications, and more."
      },
      ...prev.slice(1)
    ]);
  }, [user]);

  // Load chat history from database
  useEffect(() => {
    let isCancelled = false;
    
    const loadChatHistory = async () => {
      try {
        console.log('Loading chat history for session:', sessionId);
        
        const { data: chatMessages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading chat history:', error);
          throw error;
        }

        if (isCancelled) return; // Prevent setting state if component unmounted or sessionId changed

        if (chatMessages && chatMessages.length > 0) {
          console.log('Loaded chat messages:', chatMessages);
          const formattedMessages: Message[] = chatMessages.map((msg: DatabaseMessage) => ({
            id: msg.id,
            type: msg.role as 'user' | 'assistant',
            content: msg.message,
            timestamp: msg.created_at || new Date().toISOString(),
            metadata: msg.retrieval_metadata as Record<string, unknown> | undefined
          }));

          // Reset messages to welcome message plus loaded history (prevents duplicates)
          setMessages(prev => {
            const welcomeMessage = prev[0];
            return [welcomeMessage, ...formattedMessages];
          });
        } else {
          // No chat history, just keep welcome message
          setMessages(prev => [prev[0]]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        if (!isCancelled) {
          // Reset to just welcome message on error
          setMessages(prev => [prev[0]]);
        }
      }
    };

    if (sessionId) {
      loadChatHistory();
    }

    return () => {
      isCancelled = true;
    };
  }, [sessionId]);

  // Real-time subscription for new messages with enhanced debugging
  useEffect(() => {
    if (!sessionId) return;

    console.log('🔄 Setting up real-time subscription for session:', sessionId);

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
          console.log('📨 Real-time message received:', payload);
          const newMessage = payload.new as DatabaseMessage;
          
          // Enhanced debugging
          console.log('📋 New message details:', {
            id: newMessage.id,
            role: newMessage.role,
            content: newMessage.message?.substring(0, 100) + '...',
            created_at: newMessage.created_at
          });
          
          setMessages(prev => {
            // More robust duplicate checking
            const exists = prev.some(msg => {
              // Check by ID (primary)
              if (msg.id === newMessage.id) return true;
              
              // Check by content and timestamp (secondary, for edge cases)
              if (msg.content === newMessage.message && 
                  msg.type === newMessage.role &&
                  Math.abs(new Date(msg.timestamp || 0).getTime() - new Date(newMessage.created_at).getTime()) < 5000) {
                console.log('⚠️ Duplicate detected by content/timestamp, skipping:', newMessage.id);
                return true;
              }
              
              return false;
            });
            
            if (exists) {
              console.log('⏭️ Message already exists, skipping:', newMessage.id);
              return prev;
            }
            
            console.log('✅ Adding new message from real-time:', newMessage.id);
            
            // Create new message with correct field mapping
            const newMsg: Message = {
              id: newMessage.id,
              type: newMessage.role as 'user' | 'assistant',
              content: newMessage.message,
              timestamp: newMessage.created_at || new Date().toISOString(),
              metadata: newMessage.retrieval_metadata as Record<string, unknown> | undefined
            };
            
            // Sort messages by timestamp to ensure correct order
            const updatedMessages = [...prev, newMsg].sort((a, b) => {
              const timeA = new Date(a.timestamp || 0).getTime();
              const timeB = new Date(b.timestamp || 0).getTime();
              return timeA - timeB;
            });
            
            return updatedMessages;
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active for session:', sessionId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription failed for session:', sessionId);
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from real-time for session:', sessionId);
      subscription.unsubscribe();
    };
  }, [sessionId]);

  // Enhanced debugging to track message state changes
  useEffect(() => {
    console.log('📋 Current messages state:', {
      count: messages.length,
      messages: messages.map(m => ({ 
        id: m.id, 
        type: m.type, 
        content: typeof m.content === 'string' ? m.content.substring(0, 50) + '...' : '[Object]',
        timestamp: m.timestamp 
      }))
    });
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

  // File Handling Functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not supported. Please upload PDF, DOC, DOCX, TXT, or image files.`,
          variant: "destructive",
        });
        return false;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is too large. Maximum file size is 10MB.`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    const newAttachedFiles: AttachedFile[] = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      file,
      uploadProgress: 0
    }));

    // Generate previews for images
    newAttachedFiles.forEach(attachedFile => {
      if (attachedFile.file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachedFiles(prev => prev.map(f => 
            f.id === attachedFile.id 
              ? { ...f, preview: e.target?.result as string }
              : f
          ));
        };
        reader.readAsDataURL(attachedFile.file);
      }
    });

    setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
    
    if (validFiles.length > 0) {
      toast({
        title: "Files attached",
        description: `${validFiles.length} file(s) ready to upload with your message.`,
      });
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFile = async (attachedFile: AttachedFile): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Simulate file upload with progress
      const uploadInterval = setInterval(() => {
        setAttachedFiles(prev => prev.map(f => 
          f.id === attachedFile.id 
            ? { ...f, uploadProgress: Math.min((f.uploadProgress || 0) + 10, 90) }
            : f
        ));
      }, 100);

      // Simulate upload completion after 2 seconds
      setTimeout(() => {
        clearInterval(uploadInterval);
        
        // In a real implementation, you would upload to your storage service
        // For now, we'll simulate success
        const mockUrl = `https://storage.example.com/uploads/${attachedFile.file.name}`;
        
        setAttachedFiles(prev => prev.map(f => 
          f.id === attachedFile.id 
            ? { ...f, uploadProgress: 100, uploadedUrl: mockUrl }
            : f
        ));
        
        resolve(mockUrl);
      }, 2000);
    });
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  // Updated send function to handle file uploads
  const handleSend = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;
    
    // Check authentication first
    if (!user) {
      setChatError("Please sign in to start chatting");
      return;
    }
    
    setChatError("");
    const messageContent = inputValue.trim();
    
    // Upload files first if any
    let uploadedFileUrls: string[] = [];
    if (attachedFiles.length > 0) {
      try {
        setIsLoading(true);
        
        // Show upload progress
        toast({
          title: "Uploading files...",
          description: `Uploading ${attachedFiles.length} file(s) before sending message.`,
        });

        uploadedFileUrls = await Promise.all(
          attachedFiles.map(file => uploadFile(file))
        );
        
        toast({
          title: "Files uploaded",
          description: "All files uploaded successfully.",
        });
        
      } catch (error) {
        console.error('File upload error:', error);
        toast({
          title: "Upload failed",
          description: "Failed to upload files. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }
    
    // Create message content with file references
    let fullMessageContent = messageContent;
    if (uploadedFileUrls.length > 0) {
      const fileReferences = uploadedFileUrls.map((url, index) => 
        `[Attached file ${index + 1}: ${attachedFiles[index].file.name}](${url})`
      ).join('\n');
      
      fullMessageContent = messageContent + 
        (messageContent ? '\n\n' : '') + 
        'Attached files:\n' + fileReferences;
    }
    
    // Don't add user message locally - let real-time subscription handle it
    // This prevents duplicate messages
    setIsLoading(true);
    setInputValue('');
    setAttachedFiles([]); // Clear attached files after sending
    
    // Add thinking message with animation
    const thinkingMessage: Message = {
      id: `thinking-${Date.now()}`,
      type: "assistant",
      content: "thinking",
      timestamp: new Date().toISOString()
    };
    setMessages(m => [...m, thinkingMessage]);
    console.log('💭 Added thinking indicator');
    
    try {
      console.log('Sending chat message with files...');

      const res = await handleAsyncError(
        () => sendChat(sessionId, fullMessageContent),
        { operation: 'send_chat_message', sessionId, messageLength: fullMessageContent.length, fileCount: uploadedFileUrls.length }
      );
      
      console.log('Chat response received:', res);
      
      // Remove thinking message immediately
      setMessages(m => {
        const filtered = m.filter(msg => msg.content !== "thinking");
        console.log('🗑️ Removed thinking indicator');
        return filtered;
      });
      
      // Handle the AI response - don't add it locally, let real-time subscription handle it
      // The real-time subscription will automatically add the assistant message from the database
      console.log('✅ Chat message sent successfully, waiting for real-time response');
      
    } catch (error) {
      console.error('Chat error:', error);
      setChatError(error.message || 'Failed to send message');
      
      setMessages(m => {
        const withoutThinking = m.filter(msg => msg.content !== "thinking");
        console.log('🗑️ Removed thinking indicator due to error');
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

  // Manual refresh function for debugging - Enhanced to prevent duplicates
  const handleManualRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    try {
      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error in manual refresh:', error);
        return;
      }

      console.log('📊 Manual refresh - found messages:', chatMessages?.length || 0);
      
      if (chatMessages && chatMessages.length > 0) {
        const formattedMessages: Message[] = chatMessages.map((msg: DatabaseMessage) => ({
          id: msg.id,
          type: msg.role as 'user' | 'assistant',
          content: msg.message,
          timestamp: msg.created_at || new Date().toISOString(),
          metadata: msg.retrieval_metadata as Record<string, unknown> | undefined
        }));

        // Complete refresh approach - replace all non-welcome messages with database data
        setMessages(prev => {
          const welcomeMessage = prev[0];
          
          // Sort database messages by timestamp
          const sortedMessages = formattedMessages.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeA - timeB;
          });
          
          console.log('✅ Manual refresh complete - refreshed', sortedMessages.length, 'messages');
          return [welcomeMessage, ...sortedMessages];
        });
      } else {
        // No messages in database, just keep welcome message
        setMessages(prev => [prev[0]]);
        console.log('📭 No messages found, keeping only welcome message');
      }
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      toast({
        title: "Refresh failed",
        description: "Failed to refresh messages. Please try again.",
        variant: "destructive",
      });
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

  // Enhanced thinking animation component with swapping emojis
  const ThinkingAnimation = () => {
    const [currentEmoji, setCurrentEmoji] = useState(0);
    const thinkingEmojis = ['🤔', '💭', '🧠', '⚡', '🔍', '📋'];
    
    useEffect(() => {
      const interval = setInterval(() => {
        setCurrentEmoji(prev => (prev + 1) % thinkingEmojis.length);
      }, 800); // Change emoji every 800ms

      return () => clearInterval(interval);
    }, [thinkingEmojis.length]);

    return (
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {/* Animated emoji */}
          <div className="text-2xl animate-pulse">
            {thinkingEmojis[currentEmoji]}
          </div>
          
          {/* Animated dots */}
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>

          {/* Backup Lottie animation if available */}
          {thinkingAnimation && (
            <Lottie 
              animationData={thinkingAnimation} 
              loop={true}
              style={{ width: 40, height: 20 }}
            />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">Town Planner Assistant is thinking...</p>
          <p className="text-sm text-muted-foreground">Analyzing your documents and generating a response</p>
        </div>
      </div>
    );
  };

  // Message Actions Functions
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
      toast({
        title: "Copied to clipboard",
        description: "Message content has been copied to your clipboard.",
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy failed",
        description: "Failed to copy message to clipboard.",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    try {
      // Find the user message that preceded this assistant message
      const currentIndex = messages.findIndex(m => m.id === messageId);
      if (currentIndex <= 0) return;
      
      // Find the most recent user message before this assistant message
      let userMessageIndex = currentIndex - 1;
      while (userMessageIndex >= 0 && messages[userMessageIndex].type !== 'user') {
        userMessageIndex--;
      }
      
      if (userMessageIndex < 0 || messages[userMessageIndex].type !== 'user') {
        toast({
          title: "Cannot regenerate",
          description: "No user message found to regenerate from.",
          variant: "destructive",
        });
        return;
      }

      const userMessage = messages[userMessageIndex];
      
      // Remove all messages after the user message
      setMessages(prev => prev.slice(0, userMessageIndex + 1));
      
      // Add thinking indicator
      const thinkingMessage: Message = {
        id: `thinking-regen-${Date.now()}`,
        type: "assistant",
        content: "thinking",
        timestamp: new Date().toISOString()
      };
      setMessages(m => [...m, thinkingMessage]);
      setIsLoading(true);

      // Update the original user message status to show it's being reprocessed
      updateMessageStatus(userMessage.id, 'sending');

      // Send the user message again
      const res = await handleAsyncError(
        () => sendChat(sessionId, userMessage.content),
        { operation: 'regenerate_message', sessionId, originalMessageId: messageId }
      );
      
      // Update status to read when regeneration is complete
      updateMessageStatus(userMessage.id, 'read');
      
      // Remove thinking message
      setMessages(m => {
        const filtered = m.filter(msg => msg.content !== "thinking");
        console.log('🗑️ Removed thinking indicator after regeneration');
        return filtered;
      });
      
      toast({
        title: "Message regenerated",
        description: "A new response has been generated.",
        duration: 2000,
      });
      
    } catch (error) {
      console.error('Regenerate error:', error);
      setMessages(m => {
        const filtered = m.filter(msg => msg.content !== "thinking");
        console.log('🗑️ Removed thinking indicator due to regeneration error');
        return filtered;
      });
      toast({
        title: "Regeneration failed",
        description: "Failed to regenerate the message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    try {
      // Update local state immediately for responsiveness
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
          : msg
      ));

      // Here you would typically send feedback to your analytics/feedback system
      // For now, we'll just store it locally and show a toast
      
      const updatedFeedback = messages.find(m => m.id === messageId)?.feedback === feedback ? null : feedback;
      
      toast({
        title: updatedFeedback ? `Feedback recorded` : "Feedback removed",
        description: updatedFeedback 
          ? `You ${updatedFeedback === 'like' ? 'liked' : 'disliked'} this message.`
          : "Your feedback has been removed.",
        duration: 2000,
      });
      
      // TODO: Send to analytics/feedback API
      console.log('Message feedback:', { messageId, feedback: updatedFeedback });
      
    } catch (error) {
      console.error('Feedback error:', error);
      // Revert the local state change on error
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, feedback: msg.feedback }
          : msg
      ));
      
      toast({
        title: "Feedback failed",
        description: "Failed to record feedback. Please try again.",
        variant: "destructive",
      });
    }
  };

  // File icon helper
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  // Message Status Indicator Component
  const MessageStatusIndicator = ({ status, timestamp }: { status?: string; timestamp?: string }) => {
    if (!status) return null;

    const statusConfig = {
      sending: {
        icon: <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />,
        text: "Sending...",
        color: "text-muted-foreground"
      },
      delivered: {
        icon: <Check className="h-3 w-3 text-muted-foreground" />,
        text: "Delivered",
        color: "text-muted-foreground"
      },
      read: {
        icon: <CheckCheck className="h-3 w-3 text-blue-500" />,
        text: "Read",
        color: "text-blue-500"
      },
      failed: {
        icon: <AlertCircle className="h-3 w-3 text-destructive" />,
        text: "Failed to send",
        color: "text-destructive"
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <div className={`flex items-center gap-1 text-xs ${config.color}`} title={config.text}>
        {config.icon}
        {timestamp && (
          <span>{new Date(timestamp).toLocaleTimeString()}</span>
        )}
      </div>
    );
  };

  // Update message status
  const updateMessageStatus = (messageId: string, status: Message['status']) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, status } : msg
    ));
  };



  // Chat History Search Functions
  const searchChatHistory = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching chat history for:', query);
      
      // Build the search query for Supabase
      let supabaseQuery = supabase
        .from('chat_messages')
        .select(`
          *,
          chat_sessions!inner (
            id,
            title,
            user_id
          )
        `)
        .eq('chat_sessions.user_id', user?.id)
        .ilike('message', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply filters
      if (searchFilters.messageType !== 'all') {
        supabaseQuery = supabaseQuery.eq('role', searchFilters.messageType);
      }

      if (searchFilters.currentSessionOnly) {
        supabaseQuery = supabaseQuery.eq('session_id', sessionId);
      }

      if (searchFilters.dateRange !== 'all') {
        const now = new Date();
        const dateThreshold = new Date();
        
        switch (searchFilters.dateRange) {
          case 'today':
            dateThreshold.setHours(0, 0, 0, 0);
            break;
          case 'week':
            dateThreshold.setDate(now.getDate() - 7);
            break;
          case 'month':
            dateThreshold.setMonth(now.getMonth() - 1);
            break;
        }
        
        supabaseQuery = supabaseQuery.gte('created_at', dateThreshold.toISOString());
      }

      const { data: chatMessages, error } = await supabaseQuery;

      if (error) {
        console.error('Search error:', error);
        throw error;
      }

      // Process and rank results
      const results: SearchResult[] = (chatMessages || []).map((msg: DatabaseMessage & { chat_sessions?: { id: string; title?: string; user_id: string } }) => {
        const content = msg.message?.toLowerCase() || '';
        const queryLower = query.toLowerCase();
        
        // Calculate relevance score
        let relevanceScore = 0;
        
        // Exact match gets highest score
        if (content.includes(queryLower)) {
          relevanceScore += 10;
        }
        
        // Word matches
        const queryWords = queryLower.split(' ');
        queryWords.forEach(word => {
          if (content.includes(word)) {
            relevanceScore += 3;
          }
        });
        
        // Recent messages get slight boost
        const messageAge = Date.now() - new Date(msg.created_at).getTime();
        const daysSinceMessage = messageAge / (1000 * 60 * 60 * 24);
        if (daysSinceMessage < 7) {
          relevanceScore += 2;
        }

        return {
          message: {
            id: msg.id,
            type: msg.role as 'user' | 'assistant',
            content: msg.message,
            timestamp: msg.created_at,
            metadata: msg.retrieval_metadata as Record<string, unknown> | undefined
          },
          sessionId: msg.session_id,
          sessionTitle: msg.chat_sessions?.title || 'Untitled Chat',
          matchType: 'content' as const,
          relevanceScore
        };
      });

      // Sort by relevance
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      setSearchResults(results);
      
      toast({
        title: "Search complete",
        description: `Found ${results.length} message(s) matching "${query}"`,
        duration: 2000,
      });
      
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Search failed",
        description: "Failed to search chat history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [user?.id, sessionId, searchFilters]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchChatHistory(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchFilters, searchChatHistory]);

  // Highlight search terms in text
  const highlightSearchTerms = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? `<mark key="${index}" class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">${part}</mark>`
        : part
    ).join('');
  };

  // Navigate to a specific message/session
  const navigateToMessage = (result: SearchResult) => {
    if (result.sessionId !== sessionId && onNewSession) {
      // Switch to the session containing the message
      onNewSession(result.sessionId);
      
      toast({
        title: "Switched session",
        description: `Navigated to "${result.sessionTitle}"`,
        duration: 2000,
      });
    }
    
    setIsSearchOpen(false);
    setSearchQuery("");
  };

      return (
      <ComponentErrorBoundary>
        <div className="flex-1 flex flex-col bg-background h-full">
          {/* Search and Action Header */}
          <div className="flex items-center justify-between p-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {/* Search Chat History */}
              {user && (
                <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Search className="h-4 w-4" />
                      Search History
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                      <SheetTitle>Search Chat History</SheetTitle>
                      <SheetDescription>
                        Find messages from your previous conversations
                      </SheetDescription>
                    </SheetHeader>
                    
                    <div className="space-y-4 mt-6">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search messages..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                        {isSearching && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          </div>
                        )}
                      </div>

                      {/* Search Filters */}
                      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          <span className="text-sm font-medium">Filters</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Message Type</label>
                            <Select 
                              value={searchFilters.messageType} 
                              onValueChange={(value: 'all' | 'user' | 'assistant') => setSearchFilters(prev => ({ ...prev, messageType: value }))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Messages</SelectItem>
                                <SelectItem value="user">My Messages</SelectItem>
                                <SelectItem value="assistant">AI Responses</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-xs text-muted-foreground">Date Range</label>
                            <Select 
                              value={searchFilters.dateRange} 
                              onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setSearchFilters(prev => ({ ...prev, dateRange: value }))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="week">This Week</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="current-session"
                            checked={searchFilters.currentSessionOnly}
                            onCheckedChange={(checked) => 
                              setSearchFilters(prev => ({ ...prev, currentSessionOnly: !!checked }))
                            }
                          />
                          <label htmlFor="current-session" className="text-xs">
                            Search current conversation only
                          </label>
                        </div>
                      </div>

                      {/* Search Results */}
                      <div className="flex-1">
                        {searchQuery.trim() && !isSearching && (
                          <div className="mb-3 text-sm text-muted-foreground">
                            {searchResults.length} result(s) found
                          </div>
                        )}
                        
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-3">
                            {searchResults.map((result, index) => (
                              <Card 
                                key={`${result.message.id}-${index}`} 
                                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => navigateToMessage(result)}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {result.message.type === 'user' ? (
                                        <User className="h-3 w-3 text-blue-500" />
                                      ) : (
                                        <MessageSquare className="h-3 w-3 text-green-500" />
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {result.sessionTitle}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(result.message.timestamp || '').toLocaleDateString()}
                                    </div>
                                  </div>
                                  
                                  <div className="text-sm">
                                    <div 
                                      dangerouslySetInnerHTML={{ 
                                        __html: highlightSearchTerms(
                                          result.message.content.substring(0, 150) + 
                                          (result.message.content.length > 150 ? '...' : ''),
                                          searchQuery
                                        )
                                      }}
                                    />
                                  </div>
                                  
                                  <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className="text-xs">
                                      {result.message.type === 'user' ? 'Your message' : 'AI response'}
                                    </Badge>
                                    <div className="text-xs text-muted-foreground">
                                      Relevance: {result.relevanceScore}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                            
                            {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                              <div className="text-center text-muted-foreground py-8">
                                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No messages found</p>
                                <p className="text-xs">Try adjusting your search terms or filters</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>

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
              
              <div className="max-w-[80%] space-y-2">
                <div
                  className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-chat-user text-primary-foreground'
                      : 'bg-chat-assistant text-foreground'
                  }`}
                >
                  <div className="text-sm leading-relaxed">
                    {message.content === "thinking" && message.type === 'assistant' ? (
                      <ThinkingAnimation />
                    ) : (
                      renderMessageContent(message, onCitationClick)
                    )}
                  </div>
                  
                  {/* Message timestamp and status */}
                  <div className="flex items-center justify-between mt-1">
                    {message.timestamp && (
                      <div className="text-xs text-muted-foreground opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                    
                    {/* Status indicator for user messages */}
                    {message.type === 'user' && (
                      <MessageStatusIndicator 
                        status={message.status} 
                        timestamp={message.status === 'delivered' || message.status === 'read' ? message.timestamp : undefined}
                      />
                    )}
                  </div>
                </div>

                {/* Message Actions for Assistant Messages */}
                {message.type === 'assistant' && message.content !== "thinking" && !message.id.startsWith('1') && (
                  <div className="flex items-center gap-1 ml-2">
                    {/* Quick action buttons */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-muted"
                      onClick={() => handleCopyMessage(message.content)}
                      title="Copy message"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-muted"
                      onClick={() => handleRegenerateMessage(message.id)}
                      disabled={isLoading}
                      title="Regenerate response"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 hover:bg-muted ${message.feedback === 'like' ? 'text-green-600 bg-green-50' : ''}`}
                      onClick={() => handleMessageFeedback(message.id, 'like')}
                      title="Like this response"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 hover:bg-muted ${message.feedback === 'dislike' ? 'text-red-600 bg-red-50' : ''}`}
                      onClick={() => handleMessageFeedback(message.id, 'dislike')}
                      title="Dislike this response"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>

                    {/* More actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-muted"
                          title="More actions"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem onClick={() => handleCopyMessage(message.content)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy message
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleRegenerateMessage(message.id)}
                          disabled={isLoading}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Regenerate response
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          // TODO: Implement share functionality
                          toast({
                            title: "Share feature coming soon",
                            description: "Message sharing will be available in a future update.",
                          });
                        }}>
                          <Send className="h-4 w-4 mr-2" />
                          Share message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
        <div 
          className={`border-t p-4 ${isDragOver ? 'bg-muted/50 border-primary border-dashed' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag and Drop Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
              <div className="text-center">
                <Upload className="h-12 w-12 text-primary mx-auto mb-2" />
                <p className="text-lg font-medium text-primary">Drop files here to attach</p>
                <p className="text-sm text-muted-foreground">PDF, DOC, TXT, and images supported</p>
              </div>
            </div>
          )}

          {/* Chat Error Display */}
          {chatError && (
            <div className="mb-4">
              <InlineError message={chatError} />
            </div>
          )}

          {/* File Attachments Preview */}
          {attachedFiles.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-sm font-medium text-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attached Files ({attachedFiles.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {attachedFiles.map((attachedFile) => (
                  <Card key={attachedFile.id} className="p-3">
                    <div className="flex items-start gap-3">
                      {/* File Preview */}
                      <div className="flex-shrink-0">
                        {attachedFile.preview ? (
                          <img 
                            src={attachedFile.preview} 
                            alt={attachedFile.file.name}
                            className="w-12 h-12 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                            {getFileIcon(attachedFile.file.type)}
                          </div>
                        )}
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={attachedFile.file.name}>
                          {attachedFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(attachedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        
                        {/* Upload Progress */}
                        {typeof attachedFile.uploadProgress === 'number' && attachedFile.uploadProgress < 100 && (
                          <div className="mt-2">
                            <Progress value={attachedFile.uploadProgress} className="h-1" />
                            <p className="text-xs text-muted-foreground mt-1">
                              Uploading... {attachedFile.uploadProgress}%
                            </p>
                          </div>
                        )}
                        
                        {attachedFile.uploadProgress === 100 && (
                          <div className="flex items-center gap-1 mt-1">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-green-600">Uploaded</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeAttachedFile(attachedFile.id)}
                        title="Remove file"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
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
            
            {!user ? (
              // Authentication required UI
              <div className="flex-1 flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground flex-1">Please sign in to start chatting</span>
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/login'}
                  className="px-4"
                >
                  Sign In
                </Button>
              </div>
            ) : (
              // Authenticated chat UI
              <>
                {/* File Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                  disabled={isLoading}
                  title="Attach files"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                <Input
                  placeholder={attachedFiles.length > 0 ? "Add a message (optional)..." : "Ask about your documents..."}
                  className="flex-1"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
                <Button 
                  size="sm" 
                  className="px-6" 
                  disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)} 
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </>
            )}
          </div>

          {/* Hidden file input */}
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};