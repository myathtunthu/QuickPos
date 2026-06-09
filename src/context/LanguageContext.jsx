import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../utils/translations';
import logger from '../utils/logger';

const LanguageContext = createContext(null);

const SUPPORTED_LANGUAGES = ['mm', 'en', 'zh'];
const DEFAULT_LANGUAGE = 'mm';
const STORAGE_KEY = 'nexpos_language';

const getStoredLanguage = () => {
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  } catch (error) {
    logger.warn('Unable to read language preference:', error);
    return DEFAULT_LANGUAGE;
  }
};

const persistLanguage = (language) => {
  try {
    window.localStorage?.setItem(STORAGE_KEY, language);
  } catch (error) {
    logger.warn('Unable to save language preference:', error);
  }
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getStoredLanguage);

  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) {
      logger.warn('Unsupported language ignored:', nextLanguage);
      return;
    }

    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback((key, fallback = '') => {
    if (!key) return fallback || '';
    return translations?.[language]?.[key] || translations?.en?.[key] || fallback || key;
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const currentIndex = SUPPORTED_LANGUAGES.indexOf(prev);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SUPPORTED_LANGUAGES.length : 0;
      return SUPPORTED_LANGUAGES[nextIndex];
    });
  }, []);

  const languageLabel = useMemo(() => {
    if (language === 'mm') return 'MM';
    if (language === 'en') return 'EN';
    return '中文';
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      supportedLanguages: SUPPORTED_LANGUAGES,
      setLanguage,
      toggleLanguage,
      languageLabel,
      t,
    }),
    [language, setLanguage, toggleLanguage, languageLabel, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
};
