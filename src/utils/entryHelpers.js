// Entry page shared helper functions

export const cleanDisplayName = (profile) => {
  if (!profile) return 'Admin';

  const raw =
    profile.displayName ||
    profile.fullName ||
    profile.name ||
    profile.username ||
    profile.email ||
    'Admin';

  const clean = String(raw).trim();
  if (!clean) return 'Admin';

  return clean.includes('@') ? clean.split('@')[0] : clean;
};

export const buildVoucherNo = (type = 'Sale', count = 1, dateISO = '') => {
  const safeType = String(type || 'Sale').toLowerCase();
  let prefix = 'INV';

  if (safeType === 'purchase') prefix = 'PUR';
  if (safeType === 'expense') prefix = 'EXP';

  const safeDate = String(dateISO || new Date().toISOString().split('T')[0]).replaceAll('-', '');
  const serial = String(Number(count) || 1).padStart(4, '0');

  return `${prefix}-${safeDate}-${serial}`;
};


export const toFiniteNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const getUnitCostPrice = (unit = {}, product = {}) => {
  const multiplier = toFiniteNumber(unit.multiplier, 1) || 1;
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

export const formatMoney = (value) => `${Number(value || 0).toLocaleString()} Ks`;

export const getProductStock = (product) => Number(product?.stockBase ?? product?.stock ?? 0) || 0;

