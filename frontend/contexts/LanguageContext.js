// contexts/LanguageContext.js
import React, { createContext, useState } from 'react';
import i18n from '../i18n';

export const LanguageContext = createContext({
  language: 'en',
  toggleLanguage: () => {},
  changeLanguage: () => {}
});

const AVAILABLE_LANGUAGES = ['en','es','pl'];

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  const changeLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const toggleLanguage = () => {
    const idx     = AVAILABLE_LANGUAGES.indexOf(language);
    const nextIdx = (idx + 1) % AVAILABLE_LANGUAGES.length;
    changeLanguage(AVAILABLE_LANGUAGES[nextIdx]);
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
