import { useCallback, useState, useEffect } from 'react';
import { 
  ErrorHandler as ErrorHandlerClass, 
  ErrorType, 
  ErrorSeverity, 
  RetryHandler, 
  PerformanceMonitor,
  GracefulDegradation,
  OfflineQueue,
  NetworkMonitor
} from '@/lib/error-handling';

export const useErrorHandler = () => {
  const handleError = useCallback((error: any, context?: Record<string, any>) => {
    return ErrorHandlerClass.handle(error, context);
  }, []);

  const handleAsyncError = useCallback(async (
    operation: () => Promise<any>,
    context?: Record<string, any>
  ) => {
    try {
      return await PerformanceMonitor.measureOperation(
        context?.operation || 'unknown_operation',
        operation
      );
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }, [handleError]);

  const handleWithRetry = useCallback(async (
    operation: () => Promise<any>,
    options?: {
      maxRetries?: number;
      operationId?: string;
      context?: Record<string, any>;
    }
  ) => {
    try {
      return await RetryHandler.withRetry(operation, {
        maxRetries: options?.maxRetries || 3,
        operationId: options?.operationId
      });
    } catch (error) {
      handleError(error, { 
        ...options?.context, 
        operation: 'retry_failed', 
        maxRetries: options?.maxRetries 
      });
      throw error;
    }
  }, [handleError]);

  const handleWithFallback = useCallback(async (
    primaryOperation: () => Promise<any>,
    fallbackOperation: () => Promise<any> | any,
    context?: string
  ) => {
    try {
      return await GracefulDegradation.withFallback(
        primaryOperation,
        fallbackOperation,
        context
      );
    } catch (error) {
      handleError(error, { operation: 'fallback_failed', context });
      throw error;
    }
  }, [handleError]);

  const handleOfflineOperation = useCallback((
    operation: string,
    data: any,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      return OfflineQueue.getInstance().addToQueue(operation, data, priority);
    }
    return null;
  }, []);

  return {
    handleError,
    handleAsyncError,
    handleWithRetry,
    handleWithFallback,
    handleOfflineOperation
  };
};

// Export ErrorHandler class for components that need direct access
export { ErrorHandlerClass as ErrorHandler };

// Hook for network status monitoring
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'fast' | 'slow' | 'offline'>('fast');

  useEffect(() => {
    const monitor = NetworkMonitor.getInstance();
    setIsOnline(monitor.isOnlineStatus());
    setConnectionQuality(monitor.getConnectionQuality());

    const unsubscribe = monitor.onStatusChange((online) => {
      setIsOnline(online);
      setConnectionQuality(monitor.getConnectionQuality());
    });

    return unsubscribe;
  }, []);

  return {
    isOnline,
    connectionQuality,
    hasBeenOffline: !isOnline
  };
};

// Hook for offline queue management
export const useOfflineQueue = () => {
  const [queueStatus, setQueueStatus] = useState({ count: 0, oldestItem: undefined });

  useEffect(() => {
    const updateStatus = () => {
      setQueueStatus(OfflineQueue.getInstance().getQueueStatus());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return queueStatus;
};