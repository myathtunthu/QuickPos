/**
 * Myanmar Currency Formatter
 * @param {number} amount 
 * @returns {string} Formatted string (e.g. MMK 1,500)
 */
export const formatMMK = (amount) => {
  if (amount === undefined || amount === null) return 'MMK 0';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'MMK', 
    minimumFractionDigits: 0 
  }).format(amount);
};
