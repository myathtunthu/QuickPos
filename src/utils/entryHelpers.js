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

export const getItemCostPrice = (cartItem, products = []) => {
  const product = products.find((p) => p.id === cartItem?.productId);

  return (
    Number(
      cartItem?.costPrice ??
        cartItem?.cost ??
        product?.costPrice ??
        product?.packageUnits?.[0]?.costPrice ??
        product?.packages?.[0]?.costPrice ??
        0
    ) || 0
  );
};

export const formatMoney = (value) => `${Number(value || 0).toLocaleString()} Ks`;

export const getProductStock = (product) => Number(product?.stockBase ?? product?.stock ?? 0) || 0;

