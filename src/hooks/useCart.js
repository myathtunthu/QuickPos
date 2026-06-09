import { useCallback, useMemo, useState } from 'react';
import { cleanText, getUnitCostPrice, toFiniteNumber } from '../utils/entryHelpers';

const clampMoney = (value, fallback = 0) => Math.max(0, toFiniteNumber(value, fallback));
const normalizeDiscountType = (type) => (String(type).toLowerCase() === 'flat' ? 'flat' : '%');
const normalizePriceType = (type) => {
  const safe = cleanText(type, 'retail').toLowerCase();
  return ['retail', 'wholesale', 'purchase'].includes(safe) ? safe : 'retail';
};
const makeCartId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getProductStockBase = (product) => Math.max(0, toFiniteNumber(product?.stockBase ?? product?.stock, 0));
const getUnits = (product) => (Array.isArray(product?.packageUnits) && product.packageUnits.length > 0
  ? product.packageUnits
  : [{ name: 'ခု', multiplier: 1, prices: { retail: product?.retailPrice ?? product?.price ?? 0, wholesale: product?.wholesalePrice ?? 0 } }]);
const getUnitName = (unit) => cleanText(unit?.name, 'ခု');
const getMultiplier = (unit) => Math.max(1, toFiniteNumber(unit?.multiplier, 1));

export const useCart = (products = [], entryTab = 'Sale') => {
  const safeProducts = Array.isArray(products) ? products : [];
  const [cart, setCart] = useState([]);
  const [globalDiscountAmt, setGlobalDiscountAmtRaw] = useState('');
  const [globalDiscountType, setGlobalDiscountTypeRaw] = useState('%');

  const getCartStockUsage = useCallback((items, productId, excludingId = null) => items
    .filter((item) => item.productId === productId && item.id !== excludingId)
    .reduce((sum, item) => sum + toFiniteNumber(item.baseQuantity, 0), 0), []);

  const addToCart = useCallback((product, unit, priceType = 'retail', quantity = 1) => {
    if (!product?.id) return { success: false, message: 'ပစ္စည်းအချက်အလက် မပြည့်စုံပါ' };

    const qtyNum = toFiniteNumber(quantity, 0);
    if (!qtyNum || qtyNum <= 0) return { success: false, message: 'အရေအတွက် မှားယွင်းနေပါသည်' };

    const selectedUnit = unit || getUnits(product)[0];
    const unitName = getUnitName(selectedUnit);
    const multiplier = getMultiplier(selectedUnit);
    const baseQty = qtyNum * multiplier;
    const safePriceType = entryTab === 'Sale' ? normalizePriceType(priceType) : 'purchase';

    if (entryTab === 'Sale') {
      const currentStockBase = getProductStockBase(product);
      const existingQty = getCartStockUsage(cart, product.id);

      if (existingQty + baseQty > currentStockBase) {
        return {
          success: false,
          message: `${cleanText(product.name, 'Item')} Stock မလုံလောက်ပါ (လက်ကျန်: ${currentStockBase})`,
        };
      }
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.unitName === unitName && item.priceType === safePriceType
      );
      const costPrice = getUnitCostPrice(selectedUnit, product);
      const salePrice = clampMoney(selectedUnit?.prices?.[safePriceType] ?? product?.price, 0);
      const purchasePrice = costPrice;

      if (existing) {
        return prev.map((item) => (item.id === existing.id
          ? {
              ...item,
              quantity: toFiniteNumber(item.quantity, 0) + qtyNum,
              baseQuantity: toFiniteNumber(item.baseQuantity, 0) + baseQty,
              costPrice,
            }
          : item));
      }

      return [...prev, {
        id: makeCartId(),
        productId: product.id,
        name: cleanText(product.name, 'Item'),
        unitName,
        multiplier,
        priceType: safePriceType,
        unitPrice: entryTab === 'Sale' ? salePrice : purchasePrice,
        costPrice,
        quantity: qtyNum,
        baseQuantity: baseQty,
        itemDiscountAmt: 0,
      }];
    });

    return { success: true };
  }, [cart, entryTab, getCartStockUsage]);

  const removeCartItem = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateCartItemQty = useCallback((id, newQty) => {
    let result = { success: true };

    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (newQty === '') return { ...item, quantity: '', baseQuantity: 0, itemDiscountAmt: 0 };

      const qtyVal = Math.max(0, toFiniteNumber(newQty, 0));
      const multiplier = getMultiplier(item);
      const baseQuantity = qtyVal * multiplier;

      if (entryTab === 'Sale') {
        const product = safeProducts.find((productItem) => productItem.id === item.productId);
        const availableStock = getProductStockBase(product);
        const otherCartUsage = getCartStockUsage(prev, item.productId, id);

        if (otherCartUsage + baseQuantity > availableStock) {
          result = { success: false, message: `${item.name} Stock မလုံလောက်ပါ (လက်ကျန်: ${availableStock})` };
          return item;
        }
      }

      const rowSubtotal = clampMoney(item.unitPrice, 0) * qtyVal;
      return {
        ...item,
        quantity: qtyVal,
        baseQuantity,
        itemDiscountAmt: Math.min(clampMoney(item.itemDiscountAmt, 0), rowSubtotal),
      };
    }));

    return result;
  }, [entryTab, getCartStockUsage, safeProducts]);

  const updateCartItemUnit = useCallback((id, unitName) => {
    let result = { success: true };

    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;

      const product = safeProducts.find((productItem) => productItem.id === item.productId);
      const newUnit = getUnits(product).find((unit) => getUnitName(unit) === unitName);
      if (!newUnit) {
        result = { success: false, message: 'ယူနစ်အချက်အလက် မတွေ့ပါ' };
        return item;
      }

      const multiplier = getMultiplier(newUnit);
      const baseQuantity = toFiniteNumber(item.quantity, 0) * multiplier;

      if (entryTab === 'Sale') {
        const availableStock = getProductStockBase(product);
        const otherCartUsage = getCartStockUsage(prev, item.productId, id);
        if (otherCartUsage + baseQuantity > availableStock) {
          result = { success: false, message: `${item.name} Stock မလုံလောက်ပါ (လက်ကျန်: ${availableStock})` };
          return item;
        }
      }

      const costPrice = getUnitCostPrice(newUnit, product);
      const priceType = normalizePriceType(item.priceType);
      const newPrice = entryTab === 'Sale' ? clampMoney(newUnit.prices?.[priceType], 0) : costPrice;
      const rowSubtotal = newPrice * toFiniteNumber(item.quantity, 0);

      return {
        ...item,
        unitName: getUnitName(newUnit),
        multiplier,
        costPrice,
        unitPrice: newPrice,
        baseQuantity,
        itemDiscountAmt: Math.min(clampMoney(item.itemDiscountAmt, 0), rowSubtotal),
      };
    }));

    return result;
  }, [entryTab, getCartStockUsage, safeProducts]);

  const updateCartItemPriceType = useCallback((id, priceType) => {
    const safePriceType = normalizePriceType(priceType);

    setCart((prev) => prev.map((item) => {
      if (item.id !== id || entryTab !== 'Sale') return item;
      const product = safeProducts.find((productItem) => productItem.id === item.productId);
      const unit = getUnits(product).find((unitItem) => getUnitName(unitItem) === item.unitName);
      const unitPrice = clampMoney(unit?.prices?.[safePriceType], 0);
      const rowSubtotal = unitPrice * toFiniteNumber(item.quantity, 0);
      return {
        ...item,
        priceType: safePriceType,
        unitPrice,
        itemDiscountAmt: Math.min(clampMoney(item.itemDiscountAmt, 0), rowSubtotal),
      };
    }));
  }, [entryTab, safeProducts]);

  const updateCartItemDiscount = useCallback((id, amt) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const rowSubtotal = clampMoney(item.unitPrice, 0) * toFiniteNumber(item.quantity, 0);
      return { ...item, itemDiscountAmt: Math.min(clampMoney(amt, 0), rowSubtotal) };
    }));
  }, []);

  const updateCartItemPrice = useCallback((id, newPrice) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const unitPrice = clampMoney(newPrice, 0);
      const rowSubtotal = unitPrice * toFiniteNumber(item.quantity, 0);
      return {
        ...item,
        unitPrice,
        itemDiscountAmt: Math.min(clampMoney(item.itemDiscountAmt, 0), rowSubtotal),
      };
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmtRaw('');
  }, []);

  const setGlobalDiscountAmt = useCallback((value) => {
    if (value === '') {
      setGlobalDiscountAmtRaw('');
      return;
    }
    setGlobalDiscountAmtRaw(clampMoney(value, 0));
  }, []);

  const setGlobalDiscountType = useCallback((value) => {
    setGlobalDiscountTypeRaw(normalizeDiscountType(value));
  }, []);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce(
      (acc, item) => acc + (clampMoney(item.unitPrice, 0) * toFiniteNumber(item.quantity, 0)),
      0
    );
    const itemDiscounts = cart.reduce((acc, item) => {
      const rowSubtotal = clampMoney(item.unitPrice, 0) * toFiniteNumber(item.quantity, 0);
      return acc + Math.min(clampMoney(item.itemDiscountAmt, 0), rowSubtotal);
    }, 0);
    const netBeforeGlobal = Math.max(subtotal - itemDiscounts, 0);
    const normalizedType = normalizeDiscountType(globalDiscountType);
    const rawGlobalDisc = normalizedType === '%'
      ? (netBeforeGlobal * Math.min(clampMoney(globalDiscountAmt, 0), 100)) / 100
      : clampMoney(globalDiscountAmt, 0);
    const globalDisc = Math.min(rawGlobalDisc, netBeforeGlobal);

    return {
      subtotal,
      itemDiscounts,
      globalDisc,
      total: Math.max(netBeforeGlobal - globalDisc, 0),
      itemCount: cart.reduce((sum, item) => sum + toFiniteNumber(item.quantity, 0), 0),
    };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  return {
    cart,
    setCart,
    addToCart,
    removeCartItem,
    updateCartItemQty,
    updateCartItemUnit,
    updateCartItemPriceType,
    updateCartItemDiscount,
    updateCartItemPrice,
    clearCart,
    cartTotals,
    globalDiscountAmt,
    setGlobalDiscountAmt,
    globalDiscountType,
    setGlobalDiscountType,
  };
};

export default useCart;
