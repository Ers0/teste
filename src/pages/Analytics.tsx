import { ArrowLeft, Package, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
      
      return { itemsCount, workersCount };
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
        <div className="grid gap-6 md:grid-cols-2">
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
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('transaction_volume_title')}</CardTitle>
              <CardDescription>{t('transaction_volume_desc_v2')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionVolumeChart />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;