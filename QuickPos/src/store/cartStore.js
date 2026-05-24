import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  cart: [],
  discount: 0,
  taxRate: 0.05, // 5% Commercial Tax example
  
  addToCart: (product) => set((state) => {
    const existingItem = state.cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) return state; // Stock limit check
      return {
        cart: state.cart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      };
    }
    return { cart: [...state.cart, { ...product, quantity: 1 }] };
  }),

  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter(item => item.id !== productId)
  })),

  updateQuantity: (productId, quantity) => set((state) => ({
    cart: state.cart.map(item => 
      item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
    )
  })),

  setDiscount: (amount) => set({ discount: amount }),

  clearCart: () => set({ cart: [], discount: 0 }),

  getTotals: () => {
    const state = get();
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * state.taxRate;
    const total = subtotal + tax - state.discount;
    return { subtotal, tax, total };
  }
}));
