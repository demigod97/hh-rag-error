import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSessionManager } from "@/lib/session-management";
import { useSession } from "@/hooks/useSession";
import { TownPlannerLayout } from "@/components/TownPlannerLayout";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { LoadingWithError } from "@/components/ui/error-display";
import { supabase } from "@/lib/api";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, initialized } = useSession();
  const [sessionId, setSessionId] = useState<string>("");
  const [notebookId, setNotebookId] = useState<string>("");
  const [initializationError, setInitializationError] = useState<string>("");
  const { handleAsyncError } = useErrorHandler();
  const { getOrCreateSession } = useSessionManager();
  const navigate = useNavigate();

  // Redirect to login if not authenticated (after initialization)
  useEffect(() => {
    if (initialized && !loading && !user) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login', { 
        state: { from: { pathname: window.location.pathname + window.location.search } },
        replace: true 
      });
    }
  }, [initialized, loading, user, navigate]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setInitializationError("");
        
        // Get preferred session ID from URL
        const currentSessionId = searchParams.get("sessionId");
        
        // Use enhanced session management
        const validSessionId = await handleAsyncError(
          () => getOrCreateSession(currentSessionId || undefined),
          { operation: 'initialize_session', preferredSessionId: currentSessionId }
        );
        
        setSessionId(validSessionId);
        
        // Update URL if session ID changed
        if (validSessionId !== currentSessionId) {
          setSearchParams({ sessionId: validSessionId });
        }
        
        // Get session details to extract notebook ID
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('notebook_id')
          .eq('id', validSessionId)
          .single();
          
        if (sessionError) {
          throw new Error('Failed to get session details');
        }
        
        setNotebookId(session.notebook_id);
        
      } catch (error) {
        console.error("Failed to initialize app:", error);
        setInitializationError(error.message || "Failed to initialize application");
      }
    };

    // Only initialize when user is authenticated
    if (initialized && !loading && user) {
      initializeApp();
    }
  }, [initialized, loading, user, searchParams, setSearchParams, handleAsyncError, getOrCreateSession]);

  // Show loading state while authentication is in progress
  if (loading || !initialized) {
    return <LoadingWithError isLoading={true} fallbackMessage="Initializing authentication..." />;
  }

  // Don't render anything if not authenticated - redirect will handle it
  if (!user) {
    return null;
  }

  // Show loading state while app is being initialized
  if (!sessionId || !notebookId) {
    return (
      <LoadingWithError 
        isLoading={true} 
        error={initializationError ? new Error(initializationError) : null}
        retry={() => window.location.reload()}
        fallbackMessage="Initializing workspace..." 
      />
    );
  }

  return (
    <ComponentErrorBoundary>
      <TownPlannerLayout sessionId={sessionId} notebookId={notebookId} />
    </ComponentErrorBoundary>
  );
};

export default Index;