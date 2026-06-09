const toNonNegativeNumber = (value, fallback = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, number);
};

export const calculateBaseQty = (quantity, multiplier) => {
  const qty = toNonNegativeNumber(quantity);
  const mult = Math.max(1, toNonNegativeNumber(multiplier, 1));
  return qty * mult;
};

export const checkStockAvailability = (requestedQty, multiplier, currentStockBase) => {
  const neededBaseQty = calculateBaseQty(requestedQty, multiplier);
  const stock = toNonNegativeNumber(currentStockBase);

  return {
    isAvailable: neededBaseQty <= stock,
    needed: neededBaseQty,
    remaining: Math.max(0, stock - neededBaseQty),
    shortage: Math.max(0, neededBaseQty - stock),
  };
};

export const formatStockDisplay = (stockBase, baseUnitName = 'ခု') => {
  const unit = String(baseUnitName || 'ခု').trim() || 'ခု';
  return `${toNonNegativeNumber(stockBase).toLocaleString('en-US')} ${unit}`;
};
