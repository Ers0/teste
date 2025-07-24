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
    const tables = ['items', 'workers', 'tags', 'kits', 'kit_items', 'profiles'];
    
    for (const tableName of tables) {
      const query = supabase.from(tableName).select('*');
      
      // The 'profiles' table has 'id' as the foreign key, not 'user_id'
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

    console.log("Data synchronization complete.");
    dismissToast(toastId);
    showSuccess("Data synced and ready for offline use.");
  } catch (error: any) {
    console.error("Synchronization failed:", error);
    dismissToast(toastId);
    showError(`Sync failed: ${error.message}`);
  }
};