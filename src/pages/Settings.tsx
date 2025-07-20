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

// Define interfaces for the data shapes expected from Supabase queries for export
interface ExportableInventoryItem {
  name: string;
  description: string | null;
  barcode: string | null;
  quantity: number;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
}

interface ExportableTransactionRecord {
  type: 'takeout' | 'return';
  quantity: number;
  timestamp: string;
  items: { name: string }[]; // Changed to array
  workers: { name: string }[]; // Changed to array
}

const Settings = () => {
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
    } else if (!profileLoading && !profile) {
      setFirstName('');
      setLastName('');
      setLanguage('en');
    }
  }, [profile, profileLoading]);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'black');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSaveProfile = async () => {
    if (!user) {
      showError('You must be logged in to update settings.');
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
      showError('Error updating profile: ' + error.message);
    } else {
      showSuccess('Profile updated successfully!');
      invalidateProfile();
    }
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      showError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    setIsPasswordChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      showError('Error changing password: ' + error.message);
    } else {
      showSuccess('Password changed successfully!');
      setNewPassword('');
    }
    setIsPasswordChanging(false);
  };

  const handleExportInventory = async () => {
    const { data, error } = await supabase
      .from('items')
      .select('name, description, barcode, quantity, low_stock_threshold, critical_stock_threshold');
    if (error) {
      showError('Error fetching inventory data: ' + error.message);
      return;
    }
    if (data) {
      const formattedData = (data as ExportableInventoryItem[]).map(item => ({
        'Item Name': item.name,
        'Description': item.description || 'N/A',
        'Barcode': item.barcode || 'N/A',
        'Current Quantity': item.quantity,
        'Low Stock Threshold': item.low_stock_threshold,
        'Critical Stock Threshold': item.critical_stock_threshold,
      }));
      exportToCsv(formattedData, 'inventory_report.csv');
      showSuccess('Inventory report downloaded!');
    }
  };

  const handleExportTransactions = async () => {
    const { data, error } = await supabase.from('transactions').select('type, quantity, timestamp, items(name), workers(name)');
    if (error) {
      showError('Error fetching transaction data: ' + error.message);
      return;
    }
    if (data) {
      // Flatten and rename the data for CSV export
      const flattenedData = (data as ExportableTransactionRecord[]).map(t => ({
        'Item Name': t.items?.[0]?.name || 'N/A', // Access name from the first element of the array
        'Worker Name': t.workers?.[0]?.name || 'N/A', // Access name from the first element of the array
        'Transaction Type': t.type.charAt(0).toUpperCase() + t.type.slice(1),
        'Quantity': t.quantity,
        'Timestamp': new Date(t.timestamp).toLocaleString(),
      }));
      exportToCsv(flattenedData, 'transaction_history_report.csv');
      showSuccess('Transaction history report downloaded!');
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
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
              <CardTitle className="text-2xl">Settings</CardTitle>
              <CardDescription>Manage your profile and application preferences.</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Settings */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">Profile Information</h3>
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">App Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveProfile} className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving Profile...' : 'Save Profile Changes'}
            </Button>
          </div>

          {/* Password Change */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">Change Password</h3>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <Button onClick={handleChangePassword} className="w-full" disabled={isPasswordChanging}>
              {isPasswordChanging ? 'Changing Password...' : 'Change Password'}
            </Button>
          </div>

          {/* Biometry Note */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">Biometric Authentication</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Biometric registration (e.g., fingerprint, face ID) is a feature typically available in native mobile applications (Android/iOS) and is not directly supported in web browsers for security reasons.
            </p>
          </div>

          {/* Theme Selection */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">App Theme</h3>
            <div className="space-y-2">
              <Label htmlFor="theme">Select Theme</Label>
              <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'black') => setTheme(value)}>
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reports Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download your inventory and transaction data as CSV files for external analysis in spreadsheet software.
              Please note: Real-time, cloud-based spreadsheet integration requires external setup (e.g., Google Sheets API, Zapier, custom scripts) to connect to your Supabase database, which is beyond the scope of this application.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleExportInventory} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Export Inventory Data
              </Button>
              <Button onClick={handleExportTransactions} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Export Transaction History
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;