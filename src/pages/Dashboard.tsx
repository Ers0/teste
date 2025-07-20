import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Keep Button for logout
import { Package, Users, Barcode, Settings as SettingsIcon } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useAuth } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useProfile } from '@/hooks/use-profile';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();

  const userName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name
    ? profile.first_name
    : profile?.last_name
    ? profile.last_name
    : user?.email || 'Guest';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError('Failed to log out: ' + error.message);
    } else {
      showSuccess('Logged out successfully!');
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading user session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Welcome, {userName}!</CardTitle>
          <CardDescription className="mt-2">Manage your construction warehouse inventory and workers.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/inventory" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Package className="h-8 w-8 mb-2" />
              <span className="font-semibold">Inventory Management</span>
            </Card>
          </Link>
          <Link to="/workers" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Users className="h-8 w-8 mb-2" />
              <span className="font-semibold">Worker Management</span>
            </Card>
          </Link>
          <Link to="/scan-item" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <Barcode className="h-8 w-8 mb-2" />
              <span className="font-semibold">Scan Item (Add/Remove)</span>
            </Card>
          </Link>
          <Link to="/settings" className="block">
            <Card className="w-full h-32 flex flex-col items-center justify-center text-lg p-4 transition-all duration-200 rounded-lg shadow-md hover:shadow-lg hover:bg-primary hover:text-primary-foreground">
              <SettingsIcon className="h-8 w-8 mb-2" />
              <span className="font-semibold">Settings</span>
            </Card>
          </Link>
        </CardContent>
        <div className="p-6 text-center">
          <Button variant="outline" onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;