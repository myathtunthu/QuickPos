/**
 * Global Application Constants
 */

export const APP_CONFIG = {
  NAME: 'CyberPOS Myanmar',
  VERSION: '1.0.0',
  AUTHOR: 'SaaS POS Architect',
  CURRENCY: 'MMK',
  DEFAULT_TAX_RATE: 0.05, // 5% Commercial Tax
};

export const ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
  MANAGER: 'manager'
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  KPAY: 'kpay',
  CB_PAY: 'cbpay',
  WAVE_MONEY: 'wave',
  CARD: 'card'
};

export const FIREBASE_COLLECTIONS = {
  USERS: 'pos_users',
  PRODUCTS: 'pos_products',
  RECORDS: 'pos_records',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  ANALYTICS: 'analytics'
};
