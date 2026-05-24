import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
const translations = {
  mm: { app_name: 'MTT POS' },
  en: { app_name: 'MTT POS' }
};

const LanguageContext = createContext(null);

export const useLang = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLang must be used within a LanguageProvider");
  }
  return context;
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('mm');
  const t = useCallback((key) => translations[lang]?.[key] || key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
