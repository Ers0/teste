import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Users, Barcode, Settings as SettingsIcon, ClipboardList, History as HistoryIcon, FileText, ClipboardCheck, Tags } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useAuth } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useProfile } from '@/hooks/use-profile';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name
    ? profile.first_name
    : profile?.last_name
    ? profile.last_name
    : t('guest');

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError(t('failed_to_log_out') + error.message);
    } else {
      showSuccess(t('logged_out_successfully'));
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{t('loading_user_session')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">{t('welcome_user', { userName })}</CardTitle>
          <CardDescription className="mt-2">{t('manage_inventory_workers')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/inventory" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Package className="h-8 w-8 mb-2" />
              <span className="font-semibold">{t('inventory_management')}</span>
            </Card>
          </Link>
          <Link to="/workers" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Users className="h-8 w-8 mb-2" />
              <span className="font-semibold">{t('worker_management')}</span>
            </Card>
          </Link>
          <Link to="/scan-item" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Barcode className="h-8 w-8 mb-2" />
              <span className="font-semibold">{t('scan_item_add_remove')}</span>
            </Card>
          </Link>
          <Link to="/record-takeout" className="block cursor-pointer">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <ClipboardList className="h-8 w-8 mb-2" />
              <span className="font-semibold text-center">{t('record_item_takeout')}</span>
            </Card>
          </Link>
          <Link to="/transactions-history" className="block cursor-pointer">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <HistoryIcon className="h-8 w-8 mb-2" />
              <span className="font-semibold text-center">{t('transactions_history_title')}</span>
            </Card>
          </Link>
          <Link to="/fiscal-notes" className="block cursor-pointer">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <span className="font-semibold text-center">{t('fiscal_notes')}</span>
            </Card>
          </Link>
          <Link to="/requisitions" className="block cursor-pointer">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <ClipboardCheck className="h-8 w-8 mb-2" />
              <span className="font-semibold text-center">{t('requisitions')}</span>
            </Card>
          </Link>
          <Link to="/tags" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Tags className="h-8 w-8 mb-2" />
              <span className="font-semibold">{t('manage_tags')}</span>
            </Card>
          </Link>
          <Link to="/settings" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <SettingsIcon className="h-8 w-8 mb-2" />
              <span className="font-semibold">{t('settings')}</span>
            </Card>
          </Link>
        </CardContent>
        <div className="p-6 text-center">
          <Button variant="outline" onClick={handleLogout}>
            {t('log_out')}
          </Button>
        </div>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;