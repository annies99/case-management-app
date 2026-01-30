// App.js
import React from 'react';
import './i18n';                             // ← ensure this points to your i18n init file
import { LanguageProvider } from './contexts/LanguageContext';
import RootNavigation from './navigation';

export default function App() {
  return (
    <LanguageProvider>
      <RootNavigation />
    </LanguageProvider>
  );
}
