import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // မှတ်တမ်းထဲမှာ ရွေးထားတဲ့ ဘာသာစကားရှိရင် အဲ့ဒါသုံးမယ်၊ မရှိရင် မြန်မာ (mm) ကို ပုံသေထားမယ်
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('pos_language') || 'mm'; 
  });

  // ဘာသာစကားပြောင်းတိုင်း မှတ်တမ်း (Local Storage) ထဲမှာ သိမ်းထားမယ်
  useEffect(() => {
    localStorage.setItem('pos_language', language);
  }, [language]);

  // စာသားတွေကို ဘာသာပြန်ပေးမယ့် Function (ဥပမာ - t('dashboard') လို့ခေါ်သုံးရန်)
  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'mm' ? 'en' : 'mm'));
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
