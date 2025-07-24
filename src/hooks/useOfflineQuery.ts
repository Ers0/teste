import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNetworkStatus } from './useNetworkStatus';
import { Table } from 'dexie';
import { db } from '@/lib/db';

export const useOfflineQuery = <T extends { id: string }>(
  queryKey: any[],
  tableName: keyof typeof db,
  onlineQueryFn: () => Promise<T[] | null>
) => {
  const isOnline = useNetworkStatus();
  const dexieTable = db[tableName] as unknown as Table<T, any>;

  const { data: onlineData, isLoading: isOnlineLoading, error: onlineError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await onlineQueryFn();
      if (data) {
        await dexieTable.bulkPut(data);
      }
      return data;
    },
    enabled: isOnline,
  });

  const offlineData = useLiveQuery(() => dexieTable.toArray(), []);

  const data = isOnline ? onlineData : offlineData;
  const isLoading = isOnline ? isOnlineLoading || isFetching : offlineData === undefined;
  const error = isOnline ? onlineError : null;

  return { data, isLoading, error, refetch };
};