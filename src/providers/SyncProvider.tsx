import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { useAuth } from '@/integrations/supabase/auth';
import { showLoading, dismissToast, showSuccess, showError } from '@/utils/toast';
import { useTranslation } from 'react-i18next';

interface SyncContextType {
  isSyncing: boolean;
  lastSync: Date | null;
  syncData: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const syncData = useCallback(async () => {
    if (!isOnline || !user || isSyncing) return;

    setIsSyncing(true);
    const toastId = showLoading(t('syncing_data'));

    try {
      const tablesToSync = [
        'items', 'workers', 'tags', 'kits', 'kit_items', 
        'transactions', 'requisitions', 'fiscal_notes', 'profiles'
      ];

      for (const tableName of tablesToSync) {
        // @ts-ignore
        const { data, error } = await supabase.from(tableName).select('*').eq('user_id', user.id);
        if (error && error.code !== '42P01') { // 42P01 = undefined_table (profiles doesn't have user_id)
            if (tableName === 'profiles') {
                 const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id);
                 if (profileError) throw profileError;
                 await db.profiles.clear();
                 await db.profiles.bulkPut(profileData);
            } else {
                throw error;
            }
        } else if (data) {
            // @ts-ignore
            await db[tableName].clear();
            // @ts-ignore
            await db[tableName].bulkPut(data);
        }
      }

      setLastSync(new Date());
      dismissToast(toastId);
      showSuccess(t('data_synced_successfully'));
    } catch (error: any) {
      console.error('Sync failed:', error);
      dismissToast(toastId);
      showError(`${t('data_sync_failed')}: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, user, isSyncing, t]);

  useEffect(() => {
    if (isOnline && user) {
      syncData();
    }
  }, [isOnline, user]);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSync, syncData }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};