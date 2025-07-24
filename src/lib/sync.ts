import { supabase } from '@/integrations/supabase/client';
import { db } from './db';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';

export const syncAllData = async (userId: string) => {
  if (!navigator.onLine) {
    console.log("Offline, skipping sync.");
    return;
  }
  
  const toastId = showLoading("Syncing data for offline use...");
  console.log("Starting data synchronization...");

  try {
    const tablesToSync = ['items', 'workers', 'tags', 'kits', 'kit_items', 'profiles', 'requisitions'];
    
    for (const tableName of tablesToSync) {
      const query = supabase.from(tableName).select('*');
      
      if (tableName === 'profiles') {
        // @ts-ignore
        query.eq('id', userId);
      } else {
        // @ts-ignore
        query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        // @ts-ignore
        await db[tableName].bulkPut(data);
      }
    }

    // Special handling for transactions to limit sync size
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100); // Sync last 100 transactions

    if (txError) throw txError;
    if (transactions) {
      await db.transactions.bulkPut(transactions);
    }

    console.log("Data synchronization complete.");
    dismissToast(toastId);
    showSuccess("Data synced and ready for offline use.");
  } catch (error: any) {
    console.error("Synchronization failed:", error);
    dismissToast(toastId);
    showError(`Sync failed: ${error.message}`);
  }
};