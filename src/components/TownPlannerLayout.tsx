import { useState } from "react";
import { TopBar } from "./TopBar";
import { ChatStream } from "./ChatStream";
import { ReportsPanel } from "./ReportsPanel";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useSessionManager } from "@/lib/session-management";
import { SourcesSidebar } from "@/components/SourcesSidebar";
import { Citation } from "@/types/citation";

interface TownPlannerLayoutProps {
  sessionId: string;
  notebookId?: string;
}

export const TownPlannerLayout = ({ sessionId, notebookId = "default" }: TownPlannerLayoutProps) => {
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
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

  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
    console.log('Citation clicked:', citation);
  };

  const handleCitationClose = () => {
    setSelectedCitation(null);
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
                {/* Sources Panel - Left */}
      <div className={`hidden lg:block border-r border-border ${selectedCitation ? 'w-[30%]' : 'w-[25%]'} flex-shrink-0`}>
        <SourcesSidebar 
          notebookId={notebookId}
          selectedCitation={selectedCitation}
          onCitationClose={handleCitationClose}
          setSelectedCitation={setSelectedCitation}
        />
      </div>
          
          {/* Chat Area - Center */}
          <div className={`flex-1 min-w-0 ${selectedCitation ? 'lg:w-[40%]' : 'lg:w-[50%]'}`}>
            <ChatStream 
              sessionId={currentSessionId} 
              notebookId={notebookId}
              onNewSession={handleSessionSelect}
              onCitationClick={handleCitationClick}
            />
          </div>
          
          {/* Reports Panel - Right */}
          <div className={`hidden lg:block border-l border-border ${selectedCitation ? 'w-[30%]' : 'w-[25%]'} flex-shrink-0`}>
            <ReportsPanel notebookId={notebookId} />
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};