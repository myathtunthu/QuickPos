export const PRICE_TYPES = ['retail', 'wholesaleA', 'wholesaleB', 'wholesaleC'];

export function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const n = toSafeNumber(value, fallback);
  return Math.min(Math.max(n, min), max);
}

export function roundQuantity(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round((toSafeNumber(value) + Number.EPSILON) * factor) / factor;
}

export function getUnitMultiplier(unit) {
  return Math.max(toSafeNumber(unit?.multiplier, 1), 0.0001);
}

export function getUnitName(unit, fallback = 'pcs') {
  return String(unit?.name || fallback).trim() || fallback;
}

export function getDefaultUnit(product) {
  const units = Array.isArray(product?.packageUnits) ? product.packageUnits : [];
  return (
    units.find((unit) => getUnitMultiplier(unit) === 1) ||
    units[0] ||
    { name: product?.baseUnit || 'pcs', multiplier: 1, prices: { retail: 0 }, costPrice: 0 }
  );
}

export function getUnitPrice(unit, priceType = 'retail', entryTab = 'Sale') {
  if (!unit) return 0;
  if (entryTab === 'Purchase') return toSafeNumber(unit.costPrice, 0);
  return toSafeNumber(unit.prices?.[priceType] ?? unit.price ?? unit.prices?.retail, 0);
}

export function isDecimalUnit(unitName = '') {
  const normalized = String(unitName).trim().toLowerCase();
  const decimalUnits = new Set([
    'kg', 'g', 'gram', 'grams', 'kilogram', 'kilograms', 'ton', 'ml', 'l', 'liter', 'litre',
    'meter', 'm', 'cm', 'mm', 'ft', 'feet', 'inch', 'in', 'yard', 'yd',
    'ပိဿာ', 'ပိသာ', 'ကျပ်သား', 'ပဲ', 'အချိန်', 'ပြည်', 'တင်း', 'ခွဲတင်း', 'ဘူး',
  ]);
  return decimalUnits.has(normalized);
}

export function getQuantityStep(unitName) {
  return isDecimalUnit(unitName) ? '0.001' : '1';
}

export function normalizeBarcode(value) {
  return String(value || '').trim().toLowerCase();
}

export function getUnitBarcodes(unit) {
  const barcodes = unit?.barcodes || {};
  return Object.entries(barcodes)
    .map(([priceType, barcode]) => ({ priceType, barcode: normalizeBarcode(barcode) }))
    .filter((item) => item.barcode);
}

export function findProductByBarcode(products = [], rawCode = '') {
  const code = normalizeBarcode(rawCode);
  if (!code) return null;

  for (const product of products || []) {
    if (normalizeBarcode(product?.barcode) === code) {
      return { product, unit: getDefaultUnit(product), priceType: 'retail' };
    }

    for (const unit of product?.packageUnits || []) {
      const match = getUnitBarcodes(unit).find((item) => item.barcode === code);
      if (match) return { product, unit, priceType: match.priceType || 'retail' };
    }
  }

  return null;
}

export function calculateBaseQuantity(quantity, unit) {
  return roundQuantity(toSafeNumber(quantity, 0) * getUnitMultiplier(unit), 4);
}

export function formatQuantity(value, maxDecimals = 3) {
  const n = toSafeNumber(value, 0);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(n);
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toSafeNumber(value, 0));
}

export function getAvailableBaseStock(product) {
  return Math.max(toSafeNumber(product?.stockBase ?? product?.stock ?? 0, 0), 0);
}

export function getBaseUnitName(product) {
  return product?.baseUnit || getUnitName(getDefaultUnit(product), 'pcs');
}
