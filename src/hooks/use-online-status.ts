import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { PluginListenerHandle } from '@capacitor/core';

export function useOnlineStatus() {
  // Default to true and let the plugin/events correct it.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let listenerHandle: PluginListenerHandle | null = null;
    let cleanupWebEvents: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        // Try to use Capacitor plugin first
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        listenerHandle = await Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
        });
      } catch (e) {
        // Fallback for non-Capacitor environments (i.e., web browser)
        console.log('Capacitor Network plugin not available. Falling back to web APIs.');
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
        
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        cleanupWebEvents = () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
    };

    setupListeners();

    return () => {
      listenerHandle?.remove();
      if (cleanupWebEvents) {
        cleanupWebEvents();
      }
    };
  }, []);

  return isOnline;
}