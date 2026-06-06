/**
 * Compatibility i18n module.
 * The main app uses src/context/LanguageContext.jsx + src/utils/translations.js.
 * This file now re-exports the same dictionary so old imports do not use a tiny,
 * incomplete translation table.
 */
import { translations as baseTranslations } from '../utils/translations';

export const translations = {
  ...baseTranslations,
  my: baseTranslations.mm, // backward compatibility for older code using "my"
};

export const getTranslation = (lang, key, fallback = '') => {
  const normalizedLang = lang === 'my' ? 'mm' : lang;
  return baseTranslations?.[normalizedLang]?.[key]
    || baseTranslations?.en?.[key]
    || fallback
    || key;
};
