/**
 * Myanmar Currency Formatter
 * @param {number|string} amount
 * @returns {string} Formatted string (e.g. MMK 1,500)
 */
export const formatMMK = (amount) => {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

export default formatMMK;
