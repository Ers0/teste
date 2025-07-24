import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Transaction } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';

interface PopulatedTransaction extends Transaction {
  items: { name: string } | null;
  workers: { name: string } | null;
}

const RecentActivity = () => {
  const { t } = useTranslation();

  const recentTransactions = useLiveQuery(async () => {
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

  const renderTransactionText = (tx: PopulatedTransaction) => {
    const itemName = tx.items?.name || t('unknown_item');
    const workerName = tx.workers?.name || tx.company || t('system_user');
    const quantity = tx.quantity;

    switch (tx.type) {
      case 'takeout':
        return t('activity_feed_takeout', { workerName, quantity, itemName });
      case 'return':
        return t('activity_feed_return', { workerName, quantity, itemName });
      case 'restock':
        return t('activity_feed_restock', { quantity, itemName });
      default:
        return 'Unknown transaction';
    }
  };

  const getTransactionVariant = (type: Transaction['type']) => {
    switch (type) {
      case 'takeout': return 'destructive';
      case 'return': return 'default';
      case 'restock': return 'secondary';
      default: return 'outline';
    }
  };

  if (recentTransactions === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('recent_activity')}
          </CardTitle>
          <CardDescription>{t('latest_inventory_movements')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          {t('recent_activity')}
        </CardTitle>
        <CardDescription>{t('latest_inventory_movements')}</CardDescription>
      </CardHeader>
      <CardContent>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('no_recent_activity')}</p>
        ) : (
          <div className="space-y-4">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm">{renderTransactionText(tx)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleString()}</p>
                </div>
                <Badge variant={getTransactionVariant(tx.type)}>{t(tx.type)}</Badge>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" className="w-full mt-4" asChild>
          <Link to="/transactions-history">
            {t('view_all_transactions')} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;