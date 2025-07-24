import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { User } from '@supabase/supabase-js';

interface SyncContextType {
  isSyncing: boolean;
  lastSync: Date | null;
  syncData: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const processOutbox = async (t: TFunction) => {
  const operations = await db.outbox.orderBy('timestamp').toArray();
  if (operations.length === 0) return true;

  console.log(`Processing ${operations.length} offline operations...`);

  for (const op of operations) {
    try {
      let error;
      switch (op.type) {
        case 'create':
          ({ error } = await supabase.from(op.table).insert(op.payload));
          break;
        case 'update':
          ({ error } = await supabase.from(op.table).update(op.payload).eq('id', op.payload.id));
          break;
        case 'delete':
          ({ error } = await supabase.from(op.table).delete().eq('id', op.payload.id));
          break;
      }
      if (error) {
        if (error.code === '23505') { // unique_violation
          console.warn(`Conflict detected for operation ${op.id}, skipping. Data will be overwritten by server pull.`);
          await db.outbox.delete(op.id!);
        } else {
          throw error;
        }
      } else {
        await db.outbox.delete(op.id!);
      }
    } catch (err: any) {
      console.error('Failed to sync operation:', op, err);
      // No user-facing error here, as the indicator shows the state.
      return false; // Stop processing on first error
    }
  }
  console.log('Offline changes synced successfully.');
  return true;
};

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const isSyncingRef = useRef(false);
  
  const userRef = useRef<User | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const syncData = useCallback(async () => {
    const currentUser = userRef.current;
    if (!isOnline || !currentUser || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    
    const outboxSuccess = await processOutbox(t);
    if (!outboxSuccess) {
      setIsSyncing(false);
      isSyncingRef.current = false;
      return;
    }

    console.log('Syncing data from server...');

    try {
      const tablesToSync = [
        'items', 'workers', 'tags', 'kits', 'kit_items', 
        'transactions', 'requisitions', 'fiscal_notes', 'profiles'
      ];

      for (const tableName of tablesToSync) {
        if (tableName === 'profiles') {
          const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', currentUser.id);
          if (profileError) throw profileError;
          await db.profiles.clear();
          await db.profiles.bulkPut(profileData);
        } else {
          // @ts-ignore
          const { data, error } = await supabase.from(tableName).select('*').eq('user_id', currentUser.id);
          if (error) throw error;
          if (data) {
            // @ts-ignore
            await db[tableName].clear();
            // @ts-ignore
            await db[tableName].bulkPut(data);
          }
        }
      }

      setLastSync(new Date());
      console.log('Data synced successfully.');
    } catch (error: any) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [isOnline, t]);

  useEffect(() => {
    if (isOnline && user) {
      syncData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user?.id]);

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