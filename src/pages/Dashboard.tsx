import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Users, Barcode, Settings as SettingsIcon, ClipboardList, History as HistoryIcon, FileText, ClipboardCheck, Tags, LogOut, AreaChart, PackagePlus, FileSignature } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useAuth } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useProfile } from '@/hooks/use-profile';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import LowStockAlerts from '@/components/dashboard/LowStockAlerts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import DashboardItemMovementChart from '@/components/dashboard/DashboardItemMovementChart';

const Dashboard = () => {
  const { t } = useTranslation();
  const { profile, isLoading: profileLoading } = useProfile();

  const items = useLiveQuery(() => db.items.toArray());
  const workers = useLiveQuery(() => db.workers.toArray());

  const stats = useMemo(() => {
    if (!items || !workers) return null;
    return {
      itemsCount: items.length,
      workersCount: workers.length,
    };
  }, [items, workers]);

  const userName = profile?.first_name || t('guest');

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(t('failed_to_log_out') + error.message);
    } else {
      showSuccess(t('logged_out_successfully'));
    }
  };

  const isLoading = profileLoading || items === undefined || workers === undefined;

  const quickLinks = [
    { to: "/inventory", icon: Package, label: t('inventory_management') },
    { to: "/workers", icon: Users, label: t('worker_management') },
    { to: "/scan-item", icon: Barcode, label: t('scan_item_add_remove') },
    { to: "/record-takeout", icon: ClipboardList, label: t('record_item_takeout') },
    { to: "/create-requisition", icon: FileSignature, label: t('create_requisition') },
    { to: "/analytics", icon: AreaChart, label: t('analytics') },
    { to: "/transactions-history", icon: HistoryIcon, label: t('transactions_history_title') },
    { to: "/fiscal-notes", icon: FileText, label: t('fiscal_notes') },
    { to: "/requisitions", icon: ClipboardCheck, label: t('requisitions') },
    { to: "/tags", icon: Tags, label: t('manage_tags') },
    { to: "/kits", icon: PackagePlus, label: t('manage_kits') },
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('log_out')}
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
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
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <LowStockAlerts />
          <RecentActivity />
        </div>

        {/* Analytics Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>{t('item_movement_chart_title')}</CardTitle>
            <CardDescription>{t('item_movement_chart_desc_dashboard')}</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardItemMovementChart />
          </CardContent>
        </Card>

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