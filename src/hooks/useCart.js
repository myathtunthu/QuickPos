import { useState, useCallback, useMemo } from 'react';

export const useCart = (products, entryTab) => {
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%'); // '%' or 'Flat'

  const addToCart = useCallback((product, unit, priceType, quantity) => {
    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) return { success: false, message: 'အရေအတွက် မှားယွင်းနေပါသည်' };

    const baseQty = qtyNum * (Number(unit.multiplier) || 1);

    // 🌟 1. Stock Oversell Bug Fix
    if (entryTab === 'Sale') {
      const currentStockBase = Number(product.stockBase) || Number(product.stock) || 0;
      
      // Cart ထဲမှာ ရွေးပြီးသား အရေအတွက် (baseQuantity) ကိုပါ ထည့်ပေါင်းပြီး စစ်ဆေးသည်
      const existingQty = cart
        .filter(x => x.productId === product.id)
        .reduce((a, b) => a + (Number(b.baseQuantity) || 0), 0);

      if (existingQty + baseQty > currentStockBase) {
        return { 
          success: false, 
          message: `${product.name} Stock မလုံလောက်ပါ (လက်ကျန်: ${currentStockBase})` 
        };
      }
    }

    setCart(prev => {
      const existing = prev.find(x => x.productId === product.id && x.unitName === unit.name && x.priceType === priceType);
      
      if (existing) {
        return prev.map(x => x.id === existing.id 
          ? { ...x, quantity: x.quantity + qtyNum, baseQuantity: x.baseQuantity + baseQty } 
          : x);
      }

      // 🌟 10. Purchase Price Bug Fix
      const defaultPurchasePrice = Number(unit.costPrice) || Number(unit.cost) || Number(unit.purchasePrice) || Number(unit.buyPrice) || 0;

      return [...prev, {
        id: Date.now() + Math.random(),
        productId: product.id,
        name: product.name,
        unitName: unit.name,
        multiplier: Number(unit.multiplier) || 1,
        priceType: priceType,
        unitPrice: entryTab === 'Sale' ? (Number(unit.prices?.[priceType]) || 0) : defaultPurchasePrice,
        quantity: qtyNum,
        baseQuantity: baseQty,
        itemDiscountAmt: 0 // 🌟 ဒီနေရာတွင် Discount သည် Invoice တစ်ကြောင်းလုံး (Row) အတွက် Flat Amount ဖြစ်သည်
      }];
    });

    return { success: true };
  }, [entryTab, cart]); // 🌟 Cart ကို Dependency ထည့်ထားမှ existingQty က အမြဲမှန်ကန်မည်

  const removeCartItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  // 🌟 အရေအတွက် ပြင်ခြင်း (Backspace ခေါက်၍ အလွတ်ဖျက်နိုင်ရန် ပြင်ဆင်ထားသည်)
  const updateCartItemQty = useCallback((id, newQty) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const qtyVal = newQty === '' ? '' : Number(newQty);
        return { 
          ...item, 
          quantity: qtyVal, 
          baseQuantity: (Number(qtyVal) || 0) * (item.multiplier || 1) 
        };
      }
      return item;
    }));
  }, []);

  const updateCartItemUnit = useCallback((id, unitName) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === item.productId);
        const newUnit = product?.packageUnits?.find(u => u.name === unitName);
        if (newUnit) {
          // 🌟 10. Purchase Price Bug Fix
          const defaultPurchasePrice = Number(newUnit.costPrice) || Number(newUnit.cost) || Number(newUnit.purchasePrice) || Number(newUnit.buyPrice) || 0;
          const newPrice = entryTab === 'Sale' ? (Number(newUnit.prices?.[item.priceType]) || 0) : defaultPurchasePrice;
          
          return {
            ...item,
            unitName: newUnit.name,
            multiplier: Number(newUnit.multiplier) || 1,
            unitPrice: newPrice,
            baseQuantity: (Number(item.quantity) || 0) * (Number(newUnit.multiplier) || 1)
          };
        }
      }
      return item;
    }));
  }, [products, entryTab]);

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

  const updateCartItemDiscount = useCallback((id, amt) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, itemDiscountAmt: Number(amt) || 0 } : item));
  }, []);

  const updateCartItemPrice = useCallback((id, newPrice) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, unitPrice: Number(newPrice) || 0 } : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmt('');
  }, []);

  // 🌟 12. Totals တွက်ချက်ခြင်း (quantity က အလွတ်ဖြစ်နေရင် 0 လို့ ယူဆမည်)
  // Logic သတ်မှတ်ချက် - itemDiscountAmt သည် အရေအတွက် (Qty) နဲ့ မြှောက်ရန်မလိုဘဲ Invoice Row တစ်ခုလုံးစာအတွက် လျှော့ပေးငွေဖြစ်သည်
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * (Number(item.quantity) || 0)), 0);
    const itemDiscounts = cart.reduce((acc, item) => acc + Number(item.itemDiscountAmt || 0), 0);
    const globalDisc = globalDiscountType === '%' ? (subtotal - itemDiscounts) * (Number(globalDiscountAmt || 0) / 100) : Number(globalDiscountAmt || 0);
      
    return { subtotal, itemDiscounts, globalDisc, total: Math.max(subtotal - itemDiscounts - globalDisc, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart, 
    setCart, // 🌟 Draft Restore ပြန်လုပ်ရန် setCart ကို မဖြစ်မနေ ပြန်ထုတ်ပေးထားသည်
    addToCart, removeCartItem, updateCartItemQty, 
    updateCartItemUnit, updateCartItemPriceType, updateCartItemDiscount, 
    updateCartItemPrice,
    clearCart, cartTotals, globalDiscountAmt, setGlobalDiscountAmt, 
    globalDiscountType, setGlobalDiscountType
  };
};
