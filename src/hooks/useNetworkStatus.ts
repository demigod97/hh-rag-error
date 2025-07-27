import { useState, useEffect } from 'react';
import { NetworkMonitor, OfflineQueue } from '@/lib/error-handling';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    const monitor = NetworkMonitor.getInstance();
    setIsOnline(monitor.isOnlineStatus());

    const unsubscribe = monitor.onStatusChange((online) => {
      setIsOnline(online);
      if (!online) {
        setHasBeenOffline(true);
      } else if (hasBeenOffline) {
        // Process offline queue when coming back online
        OfflineQueue.getInstance().processQueue();
      }
    });

    return unsubscribe;
  }, [hasBeenOffline]);

  return {
    isOnline,
    hasBeenOffline
  };
};