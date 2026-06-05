import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext(null);

const SUPPORTED_LANGUAGES = ['mm', 'en', 'zh'];

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('nexpos_language');
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'mm';
  });

  useEffect(() => {
    localStorage.setItem('nexpos_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    return translations?.[language]?.[key] || translations?.en?.[key] || key;
  };

  const toggleLanguage = () => {
    setLanguage((prev) => {
      if (prev === 'mm') return 'en';
      if (prev === 'en') return 'zh';
      return 'mm';
    });
  };

  const languageLabel = useMemo(() => {
    if (language === 'mm') return 'MM';
    if (language === 'en') return 'EN';
    return '中文';
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      languageLabel,
      t,
    }),
    [language, languageLabel]
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
