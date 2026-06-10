/**
 * Central application constants.
 *
 * Keep this file framework-free and side-effect-free so it can be imported by
 * components, hooks, services, reducers, and tests without initializing Firebase.
 */

export const APP_CONFIG = Object.freeze({
  NAME: 'QuickPOS Myanmar',
  VERSION: '1.0.0',
  CURRENCY: 'MMK',
  DEFAULT_LOCALE: 'mm',
  SUPPORTED_LOCALES: Object.freeze(['mm', 'en', 'zh']),
});

// Barcode scanning
export const BARCODE_DUPLICATE_COOLDOWN_MS = 1500;
export const BARCODE_MIN_LENGTH = 4;
export const BARCODE_MAX_LENGTH = 64;

export const BARCODE_FORMATS = Object.freeze([
  'CODE_128',
  'CODE_39',
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'ITF',
  'QR_CODE',
]);

// User roles. Keep string values aligned with Firestore user profile role values.
export const ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  CASHIER: 'cashier',
  SUPER_ADMIN: 'superadmin',
});

export const TENANT_ROLES = Object.freeze([
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.STAFF,
  ROLES.CASHIER,
]);

export const ADMIN_ROLES = Object.freeze([
  ROLES.OWNER,
  ROLES.ADMIN,
]);

export const SUPER_ADMIN_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  'super_admin',
]);

// Permissions (Role-based access control အတွက်)
export const PERMISSIONS = Object.freeze({
  CREATE_SALE: 'create_sale',
  VIEW_SALES: 'view_sales',
  ACCEPT_PAYMENT: 'accept_payment',
  VIEW_INVENTORY: 'view_inventory',
  CREATE_PURCHASE: 'create_purchase',
  CREATE_EXPENSE: 'create_expense',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_USERS: 'manage_users',
  DELETE_RECORDS: 'delete_records',
  VIEW_REPORTS: 'view_reports',
  SETTINGS: 'settings',
  MANAGE_CUSTOMERS: 'manage_customers',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  MANAGE_SHIFTS: 'manage_shifts',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
});

export const ROLE_PERMISSION_PRESETS = Object.freeze({
  [ROLES.OWNER]: Object.freeze(Object.values(PERMISSIONS)),
  [ROLES.ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
  [ROLES.MANAGER]: Object.freeze([
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.ACCEPT_PAYMENT,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.CREATE_PURCHASE,
    PERMISSIONS.CREATE_EXPENSE,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_SUPPLIERS,
    PERMISSIONS.MANAGE_SHIFTS,
    PERMISSIONS.VIEW_REPORTS,
  ]),
  [ROLES.STAFF]: Object.freeze([
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.ACCEPT_PAYMENT,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_CUSTOMERS,
  ]),
  [ROLES.CASHIER]: Object.freeze([
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.ACCEPT_PAYMENT,
  ]),
});

// Price types (Multi-tier pricing အတွက်)
export const PRICE_TYPES = Object.freeze({
  RETAIL: 'retail',
  WHOLESALE_A: 'wholesaleA',
  WHOLESALE_B: 'wholesaleB',
  WHOLESALE_C: 'wholesaleC',
});

export const PRICE_TYPE_LABELS = Object.freeze({
  [PRICE_TYPES.RETAIL]: 'လက်လီဈေး',
  [PRICE_TYPES.WHOLESALE_A]: 'လက္ကား A',
  [PRICE_TYPES.WHOLESALE_B]: 'လက္ကား B',
  [PRICE_TYPES.WHOLESALE_C]: 'လက္ကား C',
});

export const PAYMENT_METHODS = Object.freeze({
  CASH: 'cash',
  KPAY: 'kpay',
  WAVE_PAY: 'wavepay',
  CB_PAY: 'cbpay',
  AYA_PAY: 'ayapay',
  CARD: 'card',
  CREDIT: 'credit',
  BANK_TRANSFER: 'bank_transfer',
});

export const PAYMENT_METHOD_LABELS = Object.freeze({
  [PAYMENT_METHODS.CASH]: 'ငွေသား',
  [PAYMENT_METHODS.KPAY]: 'KBZPay',
  [PAYMENT_METHODS.WAVE_PAY]: 'WavePay',
  [PAYMENT_METHODS.CB_PAY]: 'CB Pay',
  [PAYMENT_METHODS.AYA_PAY]: 'AYA Pay',
  [PAYMENT_METHODS.CARD]: 'Card',
  [PAYMENT_METHODS.CREDIT]: 'အကြွေး',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
});

export const FIRESTORE_COLLECTIONS = Object.freeze({
  USERS: 'pos_users',
  PRODUCTS: 'pos_products',
  RECORDS: 'pos_records',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  SETTINGS: 'pos_settings',
  COUNTERS: 'pos_counters',
  HELD_ORDERS: 'heldOrders',
  EXPENSES: 'expenses',
  SHIFTS: 'shifts',
  STOCK_TRANSFERS: 'stockTransfers',
  AUDIT_LOGS: 'audit_logs',
});

// Pagination & Search
export const ITEMS_PER_PAGE = 20;
export const MAX_ITEMS_PER_PAGE = 100;
export const SEARCH_DEBOUNCE_MS = 300;

// Numeric boundaries used by forms and reducers.
export const NUMERIC_LIMITS = Object.freeze({
  MIN_PRICE: 0,
  MAX_PRICE: 999_999_999,
  MIN_QUANTITY: 0,
  MAX_QUANTITY: 999_999,
  MIN_DISCOUNT_PERCENT: 0,
  MAX_DISCOUNT_PERCENT: 100,
  MIN_TAX_PERCENT: 0,
  MAX_TAX_PERCENT: 100,
});

// UOM categories for Myanmar-market POS usage. Actual per-product conversion
// ratios should still be stored with each product because cartons, packs, and
// rice containers can vary by product/shop.
export const UOM_TYPES = Object.freeze({
  COUNT: 'count',
  WEIGHT: 'weight',
  VOLUME: 'volume',
  LENGTH: 'length',
  CUSTOM: 'custom',
});

export const COMMON_UNITS = Object.freeze({
  COUNT: Object.freeze(['pcs', 'ခု', 'လုံး', 'ဒါဇင်', 'ပါကင်', 'စုံ', 'ဖာ', 'ကတ်']),
  WEIGHT: Object.freeze(['g', 'kg', 'ton', 'ပိဿာ', 'အချိန်', 'ကျပ်သား', 'ပဲ']),
  VOLUME: Object.freeze(['ml', 'L', 'US gallon', 'UK gallon', 'ဘူး', 'ပြည်', 'တင်း', 'ခွဲတင်း']),
  LENGTH: Object.freeze(['mm', 'cm', 'm', 'inch', 'ft', 'yard', 'လိပ်']),
});

export const STANDARD_UNIT_CONVERSIONS = Object.freeze({
  // weight base examples
  'kg:g': 1000,
  'ton:kg': 1000,
  'ပိဿာ:ကျပ်သား': 100,
  'အချိန်:ကျပ်သား': 50,
  'ကျပ်သား:ပဲ': 16,
  'ပိဿာ:kg': 1.633,
  'kg:ကျပ်သား': 61.22,
  'ကျပ်သား:g': 16.33,

  // volume base examples
  'L:ml': 1000,
  'US gallon:L': 3.785,
  'UK gallon:L': 4.546,
  'တင်း:ပြည်': 16,
  'ပြည်:ဘူး': 8,
  'ပြည်:L': 2.56,

  // length base examples
  'm:cm': 100,
  'm:mm': 1000,
  'ft:inch': 12,
  'yard:ft': 3,
  'm:ft': 3.28,
  'inch:cm': 2.54,
});

// Standard System Messages
export const MESSAGES = Object.freeze({
  SAVE_SUCCESS: 'မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။ (Saved successfully)',
  DELETE_SUCCESS: 'မှတ်တမ်း ဖျက်သိမ်းပြီးပါပြီ။ (Deleted successfully)',
  ERROR_OCCURRED: 'အမှားအယွင်း တစ်ခုခုဖြစ်ပွားနေပါသည်။ (An error occurred)',
  INVALID_INPUT: 'ထည့်သွင်းထားသော အချက်အလက်များကို ပြန်လည်စစ်ဆေးပါ။ (Please check your input)',
  NETWORK_ERROR: 'အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပါ။ (Network error)',
  UNAUTHORIZED: 'ဤလုပ်ဆောင်ချက်ကို လုပ်ဆောင်ရန် ခွင့်ပြုချက် မရှိပါ။ (Unauthorized action)',
});

export const isSupportedRole = (role) => TENANT_ROLES.includes(role) || SUPER_ADMIN_ROLES.includes(role);
export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
export const isSuperAdminRole = (role) => SUPER_ADMIN_ROLES.includes(role);
export const isSupportedPaymentMethod = (method) => Object.values(PAYMENT_METHODS).includes(method);
export const isSupportedPriceType = (type) => Object.values(PRICE_TYPES).includes(type);
