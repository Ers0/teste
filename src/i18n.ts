import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      en: {
        translation: en,
      },
      es: {
        translation: es,
      },
      'pt-BR': {
        translation: ptBR,
      },
    },
    lng: 'en', // default language
    fallbackLng: 'en', // fallback language if translation is not found
    interpolation: {
      escapeValue: false, // react already escapes by default
    },
  });

export default i18n;