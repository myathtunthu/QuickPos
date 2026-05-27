import { useState, useCallback } from 'react';

export function useCart() {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((product, unit, priceType, quantity, price) => {
    const baseQty = quantity * (unit.factor || 1);
    const subtotal = price * quantity;
    
    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === product.id && 
        item.unitName === unit.name &&
        item.priceType === priceType
      );
      
      if (existingIndex !== -1) {
        const newCart = [...prev];
        const existing = newCart[existingIndex];
        newCart[existingIndex] = {
          ...existing,
          quantity: existing.quantity + quantity,
          baseQuantity: existing.baseQuantity + baseQty,
          subtotal: existing.subtotal + subtotal
        };
        return newCart;
      }
      
      return [...prev, {
        id: Date.now(),
        productId: product.id,
        productStock: product.stock || 0,
        baseUnit: product.baseUnit || 'pcs',
        name: product.name,
        unitName: unit.name,
        unitFactor: unit.factor || 1,
        priceType,
        unitPrice: price,
        costPrice: unit.costPrice || 0,
        quantity,
        baseQuantity: baseQty,
        subtotal,
        itemDiscount: 0
      }];
    });
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id, newQuantity) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newBaseQty = newQuantity * (item.unitFactor || 1);
      return {
        ...item,
        quantity: newQuantity,
        baseQuantity: newBaseQty,
        subtotal: (item.unitPrice * newQuantity) - (item.itemDiscount || 0)
      };
    }));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const getCartTotals = useCallback((cartItems) => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const itemDiscounts = cartItems.reduce((sum, item) => sum + (item.itemDiscount || 0), 0);
    return { subtotal, itemDiscounts, totalDiscount: itemDiscounts, total: subtotal };
  }, []);

  return { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotals };
}
