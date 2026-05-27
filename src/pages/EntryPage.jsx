import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { collection, doc, writeBatch, serverTimestamp, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, Loader2, Save, Archive, Trash2, Printer, 
  User, ScanBarcode, Search, X, Package, Plus, Minus,
  Wallet, CreditCard, AlertTriangle, Clock
} from 'lucide-react';

// ============================================
// Utility Functions
// ============================================
const fmt = (n) => (Number(n) || 0).toLocaleString();

const calculateBaseQuantity = (quantity, unitFactor) => {
  return quantity * (unitFactor || 1);
};

const validateStock = (stock, requiredBaseQuantity) => {
  return (stock || 0) >= requiredBaseQuantity;
};

// ============================================
// Debounce Hook
// ============================================
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ============================================
// Main EntryPage Component
// ============================================
export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopInfo = {
    name: profile?.shopName || 'QuickPOS',
    phone: profile?.phone || '09-123456789',
    address: profile?.address || 'Yangon'
  };

  // ========== State ==========
  const [loading, setLoading] = useState(false);
  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [personName, setPersonName] = useState('');
  const [customerDebt, setCustomerDebt] = useState(0);
  const [debtLimit, setDebtLimit] = useState(0);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState({ amount: 0, type: 'flat' });
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [stockWarning, setStockWarning] = useState('');
  
  // Product selection
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState('retail');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  // Refs for keyboard
  const searchInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

  // ========== Categories ==========
  const categories = useMemo(() => 
    ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  , [products]);

  // ========== Filtered Products ==========
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(term) || 
        p.barcode?.includes(term)
      );
    }
    return result.slice(0, 50);
  }, [products, debouncedSearch, selectedCategory]);

  // ========== Cart Totals ==========
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const itemDiscounts = cart.reduce((sum, item) => sum + (item.itemDiscount || 0), 0);
    const globalDisc = globalDiscount.type === '%' 
      ? (subtotal - itemDiscounts) * (globalDiscount.amount / 100) 
      : globalDiscount.amount;
    const total = Math.max(0, subtotal - itemDiscounts - globalDisc);
    return { subtotal, itemDiscounts, globalDiscount: globalDisc, total };
  }, [cart, globalDiscount]);

  // ========== Cart Functions ==========
  const addToCart = useCallback(() => {
    if (!selectedProduct || !selectedUnit || !unitPrice || !quantity) {
      alert('Please select product, unit, price and quantity');
      return;
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);
    const baseQty = calculateBaseQuantity(qty, selectedUnit.factor || 1);

    if (isNaN(qty) || qty <= 0) {
      alert('Invalid quantity');
      return;
    }

    if (entryTab === 'Sale' && !validateStock(selectedProduct.stock, baseQty)) {
      setStockWarning(`Stock insufficient! Available: ${selectedProduct.stock} ${selectedProduct.baseUnit || 'pcs'}`);
      return;
    }

    const subtotal = price * qty;
    
    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === selectedProduct.id && 
        item.unitName === selectedUnit.name
      );
      
      if (existingIndex !== -1) {
        const newCart = [...prev];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + qty,
          baseQuantity: newCart[existingIndex].baseQuantity + baseQty,
          subtotal: newCart[existingIndex].subtotal + subtotal
        };
        return newCart;
      }
      
      return [...prev, {
        id: Date.now(),
        productId: selectedProduct.id,
        productStock: selectedProduct.stock || 0,
        baseUnit: selectedProduct.baseUnit || 'pcs',
        name: selectedProduct.name,
        unitName: selectedUnit.name,
        unitFactor: selectedUnit.factor || 1,
        priceType: selectedPriceType,
        unitPrice: price,
        quantity: qty,
        baseQuantity: baseQty,
        subtotal,
        itemDiscount: 0
      }];
    });

    setSelectedProduct(null);
    setSelectedUnit(null);
    setUnitPrice('');
    setQuantity('1');
    setStockWarning('');
  }, [selectedProduct, selectedUnit, unitPrice, quantity, selectedPriceType, entryTab]);

  const removeFromCart = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newBaseQty = newQuantity * (item.unitFactor || 1);
      return {
        ...item,
        quantity: newQuantity,
        baseQuantity: newBaseQty,
        subtotal: (item.unitPrice * newQuantity) - (item.itemDiscount || 0)
      };
    }));
  }, [removeFromCart]);

  const updateItemDiscount = useCallback((id, discountAmount) => {
    setCart(prev => prev.map(item =>
      item.id === id
        ? { ...item, itemDiscount: discountAmount, subtotal: (item.unitPrice * item.quantity) - discountAmount }
        : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPersonName('');
    setPaidAmount('');
    setGlobalDiscount({ amount: 0, type: 'flat' });
    setSelectedProduct(null);
    setSelectedUnit(null);
  }, []);

  // ========== Hold Orders ==========
  const saveHoldOrder = useCallback(async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }
    if (!tenantId) return;
    
    try {
      await addDoc(collection(db, 'held_orders'), {
        tenantId,
        cart,
        personName,
        customerDebt,
        totals: cartTotals,
        createdAt: new Date().toISOString(),
        date: entryDate
      });
      clearCart();
      alert('Order saved! Press F5 to load');
    } catch (error) {
      console.error('Save hold error:', error);
      alert('Failed to save');
    }
  }, [cart, tenantId, personName, customerDebt, cartTotals, entryDate, clearCart]);

  const loadHoldOrders = useCallback(async () => {
    if (!tenantId) return;
    try {
      const q = query(
        collection(db, 'held_orders'),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (orders.length > 0) {
        const lastOrder = orders[0];
        setCart(lastOrder.cart || []);
        setPersonName(lastOrder.personName || '');
        alert('Last hold order loaded');
      } else {
        alert('No hold orders found');
      }
    } catch (error) {
      console.error('Load hold error:', error);
    }
  }, [tenantId]);

  // ========== Product Selection ==========
  const handleSelectProduct = useCallback((product) => {
    setSelectedProduct(product);
    const defaultUnit = product.packageUnits?.[0] || null;
    setSelectedUnit(defaultUnit);
    if (defaultUnit) {
      if (entryTab === 'Sale') {
        setUnitPrice(String(defaultUnit.prices?.retail || 0));
      } else {
        setUnitPrice(String(defaultUnit.costPrice || 0));
      }
    }
    setStockWarning('');
  }, [entryTab]);

  const handleUnitChange = useCallback((unitName) => {
    const unit = selectedProduct?.packageUnits?.find(u => u.name === unitName);
    setSelectedUnit(unit);
    if (unit) {
      if (entryTab === 'Sale') {
        setUnitPrice(String(unit.prices?.[selectedPriceType] || 0));
      } else {
        setUnitPrice(String(unit.costPrice || 0));
      }
    }
  }, [selectedProduct, selectedPriceType, entryTab]);

  const handlePriceTypeChange = useCallback((type) => {
    setSelectedPriceType(type);
    if (selectedUnit) {
      setUnitPrice(String(selectedUnit.prices?.[type] || 0));
    }
  }, [selectedUnit]);

  // ========== Barcode Handler ==========
  const handleBarcodeScan = useCallback((barcode) => {
    if (!barcode || !products.length) return;
    
    for (const product of products) {
      if (product.barcode === barcode) {
        handleSelectProduct(product);
        return;
      }
      if (product.packageUnits) {
        for (const unit of product.packageUnits) {
          if (unit.barcodes && Object.values(unit.barcodes).includes(barcode)) {
            handleSelectProduct(product);
            setSelectedUnit(unit);
            if (entryTab === 'Sale') {
              setUnitPrice(String(unit.prices?.retail || 0));
            }
            return;
          }
        }
      }
    }
    alert('Product not found');
  }, [products, handleSelectProduct, entryTab]);

  // ========== Submit Transaction ==========
  const submitTransaction = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (entryTab === 'Sale') {
      for (const item of cart) {
        if (item.productStock < item.baseQuantity) {
          alert(`Insufficient stock for ${item.name}`);
          return;
        }
      }
    }

    if (paymentMethod === 'Credit') {
      const newTotalDebt = customerDebt + cartTotals.total;
      if (debtLimit > 0 && newTotalDebt > debtLimit) {
        alert(`Debt limit exceeded! Limit: ${fmt(debtLimit)} Ks`);
        return;
      }
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const recordRef = doc(collection(db, 'pos_records'));
      
      const total = cartTotals.total;
      const paid = paymentMethod === 'Credit' ? 0 : (Number(paidAmount) || total);
      const debt = Math.max(0, total - paid);
      
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
          priceType: item.priceType,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          itemDiscount: item.itemDiscount,
          baseQuantity: item.baseQuantity
        })),
        subtotal: cartTotals.subtotal,
        itemDiscounts: cartTotals.itemDiscounts,
        globalDiscount: cartTotals.globalDiscount,
        total,
        paymentMethod,
        paidAmount: paid,
        remainingDebt: debt,
        invoiceNo: `INV-${Date.now()}`
      };
      
      batch.set(recordRef, record);
      
      for (const item of cart) {
        const productRef = doc(db, 'pos_products', item.productId);
        const stockChange = entryTab === 'Sale' ? -item.baseQuantity : item.baseQuantity;
        batch.update(productRef, {
          stock: (item.productStock || 0) + stockChange
        });
      }
      
      await batch.commit();
      setShowReceipt(record);
      clearCart();
      
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  // ========== Print Receipt ==========
  const handlePrintReceipt = (record) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><title>Receipt</title>
      <style>
        body { font-family: monospace; width: 360px; margin: 20px auto; padding: 20px; border: 2px dashed #000; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; }
        .shop-name { font-size: 22px; font-weight: bold; }
        table { width: 100%; margin: 10px 0; }
        th, td { text-align: left; padding: 5px 0; }
        td:last-child { text-align: right; }
        .total { font-size: 18px; font-weight: bold; text-align: right; border-top: 2px solid #000; padding-top: 10px; }
        .footer { text-align: center; margin-top: 15px; font-size: 11px; }
      </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${shopInfo.name}</div>
          <div>${shopInfo.phone}</div>
          <div>${shopInfo.address}</div>
          <div>${record.date}</div>
          <div>${record.invoiceNo}</div>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
          <tbody>
            ${record.items.map(item => `
              <tr><td>${item.name}</td><td>${item.quantity}</td><td>${fmt(item.subtotal)}</td></tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">TOTAL: ${fmt(record.total)} Ks</div>
        <div>Method: ${record.paymentMethod}</div>
        <div>Paid: ${fmt(record.paidAmount)} Ks</div>
        ${record.remainingDebt > 0 ? `<div>Remaining Debt: ${fmt(record.remainingDebt)} Ks</div>` : ''}
        <div class="footer">Thank you for your purchase!</div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body>
      </html>
    `;
    const win = window.open();
    win.document.write(html);
    win.document.close();
  };

  // ========== Keyboard Shortcuts ==========
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'F1') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F2') { e.preventDefault(); barcodeInputRef.current?.focus(); }
      if (e.key === 'F3') { e.preventDefault(); saveHoldOrder(); }
      if (e.key === 'F4') { e.preventDefault(); clearCart(); }
      if (e.key === 'F5') { e.preventDefault(); loadHoldOrders(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); submitTransaction(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [saveHoldOrder, clearCart, loadHoldOrders, submitTransaction]);

  // ========== Render ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060816] to-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 py-4 pb-32">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2">
            <ShoppingCart size={24} /> POS ENTRY
          </h1>
          <div className="flex gap-1 text-[10px] text-slate-500 bg-black/40 px-3 py-1.5 rounded-full">
            <span>F1🔍</span><span>F2📷</span><span>F3💾</span><span>F4🗑️</span><span>F5📋</span><span>Ctrl+S✓</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['Sale', 'Purchase', 'Expense'].map(tab => (
            <button key={tab} onClick={() => { setEntryTab(tab); clearCart(); }}
              className={`py-3 rounded-xl font-bold text-sm transition-all ${entryTab === tab ? 'bg-cyan-600 text-white' : 'bg-[#0f172a] text-slate-400 border border-white/5'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Customer Section */}
        {entryTab !== 'Expense' && (
          <div className="bg-[#0f172a] rounded-xl p-4 mb-4 border border-cyan-500/20">
            <h3 className="text-xs text-cyan-400 mb-2">CUSTOMER</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)}
                placeholder="Customer name" className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm" />
              <input type="number" value={customerDebt} onChange={(e) => setCustomerDebt(Number(e.target.value) || 0)}
                placeholder="Current debt" className="bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-white text-sm" />
              <input type="number" value={debtLimit} onChange={(e) => setDebtLimit(Number(e.target.value) || 0)}
                placeholder="Debt limit" className="bg-black/40 border border-rose-500/20 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
        )}

        {/* Barcode Section */}
        {entryTab !== 'Expense' && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-3 w-4 h-4 text-blue-400" />
              <input ref={barcodeInputRef} type="text" onKeyDown={(e) => e.key === 'Enter' && handleBarcodeScan(e.target.value)}
                placeholder="Scan barcode (F2)" className="w-full bg-[#0f172a] border border-blue-500/20 rounded-xl pl-10 pr-3 py-3 text-white" />
            </div>
            <button onClick={() => setShowScanner(true)} className="px-4 bg-blue-600 rounded-xl text-white">
              <ScanBarcode size={20} />
            </button>
          </div>
        )}

        {/* Search */}
        {entryTab !== 'Expense' && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products (F1)" className="w-full bg-[#0f172a] border border-cyan-500/20 rounded-xl pl-10 pr-3 py-3 text-white" />
          </div>
        )}

        {/* Categories */}
        {entryTab !== 'Expense' && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${selectedCategory === cat ? 'bg-cyan-600' : 'bg-[#0f172a] text-slate-400'}`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Product List */}
        {entryTab !== 'Expense' && filteredProducts.length > 0 && (
          <div className="bg-[#0f172a] rounded-xl border border-cyan-500/20 mb-4 max-h-64 overflow-y-auto">
            {filteredProducts.map(product => (
              <div key={product.id} onClick={() => handleSelectProduct(product)}
                className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 cursor-pointer border-b border-white/5">
                <Package size={16} className="text-cyan-400" />
                <div className="flex-1"><p className="text-white">{product.name}</p><p className="text-xs text-slate-400">Stock: {product.stock || 0}</p></div>
                <p className="text-cyan-400">{product.packageUnits?.[0]?.prices?.retail?.toLocaleString()} Ks</p>
              </div>
            ))}
          </div>
        )}

        {/* Stock Warning */}
        {stockWarning && (
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 mb-4 flex items-center gap-2 text-rose-400 text-sm">
            <AlertTriangle size={16} /> {stockWarning}
          </div>
        )}

        {/* Selected Product Detail */}
        {selectedProduct && selectedUnit && (
          <div className="bg-[#0f172a] rounded-2xl p-4 mb-6 border border-cyan-500/20">
            <div className="flex justify-between items-start mb-3">
              <div><h3 className="font-bold text-white">{selectedProduct.name}</h3><p className="text-xs text-slate-400">Stock: {selectedProduct.stock} {selectedProduct.baseUnit}</p></div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select value={selectedUnit.name} onChange={(e) => handleUnitChange(e.target.value)}
                className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm">
                {selectedProduct.packageUnits?.map(unit => (
                  <option key={unit.name} value={unit.name}>{unit.name} (1={unit.factor})</option>
                ))}
              </select>
              {entryTab === 'Sale' && (
                <select value={selectedPriceType} onChange={(e) => handlePriceTypeChange(e.target.value)}
                  className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="retail">Retail</option><option value="wholesaleA">Wholesale A</option>
                  <option value="wholesaleB">Wholesale B</option><option value="wholesaleC">Wholesale C</option>
                </select>
              )}
              <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm" />
              <div className="flex gap-2">
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="0.25" step="0.25"
                  className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm" />
                <button onClick={addToCart} className="px-4 bg-cyan-600 rounded-lg text-white font-bold"><Plus size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {/* Cart Section */}
        {cart.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 overflow-hidden">
                <div className="p-4 border-b border-cyan-500/20 bg-cyan-600/5">
                  <h3 className="font-bold text-white">Cart ({cart.length} items)</h3>
                </div>
                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div><p className="font-bold text-white">{item.name}</p><p className="text-xs text-cyan-400">{fmt(item.unitPrice)} × {item.quantity} {item.unitName}</p></div>
                        <button onClick={() => removeFromCart(item.id)} className="text-rose-400"><Trash2 size={16} /></button>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.id, Math.max(0.25, item.quantity - 0.25))} className="w-7 h-7 bg-black/40 rounded-lg"><Minus size={12} /></button>
                          <span className="text-white w-12 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 0.25)} className="w-7 h-7 bg-black/40 rounded-lg"><Plus size={12} /></button>
                        </div>
                        <p className="font-bold text-white">{fmt(item.subtotal)} Ks</p>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <input type="number" placeholder="Discount" value={item.itemDiscount || ''} onChange={(e) => updateItemDiscount(item.id, Number(e.target.value) || 0)}
                          className="w-24 bg-black/40 border border-amber-500/20 rounded-lg px-2 py-1 text-xs text-amber-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              {/* Summary */}
              <div className="bg-gradient-to-br from-cyan-900/20 to-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 mb-4">
                <h3 className="font-bold text-white mb-3">Summary</h3>
                <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{fmt(cartTotals.subtotal)} Ks</span></div>
                {cartTotals.itemDiscounts > 0 && <div className="flex justify-between text-amber-400"><span>Discounts</span><span>-{fmt(cartTotals.itemDiscounts)} Ks</span></div>}
                <div className="border-t border-cyan-500/20 pt-2 mt-2"><div className="flex justify-between text-lg font-bold"><span className="text-cyan-400">TOTAL</span><span>{fmt(cartTotals.total)} Ks</span></div></div>
              </div>

              {/* Global Discount */}
              <div className="bg-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 mb-4">
                <div className="flex gap-2">
                  <input type="number" value={globalDiscount.amount} onChange={(e) => setGlobalDiscount({ ...globalDiscount, amount: Number(e.target.value) || 0 })}
                    placeholder="Discount" className="flex-1 bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400 text-sm" />
                  <button onClick={() => setGlobalDiscount({ ...globalDiscount, type: '%' })} className={`px-3 py-2 rounded-lg text-xs ${globalDiscount.type === '%' ? 'bg-amber-600' : 'bg-black/40'}`}>%</button>
                  <button onClick={() => setGlobalDiscount({ ...globalDiscount, type: 'flat' })} className={`px-3 py-2 rounded-lg text-xs ${globalDiscount.type === 'flat' ? 'bg-amber-600' : 'bg-black/40'}`}>Ks</button>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 sticky top-4">
                <h3 className="font-bold text-white mb-3">Payment</h3>
                <div className="grid grid-cols-5 gap-1 mb-4">
                  {['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'].map(m => (
                    <button key={m} onClick={() => { setPaymentMethod(m); if (m === 'Credit') setPaidAmount('0'); }}
                      className={`py-2 rounded-lg text-xs font-bold ${paymentMethod === m ? 'bg-cyan-600' : 'bg-black/40'}`}>{m}</button>
                  ))}
                </div>
                {paymentMethod !== 'Credit' && (
                  <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={`Amount (Total: ${fmt(cartTotals.total)})`}
                    className="w-full bg-black/40 border border-emerald-500/20 rounded-xl px-3 py-3 text-white mb-4" />
                )}
                <button onClick={submitTransaction} disabled={loading} className="w-full py-3 bg-cyan-600 rounded-xl text-white font-bold">
                  {loading ? <Loader2 className="animate-spin mx-auto" /> : `Complete ${paymentMethod === 'Credit' ? 'Credit' : ''} Sale`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {cart.length === 0 && !selectedProduct && entryTab !== 'Expense' && (
          <div className="text-center py-16"><ShoppingCart size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Cart is empty. Search or scan a product.</p>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setShowScanner(false)}>
          <div className="bg-[#0f172a] rounded-2xl p-6 w-96 text-center">
            <ScanBarcode size={48} className="mx-auto text-cyan-400 mb-4 animate-pulse" />
            <p className="text-white">Position barcode in frame</p>
            <button onClick={() => setShowScanner(false)} className="mt-4 text-slate-400">Close</button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowReceipt(null)}>
          <div className="bg-white text-black rounded-2xl p-6 max-w-sm w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-center">{shopInfo.name}</h2>
            <p className="text-center text-xs text-gray-500">{showReceipt.date}</p>
            <div className="border-t my-4"></div>
            {showReceipt.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm"><span>{item.name} × {item.quantity}</span><span>{fmt(item.subtotal)} Ks</span></div>
            ))}
            <div className="border-t my-4"></div>
            <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span>{fmt(showReceipt.total)} Ks</span></div>
            <p className="text-right text-sm mt-2">Paid: {fmt(showReceipt.paidAmount)} Ks</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => handlePrintReceipt(showReceipt)} className="flex-1 py-2 bg-cyan-600 text-white rounded-xl"><Printer size={16} className="inline mr-1" /> Print</button>
              <button onClick={() => setShowReceipt(null)} className="flex-1 py-2 bg-gray-200 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
