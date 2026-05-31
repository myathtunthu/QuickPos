import { useState, useCallback, useMemo } from 'react';

export const useCart = (products, entryTab) => {
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%'); // '%' or 'Flat'

  const addToCart = useCallback((product, unit, priceType, quantity) => {
    const qtyNum = Number(quantity);
    if (!qtyNum || qtyNum <= 0) return { success: false, message: 'အရေအတွက် မှားယွင်းနေပါသည်' };

    // 🌟 BUG FIX: factor အစား multiplier ကို သုံးထားသည်
    const baseQty = qtyNum * (Number(unit.multiplier) || 1);

    if (entryTab === 'Sale') {
      const currentStockBase = Number(product.stockBase) || Number(product.stock) || 0;
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

      const defaultPurchasePrice = Number(unit.costPrice) || Number(unit.cost) || 0;

      return [...prev, {
        id: Date.now() + Math.random(),
        productId: product.id,
        name: product.name,
        unitName: unit.name,
        multiplier: Number(unit.multiplier) || 1, // 🌟 multiplier ဟု အမည်ပြောင်းထားသည်
        priceType: priceType,
        unitPrice: entryTab === 'Sale' ? (Number(unit.prices?.[priceType]) || 0) : defaultPurchasePrice,
        quantity: qtyNum,
        baseQuantity: baseQty,
        itemDiscountAmt: 0
      }];
    });

    return { success: true };
  }, [entryTab]);

  const removeCartItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateCartItemQty = useCallback((id, newQty) => {
    const qtyNum = Number(newQty) || 1;
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: qtyNum, baseQuantity: qtyNum * (item.multiplier || 1) } : item
    ));
  }, []);

  const updateCartItemUnit = useCallback((id, unitName) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === item.productId);
        const newUnit = product?.packageUnits?.find(u => u.name === unitName);
        if (newUnit) {
          // 🌟 BUG FIX: Unit ပြောင်းလျှင် Price နှင့် BaseQty ကို အတိအကျပြန်တွက်သည်
          const defaultPurchasePrice = Number(newUnit.costPrice) || Number(newUnit.cost) || 0;
          const newPrice = entryTab === 'Sale' ? (Number(newUnit.prices?.[item.priceType]) || 0) : defaultPurchasePrice;
          
          return {
            ...item,
            unitName: newUnit.name,
            multiplier: Number(newUnit.multiplier) || 1,
            unitPrice: newPrice,
            baseQuantity: Number(item.quantity) * (Number(newUnit.multiplier) || 1)
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

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const itemDiscounts = cart.reduce((acc, item) => acc + Number(item.itemDiscountAmt || 0), 0);
    const globalDisc = globalDiscountType === '%' ? (subtotal - itemDiscounts) * (Number(globalDiscountAmt || 0) / 100) : Number(globalDiscountAmt || 0);
      
    return { subtotal, itemDiscounts, globalDisc, total: Math.max(subtotal - itemDiscounts - globalDisc, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart, addToCart, removeCartItem, updateCartItemQty, 
    updateCartItemUnit, updateCartItemPriceType, updateCartItemDiscount, 
    updateCartItemPrice,
    clearCart, cartTotals, globalDiscountAmt, setGlobalDiscountAmt, 
    globalDiscountType, setGlobalDiscountType
  };
};
