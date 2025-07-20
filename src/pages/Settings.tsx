import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/use-profile'; // Import the new hook

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, invalidateProfile } = useProfile(); // Use the new hook
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [language, setLanguage] = useState('en'); // Default to English
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profileLoading && profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setLanguage(profile.language || 'en');
    } else if (!profileLoading && !profile) {
      // If no profile exists, ensure fields are empty
      setFirstName('');
      setLastName('');
      setLanguage('en');
    }
  }, [profile, profileLoading]);

  const handleSave = async () => {
    if (!user) {
      showError('You must be logged in to update settings.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, language: language })
      .eq('id', user.id);

    if (error) {
      showError('Error updating profile: ' + error.message);
    } else {
      showSuccess('Profile updated successfully!');
      invalidateProfile(); // Invalidate the profile query to trigger re-fetch in Dashboard
    }
    setIsSaving(false);
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
            <div className="w-10"></div> {/* Placeholder for alignment */}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {/* Add more languages as needed */}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;