import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Worker } from '@/types';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignedPpeStatusProps {
  worker: Worker;
}

const AssignedPpeStatus: React.FC<AssignedPpeStatusProps> = ({ worker }) => {
  const { t } = useTranslation();
  const assignedPpeIds = worker.assigned_ppes || [];

  const ppeItems = useLiveQuery(
    () => db.items.where('id').anyOf(assignedPpeIds).toArray(),
    [assignedPpeIds.join(',')]
  );

  const transactions = useLiveQuery(
    () => db.transactions.where('worker_id').equals(worker.id).toArray(),
    [worker.id]
  );

  const ppeStatus = React.useMemo(() => {
    if (!ppeItems || !transactions) return undefined;

    const balances: { [itemId: string]: number } = {};
    transactions.forEach(tx => {
      if (assignedPpeIds.includes(tx.item_id)) {
        if (tx.type === 'takeout') {
          balances[tx.item_id] = (balances[tx.item_id] || 0) + tx.quantity;
        } else if (tx.type === 'return') {
          balances[tx.item_id] = (balances[tx.item_id] || 0) - tx.quantity;
        }
      }
    });

    return ppeItems.map(item => ({
      ...item,
      isCheckedOut: (balances[item.id] || 0) > 0,
    }));
  }, [ppeItems, transactions, assignedPpeIds]);

  if (assignedPpeIds.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-md">{t('assigned_ppe_status')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ppeStatus === undefined ? (
          <>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </>
        ) : ppeStatus.length > 0 ? (
          ppeStatus.map(item => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.name}</span>
              {item.isCheckedOut ? (
                <span className="flex items-center text-green-600">
                  <ShieldCheck className="mr-1 h-4 w-4" /> {t('checked_out')}
                </span>
              ) : (
                <span className="flex items-center text-red-600">
                  <ShieldAlert className="mr-1 h-4 w-4" /> {t('missing')}
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{t('no_ppe_assigned')}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignedPpeStatus;