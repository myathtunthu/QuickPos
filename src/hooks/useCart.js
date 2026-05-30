import { useState, useCallback, useMemo } from 'react';

export const useCart = (products, entryTab) => {
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%');

  // ၁။ Cart ထဲသို့ ပစ္စည်းအသစ်ထည့်ခြင်း
  const addToCart = useCallback((product, unit, priceType, quantity) => {
    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) return { success: false, message: 'အရေအတွက် မှားယွင်းနေပါသည်' };

    const baseQty = qtyNum * (Number(unit.factor) || 1);

    // Sale ဖောင်အတွက်ဆိုလျှင် Stock စစ်မည်
    if (entryTab === 'Sale') {
      const currentStockBase = Number(product.stockBase) || 0;
      if (baseQty > currentStockBase) {
        return { success: false, message: 'Stock မလုံလောက်ပါ' };
      }
    }

    setCart(prev => {
      const existing = prev.find(x => x.productId === product.id && x.unitName === unit.name && x.priceType === priceType);
      
      if (existing) {
        return prev.map(x => x.id === existing.id 
          ? { ...x, quantity: x.quantity + qtyNum, baseQuantity: x.baseQuantity + baseQty } 
          : x);
      }

      return [...prev, {
        id: Date.now() + Math.random(),
        productId: product.id,
        name: product.name,
        unitName: unit.name,
        factor: Number(unit.factor) || 1,
        priceType: priceType,
        unitPrice: entryTab === 'Sale' ? (unit.prices?.[priceType] || 0) : (unit.cost || 0),
        quantity: qtyNum,
        baseQuantity: baseQty,
        itemDiscountAmt: 0
      }];
    });

    return { success: true };
  }, [entryTab]);

  // ၂။ ဖျက်ခြင်း
  const removeCartItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  // ၃။ အရေအတွက် ပြင်ခြင်း
  const updateCartItemQty = useCallback((id, newQty) => {
    const qtyNum = Number(newQty) || 1;
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: qtyNum, baseQuantity: qtyNum * (item.factor || 1) } : item
    ));
  }, []);

  // ၄။ Unit ပြောင်းခြင်း
  const updateCartItemUnit = useCallback((id, unitName) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === item.productId);
        const newUnit = product?.packageUnits?.find(u => u.name === unitName);
        if (newUnit) {
          const newPrice = entryTab === 'Sale' ? (newUnit.prices?.[item.priceType] || 0) : (newUnit.cost || 0);
          return {
            ...item,
            unitName: newUnit.name,
            factor: newUnit.factor || 1,
            unitPrice: newPrice,
            baseQuantity: Number(item.quantity) * Number(newUnit.factor || 1)
          };
        }
      }
      return item;
    }));
  }, [products, entryTab]);

  // ၅။ ဈေးနှုန်းအမျိုးအစား ပြောင်းခြင်း
  const updateCartItemPriceType = useCallback((id, priceType) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === item.productId);
        const unit = product?.packageUnits?.find(u => u.name === item.unitName);
        if (unit && entryTab === 'Sale') {
          return { ...item, priceType: priceType, unitPrice: Number(unit.prices?.[priceType]) || 0 };
        }
      }
      return item;
    }));
  }, [products, entryTab]);

  // ၆။ Discount ထည့်ခြင်း
  const updateCartItemDiscount = useCallback((id, amt) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, itemDiscountAmt: Number(amt) || 0 } : item));
  }, []);

  // ၇။ အဝယ်ဈေး / Manual ဈေးနှုန်း ပြင်ဆင်ခြင်း 🌟 (Purchase အတွက် အရေးကြီးပါသည်)
  const updateCartItemPrice = useCallback((id, newPrice) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, unitPrice: Number(newPrice) || 0 } : item
    ));
  }, []);

  // ၈။ ရှင်းလင်းခြင်း
  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmt('');
  }, []);

  // ၉။ Totals တွက်ချက်ခြင်း
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const itemDiscounts = cart.reduce((acc, item) => acc + Number(item.itemDiscountAmt || 0), 0);
    const globalDisc = globalDiscountType === '%' ? (subtotal - itemDiscounts) * (Number(globalDiscountAmt || 0) / 100) : Number(globalDiscountAmt || 0);
      
    return { subtotal, itemDiscounts, globalDisc, total: Math.max(subtotal - itemDiscounts - globalDisc, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart, addToCart, removeCartItem, updateCartItemQty, 
    updateCartItemUnit, updateCartItemPriceType, updateCartItemDiscount, 
    updateCartItemPrice, // 🌟 UI သို့ ထုတ်ပေးထားပါသည်
    clearCart, cartTotals, globalDiscountAmt, setGlobalDiscountAmt, 
    globalDiscountType, setGlobalDiscountType
  };
};
