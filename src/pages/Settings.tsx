import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/use-profile';
import { useIntl } from 'react-intl';

const Settings = () => {
  const intl = useIntl();
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, invalidateProfile } = useProfile();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [language, setLanguage] = useState('pt-BR');
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
      setLanguage(profile.language || 'pt-BR');
    } else if (!profileLoading && !profile) {
      setFirstName('');
      setLastName('');
      setLanguage('pt-BR');
    }
  }, [profile, profileLoading]);

  const handleSaveProfile = async () => {
    if (!user) {
      showError(intl.formatMessage({ id: 'user_not_authenticated_update_settings' }));
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
      showError(intl.formatMessage({ id: 'error_updating_profile' }) + error.message);
    } else {
      showSuccess(intl.formatMessage({ id: 'profile_updated_successfully' }));
      invalidateProfile();
    }
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword) {
      showError(intl.formatMessage({ id: 'enter_new_password' }));
      return;
    }
    if (newPassword.length < 6) {
      showError(intl.formatMessage({ id: 'password_min_length' }));
      return;
    }

    setIsPasswordChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      showError(intl.formatMessage({ id: 'error_changing_password' }) + error.message);
    } else {
      showSuccess(intl.formatMessage({ id: 'password_changed_successfully' }));
      setNewPassword('');
    }
    setIsPasswordChanging(false);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{intl.formatMessage({ id: 'loading_settings' })}</p>
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
              <CardTitle className="text-2xl">{intl.formatMessage({ id: 'settings' })}</CardTitle>
              <CardDescription>{intl.formatMessage({ id: 'manage_profile_preferences' })}</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Settings */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{intl.formatMessage({ id: 'profile_information' })}</h3>
            <div className="space-y-2">
              <Label htmlFor="firstName">{intl.formatMessage({ id: 'first_name' })}</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={intl.formatMessage({ id: 'enter_first_name' })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{intl.formatMessage({ id: 'last_name' })}</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={intl.formatMessage({ id: 'enter_last_name' })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">{intl.formatMessage({ id: 'app_language' })}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue placeholder={intl.formatMessage({ id: 'select_language' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{intl.formatMessage({ id: 'english' })}</SelectItem>
                  <SelectItem value="es">{intl.formatMessage({ id: 'spanish' })}</SelectItem>
                  <SelectItem value="pt-BR">{intl.formatMessage({ id: 'portuguese_brazil' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveProfile} className="w-full" disabled={isSaving}>
              {isSaving ? intl.formatMessage({ id: 'saving_profile' }) : intl.formatMessage({ id: 'save_profile_changes' })}
            </Button>
          </div>

          {/* Password Change */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{intl.formatMessage({ id: 'change_password' })}</h3>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{intl.formatMessage({ id: 'new_password' })}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={intl.formatMessage({ id: 'enter_new_password' })}
              />
            </div>
            <Button onClick={handleChangePassword} className="w-full" disabled={isPasswordChanging}>
              {isPasswordChanging ? intl.formatMessage({ id: 'changing_password' }) : intl.formatMessage({ id: 'change_password' })}
            </Button>
          </div>

          {/* Biometry Note */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="text-lg font-semibold">{intl.formatMessage({ id: 'biometric_authentication' })}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {intl.formatMessage({ id: 'biometric_note' })}
            </p>
          </div>

          {/* Theme Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{intl.formatMessage({ id: 'app_theme' })}</h3>
            <div className="space-y-2">
              <Label htmlFor="theme">{intl.formatMessage({ id: 'select_theme' })}</Label>
              <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'black') => {
                setTheme(value);
                const root = window.document.documentElement;
                root.classList.remove('light', 'dark', 'black');
                root.classList.add(value);
                localStorage.setItem('theme', value);
              }}>
                <SelectTrigger id="theme">
                  <SelectValue placeholder={intl.formatMessage({ id: 'select_theme' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{intl.formatMessage({ id: 'light' })}</SelectItem>
                  <SelectItem value="dark">{intl.formatMessage({ id: 'dark' })}</SelectItem>
                  <SelectItem value="black">{intl.formatMessage({ id: 'black' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;