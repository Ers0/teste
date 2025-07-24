import React from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Worker, Item, Transaction } from '@/types';

interface OutstandingItem {
  worker_id: string;
  item_id: string;
  worker_name: string;
  company: string | null;
  item_name: string;
  outstanding_quantity: number;
}

const OutstandingItems = () => {
  const { t } = useTranslation();

  const outstandingItems = useLiveQuery(async () => {
    const transactions = await db.transactions.where('type').anyOf('takeout', 'return').toArray();
    const items = await db.items.toArray();
    const workers = await db.workers.toArray();

    const itemsMap = new Map(items.map(i => [i.id, i]));
    const workersMap = new Map(workers.map(w => [w.id, w]));

    const balances: { [key: string]: number } = {};

    for (const tx of transactions) {
        if (!tx.worker_id) continue;
        const key = `${tx.worker_id}-${tx.item_id}`;
        if (tx.type === 'takeout') {
            balances[key] = (balances[key] || 0) + tx.quantity;
        } else if (tx.type === 'return') {
            balances[key] = (balances[key] || 0) - tx.quantity;
        }
    }

    const result: OutstandingItem[] = [];
    for (const key in balances) {
        if (balances[key] > 0) {
            const [worker_id, item_id] = key.split('-');
            const worker = workersMap.get(worker_id);
            const item = itemsMap.get(item_id);
            if (worker && item) {
                result.push({
                    worker_id,
                    item_id,
                    worker_name: worker.name,
                    company: worker.company,
                    item_name: item.name,
                    outstanding_quantity: balances[key],
                });
            }
        }
    }
    return result;
  }, []);

  return (
    <div className="space-y-6 pt-4">
      <h3 className="text-lg font-semibold flex items-center">
        <HistoryIcon className="mr-2 h-5 w-5" /> {t('outstanding_takeouts_title')}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('outstanding_takeouts_description')}
      </p>
      {outstandingItems === undefined ? (
        <p className="text-gray-500">{t('loading_outstanding_takeouts')}</p>
      ) : outstandingItems && outstandingItems.length > 0 ? (
        <div className="space-y-2">
          {outstandingItems.map((item) => (
            <div key={`${item.worker_id}-${item.item_id}`} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
              <p><strong>{t('recipient')}:</strong> {item.worker_name} ({item.company || 'N/A'})</p>
              <p><strong>{t('item')}:</strong> {item.item_name}</p>
              <p><strong>{t('quantity')}:</strong> {item.outstanding_quantity}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">{t('no_outstanding_takeouts')}</p>
      )}
    </div>
  );
};

export default OutstandingItems;