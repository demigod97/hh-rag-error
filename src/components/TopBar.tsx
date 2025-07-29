import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { User, Trash2, Upload, CheckCircle, AlertCircle, Clock, RefreshCw, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { HistoryDrawer } from "./HistoryDrawer";
import { HeaderNewChatButton } from "./NewChatButton";
import { useSessionManager } from "@/lib/session-management";
import { uploadFile } from "@/lib/api";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { FileUploadErrorDisplay } from "@/components/ui/error-display";
import { useAuth } from "@/hooks/useAuth";

interface TopBarProps {
  onClearChats?: () => void;
  onSessionSelect?: (sessionId: string) => void;
  onNewSession?: () => void;
  notebookId?: string;
}

interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'uploaded' | 'error' | 'transitioning';
  error?: string;
}

// Generate random avatar background color and emoji
const getRandomAvatarStyle = () => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-emerald-500'
  ];
  
  const emojis = ['🌟', '🚀', '🎯', '🌈', '⭐', '🔥', '💎', '🎨', '🌸', '🦋', '🌺', '🎭'];
  
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  return { color: randomColor, emoji: randomEmoji };
};

export const TopBar = ({ onClearChats, onSessionSelect, onNewSession, notebookId }: TopBarProps) => {
  const { createNewSession } = useSessionManager();
  const { signOut } = useAuth();
  const [avatarStyle] = useState(getRandomAvatarStyle());
  
  // File upload state
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const { toast: toastHook } = useToast();
  const { handleAsyncError } = useErrorHandler();
  const queryClient = useQueryClient();

  const handleClearChats = () => {
    onClearChats?.();
    toast("Chat history cleared");
  };

  const handleProfileClick = () => {
    toast("Profile settings coming soon");
  };

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        toastHook({
          title: "Logout failed",
          description: error.message || "Failed to logout. Please try again.",
          variant: "destructive",
        });
      } else {
        toast("Successfully logged out");
        // Optionally redirect to login page
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      toastHook({
        title: "Logout failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    onSessionSelect?.(sessionId);
  };

  const handleNewSession = async () => {
    try {
      const newSessionId = await createNewSession(notebookId);
      onNewSession?.();
      toast("New chat session created");
    } catch (error) {
      console.error('Failed to create new session:', error);
      toast("Failed to create new session", { description: "Please try again" });
    }
  };

  // File upload logic
  const simulateUploadProgress = (fileId: string, fileName: string): NodeJS.Timeout => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 8;
      
      if (progress >= 100) {
        progress = 100;
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress: 100, status: 'completed' }
        }));
        
        setTimeout(() => {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: { ...prev[fileId], status: 'transitioning' }
          }));
          
          setTimeout(() => {
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: { ...prev[fileId], status: 'uploaded' }
            }));
            
            setTimeout(() => {
              setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[fileId];
                return newProgress;
              });
            }, 3000);
          }, 1500);
        }, 2000);
        
        clearInterval(interval);
      } else {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress, status: 'uploading' }
        }));
      }
    }, 150);

    return interval;
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || !notebookId) return;
    
    setUploadError("");
    setIsUploading(true);
    
    for (const file of acceptedFiles) {
      const fileId = `${Date.now()}-${file.name}`;
      
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: {
          id: fileId,
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        }
      }));

      const progressInterval = simulateUploadProgress(fileId, file.name);

      try {
        const result = await handleAsyncError(
          () => uploadFile(file, notebookId),
          { operation: 'file_upload', fileName: file.name, fileSize: file.size }
        );
        
        toastHook({
          title: "Upload successful",
          description: `${file.name} has been uploaded and sent for processing.`,
        });
        
        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        
      } catch (error) {
        clearInterval(progressInterval);
        
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            status: 'error',
            error: error.message || 'Upload failed'
          }
        }));
        
        setUploadError(error.message || 'Upload failed');
      }
    }
    
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'uploaded':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'transitioning':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Upload className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string, progress: number) => {
    switch (status) {
      case 'uploading':
        return `Uploading... ${Math.round(progress)}%`;
      case 'completed':
        return 'Upload Complete!';
      case 'transitioning':
        return 'Processing...';
      case 'uploaded':
        return 'Successfully Uploaded';
      case 'error':
        return 'Upload Failed';
      default:
        return 'Preparing...';
    }
  };

  const retryUpload = (fileId: string) => {
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
    setUploadError("");
  };

  return (
    <div className="h-14 bg-background border-b flex items-center justify-between px-4 sticky top-0 z-40">
      {/* Left - History Drawer, Upload, New Chat */}
      <div className="flex items-center gap-3">
        <HistoryDrawer onSessionSelect={handleSessionSelect} />
        
        {/* File Upload */}
        <div className="relative">
          <div 
            {...getRootProps()} 
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors cursor-pointer ${
              isDragActive ? 'border-primary bg-primary/5' : 
              isUploading ? 'border-muted-foreground/25 bg-muted/20 cursor-not-allowed' :
              'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <input {...getInputProps()} disabled={isUploading} />
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground hidden sm:inline">
              {isUploading ? 'Uploading...' : isDragActive ? 'Drop here' : 'Upload PDF'}
            </span>
          </div>

          {/* Upload Progress Popup */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-background border shadow-lg rounded-lg p-3 z-50">
              <h4 className="text-sm font-medium mb-2">Upload Progress</h4>
              <div className="space-y-3">
                {Object.entries(uploadProgress).map(([fileId, progress]) => (
                  <div key={fileId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(progress.status)}
                        <span className="text-sm font-medium truncate max-w-[150px]">
                          {progress.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(progress.status === 'uploading' || progress.status === 'transitioning') && (
                          <span className="text-xs text-muted-foreground">
                            {progress.status === 'uploading' ? `${Math.round(progress.progress)}%` : ''}
                          </span>
                        )}
                        {progress.status === 'error' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryUpload(fileId)}
                            className="h-6 w-6 p-0"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs font-medium text-center">
                      <span className={`${
                        progress.status === 'completed' ? 'text-green-600' :
                        progress.status === 'uploaded' ? 'text-blue-600' :
                        progress.status === 'error' ? 'text-red-600' :
                        'text-muted-foreground'
                      }`}>
                        {getStatusText(progress.status, progress.progress)}
                      </span>
                    </div>
                    
                    {progress.status === 'uploading' && (
                      <Progress 
                        value={progress.progress} 
                        className="h-2 w-full bg-muted"
                      />
                    )}
                    
                    {progress.status === 'transitioning' && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                      </div>
                    )}
                    
                    {progress.status === 'error' && progress.error && (
                      <div className="text-xs text-red-600">
                        {progress.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="absolute top-full left-0 mt-2 w-80 z-50">
              <FileUploadErrorDisplay
                error={uploadError}
                retry={() => setUploadError("")}
              />
            </div>
          )}
        </div>

        <HeaderNewChatButton
          notebookId={notebookId}
          onNewSession={handleNewSession}
          currentSessionId={undefined} // TopBar doesn't track current session
          showConfirmation={false} // Skip confirmation in header for quick access
          label="New Chat"
        />
      </div>

      {/* Center - Title */}
      <div className="flex items-center gap-2">
        <img src="/favicon.ico" alt="Human Habitat" className="w-5 h-5" />
        <h1 className="text-lg font-semibold text-foreground hidden sm:block">
          Human Habitat Assistant
        </h1>
        <h1 className="text-lg font-semibold text-foreground sm:hidden">
          Habitat Assistant
        </h1>
      </div>

      {/* Right - Avatar Only */}
      <div className="flex items-center gap-3">
        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${avatarStyle.color} text-white text-sm`}>
                  {avatarStyle.emoji}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
            <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearChats} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Chats
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};