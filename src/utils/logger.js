/**
 * Environment-aware logger
 * Production ပေါ်ရောက်လျှင် Console log များ အလိုအလျောက် ပိတ်သွားမည်ဖြစ်သည်။
 */
const logger = {
  log: (message, data = '') => {
    if (import.meta.env.DEV) {
      console.log(`[LOG] ${message}`, data);
    }
  },

  error: (message, error = '') => {
    // Error များကိုတော့ Production တွင်ပါ တွေ့နိုင်ရန် ချန်ထားနိုင်သည် (သို့) External service သို့ ပို့နိုင်သည်။
    console.error(`[ERROR] ${message}`, error);
    // TODO: Send to error logging service like Sentry in production
  },

  warn: (message, data = '') => {
    if (import.meta.env.DEV) {
      console.warn(`[WARN] ${message}`, data);
    }
  },

  debug: (message, data = '') => {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }
};

export default logger;
