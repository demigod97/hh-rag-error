import React from 'react';
import { Wifi, WifiOff, Clock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNetworkStatus, useOfflineQueue } from '@/hooks/useErrorHandler';
import { OfflineQueue } from '@/lib/error-handling';

export const NetworkStatus: React.FC = () => {
  const { isOnline, connectionQuality } = useNetworkStatus();
  const queueStatus = useOfflineQueue();

  if (isOnline && queueStatus.count === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-auto max-w-md">
      {!isOnline && (
        <Alert className="mb-2">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>You're offline. Changes will be saved locally.</span>
            <Badge variant="secondary">{connectionQuality}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {queueStatus.count > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{queueStatus.count} changes waiting to sync</span>
            {isOnline && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => OfflineQueue.getInstance().processQueue()}
              >
                Sync Now
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export const NetworkIndicator: React.FC<{ showLabel?: boolean }> = ({ showLabel = true }) => {
  const { isOnline, connectionQuality } = useNetworkStatus();

  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <Wifi className={`h-4 w-4 ${connectionQuality === 'fast' ? 'text-green-500' : 'text-yellow-500'}`} />
      ) : (
        <WifiOff className="h-4 w-4 text-red-500" />
      )}
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {isOnline ? connectionQuality : 'Offline'}
        </span>
      )}
    </div>
  );
};

// Connection quality indicator
export const ConnectionQualityIndicator: React.FC = () => {
  const { connectionQuality } = useNetworkStatus();

  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'fast': return 'bg-green-500';
      case 'slow': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${getQualityColor()}`} />
      <div className={`w-2 h-2 rounded-full ${connectionQuality !== 'offline' ? getQualityColor() : 'bg-gray-300'}`} />
      <div className={`w-2 h-2 rounded-full ${connectionQuality === 'fast' ? getQualityColor() : 'bg-gray-300'}`} />
    </div>
  );
};