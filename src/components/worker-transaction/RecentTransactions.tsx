import React from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Transaction } from '@/types';

interface PopulatedTransaction extends Transaction {
  items: { name: string } | null;
  workers: { name: string } | null;
}

const RecentTransactions = () => {
  const { t } = useTranslation();

  const transactionsHistory = useLiveQuery(async () => {
    const transactions = await db.transactions.orderBy('timestamp').reverse().limit(5).toArray();
    const populated = await Promise.all(transactions.map(async (tx) => {
        const item = await db.items.get(tx.item_id);
        const worker = tx.worker_id ? await db.workers.get(tx.worker_id) : null;
        return {
            ...tx,
            items: item ? { name: item.name } : null,
            workers: worker ? { name: worker.name } : null,
        };
    }));
    return populated;
  }, []);

  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-lg font-semibold flex items-center">
        <HistoryIcon className="mr-2 h-5 w-5" /> {t('recent_transaction_history')}
      </h3>
      {transactionsHistory === undefined ? (
        <p className="text-gray-500">{t('loading_history')}</p>
      ) : transactionsHistory && transactionsHistory.length > 0 ? (
        <div className="space-y-2">
          {transactionsHistory.map((transaction) => (
            <div key={transaction.id} className="border p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
              <p><strong>{t('recipient')}:</strong> {transaction.workers?.name || transaction.company || 'N/A'}</p>
              <p><strong>{t('item')}:</strong> {transaction.items?.name || 'N/A'}</p>
              <p>
                <strong>{t('type')}:</strong>{' '}
                <span
                  className={`font-medium px-2 py-1 rounded-full text-xs ${
                    transaction.type === 'takeout'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                      : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                  }`}
                >
                  {t(transaction.type)}
                </span>
              </p>
              <p><strong>{t('quantity')}:</strong> {transaction.quantity}</p>
              {transaction.authorized_by && <p><strong>{t('authorized_by')}:</strong> {transaction.authorized_by}</p>}
              {transaction.given_by && <p><strong>{t('given_by')}:</strong> {transaction.given_by}</p>}
              <p className="text-xs text-gray-500">
                {new Date(transaction.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">{t('no_recent_transactions')}</p>
      )}
    </div>
  );
};

export default RecentTransactions;