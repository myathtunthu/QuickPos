// Entry page shared helper functions

export const PAYMENT_METHODS = Object.freeze(['Cash', 'Credit', 'KBZPay', 'WavePay', 'AYAPay', 'Bank']);

export const toFiniteNumber = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const toNumber = toFiniteNumber;

export const clampNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const number = toFiniteNumber(value, min);
  return Math.min(Math.max(number, min), max);
};

export const cleanText = (value, fallback = '') => {
  const text = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

export const cleanDisplayName = (profile) => {
  if (!profile) return 'Admin';

  const raw =
    profile.displayName ||
    profile.fullName ||
    profile.name ||
    profile.username ||
    profile.email ||
    'Admin';

  const clean = cleanText(raw, 'Admin');
  return clean.includes('@') ? clean.split('@')[0] : clean;
};

export const buildVoucherNo = (type = 'Sale', count = 1, dateISO = '') => {
  const safeType = cleanText(type, 'Sale').toLowerCase();
  let prefix = 'INV';

  if (safeType === 'purchase') prefix = 'PUR';
  if (safeType === 'expense') prefix = 'EXP';

  const fallbackDate = new Date().toISOString().split('T')[0];
  const safeDate = String(dateISO || fallbackDate).replace(/[^0-9]/g, '').slice(0, 8) || fallbackDate.replaceAll('-', '');
  const serial = String(Math.max(1, Math.trunc(toFiniteNumber(count, 1)))).padStart(4, '0');

  return `${prefix}-${safeDate}-${serial}`;
};

export const getUnitMultiplier = (unit = {}) => Math.max(1, toFiniteNumber(unit.multiplier, 1));

export const getUnitCostPrice = (unit = {}, product = {}) => {
  const multiplier = getUnitMultiplier(unit);
  const explicitUnitCost =
    unit.costPrice ??
    unit.cost ??
    unit.purchasePrice ??
    unit.buyPrice ??
    unit.avgCostPrice ??
    unit.averageCost;

  if (explicitUnitCost !== undefined && explicitUnitCost !== null && explicitUnitCost !== '') {
    return Math.max(0, toFiniteNumber(explicitUnitCost, 0));
  }

  const baseCost =
    product.costPrice ??
    product.cost ??
    product.purchasePrice ??
    product.buyPrice ??
    product.avgCostPrice ??
    product.averageCost ??
    0;

  return Math.max(0, toFiniteNumber(baseCost, 0) * multiplier);
};

export const getItemCostPrice = (cartItem, products = []) => {
  const product = products.find((p) => p.id === cartItem?.productId);
  const selectedUnit = product?.packageUnits?.find((u) => u.name === cartItem?.unitName);

  const cost =
    cartItem?.costPrice ??
    cartItem?.cost ??
    getUnitCostPrice(selectedUnit || {}, product || {});

  return Math.max(0, toFiniteNumber(cost, 0));
};

export const formatMoney = (value, options = {}) => {
  const { maximumFractionDigits = 2, minimumFractionDigits = 0 } = options;
  const amount = toFiniteNumber(value, 0);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits, minimumFractionDigits }).format(amount);
};

export const getProductStock = (product) => Math.max(0, toFiniteNumber(product?.stockBase ?? product?.stock, 0));

export const calculateLineTotal = ({ quantity = 0, price = 0, discount = 0 } = {}) => {
  const gross = Math.max(0, toFiniteNumber(quantity, 0) * toFiniteNumber(price, 0));
  return Math.max(0, gross - Math.max(0, toFiniteNumber(discount, 0)));
};
