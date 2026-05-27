import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';

// Components
import EntryTabs from '../components/entry/EntryTabs';
import ProductSearch from '../components/entry/ProductSearch';
import CartSection from '../components/entry/CartSection';
import BarcodeSection from '../components/entry/BarcodeSection';
import HoldOrders from '../components/entry/HoldOrders';

export default function EntryPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
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
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  const addToCart = useCallback((product, selectedUnit, priceType, qty) => {
    const unitObj = product.units?.find(u => u.name === selectedUnit) || product.units?.[0];
    if (!unitObj) return;

    const unitPrice = unitObj.prices?.[priceType] || unitObj.prices?.retail || 0;
    const baseQty = qty * (unitObj.factor || 1);

    if (baseQty > (product.stockBase || 0)) {
      alert(`Stock မလုံလောက်ပါဘူး! (${product.stockBase} ဘူး ကျန်ပါတယ်)`);
      return;
    }

    const newItem = {
      id: Date.now(),
      productId: product.id,
      name: product.name,
      unit: selectedUnit,
      factor: unitObj.factor,
      priceType,
      unitPrice,
      quantity: qty,
      baseQuantity: baseQty,
      subtotal: qty * unitPrice,
    };

    setCart(prev => [...prev, newItem]);
  }, []);

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.subtotal, 0), [cart]);
  const total = Math.max(0, subtotal - discount);

  const saveSale = async () => {
    if (cart.length === 0) return alert("Cart ဗလာဖြစ်နေပါတယ်");

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
      });

      alert("✅ ရောင်းချမှု အောင်မြင်ပါသည်!");
      setCart([]);
      setCustomer({ name: '', phone: '' });
      setDiscount(0);
    } catch (e) {
      alert("Error saving sale");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Loading POS System...</div>;
  }

  return (
    <div className="min-h-screen bg-[#060816] text-white pb-20">
      <div className="max-w-7xl mx-auto p-4">
        <h1 className="text-3xl font-black text-cyan-400 mb-6 flex items-center gap-3">
          <Package size={32} /> POS Entry
        </h1>

        <EntryTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-7">
            {activeTab === 'products' && <ProductSearch products={products} addToCart={addToCart} />}
            {activeTab === 'barcode' && <BarcodeSection products={products} addToCart={addToCart} />}
            {activeTab === 'hold' && <HoldOrders heldOrders={heldOrders} />}
          </div>

          <div className="lg:col-span-5">
            <CartSection
              cart={cart}
              removeFromCart={removeFromCart}
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
