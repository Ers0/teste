import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useIntl } from 'react-intl';
import { useEffect, useState } from 'react';

const Login = () => {
  const intl = useIntl();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'black') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12 bg-[#842CD4]">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold text-white drop-shadow-md">{intl.formatMessage({ id: 'welcome_back' })}</h1>
            <p className="text-balance text-white drop-shadow-md">
              {intl.formatMessage({ id: 'sign_in_to_manage_inventory' })}
            </p>
          </div>
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary-foreground))',
                  },
                },
              },
            }}
            theme={theme}
            redirectTo={window.location.origin}
          />
        </div>
      </div>
      <div className="hidden bg-[#842CD4] lg:flex lg:items-center lg:justify-center lg:flex-col">
        <div className="text-center p-8">
          <img src="/yees-logo.png" alt="Yees!" className="mx-auto h-32 w-auto drop-shadow-md" />
          <p className="mt-2 text-lg text-white drop-shadow-md">
            {intl.formatMessage({ id: 'manage_warehouse_items' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;