import React, { useState, useEffect } from 'react';
import { IntlProvider } from 'react-intl';
import { useAuth } from '@/integrations/supabase/auth';

import en from '@/locales/en.json';
import es from '@/locales/es.json';
import ptBR from '@/locales/pt-BR.json';

const messages: Record<string, any> = {
  en,
  es,
  'pt-BR': ptBR,
};

type Locale = keyof typeof messages;

const getNavigatorLanguage = () => {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.split(/[-_]/)[0];
  if (lang in messages) return lang as Locale;
  if (navigator.language in messages) return navigator.language as Locale;
  return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [locale, setLocale] = useState<Locale>(getNavigatorLanguage());

  useEffect(() => {
    const userLang = profile?.language;
    if (userLang && userLang in messages) {
      setLocale(userLang as Locale);
    } else {
      const browserLang = getNavigatorLanguage();
      setLocale(browserLang);
    }
  }, [profile]);

  return (
    <IntlProvider locale={locale} messages={messages[locale]} defaultLocale="en">
      {children}
    </IntlProvider>
  );
};