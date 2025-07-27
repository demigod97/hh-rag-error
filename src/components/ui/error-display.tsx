import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ErrorHandler } from '@/hooks/useErrorHandler'; // Add this import

interface ErrorDisplayProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  retry?: () => void;
  showDetails?: boolean;
  details?: string;
  suggestions?: string[];
  context?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = 'Error',
  message,
  type = 'error',
  retry,
  showDetails = false,
  details,
  suggestions = [],
  context
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (type) {
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Alert variant={getVariant()}>
      {getIcon()}
      <AlertTitle className="flex items-center justify-between">
        {title}
        {context && <Badge variant="outline" className="text-xs">{context}</Badge>}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{message}</p>
        
        {suggestions.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium text-sm">Suggestions:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        {retry && (
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Try Again
          </Button>
        )}

        {showDetails && details && (
          <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-auto">
                Technical Details {isDetailsOpen ? '▼' : '▶'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted p-2 rounded border">
                {details}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </AlertDescription>
    </Alert>
  );
};

// Inline error component for form fields and small spaces
const InlineError: React.FC<{ message: string; className?: string }> = ({ 
  message, 
  className = '' 
}) => (
  <div className={`flex items-center text-sm text-destructive mt-1 ${className}`}>
    <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
    <span>{message}</span>
  </div>
);

// Specialized error displays for common scenarios
const NetworkErrorDisplay: React.FC<{ retry?: () => void }> = ({ retry }) => (
  <ErrorDisplay
    title="Connection Problem"
    message="Unable to connect to the server. Please check your internet connection."
    type="warning"
    retry={retry}
    suggestions={[
      'Check your internet connection',
      'Try refreshing the page',
      'Contact support if the problem persists'
    ]}
    context="Network"
  />
);

const FileUploadErrorDisplay: React.FC<{ 
  error: string; 
  retry?: () => void;
  fileName?: string;
}> = ({ error, retry, fileName }) => {
  const getSuggestions = (error: string) => {
    if (error.includes('size')) {
      return ['Choose a smaller file (max 50MB)', 'Compress the PDF if possible'];
    }
    if (error.includes('type') || error.includes('format')) {
      return ['Only PDF files are supported', 'Convert your document to PDF format'];
    }
    if (error.includes('network')) {
      return ['Check your internet connection', 'Try uploading again'];
    }
    if (error.includes('timeout')) {
      return ['The upload took too long', 'Try uploading a smaller file', 'Check your internet connection'];
    }
    if (error.includes('storage')) {
      return ['Storage service temporarily unavailable', 'Try again in a few moments'];
    }
    return ['Try uploading the file again', 'Contact support if the problem persists'];
  };

  return (
    <ErrorDisplay
      title="Upload Failed"
      message={`Failed to upload ${fileName || 'file'}: ${error}`}
      type="error"
      retry={retry}
      suggestions={getSuggestions(error)}
      context="File Upload"
    />
  );
};

const ValidationErrorDisplay: React.FC<{ 
  errors: Record<string, string>;
  onFieldFocus?: (field: string) => void;
}> = ({ errors, onFieldFocus }) => (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Please fix the following errors:</AlertTitle>
    <AlertDescription>
      <ul className="list-disc list-inside space-y-1 mt-2">
        {Object.entries(errors).map(([field, error]) => (
          <li key={field} className="text-sm">
            <button
              onClick={() => onFieldFocus?.(field)}
              className="text-left hover:underline"
            >
              <strong>{field}:</strong> {error}
            </button>
          </li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
);

// Loading state with error fallback and timeout
const LoadingWithError: React.FC<{
  isLoading: boolean;
  error?: Error | null;
  retry?: () => void;
  children: React.ReactNode;
  timeout?: number;
  fallbackMessage?: string;
}> = ({ 
  isLoading, 
  error, 
  retry, 
  children, 
  timeout = 30000, // 30 seconds
  fallbackMessage 
}) => {
  const [hasTimedOut, setHasTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setHasTimedOut(true);
      }, timeout);

      return () => clearTimeout(timer);
    } else {
      setHasTimedOut(false);
    }
  }, [isLoading, timeout]);

  if (error) {
    return (
      <ErrorDisplay
        message={fallbackMessage || error.message}
        retry={retry}
        showDetails={import.meta.env.DEV}
        details={error.stack}
      />
    );
  }

  if (hasTimedOut) {
    return (
      <ErrorDisplay
        title="Loading Timeout"
        message="This is taking longer than expected."
        type="warning"
        retry={retry}
        suggestions={[
          'Check your internet connection',
          'Try refreshing the page',
          'The server might be experiencing high load'
        ]}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
          <p className="text-xs text-muted-foreground mt-1">
            This may take a few moments
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};


// Error summary component for debugging
const ErrorSummary: React.FC = () => {
  const [errorStats, setErrorStats] = React.useState<any>(null);

  React.useEffect(() => {
    const updateStats = () => {
      const stats = ErrorHandler.getLogger().getErrorStats();
      setErrorStats(stats);
    };

    updateStats();
    const interval = setInterval(updateStats, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (!errorStats || errorStats.total === 0) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-64 z-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Error Summary</CardTitle>
        <CardDescription className="text-xs">
          Last 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total Errors:</span>
            <Badge variant="destructive">{errorStats.total}</Badge>
          </div>
          
          {Object.entries(errorStats.bySeverity).map(([severity, count]) => (
            <div key={severity} className="flex justify-between text-xs">
              <span>{severity}:</span>
              <span>{count as number}</span>
            </div>
          ))}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => ErrorHandler.getLogger().clearErrors()}
            className="w-full mt-2"
          >
            Clear Errors
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};



// Export all components
export {
  ErrorDisplay,
  InlineError,
  NetworkErrorDisplay,
  FileUploadErrorDisplay,
  ValidationErrorDisplay,
  LoadingWithError,
  ErrorSummary  // Comment this out
  
};