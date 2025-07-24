import { supabase } from '@/integrations/supabase/client';
import { db, OfflineAction } from './db';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';

let isSyncing = false;

export const processOfflineQueue = async () => {
  if (!navigator.onLine || isSyncing) {
    return;
  }

  isSyncing = true;
  const actions = await db.offline_queue.orderBy('timestamp').toArray();

  if (actions.length === 0) {
    isSyncing = false;
    return;
  }

  const toastId = showLoading(`Syncing ${actions.length} offline changes...`);

  try {
    for (const action of actions) {
      let error;
      switch (action.type) {
        case 'create':
          ({ error } = await supabase.from(action.tableName).insert(action.payload));
          break;
        case 'update':
          ({ error } = await supabase.from(action.tableName).update(action.payload).eq('id', action.payload.id));
          break;
        case 'delete':
          ({ error } = await supabase.from(action.tableName).delete().eq('id', action.payload.id));
          break;
      }

      if (error) {
        // For now, we stop on the first error to prevent data integrity issues.
        // A more advanced implementation could handle individual failures.
        throw new Error(`Failed to sync action for table ${action.tableName}: ${error.message}`);
      } else {
        // If successful, remove it from the queue
        await db.offline_queue.delete(action.id!);
      }
    }
    dismissToast(toastId);
    showSuccess('All offline changes have been synced.');
  } catch (error: any) {
    dismissToast(toastId);
    showError(`Sync failed: ${error.message}`);
  } finally {
    isSyncing = false;
  }
};

// Listen for when the app comes back online
window.addEventListener('online', processOfflineQueue);