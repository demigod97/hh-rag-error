import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, MessageSquare, Plus, MoreHorizontal, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNewChatButton } from "@/components/NewChatButton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/api";
import { LoadingWithError } from "@/components/ui/error-display";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { useSessionManager } from "@/lib/session-management";
import { toast } from "@/hooks/use-toast";

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
  const { createNewSession } = useSessionManager();

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
      return (sessions || []).map((session): ChatSession => ({
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

  // Using createNewSession from useSessionManager to prevent duplication

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

  // Safe new session handler using sessionManager
  const handleNewSession = async () => {
    try {
      const newSessionId = await createNewSession(); // This uses useSessionManager's createNewSession
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

  // Delete single session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      // @ts-expect-error - Database function not in generated types yet
      const { error } = await supabase.rpc('delete_chat_session_cascade', {
        session_id: sessionId
      });

      if (error) {
        console.error('Error deleting session:', error);
        throw error;
      }

      // If we're deleting the current session, select a new one or create one
      if (currentSessionId === sessionId) {
        const remainingSessions = sessions?.filter(s => s.id !== sessionId) || [];
        if (remainingSessions.length > 0) {
          onSessionSelect(remainingSessions[0].id);
        } else {
          // Create a new session if no sessions remain
          const newSessionId = await createNewSession();
          if (newSessionId) {
            onSessionSelect(newSessionId);
          }
        }
      }

      // Refetch sessions to update the list
      refetch();
      
      toast({
        title: "Session deleted",
        description: "Chat session and all its messages have been deleted.",
      });

    } catch (error) {
      console.error('Failed to delete session:', error);
      toast({
        title: "Deletion failed",
        description: "Failed to delete chat session. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Delete all chat history
  const handleDeleteAllHistory = async () => {
    try {
      // @ts-expect-error - Database function not in generated types yet
      const { error } = await supabase.rpc('delete_all_user_chat_history');

      if (error) {
        console.error('Error deleting all chat history:', error);
        throw error;
      }

      // Create a new session since all were deleted
      const newSessionId = await createNewSession();
      if (newSessionId) {
        onSessionSelect(newSessionId);
      }

      // Refetch sessions to update the list
      refetch();
      
      toast({
        title: "All history deleted",
        description: "All chat sessions and messages have been deleted.",
      });

    } catch (error) {
      console.error('Failed to delete all chat history:', error);
      toast({
        title: "Deletion failed",
        description: "Failed to delete chat history. Please try again.",
        variant: "destructive",
      });
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
            <div className="flex items-center gap-2">
              <SidebarNewChatButton
                notebookId={undefined} // Will use default notebook
                onNewSession={(sessionId) => {
                  onSessionSelect(sessionId);
                  setOpen(false); // Close the drawer
                }}
                currentSessionId={currentSessionId}
                showConfirmation={true}
                size="sm"
                iconOnly={true}
                label="New Chat"
                className="h-8 w-8"
              />
              {sessions && sessions.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Clear all history">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Clear All Chat History
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all your chat sessions and messages. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteAllHistory}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All History
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
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
                      className={`group flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors ${
                        isCurrentSession ? 'bg-muted border-primary' : ''
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleSessionClick(session.id)}
                      >
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSessionClick(session.id);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Open Session
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Session
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Delete Chat Session
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{sessionTitle}" and all its messages. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteSession(session.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Session
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
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