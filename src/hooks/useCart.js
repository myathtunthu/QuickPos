import { useState, useCallback, useMemo } from 'react';
import { getUnitCostPrice, toFiniteNumber } from '../utils/entryHelpers';

const clampMoney = (value, fallback = 0) => Math.max(0, toFiniteNumber(value, fallback));
const normalizeDiscountType = (type) => (String(type).toLowerCase() === 'flat' ? 'flat' : '%');

export const useCart = (products, entryTab) => {
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%'); // '%' or 'flat'

  const addToCart = useCallback((product, unit, priceType, quantity) => {
    const qtyNum = toFiniteNumber(quantity, 0);
    if (!qtyNum || qtyNum <= 0) return { success: false, message: 'အရေအတွက် မှားယွင်းနေပါသည်' };

    const multiplier = toFiniteNumber(unit?.multiplier, 1) || 1;
    const baseQty = qtyNum * multiplier;

    if (entryTab === 'Sale') {
      const currentStockBase = toFiniteNumber(product?.stockBase ?? product?.stock, 0);
      const existingQty = cart
        .filter(x => x.productId === product.id)
        .reduce((a, b) => a + (toFiniteNumber(b.baseQuantity, 0)), 0);

      if (existingQty + baseQty > currentStockBase) {
        return {
          success: false,
          message: `${product.name} Stock မလုံလောက်ပါ (လက်ကျန်: ${currentStockBase})`
        };
      }
    }

    setCart(prev => {
      const safePriceType = entryTab === 'Sale' ? priceType : 'purchase';
      const existing = prev.find(x => x.productId === product.id && x.unitName === unit.name && x.priceType === safePriceType);
      const costPrice = getUnitCostPrice(unit, product);
      const salePrice = clampMoney(unit?.prices?.[priceType], 0);
      const purchasePrice = costPrice;

      if (existing) {
        return prev.map(x => x.id === existing.id
          ? {
              ...x,
              quantity: toFiniteNumber(x.quantity, 0) + qtyNum,
              baseQuantity: toFiniteNumber(x.baseQuantity, 0) + baseQty,
              costPrice
            }
          : x);
      }

      return [...prev, {
        id: Date.now() + Math.random(),
        productId: product.id,
        name: product.name,
        unitName: unit.name,
        multiplier,
        priceType: safePriceType,
        unitPrice: entryTab === 'Sale' ? salePrice : purchasePrice,
        costPrice,
        quantity: qtyNum,
        baseQuantity: baseQty,
        itemDiscountAmt: 0
      }];
    });

    return { success: true };
  }, [entryTab, cart]);

  const removeCartItem = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateCartItemQty = useCallback((id, newQty) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const qtyVal = newQty === '' ? '' : Math.max(0, toFiniteNumber(newQty, 0));
        return {
          ...item,
          quantity: qtyVal,
          baseQuantity: (toFiniteNumber(qtyVal, 0)) * (toFiniteNumber(item.multiplier, 1) || 1)
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
          const multiplier = toFiniteNumber(newUnit.multiplier, 1) || 1;
          const costPrice = getUnitCostPrice(newUnit, product);
          const newPrice = entryTab === 'Sale' ? clampMoney(newUnit.prices?.[item.priceType], 0) : costPrice;

          return {
            ...item,
            unitName: newUnit.name,
            multiplier,
            costPrice,
            unitPrice: newPrice,
            baseQuantity: (toFiniteNumber(item.quantity, 0)) * multiplier
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
          return { ...item, priceType, unitPrice: clampMoney(unit.prices?.[priceType], 0) };
        }
      }
      return item;
    }));
  }, [products, entryTab]);

  const updateCartItemDiscount = useCallback((id, amt) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const rowSubtotal = clampMoney(item.unitPrice, 0) * toFiniteNumber(item.quantity, 0);
      return { ...item, itemDiscountAmt: Math.min(clampMoney(amt, 0), rowSubtotal) };
    }));
  }, []);

  const updateCartItemPrice = useCallback((id, newPrice) => {
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, unitPrice: clampMoney(newPrice, 0) } : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmt('');
  }, []);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (clampMoney(item.unitPrice, 0) * (toFiniteNumber(item.quantity, 0))), 0);
    const rawItemDiscounts = cart.reduce((acc, item) => {
      const rowSubtotal = clampMoney(item.unitPrice, 0) * toFiniteNumber(item.quantity, 0);
      return acc + Math.min(clampMoney(item.itemDiscountAmt, 0), rowSubtotal);
    }, 0);
    const netBeforeGlobal = Math.max(subtotal - rawItemDiscounts, 0);
    const normalizedType = normalizeDiscountType(globalDiscountType);
    const rawGlobalDisc = normalizedType === '%'
      ? netBeforeGlobal * Math.min(clampMoney(globalDiscountAmt, 0), 100) / 100
      : clampMoney(globalDiscountAmt, 0);
    const globalDisc = Math.min(rawGlobalDisc, netBeforeGlobal);

    return { subtotal, itemDiscounts: rawItemDiscounts, globalDisc, total: Math.max(netBeforeGlobal - globalDisc, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart,
    setCart,
    addToCart, removeCartItem, updateCartItemQty,
    updateCartItemUnit, updateCartItemPriceType, updateCartItemDiscount,
    updateCartItemPrice,
    clearCart, cartTotals, globalDiscountAmt, setGlobalDiscountAmt,
    globalDiscountType, setGlobalDiscountType
  };
};
