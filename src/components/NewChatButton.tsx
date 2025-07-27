import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSessionManager } from "@/lib/session-management";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface NewChatButtonProps {
  /** Current notebook ID for the new session */
  notebookId?: string;
  /** Callback when new session is created */
  onNewSession?: (sessionId: string) => void;
  /** Whether to show confirmation dialog if current session has messages */
  showConfirmation?: boolean;
  /** Current session ID to check for existing messages */
  currentSessionId?: string;
  /** Button variant - affects styling and placement */
  variant?: 'default' | 'outline' | 'ghost' | 'floating';
  /** Button size */
  size?: 'sm' | 'default' | 'lg';
  /** Whether to show icon only (for compact layouts) */
  iconOnly?: boolean;
  /** Custom button text */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * NewChatButton Component
 * 
 * Creates a new chat session and switches to it automatically.
 * Handles confirmation dialogs, loading states, and error scenarios.
 * Integrates with existing session management and error handling systems.
 */
export const NewChatButton = ({
  notebookId,
  onNewSession,
  showConfirmation = true,
  currentSessionId,
  variant = 'default',
  size = 'default',
  iconOnly = false,
  label = 'New Chat',
  className = ''
}: NewChatButtonProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();
  const { createNewSession } = useSessionManager();
  const { handleAsyncError } = useErrorHandler();

  /**
   * Check if current session has messages to determine if confirmation is needed
   */
  const checkCurrentSessionMessages = async (): Promise<boolean> => {
    if (!currentSessionId || !showConfirmation) return false;

    try {
      const { supabase } = await import('@/lib/api');
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', currentSessionId)
        .limit(1);

      if (error) {
        console.warn('Failed to check session messages:', error);
        return false;
      }

      return (messages?.length || 0) > 0;
    } catch (error) {
      console.warn('Error checking session messages:', error);
      return false;
    }
  };

  /**
   * Handle the new session creation process
   */
  const handleCreateNewSession = async () => {
    setIsCreating(true);
    
    try {
      // Create new session using session manager
      const newSessionId = await handleAsyncError(
        () => createNewSession(notebookId),
        { 
          operation: 'create_new_chat_session', 
          notebookId,
          currentSessionId 
        }
      );

      // Success feedback
      toast({
        title: "New chat started",
        description: "You're now in a fresh conversation.",
        duration: 3000,
      });

      // Notify parent component
      onNewSession?.(newSessionId);

      // Reset confirmation state
      setHasMessages(false);

    } catch (error) {
      console.error('Failed to create new session:', error);
      
      toast({
        title: "Failed to start new chat",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle button click with optional confirmation
   */
  const handleClick = async () => {
    if (isCreating) return;

    // Check if confirmation is needed
    if (showConfirmation && currentSessionId) {
      const hasExistingMessages = await checkCurrentSessionMessages();
      
      if (hasExistingMessages) {
        setHasMessages(true);
        setShowConfirmDialog(true);
        return;
      }
    }

    // Proceed directly if no confirmation needed
    await handleCreateNewSession();
  };

  /**
   * Handle confirmed new session creation
   */
  const handleConfirmedCreate = async () => {
    setShowConfirmDialog(false);
    await handleCreateNewSession();
  };

  /**
   * Get button styling based on variant
   */
  const getButtonVariant = () => {
    switch (variant) {
      case 'floating':
        return 'default';
      case 'outline':
        return 'outline';
      case 'ghost':
        return 'ghost';
      default:
        return 'default';
    }
  };

  /**
   * Get additional styling classes based on variant
   */
  const getAdditionalClasses = () => {
    const baseClasses = className;
    
    switch (variant) {
      case 'floating':
        return `${baseClasses} fixed bottom-6 right-6 z-50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 h-14 w-14`;
      default:
        return baseClasses;
    }
  };

  /**
   * Render button content based on state and props
   */
  const renderButtonContent = () => {
    if (isCreating) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {!iconOnly && <span className="ml-2">Creating...</span>}
        </>
      );
    }

    if (iconOnly || variant === 'floating') {
      return <Plus className="h-4 w-4" />;
    }

    return (
      <>
        <Plus className="h-4 w-4" />
        <span className="ml-2">{label}</span>
      </>
    );
  };

  return (
    <ComponentErrorBoundary>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogTrigger asChild>
          <Button
            variant={getButtonVariant()}
            size={variant === 'floating' ? 'default' : size}
            onClick={handleClick}
            disabled={isCreating}
            className={getAdditionalClasses()}
            title={iconOnly ? label : undefined}
            data-testid="new-chat-button"
          >
            {renderButtonContent()}
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Start New Conversation?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have an active conversation with messages. Starting a new chat will switch you to a fresh conversation. 
              Your current chat will be saved and accessible from the chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreating}>
              Continue Current Chat
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedCreate}
              disabled={isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComponentErrorBoundary>
  );
};

/**
 * Preset variants for common use cases
 */

// Header variant - for use in top navigation
export const HeaderNewChatButton = (props: Omit<NewChatButtonProps, 'variant' | 'size'>) => (
  <NewChatButton {...props} variant="ghost" size="sm" />
);

// Sidebar variant - for use in sidebar navigation
export const SidebarNewChatButton = (props: Omit<NewChatButtonProps, 'variant'>) => (
  <NewChatButton {...props} variant="outline" />
);

// Floating variant - for mobile or minimal interfaces
export const FloatingNewChatButton = (props: Omit<NewChatButtonProps, 'variant' | 'iconOnly'>) => (
  <NewChatButton {...props} variant="floating" iconOnly={true} />
);

// Compact variant - icon only for tight spaces
export const CompactNewChatButton = (props: Omit<NewChatButtonProps, 'iconOnly' | 'size'>) => (
  <NewChatButton {...props} iconOnly={true} size="sm" />
);