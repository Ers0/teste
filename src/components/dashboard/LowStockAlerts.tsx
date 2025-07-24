import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ShieldCheck, ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Item } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const LowStockAlerts = () => {
  const { t } = useTranslation();
  const items = useLiveQuery(() => db.items.toArray());

  const { lowStockItems, criticalStockItems } = useMemo(() => {
    if (!items) return { lowStockItems: [], criticalStockItems: [] };

    const low: Item[] = [];
    const critical: Item[] = [];

    items.forEach(item => {
      if (item.is_tool) return; // Tools don't have stock levels in the same way

      const lowThreshold = item.low_stock_threshold ?? 0;
      const criticalThreshold = item.critical_stock_threshold ?? 0;

      if (item.quantity <= criticalThreshold) {
        critical.push(item);
      } else if (item.quantity <= lowThreshold) {
        low.push(item);
      }
    });

    return { lowStockItems: low, criticalStockItems: critical };
  }, [items]);

  if (items === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('items_requiring_attention')}
          </CardTitle>
          <CardDescription>{t('low_and_critical_stock_items')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (lowStockItems.length === 0 && criticalStockItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            {t('inventory_status')}
          </CardTitle>
          <CardDescription>{t('all_items_stocked_up')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('great_job_stock_ok')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          {t('items_requiring_attention')}
        </CardTitle>
        <CardDescription>{t('low_and_critical_stock_items')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-64 overflow-y-auto">
        {criticalStockItems.length > 0 && (
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <ShieldX className="h-4 w-4 text-red-500" />
              {t('critical_stock')}
            </h4>
            <div className="space-y-2">
              {criticalStockItems.map(item => (
                <Link to="/inventory" key={item.id} className="block">
                  <div className="flex justify-between items-center p-2 rounded-md hover:bg-accent">
                    <span>{item.name}</span>
                    <Badge variant="destructive">{t('quantity')}: {item.quantity}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        {lowStockItems.length > 0 && (
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              {t('low_stock')}
            </h4>
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <Link to="/inventory" key={item.id} className="block">
                  <div className="flex justify-between items-center p-2 rounded-md hover:bg-accent">
                    <span>{item.name}</span>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('quantity')}: {item.quantity}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LowStockAlerts;