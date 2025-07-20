import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Users, Barcode, QrCode, Settings as SettingsIcon } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useAuth } from '@/integrations/supabase/auth';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error.message);
          setUserName(user.email); // Fallback to email on error
        } else if (data) {
          if (data.first_name && data.last_name) {
            setUserName(`${data.first_name} ${data.last_name}`);
          } else if (data.first_name) {
            setUserName(data.first_name);
          } else if (data.last_name) {
            setUserName(data.last_name);
          } else {
            setUserName(user.email); // Fallback if no name is set
          }
        } else {
          setUserName(user.email); // Fallback if no profile data
        }
      } else {
        setUserName('Guest'); // For unauthenticated state, though auth should redirect
      }
    };

    if (!loading) {
      fetchUserProfile();
    }
  }, [user, loading]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError('Failed to log out: ' + error.message);
    } else {
      showSuccess('Logged out successfully!');
    }
  };

  if (loading) {
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
          <CardTitle className="text-3xl font-bold">Welcome, {userName || 'Guest'}!</CardTitle>
          <CardDescription className="mt-2">Manage your construction warehouse inventory and workers.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/inventory">
            <Button className="w-full h-32 flex flex-col items-center justify-center text-lg">
              <Package className="h-8 w-8 mb-2" />
              Inventory Management
            </Button>
          </Link>
          <Link to="/workers">
            <Button className="w-full h-32 flex flex-col items-center justify-center text-lg">
              <Users className="h-8 w-8 mb-2" />
              Worker Management
            </Button>
          </Link>
          <Link to="/scan-item">
            <Button className="w-full h-32 flex flex-col items-center justify-center text-lg">
              <Barcode className="h-8 w-8 mb-2" />
              Scan Item (Add/Remove)
            </Button>
          </Link>
          <Link to="/settings">
            <Button className="w-full h-32 flex flex-col items-center justify-center text-lg">
              <SettingsIcon className="h-8 w-8 mb-2" />
              Settings
            </Button>
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