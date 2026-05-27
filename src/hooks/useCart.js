import { useState, useMemo, useCallback } from 'react';

export function useCart() {
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%');

  // Add or merge item
  const addItem = useCallback((item) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(
        x => x.productId === item.productId &&
             x.unitName === item.unitName &&
             x.priceType === item.priceType
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
          itemDiscountAmt: (updated[existingIndex].itemDiscountAmt || 0) + (item.itemDiscountAmt || 0)
        };
        return updated;
      }
      return [...prev, { ...item, id: Date.now(), itemDiscountAmt: item.itemDiscountAmt || 0, notes: item.notes || '' }];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateItemQuantity = useCallback((id, newQty) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: newQty } : c));
  }, []);

  const updateItemDiscount = useCallback((id, amt) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, itemDiscountAmt: Number(amt) || 0 } : c));
  }, []);

  const updateItemUnit = useCallback((id, unitName, multiplier, unitPrice) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, unitName, multiplier, unitPrice } : c));
  }, []);

  const updateItemPriceType = useCallback((id, priceType, unitPrice) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, priceType, unitPrice } : c));
  }, []);

  const updateItemNotes = useCallback((id, notes) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmt('');
    setGlobalDiscountType('%');
  }, []);

  // Totals calculation
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const itemDiscounts = cart.reduce((sum, item) => sum + (item.itemDiscountAmt || 0), 0);
    const afterItemDisc = subtotal - itemDiscounts;
    const globalDisc = globalDiscountType === '%'
      ? afterItemDisc * (Number(globalDiscountAmt) / 100)
      : Number(globalDiscountAmt);
    const total = Math.max(afterItemDisc - globalDisc, 0);
    return { subtotal, itemDiscounts, globalDisc, total };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemDiscount,
    updateItemUnit,
    updateItemPriceType,
    updateItemNotes,
    clearCart,
    globalDiscountAmt,
    setGlobalDiscountAmt,
    globalDiscountType,
    setGlobalDiscountType,
    totals
  };
}
