import { ArrowLeft, Package, Users, AlertTriangle, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ItemMovementChart from '@/components/analytics/ItemMovementChart';
import TransactionVolumeChart from '@/components/analytics/TransactionVolumeChart';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';

const Analytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analyticsPageStats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { count: itemsCount } = await supabase.from('items').select('*', { count: 'exact', head: true });
      const { count: workersCount } = await supabase.from('workers').select('*', { count: 'exact', head: true });
      
      const { data: lowStockItemsData, error } = await supabase
        .from('items')
        .select('id, name, quantity, low_stock_threshold, critical_stock_threshold')
        .or('quantity.lte.low_stock_threshold,quantity.lte.critical_stock_threshold');

      if (error) {
        console.error("Error fetching low stock items:", error);
        return { itemsCount, workersCount, lowStockItems: [], criticalStockCount: 0, lowStockCount: 0 };
      }

      const lowStockItems = lowStockItemsData || [];
      const criticalStockCount = lowStockItems.filter(item => item.critical_stock_threshold && item.quantity <= item.critical_stock_threshold).length;
      const lowStockCount = lowStockItems.filter(item => item.low_stock_threshold && item.critical_stock_threshold && item.quantity <= item.low_stock_threshold && item.quantity > item.critical_stock_threshold).length;

      return { itemsCount, workersCount, lowStockItems, criticalStockCount, lowStockCount };
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('analytics_dashboard')}</h1>
            <p className="text-muted-foreground">{t('analytics_subtitle')}</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('total_items')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats?.itemsCount ?? 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('total_workers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats?.workersCount ?? 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('critical_stock_items')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold text-destructive">{stats?.criticalStockCount ?? 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('low_stock_items')}</CardTitle>
              <TrendingDown className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold text-amber-500">{stats?.lowStockCount ?? 0}</div>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('item_movement_chart_title')}</CardTitle>
              <CardDescription>{t('item_movement_chart_desc_v2')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemMovementChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('transaction_volume_title')}</CardTitle>
              <CardDescription>{t('transaction_volume_desc_v2')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionVolumeChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('actionable_low_stock_title')}</CardTitle>
              <CardDescription>{t('actionable_low_stock_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-[350px] w-full" /> : (
                <div className="overflow-auto h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('item_name')}</TableHead>
                        <TableHead className="text-right">{t('current_quantity')}</TableHead>
                        <TableHead className="text-right">{t('threshold')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
                        stats.lowStockItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.critical_stock_threshold && item.quantity <= item.critical_stock_threshold ? 'destructive' : 'secondary'} className={!(item.critical_stock_threshold && item.quantity <= item.critical_stock_threshold) ? 'bg-amber-500 text-white' : ''}>
                                {item.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{item.critical_stock_threshold && item.quantity <= item.critical_stock_threshold ? item.critical_stock_threshold : item.low_stock_threshold}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center">{t('no_low_stock_items')}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;