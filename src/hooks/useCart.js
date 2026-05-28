import { useState, useCallback, useMemo } from 'react';
import { calculateBaseQty, checkStockAvailability } from '../utils/stockConverter';

export const useCart = (products, entryTab) => {
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%');

  // အသစ်ထည့်ခြင်း
  const addToCart = useCallback((product, unit, priceType, quantity) => {
    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) return { success: false, message: 'အရေအတွက် မှားယွင်းနေပါသည်' };

    const baseQty = calculateBaseQty(qtyNum, unit.factor);

    // Sale ဖောင်အတွက်ဆိုလျှင် Stock စစ်မည်
    if (entryTab === 'Sale') {
      const stockCheck = checkStockAvailability(qtyNum, unit.factor, product.stockBase);
      if (!stockCheck.isAvailable) {
        return { success: false, message: 'Stock မလုံလောက်ပါ' };
      }
    }

    setCart(prev => {
      const existing = prev.find(x => x.productId === product.id && x.unitName === unit.name && x.priceType === priceType);
      
      if (existing) {
        return prev.map(x => x.id === existing.id 
          ? { 
              ...x, 
              quantity: x.quantity + qtyNum, 
              baseQuantity: x.baseQuantity + baseQty 
            } 
          : x);
      }

      return [...prev, {
        id: Date.now(),
        productId: product.id,
        name: product.name,
        unitName: unit.name,
        factor: unit.factor,
        priceType: priceType,
        unitPrice: entryTab === 'Sale' ? unit.prices[priceType] : unit.cost,
        quantity: qtyNum,
        baseQuantity: baseQty,
        itemDiscountAmt: 0
      }];
    });

    return { success: true };
  }, [entryTab]);

  // အခြေခံ Update Functions များ
  const removeCartItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateCartItemQty = useCallback((id, newQty) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Number(newQty) || 1 } : item));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmt('');
  }, []);

  // Totals တွက်ချက်ခြင်း (useMemo ဖြင့် Performance မြှင့်ထားသည်)
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const itemDiscounts = cart.reduce((acc, item) => acc + Number(item.itemDiscountAmt || 0), 0);
    
    const globalDisc = globalDiscountType === '%' 
      ? (subtotal - itemDiscounts) * (Number(globalDiscountAmt || 0) / 100) 
      : Number(globalDiscountAmt || 0);
      
    return { 
      subtotal, 
      itemDiscounts, 
      globalDisc, 
      total: Math.max(subtotal - itemDiscounts - globalDisc, 0) 
    };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart,
    addToCart,
    removeCartItem,
    updateCartItemQty,
    clearCart,
    cartTotals,
    globalDiscountAmt,
    setGlobalDiscountAmt,
    globalDiscountType,
    setGlobalDiscountType
  };
};
