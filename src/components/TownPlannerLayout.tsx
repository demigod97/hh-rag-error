import { useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { ChatStream } from "./ChatStream";
import { ReportsPanel } from "./ReportsPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, FileText, Settings } from "lucide-react";
import { supabase } from "@/lib/api";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useSessionManager } from "@/lib/session-management";

interface TownPlannerLayoutProps {
  sessionId: string;
  notebookId?: string;
}

export const TownPlannerLayout = ({ sessionId, notebookId = "default" }: TownPlannerLayoutProps) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const { switchSession, createNewSession } = useSessionManager();

  // Real-time session updates
  useEffect(() => {
    if (!sessionId) return;

    const subscription = supabase
      .channel(`session-updates-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Session updated:', payload.new);
          // Handle session updates if needed
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId]);

  const handleSessionSelect = (newSessionId: string) => {
    switchSession(newSessionId).then((success) => {
      if (success) {
        setCurrentSessionId(newSessionId);
        setSourcesOpen(false);
      }
    });
  };

  const handleNewSession = async () => {
    try {
      const newSessionId = await createNewSession(notebookId);
      setCurrentSessionId(newSessionId);
      setSourcesOpen(false);
      setReportsOpen(false);
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  const handleClearChats = async () => {
    try {
      // This would implement chat clearing logic
      console.log('Clearing chats...');
    } catch (error) {
      console.error('Failed to clear chats:', error);
    }
  };

  return (
    <ComponentErrorBoundary>
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <TopBar 
          onSessionSelect={handleSessionSelect} 
          onClearChats={handleClearChats}
          onNewSession={handleNewSession}
          notebookId={notebookId}
        />
        
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Desktop Unified Sidebar */}
          <div className="hidden lg:block">
            <UnifiedSidebar 
              notebookId={notebookId} 
              sessionId={currentSessionId}
              onSessionSelect={handleSessionSelect}
            />
          </div>
          
          {/* Mobile Unified Sidebar Sheet */}
          <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden fixed top-16 left-2 z-40 swipe-area"
                data-testid="mobile-sources-trigger"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[340px] swipe-area" data-testid="sheet-close">
              <UnifiedSidebar 
                notebookId={notebookId} 
                sessionId={currentSessionId}
                onSessionSelect={handleSessionSelect}
              />
            </SheetContent>
          </Sheet>
          
          {/* Chat Area */}
          <div className="flex-1 min-w-0">
            <ChatStream 
              sessionId={currentSessionId} 
              notebookId={notebookId}
              onNewSession={handleSessionSelect}
            />
          </div>
          
          {/* Desktop Reports Panel */}
          <div className="hidden lg:block">
            <ReportsPanel notebookId={notebookId} />
          </div>
          
          {/* Mobile Reports Sheet */}
          <Sheet open={reportsOpen} onOpenChange={setReportsOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="lg:hidden fixed top-16 right-2 z-40 swipe-area"
                data-testid="mobile-actions-trigger"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[380px] swipe-area">
              <ReportsPanel notebookId={notebookId} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};