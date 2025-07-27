import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ErrorHandler } from '@/lib/error-handling';

interface ErrorFallbackProps {
  error?: Error;
  retry?: () => void;
  context?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry, context }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [errorStats, setErrorStats] = React.useState<any>(null);

  React.useEffect(() => {
    // Get error statistics for debugging
    const stats = ErrorHandler.getLogger().getErrorStats();
    setErrorStats(stats);
  }, []);

  const handleReportError = () => {
    // Create a detailed error report
    const errorReport = {
      error: error?.message,
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      stats: errorStats
    };

    // Copy to clipboard for easy reporting
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
    
    // Show success message
    alert('Error report copied to clipboard. Please share this with support.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            {context ? `Error in ${context}` : 'An unexpected error occurred'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Statistics */}
          {errorStats && (
            <Alert>
              <Bug className="h-4 w-4" />
              <AlertTitle>Error Statistics</AlertTitle>
              <AlertDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">Total: {errorStats.total}</Badge>
                  {Object.entries(errorStats.bySeverity).map(([severity, count]) => (
                    <Badge key={severity} variant="secondary">
                      {severity}: {count as number}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Network Status */}
          <Alert>
            {navigator.onLine ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <AlertTitle>Connection Status</AlertTitle>
            <AlertDescription>
              {navigator.onLine ? 'Online' : 'Offline - Some features may be limited'}
            </AlertDescription>
          </Alert>

          {/* Error Details (Development only) */}
          {import.meta.env.DEV && error && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full"
              >
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </Button>
              
              {showDetails && (
                <details className="rounded border p-3 text-sm bg-muted">
                  <summary className="cursor-pointer font-medium mb-2">
                    Error Information
                  </summary>
                  <div className="space-y-2">
                    <div>
                      <strong>Message:</strong> {error.message}
                    </div>
                    <div>
                      <strong>Context:</strong> {context || 'Unknown'}
                    </div>
                    {error.stack && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="mt-1 text-xs whitespace-pre-wrap bg-background p-2 rounded">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline" 
              className="flex-1"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>
            {retry && (
              <Button onClick={retry} className="flex-1">
                Try Again
              </Button>
            )}
          </div>

          {/* Report Error Button */}
          <Button 
            onClick={handleReportError}
            variant="ghost" 
            size="sm" 
            className="w-full"
          >
            <Bug className="mr-2 h-4 w-4" />
            Copy Error Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Component-level error boundary with context
export const ComponentErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  context?: string;
}> = ({ children, fallback: Fallback = ErrorFallback, context }) => {
  return (
    <ErrorBoundaryWrapper fallback={Fallback} context={context}>
      {children}
    </ErrorBoundaryWrapper>
  );
};

class ErrorBoundaryWrapper extends React.Component<
  { 
    children: React.ReactNode; 
    fallback: React.ComponentType<ErrorFallbackProps>;
    context?: string;
  },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    ErrorHandler.handle(error, {
      operation: 'react_error_boundary',
      context: this.props.context,
      errorInfo,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      return (
        <Fallback 
          error={this.state.error}
          context={this.props.context}
          retry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}

// Inline error display components
export const InlineError: React.FC<{ 
  message?: string; 
  retry?: () => void;
  className?: string;
}> = ({ message, retry, className }) => {
  if (!message) return null;
  
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

// Field-level error component
export const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  
  return (
    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      {message}
    </p>
  );
};

// Loading state with error fallback
export const LoadingWithError: React.FC<{
  isLoading: boolean;
  error?: Error | null;
  retry?: () => void;
  children: React.ReactNode;
  fallbackMessage?: string;
}> = ({ isLoading, error, retry, children, fallbackMessage }) => {
  if (error) {
    return (
      <InlineError
        message={fallbackMessage || error.message}
        retry={retry}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};