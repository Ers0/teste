import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Users, Barcode, Settings as SettingsIcon, ClipboardList, History as HistoryIcon, FileText, ClipboardCheck, Tags, AlertTriangle, Star, LogOut } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useAuth } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useProfile } from '@/hooks/use-profile';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { count: itemsCount } = await supabase.from('items').select('*', { count: 'exact', head: true });
      const { count: workersCount } = await supabase.from('workers').select('*', { count: 'exact', head: true });
      
      const { data: lowStockItems } = await supabase.from('items').select('id, name, quantity, low_stock_threshold, critical_stock_threshold').order('quantity', { ascending: true });
      const criticalStockItems = lowStockItems?.filter(item => item.critical_stock_threshold && item.quantity <= item.critical_stock_threshold) || [];
      const warningStockItems = lowStockItems?.filter(item => item.low_stock_threshold && item.critical_stock_threshold && item.quantity <= item.low_stock_threshold && item.quantity > item.critical_stock_threshold) || [];

      const { data: lowReliabilityWorkers } = await supabase
        .from('workers')
        .select('id, name, reliability_score')
        .lt('reliability_score', 80)
        .order('reliability_score', { ascending: true })
        .limit(5);

      return {
        itemsCount,
        workersCount,
        criticalStockItems,
        warningStockItems,
        lowReliabilityWorkers,
      };
    },
    enabled: !!user,
  });

  const userName = profile?.first_name || t('guest');

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(t('failed_to_log_out') + error.message);
    } else {
      showSuccess(t('logged_out_successfully'));
    }
  };

  const isLoading = profileLoading || statsLoading;

  const quickLinks = [
    { to: "/inventory", icon: Package, label: t('inventory_management') },
    { to: "/workers", icon: Users, label: t('worker_management') },
    { to: "/scan-item", icon: Barcode, label: t('scan_item_add_remove') },
    { to: "/record-takeout", icon: ClipboardList, label: t('record_item_takeout') },
    { to: "/transactions-history", icon: HistoryIcon, label: t('transactions_history_title') },
    { to: "/fiscal-notes", icon: FileText, label: t('fiscal_notes') },
    { to: "/requisitions", icon: ClipboardCheck, label: t('requisitions') },
    { to: "/tags", icon: Tags, label: t('manage_tags') },
    { to: "/settings", icon: SettingsIcon, label: t('settings') },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('welcome_user', { userName })}</h1>
            <p className="text-muted-foreground">{t('dashboard_subtitle')}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('log_out')}
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex-1 pr-2">{t('total_items')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats?.itemsCount ?? 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex-1 pr-2">{t('total_workers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{stats?.workersCount ?? 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex-1 pr-2">{t('critical_stock_items')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold text-destructive">{stats?.criticalStockItems.length ?? 0}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex-1 pr-2">{t('low_reliability_workers')}</CardTitle>
              <Star className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold text-amber-500">{stats?.lowReliabilityWorkers?.length ?? 0}</div>}
            </CardContent>
          </Card>
        </div>

        {/* Alerts and Lists */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('stock_alerts')}</CardTitle>
              <CardDescription>{t('items_needing_attention')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ) : (
                <div className="space-y-4">
                  {stats?.criticalStockItems && stats.criticalStockItems.length > 0 ? (
                    stats.criticalStockItems.map(item => (
                      <div key={item.id} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <Link to="/inventory" className="font-medium hover:underline">{item.name}</Link>
                        <Badge variant="destructive">{t('quantity')}: {item.quantity}</Badge>
                      </div>
                    ))
                  ) : <p className="text-sm text-muted-foreground">{t('no_critical_stock_items')}</p>}
                  {stats?.warningStockItems && stats.warningStockItems.length > 0 && (
                    stats.warningStockItems.map(item => (
                      <div key={item.id} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <Link to="/inventory" className="font-medium hover:underline">{item.name}</Link>
                        <Badge variant="secondary" className="bg-amber-500 text-white">{t('quantity')}: {item.quantity}</Badge>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('low_reliability_workers')}</CardTitle>
              <CardDescription>{t('workers_with_lowest_scores')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ) : (
                <div className="space-y-4">
                  {stats?.lowReliabilityWorkers && stats.lowReliabilityWorkers.length > 0 ? (
                    stats.lowReliabilityWorkers.map(worker => (
                      <div key={worker.id} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <Link to={`/worker-report/${worker.id}`} className="font-medium hover:underline">{worker.name}</Link>
                        <Badge variant="secondary">{t('score')}: {worker.reliability_score}</Badge>
                      </div>
                    ))
                  ) : <p className="text-sm text-muted-foreground">{t('all_workers_good_standing')}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quick_actions')}</CardTitle>
            <CardDescription>{t('navigate_to_app_sections')}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickLinks.map(link => (
              <Link key={link.to} to={link.to}>
                <Button variant="outline" className="w-full min-h-24 h-full flex flex-col gap-2 p-2">
                  <link.icon className="h-6 w-6" />
                  <span className="text-center text-xs sm:text-sm">{link.label}</span>
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>

        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Dashboard;