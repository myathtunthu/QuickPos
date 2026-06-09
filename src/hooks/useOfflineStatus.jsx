import { useEffect, useState } from 'react';
import { useToastStore } from '../store/toastStore';

const getOnlineStatus = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export function useOfflineStatus({ showToasts = true } = {}) {
  const [isOffline, setIsOffline] = useState(!getOnlineStatus());
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (showToasts) addToast('System is back online. Please verify pending transactions.', 'success');
    };

    const handleOffline = () => {
      setIsOffline(true);
      if (showToasts) addToast('Network lost. Avoid final checkout until connection returns.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, showToasts]);

  return isOffline;
}

export default useOfflineStatus;
