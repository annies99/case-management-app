// frontend/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';
import pl from './pl.json';        // ← import your new Polish file

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    resources: {
      en: { translation: en },
      es: { translation: es },
      pl: { translation: pl },    // ← register it here
    },
    interpolation: { escapeValue: false }
  });

export default i18n;
