import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';

// Components
import ProductSearch from '../components/entry/ProductSearch';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';
import SummarySection from '../components/entry/SummarySection'; // Create a simple display component for totals if needed

export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const [entryTab, setEntryTab] = useState('Sale'); // 'Sale' | 'Purchase'
  
  // Search States
  const [selCategory, setSelCategory] = useState('All');
  const [prodSearch, setProdSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const debouncedSearch = useDebounce(prodSearch, 300);

  // Payment States
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Use Custom Hook for Cart Logic
  const { 
    cart, addToCart, removeCartItem, updateCartItemQty, 
    cartTotals, clearCart 
    // ... global discount states
  } = useCart(products, entryTab);

  // Data Memos
  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selCategory !== 'All') result = result.filter(p => p.category === selCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').includes(q));
    }
    return result;
  }, [products, debouncedSearch, selCategory]);

  const handleSelectProduct = (product) => {
    // Default unit and price type
    const defaultUnit = product.packageUnits?.[0] || { name: 'ခု', factor: 1, prices: { retail: 0 }};
    const response = addToCart(product, defaultUnit, 'retail', 1);
    
    if (response.success) {
      setProdSearch(''); // Clear search after adding
    } else {
      alert(response.message); // Show error (e.g. Out of stock)
    }
  };

  const handleCheckout = async () => {
    // Firebase ဖြင့် သိမ်းဆည်းမည့် Logic (ဒီနေရာတွင် ဆက်လက်ရေးသားနိုင်သည်)
    setLoading(true);
    // ... Save to Firestore ...
    setLoading(false);
  };

  return (
    <div className="p-3 sm:p-4 pb-28 text-white max-w-4xl mx-auto space-y-4 bg-[#080c14] min-h-screen">
      
      {/* Header & Tabs ကို ဒီနေရာမှာ ထားပါ */}
      <h1 className="text-xl font-black text-cyan-400">POS ENTRY</h1>

      {/* Search & Categories */}
      <ProductSearch 
        categories={categories}
        selCategory={selCategory}
        setSelCategory={setSelCategory}
        prodSearch={prodSearch}
        setProdSearch={setProdSearch}
        setShowScanner={setShowScanner}
      />

      {/* Dropdown (Shows only when typing) */}
      <div className="relative">
        <ProductDropdown 
          products={filteredProducts} 
          onSelect={handleSelectProduct} 
          isOpen={debouncedSearch.length > 0} 
        />
      </div>

      {/* Main Cart Section */}
      <CartSection 
        cart={cart}
        products={products}
        onUpdateQty={updateCartItemQty}
        // ... pass other cart updaters from useCart
        onRemove={removeCartItem}
      />

      {/* Checkout Area (Sticky Bottom for Mobile or inline for Desktop) */}
      {cart.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-cyan-500/20">
          <PaymentSection 
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            paidAmount={paidAmount}
            setPaidAmount={setPaidAmount}
            submitTransaction={handleCheckout}
            loading={loading}
            entryTab={entryTab}
          />
        </div>
      )}

      {/* Scanner Modal & Receipt Modal များကို ဤနေရာတွင် လှမ်းခေါ်ပါ */}
      
    </div>
  );
}
