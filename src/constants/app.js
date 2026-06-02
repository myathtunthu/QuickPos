// Barcode scanning
export const BARCODE_DUPLICATE_COOLDOWN_MS = 1500;

export const BARCODE_FORMATS = [
  'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'QR_CODE'
];

// User Roles
export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  MANAGER: 'manager'
};

// Permissions (Role-based access control အတွက်)
export const PERMISSIONS = {
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
};

// Price types (Multi-tier pricing အတွက်)
export const PRICE_TYPES = {
  RETAIL: 'retail',
  WHOLESALE_A: 'wholesaleA',
  WHOLESALE_B: 'wholesaleB',
  WHOLESALE_C: 'wholesaleC',
};

// Pagination & Search
export const ITEMS_PER_PAGE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

// Standard System Messages
export const MESSAGES = {
  SAVE_SUCCESS: 'မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။ (Saved successfully)',
  DELETE_SUCCESS: 'မှတ်တမ်း ဖျက်သိမ်းပြီးပါပြီ။ (Deleted successfully)',
  ERROR_OCCURRED: 'အမှားအယွင်း တစ်ခုခုဖြစ်ပွားနေပါသည်။ (An error occurred)',
  INVALID_INPUT: 'ထည့်သွင်းထားသော အချက်အလက်များကို ပြန်လည်စစ်ဆေးပါ။ (Please check your input)',
  NETWORK_ERROR: 'အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပါ။ (Network error)',
  UNAUTHORIZED: 'ဤလုပ်ဆောင်ချက်ကို လုပ်ဆောင်ရန် ခွင့်ပြုချက် မရှိပါ။ (Unauthorized action)'
};
