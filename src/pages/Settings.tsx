import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { Settings as SettingsIcon, ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/use-profile';
import { exportToCsv } from '@/utils/export';
import { useTranslation } from 'react-i18next'; // Import useTranslation

// Define interfaces for the data shapes expected from Supabase queries for export
interface ExportableInventoryItem {
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
}

// Define the exact structure of a single row returned by the Supabase transactions query
interface SupabaseTransactionRow {
  type: 'takeout' | 'return';
  quantity: number;
  timestamp: string;
  items: { name: string }[] | null; // Supabase returns an array for joined relations, or null
  workers: { name: string; id: string; qr_code_data: string | null; }[] | null; // Supabase returns an array for joined relations, or null
}

const Settings = () => {
  const { t, i18n } = useTranslation(); // Initialize useTranslation
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, invalidateProfile } = useProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [language, setLanguage] = useState('en');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'black'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark' | 'black') || 'light';
    }
    return 'light';
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!profileLoading && profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setLanguage(profile.language || 'en');
      i18n.changeLanguage(profile.language || 'en'); // Set i18n language from profile
    } else if (!profileLoading && !profile) {
      setFirstName('');
      setLastName('');
      setLanguage('en');
      i18n.changeLanguage('en'); // Default to English if no profile
    }
  }, [profile, profileLoading, i18n]);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'black');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSaveProfile = async () => {
    if (!user) {
      showError(t('user_not_authenticated_update_settings')); // Translated error
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          language: language,
        },
        { onConflict: 'id' }
      );

    if (error) {
      showError(t('error_updating_profile') + error.message); // Translated error
    } else {
      showSuccess(t('profile_updated_successfully')); // Translated success
      invalidateProfile();
      i18n.changeLanguage(language); // Change i18n language immediately
    }
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      showError(t('enter_new_password')); // Translated error
      return;
    }
    if (newPassword.length < 6) {
      showError(t('password_min_length')); // Translated error
      return;
    }

    setIsPasswordChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      showError(t('error_changing_password') + error.message); // Translated error
    } else {
      showSuccess(t('password_changed_successfully')); // Translated success
      setNewPassword('');
    }
    setIsPasswordChanging(false);
  };

  const handleExportInventory = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('name, description, barcode, quantity, low_stock_threshold, critical_stock_threshold');
    if (error) {
      showError(t('error_fetching_inventory_data') + error.message); // Translated error
      return;
    }
    if (data) {
      const formattedData = (data as ExportableInventoryItem[]).map(item => ({
        [t('item_name')]: item.name,
        [t('description')]: item.description || 'N/A',
        [t('barcode')]: item.barcode || 'N/A',
        [t('current_quantity')]: item.quantity,
        [t('low_stock_threshold')]: item.low_stock_threshold,
        [t('critical_stock_threshold')]: item.critical_stock_threshold,
      }));
      exportToCsv(formattedData, 'inventory_report.csv');
      showSuccess(t('inventory_report_downloaded')); // Translated success
    }
  };

  const handleExportTransactions = async () => {
    const { data, error } = await supabase.from('transactions').select('type, quantity, timestamp, items(name), workers(name, id, qr_code_data)');
    if (error) {
      showError(t('error_fetching_transaction_data') + error.message); // Translated error
      return;
    }
    if (data) {
      // Cast the data to the correct Supabase row type
      const transactionsData = data as SupabaseTransactionRow[];

      // Flatten and rename the data for CSV export
      const flattenedData = transactionsData.map(t_data => ({
        [t('item_name')]: t_data.items?.[0]?.name || 'N/A', // Access the first element of the array
        [t('worker_name')]: t_data.workers?.[0]?.name || 'N/A', // Access the first element of the array
        [t('worker_id')]: t_data.workers?.[0]?.id || 'N/A',
        [t('worker_qr_code_data')]: t_data.workers?.[0]?.qr_code_data || 'N/A',
        [t('transaction_type')]: t_data.type.charAt(0).toUpperCase() + t_data.type.slice(1),
        [t('quantity')]: t_data.quantity,
        [t('timestamp')]: new Date(t_data.timestamp).toLocaleString(),
      }));
      exportToCsv(flattenedData, 'transaction_history_report.csv');
      showSuccess(t('transaction_history_report_downloaded')); // Translated success
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{t('loading_settings')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-grow text-center">
              <CardTitle className="text-2xl">{t('settings')}</CardTitle>
              <CardDescription>{t('manage_profile_preferences')}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Settings */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{t('profile_information')}</h3>
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('first_name')}</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('enter_first_name')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('last_name')}</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('enter_last_name')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{t('app_language')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue placeholder={t('select_language')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('english')}</SelectItem>
                  <SelectItem value="es">{t('spanish')}</SelectItem>
                  <SelectItem value="pt-BR">{t('portuguese_brazil')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveProfile} className="w-full" disabled={isSaving}>
              {isSaving ? t('saving_profile') : t('save_profile_changes')}
            </Button>
          </div>

          {/* Password Change */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{t('change_password')}</h3>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('new_password')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('enter_new_password')}
              />
            </div>
            <Button onClick={handleChangePassword} className="w-full" disabled={isPasswordChanging}>
              {isPasswordChanging ? t('changing_password') : t('change_password')}
            </Button>
          </div>

          {/* Biometry Note */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{t('biometric_authentication')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('biometric_note')}
            </p>
          </div>

          {/* Theme Selection */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{t('app_theme')}</h3>
            <div className="space-y-2">
              <Label htmlFor="theme">{t('select_theme')}</Label>
              <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'black') => setTheme(value)}>
                <SelectTrigger id="theme">
                  <SelectValue placeholder={t('select_theme')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('light')}</SelectItem>
                  <SelectItem value="dark">{t('dark')}</SelectItem>
                  <SelectItem value="black">{t('black')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reports Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('reports')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('reports_note')}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleExportInventory} className="w-full">
                <Download className="mr-2 h-4 w-4" /> {t('export_inventory_data')}
              </Button>
              <Button onClick={handleExportTransactions} className="w-full">
                <Download className="mr-2 h-4 w-4" /> {t('export_transaction_history')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;