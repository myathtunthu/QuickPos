/**
 * Simple Internationalization (i18n) Setup for Multi-language support
 * (English and Myanmar/Burmese)
 */

export const translations = {
  en: {
    dashboard: "Dashboard",
    pos_entry: "POS Entry",
    inventory: "Inventory",
    reports: "Reports",
    settings: "Settings",
    total_sales: "Total Sales",
    checkout: "Checkout"
  },
  my: {
    dashboard: "ဒက်ရှ်ဘုတ်",
    pos_entry: "အရောင်းမှတ်ရန်",
    inventory: "ကုန်ပစ္စည်းစာရင်း",
    reports: "အစီရင်ခံစာများ",
    settings: "ဆက်တင်များ",
    total_sales: "စုစုပေါင်းရောင်းရငွေ",
    checkout: "ငွေရှင်းမည်"
  }
};

export const getTranslation = (lang, key) => {
  if (!translations[lang]) return key;
  return translations[lang][key] || key;
};
