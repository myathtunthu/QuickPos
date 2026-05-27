export function calculateBaseQuantity(quantity, unit) {
  return quantity * (unit.factor || 1);
}

export function validateStock(product, requiredBaseQuantity, type = 'sale') {
  if (type === 'sale') {
    return (product?.stock || 0) >= requiredBaseQuantity;
  }
  return true;
}

export function formatCurrency(amount) {
  return (amount || 0).toLocaleString() + ' Ks';
}
