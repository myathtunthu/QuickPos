import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';

// Components
import EntryTabs from '../components/entry/EntryTabs';
import ProductSearch from '../components/entry/ProductSearch';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';
import HoldOrders from '../components/entry/HoldOrders';
import BarcodeSection from '../components/entry/BarcodeSection';

export default function EntryPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('search'); // search, barcode, hold
  const [heldOrders, setHeldOrders] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load Products
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  const addToCart = useCallback((product, unit, priceType, qty) => {
    const selectedUnit = product.units?.find(u => u.name === unit) || product.units?.[0];
    if (!selectedUnit) return;

    const unitPrice = selectedUnit.prices?.[priceType] || selectedUnit.prices?.retail || 0;
    const baseQuantity = qty * (selectedUnit.factor || 1);

    // Stock Check
    if (baseQuantity > (product.stockBase || 0)) {
      alert("Stock မလုံလောက်ပါဘူး!");
      return;
    }

    const cartItem = {
      id: Date.now(),
      productId: product.id,
      name: product.name,
      unit: unit,
      factor: selectedUnit.factor,
      priceType,
      unitPrice,
      quantity: qty,
      baseQuantity,
      subtotal: qty * unitPrice,
    };

    setCart(prev => [...prev, cartItem]);
  }, []);

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const updateCartItem = (id, updates) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const clearCart = () => setCart([]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const total = Math.max(0, subtotal - discount);

  const saveSale = async () => {
    if (cart.length === 0) return alert("Cart ဗလာ ဖြစ်နေပါတယ်");

    try {
      await addDoc(collection(db, 'pos_records'), {
        tenantId,
        type: 'sale',
        items: cart,
        subtotal,
        discount,
        total,
        paymentMethod,
        personName: customer.name || 'Walk-in',
        createdAt: serverTimestamp(),
        status: 'completed'
      });

      alert("ရောင်းချမှု အောင်မြင်ပါသည်!");
      clearCart();
      setCustomer({ name: '', phone: '' });
    } catch (err) {
      alert("Error saving sale");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#060816] text-white pb-24">
      <div className="max-w-7xl mx-auto p-4">
        <h1 className="text-3xl font-black text-cyan-400 mb-6">POS Entry</h1>

        <EntryTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Left - Products */}
          <div className="lg:col-span-7 space-y-4">
            {activeTab === 'search' && <ProductSearch products={products} addToCart={addToCart} />}
            {activeTab === 'barcode' && <BarcodeSection addToCart={addToCart} products={products} />}
            {activeTab === 'hold' && <HoldOrders heldOrders={heldOrders} />}
          </div>

          {/* Right - Cart */}
          <div className="lg:col-span-5">
            <CartSection 
              cart={cart} 
              removeFromCart={removeFromCart}
              updateCartItem={updateCartItem}
              subtotal={subtotal}
              total={total}
              discount={discount}
              setDiscount={setDiscount}
              customer={customer}
              setCustomer={setCustomer}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              saveSale={saveSale}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
