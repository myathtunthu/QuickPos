/**
 * Cart Reducer (Alternative to Zustand, as requested in STACK requirements)
 * Can be used with React's useReducer hook for local state management.
 */

export const initialCartState = {
  items: [],
  discount: 0,
  taxRate: 0.05,
};

export function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(item => item.id === action.payload.id);
      if (existingItemIndex >= 0) {
        const updatedItems = [...state.items];
        if (updatedItems[existingItemIndex].quantity < action.payload.stock) {
          updatedItems[existingItemIndex].quantity += 1;
        }
        return { ...state, items: updatedItems };
      }
      return { ...state, items: [...state.items, { ...action.payload, quantity: 1 }] };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };

    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(1, action.payload.quantity) }
            : item
        )
      };

    case 'SET_DISCOUNT':
      return { ...state, discount: action.payload };

    case 'CLEAR_CART':
      return initialCartState;

    default:
      return state;
  }
}

// Helper to calculate totals from reducer state
export const calculateCartTotals = (state) => {
  const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * state.taxRate;
  const total = subtotal + tax - state.discount;
  return { subtotal, tax, total };
};
