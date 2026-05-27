import React, { useState, useMemo, useCallback } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { 
  ShoppingCart, Loader2, User, ScanBarcode, Search, X, 
  Package, Plus, Minus, Wallet, CreditCard, AlertTriangle, Printer 
} from 'lucide-react';

const fmt = (n) => (Number(n) || 0).toLocaleString();

export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [loading, setLoading] = useState(false);
  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [personName, setPersonName] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [showReceipt, setShowReceipt] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 30);
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(term) || 
      p.barcode?.includes(term)
    ).slice(0, 30);
  }, [products, searchTerm]);

  // Cart totals
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    return { subtotal, total: subtotal };
  }, [cart]);

  const addToCart = () => {
    if (!selectedProduct || !selectedUnit || !unitPrice || !quantity) {
      alert('Please select product');
      return;
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);
    
    setCart(prev => [...prev, {
      id: Date.now(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      unitName: selectedUnit.name,
      unitPrice: price,
      quantity: qty,
      subtotal: price * qty,
      baseQuantity: qty * (selectedUnit.factor || 1),
      productStock: selectedProduct.stock || 0
    }]);

    setSelectedProduct(null);
    setSelectedUnit(null);
    setUnitPrice('');
    setQuantity('1');
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === id 
        ? { ...item, quantity: newQty, subtotal: item.unitPrice * newQty }
        : item
    ));
  };

  const clearCart = () => {
    setCart([]);
    setPersonName('');
    setPaidAmount('');
  };

  const submitTransaction = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const recordRef = doc(collection(db, 'pos_records'));
      
      const total = cartTotals.total;
      const paid = paymentMethod === 'Credit' ? 0 : (Number(paidAmount) || total);
      
      const record = {
        type: entryTab,
        tenantId,
        personName: personName || 'Walk-in',
        date: entryDate,
        createdAt: serverTimestamp(),
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitName: item.unitName,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal
        })),
        total,
        paymentMethod,
        paidAmount: paid,
        remainingDebt: total - paid,
        invoiceNo: `INV-${Date.now()}`
      };
      
      batch.set(recordRef, record);
      
      for (const item of cart) {
        const productRef = doc(db, 'pos_products', item.productId);
        batch.update(productRef, {
          stock: (item.productStock || 0) - item.baseQuantity
        });
      }
      
      await batch.commit();
      setShowReceipt(record);
      clearCart();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    const unit = product.packageUnits?.[0];
    setSelectedUnit(unit);
    if (unit) setUnitPrice(String(unit.prices?.retail || 0));
  };

  return (
    <div className="min-h-screen bg-[#060816]">
      <div className="max-w-7xl mx-auto px-4 py-4 pb-32">
        
        <h1 className="text-xl font-black text-cyan-400 mb-6">POS ENTRY</h1>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['Sale', 'Purchase', 'Expense'].map(tab => (
            <button
              key={tab}
              onClick={() => setEntryTab(tab)}
              className={`py-3 rounded-xl font-bold ${
                entryTab === tab ? 'bg-cyan-600 text-white' : 'bg-[#0f172a] text-slate-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Customer */}
        {entryTab !== 'Expense' && (
          <div className="bg-[#0f172a] rounded-xl p-4 mb-4">
            <input
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Customer name"
              className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white"
            />
          </div>
        )}

        {/* Search */}
        {entryTab !== 'Expense' && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-[#0f172a] border border-cyan-500/20 rounded-xl pl-10 pr-3 py-3 text-white"
            />
          </div>
        )}

        {/* Product List */}
        {entryTab !== 'Expense' && searchTerm && filteredProducts.length > 0 && (
          <div className="bg-[#0f172a] rounded-xl border border-cyan-500/20 mb-4 max-h-64 overflow-y-auto">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 cursor-pointer border-b border-white/5"
              >
                <Package size={16} className="text-cyan-400" />
                <div className="flex-1">
                  <p className="text-white">{product.name}</p>
                  <p className="text-xs text-slate-400">Stock: {product.stock || 0}</p>
                </div>
                <p className="text-cyan-400">{product.packageUnits?.[0]?.prices?.retail?.toLocaleString()} Ks</p>
              </div>
            ))}
          </div>
        )}

        {/* Selected Product */}
        {selectedProduct && selectedUnit && (
          <div className="bg-[#0f172a] rounded-2xl p-4 mb-6 border border-cyan-500/20">
            <div className="flex justify-between mb-3">
              <h3 className="font-bold text-white">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select value={selectedUnit.name} onChange={(e) => {
                const unit = selectedProduct.packageUnits?.find(u => u.name === e.target.value);
                setSelectedUnit(unit);
                setUnitPrice(String(unit?.prices?.retail || 0));
              }} className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white">
                {selectedProduct.packageUnits?.map(unit => (
                  <option key={unit.name} value={unit.name}>{unit.name}</option>
                ))}
              </select>
              <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Price" className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white" />
              <div className="flex gap-2">
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white" />
                <button onClick={addToCart} className="px-4 bg-cyan-600 rounded-lg text-white">+</button>
              </div>
            </div>
          </div>
        )}

        {/* Cart */}
        {cart.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-[#0f172a] rounded-2xl p-4">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 border-b border-white/10">
                    <div>
                      <p className="text-white font-bold">{item.name}</p>
                      <p className="text-xs text-cyan-400">{fmt(item.unitPrice)} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 bg-black/40 rounded">-</button>
                      <span className="text-white">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 bg-black/40 rounded">+</button>
                      <button onClick={() => removeFromCart(item.id)} className="text-rose-400">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-[#0f172a] rounded-2xl p-4">
                <div className="flex justify-between mb-4">
                  <span className="text-slate-400">Total:</span>
                  <span className="text-white font-bold">{fmt(cartTotals.total)} Ks</span>
                </div>
                
                <div className="grid grid-cols-5 gap-1 mb-4">
                  {['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 rounded-lg text-xs ${paymentMethod === m ? 'bg-cyan-600' : 'bg-black/40'}`}>{m}</button>
                  ))}
                </div>
                
                {paymentMethod !== 'Credit' && (
                  <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={`Amount (Total: ${fmt(cartTotals.total)})`} className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white mb-4" />
                )}
                
                <button onClick={submitTransaction} disabled={loading} className="w-full py-3 bg-cyan-600 rounded-xl text-white font-bold">
                  {loading ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
