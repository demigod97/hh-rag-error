import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNewChatButton } from "@/components/NewChatButton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/api";
import { LoadingWithError } from "@/components/ui/error-display";
import { useErrorHandler } from "@/hooks/useErrorHandler";

// Define proper TypeScript interfaces to prevent undefined errors
interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  total_messages: number;
  user_id: string;
  notebook_id: string | null;
  is_active: boolean;
}

interface HistoryDrawerProps {
  onSessionSelect: (sessionId: string) => void;
  currentSessionId?: string;
}

export function HistoryDrawer({ onSessionSelect, currentSessionId }: HistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const { handleAsyncError } = useErrorHandler();

  // Safe session fetching with proper error handling
  const getChatSessions = async (): Promise<ChatSession[]> => {
    return await handleAsyncError(async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User authentication required');
      }

      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at, updated_at, total_messages, user_id, notebook_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching chat sessions:', error);
        throw error;
      }

      // Ensure all required fields are present and properly typed
      return (sessions || []).map((session: any): ChatSession => ({
        id: session.id || '',
        title: session.title || null,
        created_at: session.created_at || new Date().toISOString(),
        updated_at: session.updated_at || new Date().toISOString(),
        total_messages: session.total_messages || 0,
        user_id: session.user_id || '',
        notebook_id: session.notebook_id || null,
        is_active: session.is_active !== false
      }));
    }, { operation: 'fetch_chat_sessions' });
  };

  const { data: sessions = [], isLoading, error, refetch } = useQuery({
    queryKey: ["chat_sessions"],
    queryFn: getChatSessions,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Add staleTime to prevent excessive refetching
    staleTime: 30000,
    // Add error boundary
    throwOnError: false
  });

  // Safe session creation with proper error handling
  const createNewSession = async (): Promise<string> => {
    return await handleAsyncError(async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User authentication required');
      }

      // Get or create default notebook
      let notebookId: string;
      const { data: notebooks, error: notebookError } = await supabase
        .from('notebooks')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (notebookError || !notebooks) {
        // Create default notebook
        const { data: newNotebook, error: createError } = await supabase
          .from('notebooks')
          .insert({
            user_id: user.id,
            name: 'Default Notebook',
            project_type: 'general',
            project_status: 'active'
          })
          .select('id')
          .single();

        if (createError) throw createError;
        notebookId = newNotebook.id;
      } else {
        notebookId = notebooks.id;
      }

      // Create new chat session
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          notebook_id: notebookId,
          title: `Chat - ${new Date().toLocaleString()}`,
          total_messages: 0,
          is_active: true
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      return session.id;
    }, { operation: 'create_new_session' });
  };

  // Safe session click handler with null checks
  const handleSessionClick = (sessionId: string | undefined) => {
    // Critical fix: Add null/undefined checks to prevent indexOf errors
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      console.error('Invalid session ID provided:', sessionId);
      return;
    }

    try {
      onSessionSelect(sessionId);
      setOpen(false);
    } catch (error) {
      console.error('Error selecting session:', error);
    }
  };

  // Safe new session handler
  const handleNewSession = async () => {
    try {
      const newSessionId = await createNewSession();
      if (newSessionId && typeof newSessionId === 'string') {
        onSessionSelect(newSessionId);
        setOpen(false);
        // Refetch sessions to update the list
        refetch();
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  // Safe session title rendering with fallbacks
  const getSessionTitle = (session: ChatSession): string => {
    // Critical fix: Ensure we never pass undefined to string operations
    if (!session) return 'Unknown Session';
    
    const title = session.title;
    if (title && typeof title === 'string' && title.trim() !== '') {
      return title;
    }
    
    // Fallback to date-based title
    try {
      const date = new Date(session.created_at || session.updated_at);
      return `Chat - ${date.toLocaleDateString()}`;
    } catch (dateError) {
      return 'Untitled Chat';
    }
  };

  // Safe date formatting with error handling
  const formatSessionDate = (session: ChatSession): string => {
    try {
      const dateStr = session.updated_at || session.created_at;
      if (!dateStr || typeof dateStr !== 'string') {
        return 'Unknown date';
      }
      
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Chat History
            <SidebarNewChatButton
              notebookId={undefined} // Will use default notebook
              onNewSession={(sessionId) => {
                onSessionSelect(sessionId);
                setOpen(false); // Close the drawer
              }}
              currentSessionId={currentSessionId}
              showConfirmation={true}
              variant="outline"
              size="sm"
              iconOnly={true}
              label="New Chat"
              className="h-8 w-8"
            />
          </SheetTitle>
        </SheetHeader>
        
        <LoadingWithError 
          isLoading={isLoading} 
          error={error} 
          retry={() => refetch()}
          fallbackMessage="Failed to load chat history"
        >
          <ScrollArea className="h-full mt-4">
            {!sessions || sessions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">No chat history</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleNewSession}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Start First Chat
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  // Critical fix: Validate session object before rendering
                  if (!session || !session.id) {
                    console.warn('Invalid session object:', session);
                    return null;
                  }

                  const sessionTitle = getSessionTitle(session);
                  const sessionDate = formatSessionDate(session);
                  const isCurrentSession = currentSessionId && session.id === currentSessionId;

                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                        isCurrentSession ? 'bg-muted border-primary' : ''
                      }`}
                      onClick={() => handleSessionClick(session.id)}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={sessionTitle}>
                          {sessionTitle}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{sessionDate}</span>
                          {session.total_messages > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {session.total_messages} msgs
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </LoadingWithError>
      </SheetContent>
    </Sheet>
  );
}