export const PAYMENT_METHODS = ['Cash', 'Wave', 'KBZPay', 'Bank', 'Credit'];
const VOUCHER_PREFIXES = { sale: 'SAL', purchase: 'PUR', expense: 'EXP' };

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatMoney(value) {
  return toNumber(value).toLocaleString();
}

export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

export function safeTrim(value) {
  return String(value || '').trim();
}

export function translate(t, key, fallback) {
  if (typeof t !== 'function') return fallback;
  const value = t(key, fallback);
  return value && value !== key ? value : fallback;
}

export function cleanDisplayName(profile) {
  const raw =
    profile?.displayName ||
    profile?.fullName ||
    profile?.name ||
    profile?.username ||
    profile?.email ||
    'Cashier';
  const clean = String(raw).trim();
  if (!clean) return 'Cashier';
  if (clean.includes('@')) return clean.split('@')[0];
  return clean;
}

export function getProductName(product) {
  return product?.name || product?.productName || product?.itemName || product?.title || 'Unnamed Product';
}

export function getProductStock(product) {
  return toNumber(product?.stockBase ?? product?.stock ?? product?.qty ?? product?.quantity ?? 0);
}

export function getProductCost(product) {
  return toNumber(
    product?.costPrice ??
      product?.cost ??
      product?.buyPrice ??
      product?.packageUnits?.[0]?.costPrice ??
      product?.packageUnits?.[0]?.cost ??
      0
  );
}

export function getItemCostPrice(item, products) {
  const product =
    products.find((p) => p.id === item.productId) ||
    products.find((p) => getProductName(p) === item.name) ||
    null;

  return toNumber(
    item.costPrice ??
      item.cost ??
      product?.costPrice ??
      product?.cost ??
      product?.buyPrice ??
      product?.packageUnits?.find((unit) => unit.name === item.unitName)?.costPrice ??
      product?.packageUnits?.[0]?.costPrice ??
      0
  );
}

export function buildVoucherNo(type, count, dateISO) {
  const safeType = String(type || 'sale').toLowerCase();
  const prefix = VOUCHER_PREFIXES[safeType] || 'SAL';
  const compactDate = String(dateISO || getTodayISO()).replaceAll('-', '');
  return `${prefix}-${compactDate}-${String(count || 1).padStart(4, '0')}`;
}

export function getTimeNow() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getDefaultUnit(product) {
  return (
    product?.packageUnits?.find((unit) => toNumber(unit.multiplier) === 1) ||
    product?.packageUnits?.[0] || {
      name: product?.unitName || 'ခု',
      multiplier: 1,
      prices: {
        retail: toNumber(product?.price ?? product?.sellPrice ?? 0),
        wholesale: toNumber(product?.wholesalePrice ?? product?.price ?? product?.sellPrice ?? 0),
      },
      costPrice: getProductCost(product),
    }
  );
}

export function canDo(profile, hasPermission, permission) {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'owner') return true;
  if (typeof hasPermission === 'function') return hasPermission(permission);
  return Array.isArray(profile.permissions) && profile.permissions.includes(permission);
}

export function normalizePerson(person) {
  return {
    id: person.id,
    name: person.name || person.fullName || person.customerName || person.supplierName || 'Unknown',
    phone: person.phone || '',
    address: person.address || '',
    totalDebt: toNumber(person.totalDebt),
    ...person,
  };
}

export function isWalkInName(name, entryTab) {
  const v = String(name || '').trim().toLowerCase();
  if (entryTab === 'Sale') return !v || v === 'walk-in' || v === 'walk in' || v === 'walk-in customer';
  return !v || v === 'unknown supplier';
}

