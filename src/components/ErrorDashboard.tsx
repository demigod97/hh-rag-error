import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, Users, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/api';
import { ErrorHandler, PerformanceMonitor } from '@/lib/error-handling';
import { LoadingWithError } from '@/components/ui/error-display';

interface ErrorAnalytics {
  error_type: string;
  severity: string;
  occurrence_count: number;
  affected_users: number;
  first_occurrence: string;
  last_occurrence: string;
}

export const ErrorDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<ErrorAnalytics[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load error analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('error_analytics')
        .select('*')
        .limit(20);

      if (analyticsError) throw analyticsError;

      // Load recent errors
      const { data: errorsData, error: errorsError } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (errorsError) throw errorsError;

      // Get local error statistics
      const localStats = ErrorHandler.getLogger().getErrorStats();
      const perfMetrics = PerformanceMonitor.getMetrics();

      setAnalytics(analyticsData || []);
      setRecentErrors(errorsData || []);
      setPerformanceMetrics(perfMetrics);

    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'outline';
      default: return 'outline';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Error Dashboard</h1>
          <p className="text-muted-foreground">Monitor application health and error patterns</p>
        </div>
        <Button onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <LoadingWithError isLoading={isLoading} error={error} retry={loadData}>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="recent">Recent Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.reduce((sum, item) => sum + item.occurrence_count, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Affected Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.max(...analytics.map(item => item.affected_users), 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Unique users</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.filter(item => item.severity === 'CRITICAL').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Require attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.values(performanceMetrics).length > 0 
                      ? formatDuration(Object.values(performanceMetrics)[0]?.average || 0)
                      : '0ms'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">API response time</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Breakdown</CardTitle>
                <CardDescription>Errors by type and severity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant={getSeverityColor(item.severity)}>
                          {item.severity}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.error_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.affected_users} users affected
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{item.occurrence_count}</p>
                        <p className="text-xs text-muted-foreground">occurrences</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Operation response times and success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(performanceMetrics).map(([operation, metrics]) => (
                    <div key={operation} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{operation}</p>
                        <p className="text-sm text-muted-foreground">
                          {metrics.count} operations
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatDuration(metrics.average)}</p>
                        <p className="text-xs text-muted-foreground">
                          Recent: {formatDuration(metrics.recent)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Latest error occurrences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentErrors.slice(0, 20).map((error, index) => (
                    <div key={index} className="p-3 border rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={getSeverityColor(error.severity)}>
                          {error.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-medium">{error.error_type}</p>
                      <p className="text-sm text-muted-foreground">{error.user_message}</p>
                      {error.context && Object.keys(error.context).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer">Context</summary>
                          <pre className="mt-1 bg-muted p-2 rounded">
                            {JSON.stringify(error.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </LoadingWithError>
    </div>
  );
};