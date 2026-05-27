import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
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

const validateStock = (product, requiredBaseQuantity) => {
  return (product?.stock || 0) >= requiredBaseQuantity;
};

// ============================================
// EntryTabs Component
// ============================================
const EntryTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'Sale', label: 'Sale', color: 'cyan' },
    { id: 'Purchase', label: 'Purchase', color: 'amber' },
    { id: 'Expense', label: 'Expense', color: 'rose' }
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`py-3 rounded-xl font-black text-sm transition-all ${
            activeTab === tab.id
              ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-500/20`
              : 'bg-[#0f172a] text-slate-400 border border-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ============================================
// CustomerSection Component
// ============================================
const CustomerSection = ({ personName, setPersonName }) => {
  return (
    <div className="bg-[#0f172a] rounded-xl p-4 mb-4 border border-cyan-500/20">
      <h3 className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-2">
        <User size={12} /> CUSTOMER INFO
      </h3>
      <input
        type="text"
        value={personName}
        onChange={(e) => setPersonName(e.target.value)}
        placeholder="Customer name"
        className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
      />
    </div>
  );
};

// ============================================
// BarcodeSection Component
// ============================================
const BarcodeSection = ({ onScan, onOpenScanner }) => {
  const [barcodeInput, setBarcodeInput] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onScan(barcodeInput);
      setBarcodeInput('');
    }
  };

  return (
    <div className="flex gap-2 flex-1 mb-4">
      <div className="relative flex-1">
        <ScanBarcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
        <input
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scan or type barcode..."
          className="w-full bg-[#0f172a] border border-blue-500/20 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
        />
      </div>
      <button
        onClick={onOpenScanner}
        className="px-4 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-500 transition-colors"
      >
        <ScanBarcode size={20} />
      </button>
    </div>
  );
};

// ============================================
// ProductDropdown Component
// ============================================
const ProductDropdown = ({ products, onSelectProduct }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => 
    ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  , [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.barcode?.includes(term)
      );
    }
    return result.slice(0, 50);
  }, [products, searchTerm, selectedCategory]);

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-[#0f172a] border border-cyan-500/20 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <X size={16} className="text-slate-400" />
          </button>
        )}
      </div>
      
      <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-cyan-600 text-white'
                : 'bg-[#0f172a] text-slate-400 border border-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {filteredProducts.length > 0 && (
        <div className="mt-3 bg-[#0f172a] rounded-xl border border-cyan-500/20 max-h-64 overflow-y-auto">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 cursor-pointer border-b border-white/5 transition-colors"
            >
              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <Package size={14} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{product.name}</p>
                <p className="text-xs text-slate-400">Stock: {product.stock || 0} {product.baseUnit || 'pcs'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-cyan-400">
                  {(product.packageUnits?.[0]?.prices?.retail || 0).toLocaleString()} Ks
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// CartItem Component
// ============================================
const CartItem = ({ item, onUpdateQuantity, onRemoveItem, onUpdateDiscount }) => {
  const [discount, setDiscount] = useState(item.itemDiscount || 0);

  const handleDiscountChange = (value) => {
    const amt = Number(value) || 0;
    setDiscount(amt);
    onUpdateDiscount(item.id, amt);
  };

  return (
    <div className="p-4 hover:bg-white/5 transition-colors border-b border-white/5">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-white">{item.name}</p>
          <p className="text-xs text-cyan-400">
            {fmt(item.unitPrice)} Ks × {item.quantity} {item.unitName}
          </p>
          <p className="text-[10px] text-slate-500">
            {item.priceType || 'retail'} | Base: {item.baseQuantity} {item.baseUnit}
          </p>
        </div>
        <button onClick={() => onRemoveItem(item.id)} className="text-rose-400 hover:text-rose-300">
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
            className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center hover:bg-cyan-600/20"
          >
            <Minus size={12} />
          </button>
          <span className="text-white w-8 text-center">{item.quantity}</span>
          <button 
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center hover:bg-cyan-600/20"
          >
            <Plus size={12} />
          </button>
        </div>
        
        <div className="text-right">
          <p className="font-bold text-white">{fmt(item.subtotal)} Ks</p>
          {item.itemDiscount > 0 && (
            <p className="text-[10px] text-amber-400">Disc: -{fmt(item.itemDiscount)}</p>
          )}
        </div>
      </div>
      
      <div className="mt-2 flex justify-end">
        <input
          type="number"
          placeholder="Item discount"
          value={discount}
          onChange={(e) => handleDiscountChange(e.target.value)}
          className="w-24 bg-black/40 border border-amber-500/20 rounded-lg px-2 py-1 text-xs text-amber-400 focus:outline-none"
        />
      </div>
    </div>
  );
};

// ============================================
// CartSection Component
// ============================================
const CartSection = ({ cart, onUpdateQuantity, onRemoveItem, onUpdateDiscount }) => {
  if (cart.length === 0) {
    return (
      <div className="bg-[#0f172a] rounded-2xl p-8 text-center border border-cyan-500/20">
        <ShoppingCart size={40} className="mx-auto text-slate-500 mb-3" />
        <p className="text-slate-400">Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 overflow-hidden">
      <div className="p-4 border-b border-cyan-500/20 bg-cyan-600/5">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ShoppingCart size={16} className="text-cyan-400" /> 
          Shopping Cart ({cart.length} items)
        </h3>
      </div>
      
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {cart.map(item => (
          <CartItem
            key={item.id}
            item={item}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveItem={onRemoveItem}
            onUpdateDiscount={onUpdateDiscount}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================
// SummarySection Component
// ============================================
const SummarySection = ({ totals }) => {
  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 mb-4">
      <h3 className="font-bold text-white mb-3">Order Summary</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Subtotal</span>
          <span className="text-white">{fmt(totals.subtotal)} Ks</span>
        </div>
        
        {totals.itemDiscounts > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Item Discounts</span>
            <span>-{fmt(totals.itemDiscounts)} Ks</span>
          </div>
        )}
        
        {totals.globalDiscount > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Global Discount</span>
            <span>-{fmt(totals.globalDiscount)} Ks</span>
          </div>
        )}
        
        <div className="border-t border-cyan-500/20 pt-2 mt-2">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-cyan-400">TOTAL</span>
            <span className="text-white">{fmt(totals.total)} Ks</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PaymentSection Component
// ============================================
const PaymentSection = ({ 
  total, 
  paymentMethod, 
  setPaymentMethod, 
  paidAmount, 
  setPaidAmount, 
  onSubmit, 
  isLoading 
}) => {
  const methods = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];

  return (
    <div className="bg-[#0f172a] rounded-2xl p-4 border border-cyan-500/20">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2">
        <CreditCard size={16} className="text-cyan-400" /> Payment
      </h3>
      
      <div className="grid grid-cols-5 gap-1 mb-4">
        {methods.map(m => (
          <button
            key={m}
            onClick={() => {
              setPaymentMethod(m);
              if (m === 'Credit') setPaidAmount('0');
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              paymentMethod === m
                ? 'bg-cyan-600 text-white'
                : 'bg-black/40 text-slate-400 border border-white/5'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      
      <div className="relative mb-4">
        <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-400" />
        <input
          type="number"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          placeholder={paymentMethod === 'Credit' ? '0 (Credit Sale)' : `Enter amount (Total: ${fmt(total)} Ks)`}
          readOnly={paymentMethod === 'Credit'}
          className="w-full bg-black/40 border border-emerald-500/20 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
        />
      </div>
      
      <button
        onClick={onSubmit}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-500 hover:to-blue-500 transition-all"
      >
        {isLoading ? (
          <><Loader2 size={18} className="animate-spin" /> Processing...</>
        ) : (
          <><ShoppingCart size={18} /> Complete {paymentMethod === 'Credit' ? 'Credit' : ''} Sale</>
        )}
      </button>
    </div>
  );
};

// ============================================
// Main EntryPage Component
// ============================================
export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  // State
  const [loading, setLoading] = useState(false);
  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [personName, setPersonName] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState({ amount: 0, type: 'flat' });
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  
  // Product selection state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState('retail');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [stockWarning, setStockWarning] = useState('');

  // ============================================
  // Cart Functions
  // ============================================
  const getCartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const itemDiscounts = cart.reduce((sum, item) => sum + (item.itemDiscount || 0), 0);
    const globalDisc = globalDiscount.type === '%' 
      ? (subtotal - itemDiscounts) * (globalDiscount.amount / 100) 
      : globalDiscount.amount;
    const total = Math.max(0, subtotal - itemDiscounts - globalDisc);
    
    return { subtotal, itemDiscounts, globalDiscount: globalDisc, total };
  }, [cart, globalDiscount]);

  const addToCart = useCallback(() => {
    if (!selectedProduct || !selectedUnit || !unitPrice || !quantity) {
      alert('Please select product, unit, price and quantity');
      return;
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);
    const baseQty = calculateBaseQuantity(qty, selectedUnit.factor || 1);

    // Stock validation for sales
    if (entryTab === 'Sale' && !validateStock(selectedProduct, baseQty)) {
      setStockWarning(`Stock insufficient! Available: ${selectedProduct.stock} ${selectedProduct.baseUnit}`);
      return;
    }

    const subtotal = price * qty;
    
    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === selectedProduct.id && 
        item.unitName === selectedUnit.name &&
        item.priceType === selectedPriceType
      );
      
      if (existingIndex !== -1) {
        const newCart = [...prev];
        const existing = newCart[existingIndex];
        newCart[existingIndex] = {
          ...existing,
          quantity: existing.quantity + qty,
          baseQuantity: existing.baseQuantity + baseQty,
          subtotal: existing.subtotal + subtotal
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
        costPrice: selectedUnit.costPrice || 0,
        quantity: qty,
        baseQuantity: baseQty,
        subtotal,
        itemDiscount: 0
      }];
    });

    // Reset selection
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
  }, []);

  const updateItemDiscount = useCallback((id, discountAmount) => {
    setCart(prev => prev.map(item =>
      item.id === id
        ? { 
            ...item, 
            itemDiscount: discountAmount, 
            subtotal: (item.unitPrice * item.quantity) - discountAmount 
          }
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

  // ============================================
  // Product Selection Handler
  // ============================================
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

  // ============================================
  // Barcode Handler
  // ============================================
  const handleBarcodeScan = useCallback((barcode) => {
    if (!barcode || !products.length) return;
    
    for (const product of products) {
      // Check main product barcode
      if (product.barcode === barcode) {
        handleSelectProduct(product);
        return;
      }
      // Check units barcodes
      if (product.packageUnits) {
        for (const unit of product.packageUnits) {
          if (unit.barcodes && Object.values(unit.barcodes).includes(barcode)) {
            handleSelectProduct(product);
            setSelectedUnit(unit);
            if (entryTab === 'Sale') {
              setUnitPrice(String(unit.prices?.retail || 0));
            } else {
              setUnitPrice(String(unit.costPrice || 0));
            }
            return;
          }
        }
      }
    }
    alert('Product not found with this barcode');
  }, [products, handleSelectProduct, entryTab]);

  // ============================================
  // Submit Transaction
  // ============================================
  const submitTransaction = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    // Stock validation for sales
    if (entryTab === 'Sale') {
      for (const item of cart) {
        if (item.productStock < item.baseQuantity) {
          alert(`Insufficient stock for ${item.name}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const recordRef = doc(collection(db, 'pos_records'));
      
      const total = getCartTotals.total;
      const paid = paymentMethod === 'Credit' ? 0 : (Number(paidAmount) || total);
      const debt = Math.max(0, total - paid);
      
      const record = {
        type: entryTab,
        tenantId,
        personName: personName || 'Walk-in Customer',
        date: entryDate,
        createdAt: serverTimestamp(),
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitName: item.unitName,
          unitFactor: item.unitFactor,
          priceType: item.priceType,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          subtotal: item.subtotal,
          itemDiscount: item.itemDiscount,
          baseQuantity: item.baseQuantity
        })),
        subtotal: getCartTotals.subtotal,
        itemDiscounts: getCartTotals.itemDiscounts,
        globalDiscount: getCartTotals.globalDiscount,
        total,
        paymentMethod,
        paidAmount: paid,
        remainingDebt: debt,
        invoiceNo: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };
      
      batch.set(recordRef, record);
      
      // Update stock
      for (const item of cart) {
        const productRef = doc(db, 'pos_products', item.productId);
        const stockChange = entryTab === 'Sale' ? -item.baseQuantity : item.baseQuantity;
        batch.update(productRef, {
          stock: (item.productStock || 0) + stockChange
        });
      }
      
      await batch.commit();
      setShowReceipt({ ...record, id: recordRef.id });
      clearCart();
      
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Receipt Print Handler
  // ============================================
  const handlePrintReceipt = (record) => {
    const shopName = profile?.shopName || 'QuickPOS';
    const shopPhone = profile?.phone || '09-123456789';
    const shopAddress = profile?.address || 'No.123, Yangon';
    
    const items = record.items || [];
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 13px; width: 360px; margin: 20px auto; padding: 20px; border: 2px dashed #000; background: #fff; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
          .shop-name { font-size: 22px; font-weight: bold; }
          .shop-info { font-size: 11px; color: #555; margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
          td { padding: 5px 0; }
          td:last-child { text-align: right; }
          .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 10px; margin-top: 8px; text-align: right; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #555; border-top: 1px dashed #ccc; padding-top: 10px; }
          .debt-info { background: #f0f0f0; padding: 8px; margin-top: 10px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${shopName}</div>
          <div class="shop-info">📞 ${shopPhone}</div>
          <div class="shop-info">📍 ${shopAddress}</div>
          <div class="shop-info">📅 ${record.date}</div>
          <div class="shop-info">🧾 ${record.invoiceNo}</div>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}${item.itemDiscount ? `<br><small style="color:#888;">Disc: -${fmt(item.itemDiscount)}</small>` : ''}</td>
                <td>${item.quantity}</td>
                <td>${item.unitName || '-'}</td>
                <td>${fmt(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${record.globalDiscount > 0 ? `<p style="text-align:right;">Global Disc: -${fmt(record.globalDiscount)} Ks</p>` : ''}
        <div class="total-row">TOTAL: ${fmt(record.total)} Ks</div>
        <p style="text-align:right;">Method: ${record.paymentMethod}</p>
        <p style="text-align:right;">Paid: ${fmt(record.paidAmount)} Ks</p>
        ${record.remainingDebt > 0 ? `<div class="debt-info">⚠️ Remaining Debt: ${fmt(record.remainingDebt)} Ks</div>` : ''}
        <div class="footer">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>Thank you for your purchase!</div>
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body>
      </html>
    `;
    
    const win = window.open();
    win.document.write(html);
    win.document.close();
  };

  // ============================================
  // Render
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060816] to-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 py-4 pb-32">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2">
            <ShoppingCart size={24} />
            POS ENTRY
          </h1>
          <div className="flex items-center gap-2 bg-black/40 border border-cyan-500/20 rounded-2xl px-3 py-1.5">
            <span className="text-xs text-slate-400">Date:</span>
            <input 
              type="date" 
              value={entryDate} 
              onChange={(e) => setEntryDate(e.target.value)} 
              className="bg-transparent text-xs text-white focus:outline-none"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Tabs */}
        <EntryTabs activeTab={entryTab} onTabChange={setEntryTab} />

        {/* Customer Section (only for Sale/Purchase) */}
        {entryTab !== 'Expense' && (
          <CustomerSection personName={personName} setPersonName={setPersonName} />
        )}

        {/* Barcode + Product Search */}
        {entryTab !== 'Expense' && (
          <>
            <BarcodeSection onScan={handleBarcodeScan} onOpenScanner={() => setShowScanner(true)} />
            <div className="mb-6">
              <ProductDropdown products={products} onSelectProduct={handleSelectProduct} />
            </div>
          </>
        )}

        {/* Stock Warning */}
        {stockWarning && (
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 mb-4 flex items-center gap-2 text-rose-400 text-sm">
            <AlertTriangle size={16} />
            {stockWarning}
          </div>
        )}

        {/* Selected Product Details */}
        {selectedProduct && selectedUnit && (
          <div className="bg-[#0f172a] rounded-2xl p-4 mb-6 border border-cyan-500/20">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-400">
                  Stock: {selectedProduct.stock} {selectedProduct.baseUnit}
                </p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Unit Selector */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Unit</label>
                <select 
                  value={selectedUnit.name}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {selectedProduct.packageUnits?.map(unit => (
                    <option key={unit.name} value={unit.name}>
                      {unit.name} (1 = {unit.factor} {selectedProduct.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Type (for sales) */}
              {entryTab === 'Sale' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Price Type</label>
                  <select 
                    value={selectedPriceType}
                    onChange={(e) => handlePriceTypeChange(e.target.value)}
                    className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesaleA">Wholesale A</option>
                    <option value="wholesaleB">Wholesale B</option>
                    <option value="wholesaleC">Wholesale C</option>
                  </select>
                </div>
              )}

              {/* Price */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Price (Ks)</label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>

              {/* Quantity & Add Button */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Quantity</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={addToCart}
                    className="px-4 bg-cyan-600 rounded-lg text-white font-bold hover:bg-cyan-500 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CartSection 
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onUpdateDiscount={updateItemDiscount}
            />
          </div>
          
          <div className="lg:col-span-1">
            {cart.length > 0 && (
              <>
                <SummarySection totals={getCartTotals} />
                <PaymentSection
                  total={getCartTotals.total}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paidAmount={paidAmount}
                  setPaidAmount={setPaidAmount}
                  onSubmit={submitTransaction}
                  isLoading={loading}
                />
              </>
            )}
          </div>
        </div>

        {/* Empty State */}
        {cart.length === 0 && !selectedProduct && entryTab !== 'Expense' && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart size={40} className="text-cyan-400" />
            </div>
            <h3 className="text-white font-bold mb-2">Cart is Empty</h3>
            <p className="text-slate-400 text-sm">Search for a product or scan a barcode to start</p>
          </div>
        )}

        {/* Expense Tab */}
        {entryTab === 'Expense' && (
          <div className="bg-[#0f172a] rounded-2xl p-6 border border-rose-500/20 max-w-md mx-auto">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-400" />
              Record Expense
            </h3>
            <input
              type="text"
              placeholder="Expense title"
              className="w-full bg-black/40 border border-rose-500/20 rounded-lg px-4 py-3 text-white mb-3"
            />
            <input
              type="number"
              placeholder="Amount"
              className="w-full bg-black/40 border border-rose-500/20 rounded-lg px-4 py-3 text-white mb-4"
            />
            <button className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 rounded-xl text-white font-bold">
              Save Expense
            </button>
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-cyan-500/20 rounded-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-cyan-500/20">
              <h2 className="font-bold text-white">Scan Barcode</h2>
              <button onClick={() => setShowScanner(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 text-center">
              <p className="text-slate-400 text-sm mb-4">Camera scanner would open here</p>
              <p className="text-xs text-cyan-400">For demo, please type barcode in the field</p>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="text-center border-b border-dashed pb-4 mb-4">
              <h2 className="text-xl font-black">{profile?.shopName || 'QuickPOS'}</h2>
              <p className="text-xs text-gray-500">{profile?.phone || '09-123456789'}</p>
              <p className="text-xs text-gray-500 mt-1">{showReceipt.date}</p>
              <p className="text-xs text-gray-500">{showReceipt.invoiceNo}</p>
            </div>
            
            <div className="space-y-2 mb-4">
              {showReceipt.items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.name} × {item.quantity} ({item.unitName})</span>
                  <span>{fmt(item.subtotal)} Ks</span>
                </div>
              ))}
            </div>
            
            {showReceipt.globalDiscount > 0 && (
              <p className="text-right text-sm text-amber-600">Disc: -{fmt(showReceipt.globalDiscount)} Ks</p>
            )}
            
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-xl font-black">
                <span>TOTAL</span>
                <span>{fmt(showReceipt.total)} Ks</span>
              </div>
            </div>
            
            <p className="text-sm text-right mt-1">Method: {showReceipt.paymentMethod}</p>
            <p className="text-sm text-right">Paid: {fmt(showReceipt.paidAmount)} Ks</p>
            
            {showReceipt.remainingDebt > 0 && (
              <p className="text-sm text-right text-red-600 font-bold">
                Remaining Debt: {fmt(showReceipt.remainingDebt)} Ks
              </p>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handlePrintReceipt(showReceipt)}
                className="flex-1 py-3 bg-cyan-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Print
              </button>
              <button
                onClick={() => setShowReceipt(null)}
                className="flex-1 py-3 bg-gray-200 text-black rounded-2xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
