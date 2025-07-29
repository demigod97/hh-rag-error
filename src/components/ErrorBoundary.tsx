import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Bug, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorHandler } from '@/lib/error-handling';

interface ErrorFallbackProps {
  error?: Error;
  retry?: () => void;
  context?: string;
}

interface ErrorStats {
  total: number;
  bySeverity: Record<string, number>;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry, context }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [errorStats, setErrorStats] = React.useState<ErrorStats | null>(null);

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
    
    // Show success message with better UX
    const originalText = document.querySelector('[data-error-report-btn]')?.textContent;
    const btn = document.querySelector('[data-error-report-btn]') as HTMLElement;
    if (btn) {
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = originalText || 'Copy Error Report';
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border-2 border-destructive/20">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
            <CardDescription className="text-base">
              {context ? `An error occurred in ${context}` : 'An unexpected error has occurred in the application'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* System Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Error Statistics Card */}
            {errorStats && (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bug className="h-4 w-4 text-orange-600" />
                    Error Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-orange-300">
                      Total: {errorStats.total}
                    </Badge>
                    {Object.entries(errorStats.bySeverity).map(([severity, count]) => (
                      <Badge key={severity} variant="secondary" className="bg-orange-100">
                        {severity}: {count as number}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Network Status Card */}
            <Card className={`border-2 ${navigator.onLine ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {navigator.onLine ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Badge variant={navigator.onLine ? "default" : "destructive"} className="text-xs">
                  {navigator.onLine ? 'Online' : 'Offline'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {navigator.onLine ? 'All systems operational' : 'Some features may be limited'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Error Details - Development only */}
          {import.meta.env.DEV && error && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <span className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Technical Details
                  </span>
                  {showDetails ? <RefreshCw className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-4">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Error Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Message:</p>
                        <p className="text-sm text-muted-foreground bg-background p-2 rounded border">
                          {error.message}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Context:</p>
                        <Badge variant="outline">{context || 'Unknown'}</Badge>
                      </div>
                      
                      {error.stack && (
                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">Stack Trace:</p>
                          <ScrollArea className="h-32 w-full rounded border bg-background">
                            <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                              {error.stack}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => window.location.reload()} 
              variant="default" 
              className="flex-1"
              size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Application
            </Button>
            {retry && (
              <Button onClick={retry} variant="outline" className="flex-1" size="lg">
                Try Again
              </Button>
            )}
          </div>

          <Separator />

          {/* Report Error Button */}
          <Button 
            onClick={handleReportError}
            variant="ghost" 
            size="sm" 
            className="w-full"
            data-error-report-btn
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

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode; 
  fallback: React.ComponentType<ErrorFallbackProps>;
  context?: string;
}

interface ErrorBoundaryWrapperState {
  hasError: boolean; 
  error?: Error;
}

class ErrorBoundaryWrapper extends React.Component<ErrorBoundaryWrapperProps, ErrorBoundaryWrapperState> {
  constructor(props: ErrorBoundaryWrapperProps) {
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