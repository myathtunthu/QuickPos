/**
 * Cart Reducer
 *
 * This reducer is intentionally framework-agnostic so it can be used with
 * React.useReducer, tests, or a future offline-first cart module. The app
 * currently also has a Zustand cart store; keeping this reducer safe prevents
 * future regressions when teams reuse it for POS/cart workflows.
 *
 * Security / reliability goals:
 * - Never trust action payload numbers directly.
 * - Prevent negative quantity, price, discount, tax, or total values.
 * - Support Myanmar/international UOM multipliers such as viss, tical, pyi,
 *   tin, kg, g, pack, carton, etc.
 * - Keep calculations deterministic and rounded to avoid floating drift.
 */

export const CART_ACTIONS = Object.freeze({
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  UPDATE_UNIT: 'UPDATE_UNIT',
  SET_DISCOUNT: 'SET_DISCOUNT',
  SET_TAX_RATE: 'SET_TAX_RATE',
  CLEAR_CART: 'CLEAR_CART',
});

export const initialCartState = Object.freeze({
  items: [],
  discount: 0,
  taxRate: 0,
});

const MAX_CART_ITEMS = 500;
const MAX_QUANTITY = 1_000_000;
const MAX_PRICE = 1_000_000_000;
const MAX_DISCOUNT = 1_000_000_000;
const MAX_TAX_RATE = 1;
const DECIMAL_PRECISION = 6;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const round = (value, precision = DECIMAL_PRECISION) => {
  const factor = 10 ** precision;
  return Math.round((toFiniteNumber(value) + Number.EPSILON) * factor) / factor;
};

const normalizeText = (value, fallback = '') => {
  const text = String(value ?? fallback).trim();
  return text || fallback;
};

const getUnitMultiplier = (unit = {}) => {
  const multiplier = toFiniteNumber(unit.multiplier ?? unit.baseMultiplier ?? unit.ratio, 1);
  return multiplier > 0 ? round(multiplier) : 1;
};

const normalizeUnit = (unit, fallbackUnit = null) => {
  const safeFallback = fallbackUnit || { name: 'pcs', multiplier: 1, allowDecimal: false };
  const source = unit && typeof unit === 'object' ? unit : safeFallback;
  const name = normalizeText(source.name ?? source.label ?? source.unit, safeFallback.name || 'pcs');
  const multiplier = getUnitMultiplier(source);
  const allowDecimal = Boolean(source.allowDecimal ?? !['pcs', 'ခု', 'လုံး', 'set', 'စုံ'].includes(name));

  return {
    ...source,
    name,
    multiplier,
    allowDecimal,
  };
};

const normalizeQuantity = (quantity, unit) => {
  const safeUnit = normalizeUnit(unit);
  const min = safeUnit.allowDecimal ? 0.001 : 1;
  const raw = clamp(toFiniteNumber(quantity, min), min, MAX_QUANTITY);
  return safeUnit.allowDecimal ? round(raw, 3) : Math.max(1, Math.floor(raw));
};

const getBaseQuantity = (quantity, unit) => round(normalizeQuantity(quantity, unit) * getUnitMultiplier(unit));

const getAvailableBaseStock = (item) => {
  const stock = toFiniteNumber(item?.stock ?? item?.baseStock ?? item?.quantityInStock, Number.POSITIVE_INFINITY);
  const stockUnit = normalizeUnit(item?.baseUnit ? { name: item.baseUnit, multiplier: 1, allowDecimal: true } : item?.unit);
  const stockMultiplier = getUnitMultiplier(stockUnit);
  return stock === Number.POSITIVE_INFINITY ? stock : Math.max(0, round(stock * stockMultiplier));
};

const hasEnoughStock = (item, quantity, unit) => {
  const availableBaseStock = getAvailableBaseStock(item);
  if (availableBaseStock === Number.POSITIVE_INFINITY) return true;
  return getBaseQuantity(quantity, unit) <= availableBaseStock + 0.000001;
};

const normalizeCartItem = (payload = {}, existingItem = null) => {
  const selectedUnit = normalizeUnit(payload.selectedUnit ?? payload.unit, existingItem?.selectedUnit ?? existingItem?.unit);
  const quantity = normalizeQuantity(payload.quantity ?? existingItem?.quantity ?? 1, selectedUnit);
  const price = clamp(toFiniteNumber(payload.price ?? existingItem?.price, 0), 0, MAX_PRICE);
  const discount = clamp(toFiniteNumber(payload.discount ?? existingItem?.discount, 0), 0, MAX_DISCOUNT);

  return {
    ...(existingItem || {}),
    ...payload,
    id: normalizeText(payload.id ?? existingItem?.id),
    name: normalizeText(payload.name ?? existingItem?.name, 'Unnamed Product'),
    price: round(price, 2),
    discount: round(discount, 2),
    selectedUnit,
    unit: selectedUnit,
    quantity,
    baseQuantity: getBaseQuantity(quantity, selectedUnit),
  };
};

const updateItemQuantitySafely = (item, nextQuantity, nextUnit = item.selectedUnit ?? item.unit) => {
  const unit = normalizeUnit(nextUnit, item.selectedUnit ?? item.unit);
  const quantity = normalizeQuantity(nextQuantity, unit);

  if (!hasEnoughStock(item, quantity, unit)) {
    return {
      ...item,
      stockWarning: true,
      stockWarningMessage: 'လက်ကျန် Stock ထက် ကျော်နေပါသည်။',
    };
  }

  return {
    ...item,
    selectedUnit: unit,
    unit,
    quantity,
    baseQuantity: getBaseQuantity(quantity, unit),
    stockWarning: false,
    stockWarningMessage: '',
  };
};

export function cartReducer(state = initialCartState, action = {}) {
  const currentState = {
    ...initialCartState,
    ...state,
    items: Array.isArray(state?.items) ? state.items : [],
  };

  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const payload = action.payload || {};
      const productId = normalizeText(payload.id);
      if (!productId) return currentState;

      const existingItemIndex = currentState.items.findIndex((item) => item.id === productId);

      if (existingItemIndex >= 0) {
        const updatedItems = currentState.items.map((item, index) => {
          if (index !== existingItemIndex) return item;
          const unit = normalizeUnit(payload.selectedUnit ?? payload.unit, item.selectedUnit ?? item.unit);
          const incrementBy = normalizeQuantity(payload.quantity ?? 1, unit);
          return updateItemQuantitySafely(item, toFiniteNumber(item.quantity, 0) + incrementBy, unit);
        });
        return { ...currentState, items: updatedItems };
      }

      if (currentState.items.length >= MAX_CART_ITEMS) return currentState;

      const newItem = normalizeCartItem({ ...payload, quantity: payload.quantity ?? 1 });
      if (!hasEnoughStock(newItem, newItem.quantity, newItem.selectedUnit)) {
        return currentState;
      }

      return { ...currentState, items: [...currentState.items, newItem] };
    }

    case CART_ACTIONS.REMOVE_ITEM: {
      const productId = normalizeText(action.payload?.id ?? action.payload);
      return {
        ...currentState,
        items: currentState.items.filter((item) => item.id !== productId),
      };
    }

    case CART_ACTIONS.UPDATE_QUANTITY: {
      const productId = normalizeText(action.payload?.id);
      if (!productId) return currentState;
      return {
        ...currentState,
        items: currentState.items.map((item) =>
          item.id === productId
            ? updateItemQuantitySafely(item, action.payload.quantity, action.payload.selectedUnit ?? action.payload.unit)
            : item,
        ),
      };
    }

    case CART_ACTIONS.UPDATE_UNIT: {
      const productId = normalizeText(action.payload?.id);
      if (!productId) return currentState;
      return {
        ...currentState,
        items: currentState.items.map((item) => {
          if (item.id !== productId) return item;
          const nextUnit = normalizeUnit(action.payload.selectedUnit ?? action.payload.unit, item.selectedUnit ?? item.unit);
          return updateItemQuantitySafely(item, item.quantity, nextUnit);
        }),
      };
    }

    case CART_ACTIONS.SET_DISCOUNT: {
      return {
        ...currentState,
        discount: round(clamp(toFiniteNumber(action.payload, 0), 0, MAX_DISCOUNT), 2),
      };
    }

    case CART_ACTIONS.SET_TAX_RATE: {
      return {
        ...currentState,
        taxRate: round(clamp(toFiniteNumber(action.payload, 0), 0, MAX_TAX_RATE), 4),
      };
    }

    case CART_ACTIONS.CLEAR_CART:
      return { ...initialCartState, items: [] };

    default:
      return currentState;
  }
}

export const calculateCartTotals = (state = initialCartState) => {
  const safeState = {
    ...initialCartState,
    ...state,
    items: Array.isArray(state?.items) ? state.items : [],
  };

  const subtotal = safeState.items.reduce((sum, item) => {
    const price = clamp(toFiniteNumber(item.price, 0), 0, MAX_PRICE);
    const quantity = normalizeQuantity(item.quantity, item.selectedUnit ?? item.unit);
    return sum + price * quantity;
  }, 0);

  const itemDiscount = safeState.items.reduce((sum, item) => {
    const discount = clamp(toFiniteNumber(item.discount, 0), 0, MAX_DISCOUNT);
    return sum + discount;
  }, 0);

  const cartDiscount = clamp(toFiniteNumber(safeState.discount, 0), 0, MAX_DISCOUNT);
  const taxableAmount = Math.max(0, subtotal - itemDiscount - cartDiscount);
  const taxRate = clamp(toFiniteNumber(safeState.taxRate, 0), 0, MAX_TAX_RATE);
  const tax = taxableAmount * taxRate;
  const total = Math.max(0, taxableAmount + tax);

  return {
    subtotal: round(subtotal, 2),
    itemDiscount: round(itemDiscount, 2),
    discount: round(cartDiscount, 2),
    taxableAmount: round(taxableAmount, 2),
    tax: round(tax, 2),
    total: round(total, 2),
    itemCount: safeState.items.length,
    totalQuantity: round(safeState.items.reduce((sum, item) => sum + normalizeQuantity(item.quantity, item.selectedUnit ?? item.unit), 0), 3),
    totalBaseQuantity: round(safeState.items.reduce((sum, item) => sum + getBaseQuantity(item.quantity, item.selectedUnit ?? item.unit), 0), 3),
  };
};

export const cartReducerTestUtils = {
  normalizeUnit,
  normalizeQuantity,
  getBaseQuantity,
  hasEnoughStock,
};
