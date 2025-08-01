import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, Search, CheckCircle, AlertCircle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/lib/api";
import { uploadFile, deleteAllSources } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkIndicator } from "@/components/NetworkStatus";
import { ErrorDisplay, FileUploadErrorDisplay } from "@/components/ui/error-display";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Citation } from "@/types/citation";
import SourceContentViewer from "@/components/ui/source-content-viewer";

interface Source {
  id: string;
  display_name: string;
  file_size: number;
  file_path?: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'uploaded' | 'error' | 'transitioning';
  error?: string;
}

interface SourcesSidebarProps {
  notebookId: string;
  selectedCitation?: Citation | null;
  onCitationClose?: () => void;
  setSelectedCitation?: (citation: Citation | null) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const SourcesSidebar = ({ 
  notebookId, 
  selectedCitation, 
  onCitationClose, 
  setSelectedCitation 
}: SourcesSidebarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [userQuery, setUserQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const { toast } = useToast();
  const { handleAsyncError } = useErrorHandler();
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources", notebookId],
    queryFn: async (): Promise<Source[]> => {
      return handleAsyncError(async () => {
        const { data, error } = await supabase
          .from("sources")
          .select("*")
          .eq("notebook_id", notebookId)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        return data || [];
      }, { operation: 'fetch_sources', notebookId });
    },
    retry: (failureCount, error) => {
      if (failureCount < 3 && error.message?.includes('fetch')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleFileToggle = async (fileId: string, enabled: boolean) => {
    setSelectedFiles(prev => ({
      ...prev,
      [fileId]: enabled
    }));
  };

  const simulateUploadProgress = (fileId: string, fileName: string): NodeJS.Timeout => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 8; // Random progress between 8-20%
      
      if (progress >= 100) {
        progress = 100;
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], progress: 100, status: 'completed' }
        }));
        
        // Show completed state briefly, then transition
        setTimeout(() => {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: { ...prev[fileId], status: 'transitioning' }
          }));
          
          // Transition to uploaded after brief pause
          setTimeout(() => {
            setUploadProgress(prev => {
              return {
                ...prev,
                [fileId]: { ...prev[fileId], status: 'uploaded' }
              };
            });
            
            // Remove from progress tracking after showing uploaded status
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
    }, 150); // Slightly faster updates for smoother animation

    return interval;
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setUploadError("");
    setIsUploading(true);
    
    for (const file of acceptedFiles) {
      const fileId = `${Date.now()}-${file.name}`;
      
      // Initialize progress tracking
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: {
          id: fileId,
          fileName: file.name,
          progress: 0,
          status: 'uploading'
        }
      }));

      // Start progress simulation
      const progressInterval = simulateUploadProgress(fileId, file.name);

      try {
        console.log('Starting file upload:', file.name);
        const result = await handleAsyncError(
          () => uploadFile(file, notebookId, userQuery.trim() || undefined),
          { operation: 'file_upload', fileName: file.name, fileSize: file.size }
        );
        
        console.log('File upload completed:', result);
        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded and sent for processing.`,
        });
        
        // Clear the query after successful upload
        setUserQuery("");
        
        // Refresh the sources list
        queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
        
      } catch (error) {
        console.error('File upload failed:', error);
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

  const handleManualUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        onDrop(files);
      }
    };
    input.click();
  };

  const handleClearAllSources = async () => {
    if (!confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
      return;
    }

    setIsDeletingAll(true);
    
    try {
      await handleAsyncError(
        () => deleteAllSources(notebookId),
        { operation: 'delete_all_sources', notebookId }
      );
      
      toast({
        title: "All documents deleted",
        description: "All documents have been successfully removed.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAll(false);
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

  const handleSourceClick = (source: Source) => {
    if (!setSelectedCitation) return;
    
    // Create a mock citation for source preview (similar to template)
    const mockCitation: Citation = {
      citation_id: -1, // -1 indicates source list click (no specific citation)
      source_id: source.id,
      source_title: source.display_name,
      source_type: getSourceTypeFromName(source.display_name),
      // No chunk_lines_from/to = no highlighting/auto-scroll
      excerpt: `Full content of ${source.display_name}`,
      document: {
        pageContent: `Loading content for ${source.display_name}...`, // This would be fetched in real implementation
        metadata: {
          title: source.display_name,
          file_size: source.file_size,
          processing_status: source.processing_status
        }
      }
    };
    
    setSelectedCitation(mockCitation);
  };

  const getSourceTypeFromName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'txt':
      case 'md':
        return 'text';
      case 'doc':
      case 'docx':
        return 'doc';
      default:
        return 'text';
    }
  };

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

  const filteredSources = sources.filter(source =>
    source.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="w-[260px] bg-sidebar-custom border-r h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  // If a citation is selected, show the source content viewer
  if (selectedCitation) {
    return (
      <ComponentErrorBoundary>
        <div className="h-full bg-card flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Source Details</h3>
            <button 
              onClick={onCitationClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SourceContentViewer
              citation={selectedCitation}
              sourceContent={selectedCitation.document?.pageContent || selectedCitation.excerpt}
              className="h-full"
            />
          </div>
        </div>
      </ComponentErrorBoundary>
    );
  }

  // Default view: show sources list
  return (
    <ComponentErrorBoundary>
      <div className="w-[260px] bg-sidebar-custom border-r h-full flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-foreground">Sources</h2>
            <div className="flex items-center gap-2">
              <NetworkIndicator />
              {filteredSources.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllSources}
                  disabled={isDeletingAll}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Upload and select PDF documents.</p>
        </div>
        
        <div className="p-4 border-b space-y-4">
          {/* Upload Error Display */}
          {uploadError && (
            <FileUploadErrorDisplay
              error={uploadError}
              retry={() => setUploadError("")}
            />
          )}
          
          {/* User Query Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              What would you like to know? (Optional)
            </label>
            <Textarea
              placeholder="e.g., What are the setback requirements?"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="min-h-[80px] resize-none"
              disabled={isUploading}
            />
          </div>
          
          {/* Dropzone for PDF upload */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 
              isUploading ? 'border-muted-foreground/25 bg-muted/20 cursor-not-allowed' :
              'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} disabled={isUploading} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {isUploading ? (
              <p className="text-sm text-muted-foreground">Uploading files...</p>
            ) : isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop PDFs here</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Drag & drop PDFs or click to browse
              </p>
            )}
          </div>
          
          {/* Upload Progress Indicators */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Upload Progress</h3>
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
                  
                  {/* Status Text */}
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
          )}
          
          {/* Manual Upload Button */}
          <Button 
            onClick={handleManualUpload}
            disabled={isUploading}
            className="w-full"
            variant="outline"
          >
            {isUploading ? 'Uploading...' : 'Choose Files'}
          </Button>
          
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        
        <div className="flex-1 p-4 space-y-3 overflow-auto">
          {filteredSources.map((source) => (
            <div key={source.id} className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={selectedFiles[source.id] || false}
                onCheckedChange={(checked) => handleFileToggle(source.id, !!checked)}
                className="mt-0.5"
              />
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleSourceClick(source)}
              >
                <p className="text-sm font-medium text-foreground leading-tight mb-1">
                  {source.display_name}
                </p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(source.file_size)}
                  </Badge>
                  <Badge variant={source.processing_status === 'completed' ? 'default' : 'outline'} className="text-xs">
                    {source.processing_status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
          {filteredSources.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchTerm ? "No documents match your search" : "No documents uploaded yet"}
            </p>
          )}
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};