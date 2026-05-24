import { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';

/**
 * Custom hook to monitor network status for offline POS capabilities
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const addToast = useToastStore(state => state.addToast);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      addToast('System is back online. Syncing data...', 'success');
    };

    const handleOffline = () => {
      setIsOffline(true);
      addToast('Network lost. Switched to offline mode.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  return isOffline;
}
