import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('nexpos_language') || 'mm';
  });

  useEffect(() => {
    localStorage.setItem('nexpos_language', language);
  }, [language]);

  const t = (key) => {
    return translations?.[language]?.[key] || translations?.en?.[key] || key;
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'mm' ? 'en' : 'mm'));
  };

  const setMyanmar = () => setLanguage('mm');
  const setEnglish = () => setLanguage('en');

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      setMyanmar,
      setEnglish,
      t,
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
};
