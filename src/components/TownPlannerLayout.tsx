import { useState } from "react";
import { TopBar } from "./TopBar";
import { ChatStream } from "./ChatStream";
import { ReportsPanel } from "./ReportsPanel";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useSessionManager } from "@/lib/session-management";

interface TownPlannerLayoutProps {
  sessionId: string;
  notebookId?: string;
}

export const TownPlannerLayout = ({ sessionId, notebookId = "default" }: TownPlannerLayoutProps) => {
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const { switchSession, createNewSession } = useSessionManager();



  const handleSessionSelect = (newSessionId: string) => {
    switchSession(newSessionId).then((success) => {
      if (success) {
        setCurrentSessionId(newSessionId);
      }
    });
  };

  const handleNewSession = async () => {
    try {
      const newSessionId = await createNewSession(notebookId);
      setCurrentSessionId(newSessionId);
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
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};