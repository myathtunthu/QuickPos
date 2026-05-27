import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FixedSizeList as List } from 'react-window';
import { 
  ShoppingCart, Loader2, Save, Archive, Trash2, Printer, 
  User, ScanBarcode, Search, X, Package, Plus, Minus,
  Wallet, CreditCard, AlertTriangle, Clock, TrendingUp,
  Zap, Edit2, ChevronLeft, ChevronRight, QrCode
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
// Keyboard Shortcuts Hook
// ============================================
function useKeyboardShortcuts(handlers) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F1 = Search focus
      if (e.key === 'F1') {
        e.preventDefault();
        handlers.onSearch?.();
      }
      // F2 = Barcode focus
      if (e.key === 'F2') {
        e.preventDefault();
        handlers.onBarcode?.();
      }
      // F3 = Hold order
      if (e.key === 'F3') {
        e.preventDefault();
        handlers.onHold?.();
      }
      // F4 = New/Clear cart
      if (e.key === 'F4') {
        e.preventDefault();
        handlers.onClear?.();
      }
      // F5 = Load hold orders
      if (e.key === 'F5') {
        e.preventDefault();
        handlers.onLoadHolds?.();
      }
      // F6 = Print
      if (e.key === 'F6') {
        e.preventDefault();
        handlers.onPrint?.();
      }
      // Ctrl/Cmd + S = Save/Checkout
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handlers.onSave?.();
      }
      // Escape = Clear selection
      if (e.key === 'Escape') {
        handlers.onEscape?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

// ============================================
// EntryTabs Component
// ============================================
const EntryTabs = React.memo(({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'Sale', label: 'Sale', color: 'cyan' },
    { id: 'Purchase', label: 'Purchase', color: 'amber' },
    { id: 'Expense', label: 'Expense', color: 'rose' }
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {tabs.map(tab => (
        <motion.button
          key={tab.id}
          whileTap={{ scale: 0.97 }}
          onClick={() => onTabChange(tab.id)}
          className={`py-3 rounded-xl font-black text-sm transition-all ${
            activeTab === tab.id
              ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-500/20`
              : 'bg-[#0f172a] text-slate-400 border border-white/5'
          }`}
        >
          {tab.label}
        </motion.button>
      ))}
    </div>
  );
});

// ============================================
// CustomerSection Component with Debt Limit
// ============================================
const CustomerSection = React.memo(({ personName, setPersonName, customerDebt, setCustomerDebt, debtLimit, setDebtLimit }) => {
  return (
    <div className="bg-[#0f172a] rounded-xl p-4 mb-4 border border-cyan-500/20">
      <h3 className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-2">
        <User size={12} /> CUSTOMER INFO
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder="Customer name"
          className="bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
        />
        <input
          type="number"
          value={customerDebt}
          onChange={(e) => setCustomerDebt(Number(e.target.value) || 0)}
          placeholder="Current debt"
          className="bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
        />
        <input
          type="number"
          value={debtLimit}
          onChange={(e) => setDebtLimit(Number(e.target.value) || 0)}
          placeholder="Debt limit"
          className="bg-black/40 border border-rose-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
        />
      </div>
    </div>
  );
});

// ============================================
// BarcodeSection Component
// ============================================
const BarcodeSection = React.memo(({ onScan, onOpenScanner }) => {
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
          id="barcode-input"
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scan or type barcode... (F2)"
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
});

// ============================================
// Virtualized Product Dropdown Component
// ============================================
const ProductRow = ({ data, index, style }) => {
  const product = data.items[index];
  const onSelect = data.onSelect;
  
  return (
    <div 
      style={style}
      onClick={() => onSelect(product)}
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
  );
};

const ProductDropdown = React.memo(({ products, onSelectProduct, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(0);
  const itemsPerPage = 20;

  const categories = useMemo(() => 
    ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  , [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.barcode?.includes(term)
      );
    }
    return result;
  }, [products, debouncedSearch, selectedCategory]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, (page + 1) * itemsPerPage);
  }, [filteredProducts, page]);

  const hasMore = paginatedProducts.length < filteredProducts.length;

  const loadMore = () => {
    if (hasMore) setPage(p => p + 1);
  };

  const handleSelect = (product) => {
    onSelectProduct(product);
    setSearchTerm('');
    setPage(0);
  };

  return (
    <div className="relative flex-1 mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id="product-search"
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0);
          }}
          placeholder="Search products... (F1)"
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
            onClick={() => {
              setSelectedCategory(cat);
              setPage(0);
            }}
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
      
      {isLoading ? (
        <div className="mt-3 bg-[#0f172a] rounded-xl p-8 text-center">
          <Loader2 className="animate-spin mx-auto text-cyan-400" />
        </div>
      ) : paginatedProducts.length > 0 ? (
        <div className="mt-3 bg-[#0f172a] rounded-xl border border-cyan-500/20 overflow-hidden">
          <List
            height={300}
            itemCount={paginatedProducts.length}
            itemSize={70}
            width="100%"
            itemData={{ items: paginatedProducts, onSelect: handleSelect }}
          >
            {ProductRow}
          </List>
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full p-2 text-xs text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            >
              Load more...
            </button>
          )}
        </div>
      ) : debouncedSearch && (
        <div className="mt-3 bg-[#0f172a] rounded-xl p-8 text-center border border-cyan-500/20">
          <p className="text-slate-400 text-sm">No products found for "{debouncedSearch}"</p>
        </div>
      )}
    </div>
  );
});

// ============================================
// CartItem Component with Edit and Swipe
// ============================================
const CartItem = React.memo(({ item, onUpdateQuantity, onRemoveItem, onUpdateDiscount, onUpdateUnit, onUpdatePriceType, products, entryTab }) => {
  const [touchStart, setTouchStart] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const product = products.find(p => p.id === item.productId);
  
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };
  
  const handleTouchMove = (e) => {
    if (!touchStart) return;
    const delta = touchStart - e.touches[0].clientX;
    if (delta > 0) setSwipeOffset(Math.min(delta, 80));
  };
  
  const handleTouchEnd = () => {
    if (swipeOffset > 40) {
      onRemoveItem(item.id);
    }
    setSwipeOffset(0);
    setTouchStart(null);
  };

  return (
    <div 
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="absolute right-0 top-0 bottom-0 w-20 bg-rose-600 flex items-center justify-center"
        style={{ right: -80 + swipeOffset }}
      >
        <Trash2 size={20} className="text-white" />
      </div>
      
      <div 
        className="p-4 hover:bg-white/5 transition-colors border-b border-white/5 bg-[#0f172a]"
        style={{ transform: `translateX(-${swipeOffset}px)` }}
      >
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
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(!showEdit)} className="text-slate-400 hover:text-cyan-400">
              <Edit2 size={14} />
            </button>
            <button onClick={() => onRemoveItem(item.id)} className="text-rose-400 hover:text-rose-300">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        {/* Edit Section */}
        {showEdit && product && (
          <div className="mt-3 p-3 bg-black/40 rounded-lg grid grid-cols-2 gap-2">
            <select
              value={item.unitName}
              onChange={(e) => onUpdateUnit(item.id, e.target.value)}
              className="bg-black/60 border border-cyan-500/20 rounded px-2 py-1 text-xs text-white"
            >
              {product.packageUnits?.map(unit => (
                <option key={unit.name} value={unit.name}>{unit.name}</option>
              ))}
            </select>
            {entryTab === 'Sale' && (
              <select
                value={item.priceType}
                onChange={(e) => onUpdatePriceType(item.id, e.target.value)}
                className="bg-black/60 border border-cyan-500/20 rounded px-2 py-1 text-xs text-white"
              >
                <option value="retail">Retail</option>
                <option value="wholesaleA">Wholesale A</option>
                <option value="wholesaleB">Wholesale B</option>
                <option value="wholesaleC">Wholesale C</option>
              </select>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onUpdateQuantity(item.id, Math.max(0.25, item.quantity - 0.25))}
              className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center hover:bg-cyan-600/20"
            >
              <Minus size={12} />
            </button>
            <span className="text-white w-12 text-center">{item.quantity}</span>
            <button 
              onClick={() => onUpdateQuantity(item.id, item.quantity + 0.25)}
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
            value={item.itemDiscount || ''}
            onChange={(e) => onUpdateDiscount(item.id, Number(e.target.value) || 0)}
            className="w-24 bg-black/40 border border-amber-500/20 rounded-lg px-2 py-1 text-xs text-amber-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
});

// ============================================
// CartSection Component
// ============================================
const CartSection = React.memo(({ cart, onUpdateQuantity, onRemoveItem, onUpdateDiscount, onUpdateUnit, onUpdatePriceType, products, entryTab }) => {
  if (cart.length === 0) {
    return (
      <div className="bg-[#0f172a] rounded-2xl p-8 text-center border border-cyan-500/20">
        <ShoppingCart size={40} className="mx-auto text-slate-500 mb-3" />
        <p className="text-slate-400">Cart is empty</p>
        <p className="text-xs text-slate-500 mt-2">F4 to clear | F3 to hold</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 overflow-hidden">
      <div className="p-4 border-b border-cyan-500/20 bg-cyan-600/5 sticky top-0 z-10">
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
            onUpdateUnit={onUpdateUnit}
            onUpdatePriceType={onUpdatePriceType}
            products={products}
            entryTab={entryTab}
          />
        ))}
      </div>
    </div>
  );
});

// ============================================
// SummarySection Component
// ============================================
const SummarySection = React.memo(({ totals }) => {
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
});

// ============================================
// PaymentSection Component
// ============================================
const PaymentSection = React.memo(({ 
  total, 
  paymentMethod, 
  setPaymentMethod, 
  paidAmount, 
  setPaidAmount, 
  onSubmit, 
  isLoading,
  customerDebt,
  debtLimit
}) => {
  const methods = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];
  const newTotalDebt = customerDebt + (paymentMethod === 'Credit' ? total : 0);
  const isOverLimit = debtLimit > 0 && newTotalDebt > debtLimit;

  return (
    <div className="bg-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 sticky top-4">
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
      
      {paymentMethod === 'Credit' && (
        <div className={`mb-4 p-3 rounded-lg ${isOverLimit ? 'bg-rose-950/30 border border-rose-500/30' : 'bg-amber-950/30 border border-amber-500/30'}`}>
          <p className="text-xs flex justify-between">
            <span>Current Debt:</span>
            <span>{fmt(customerDebt)} Ks</span>
          </p>
          <p className="text-xs flex justify-between mt-1">
            <span>New Debt:</span>
            <span className={isOverLimit ? 'text-rose-400 font-bold' : 'text-amber-400'}>{fmt(newTotalDebt)} Ks</span>
          </p>
          {debtLimit > 0 && (
            <p className="text-xs flex justify-between mt-1">
              <span>Debt Limit:</span>
              <span>{fmt(debtLimit)} Ks</span>
            </p>
          )}
          {isOverLimit && (
            <p className="text-rose-400 text-xs mt-2 flex items-center gap-1">
              <AlertTriangle size={12} /> Debt limit exceeded!
            </p>
          )}
        </div>
      )}
      
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
        disabled={isLoading || (paymentMethod === 'Credit' && isOverLimit)}
        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-500 hover:to-blue-500 transition-all"
      >
        {isLoading ? (
          <><Loader2 size={18} className="animate-spin" /> Processing...</>
        ) : (
          <><ShoppingCart size={18} /> Complete {paymentMethod === 'Credit' ? 'Credit' : ''} Sale</>
        )}
      </button>
      
      <div className="text-center mt-3 text-[10px] text-slate-500">
        F6: Print | Ctrl+S: Checkout
      </div>
    </div>
  );
});

// ============================================
// AI Insights Component
// ============================================
const AIInsights = React.memo(({ products, cart, totalSales }) => {
  const [fastMoving, setFastMoving] = useState([]);
  const [lowStockPredictions, setLowStockPredictions] = useState([]);
  const [recommendedPrice, setRecommendedPrice] = useState(null);

  useEffect(() => {
    // Fast moving products (from cart)
    const cartProductIds = cart.map(item => item.productId);
    const fastMovingProducts = products.filter(p => cartProductIds.includes(p.id)).slice(0, 3);
    setFastMoving(fastMovingProducts);

    // Low stock prediction (stock < 20)
    const lowStock = products.filter(p => (p.stock || 0) < 20).slice(0, 3);
    setLowStockPredictions(lowStock);

    // Recommended price (for first product in cart)
    if (cart[0]) {
      const product = products.find(p => p.id === cart[0].productId);
      if (product) {
        const avgPrice = product.packageUnits?.[0]?.prices?.retail || 0;
        setRecommendedPrice(avgPrice);
      }
    }
  }, [products, cart]);

  if (fastMoving.length === 0 && lowStockPredictions.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-purple-900/20 to-[#0f172a] rounded-2xl p-4 border border-purple-500/20 mb-6">
      <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2">
        <Zap size={12} /> AI Insights
      </h3>
      <div className="space-y-2">
        {fastMoving.length > 0 && (
          <div className="p-2 bg-black/30 rounded-lg">
            <p className="text-[10px] text-slate-400">🔥 Fast Moving Alert</p>
            <p className="text-xs text-white">{fastMoving.map(p => p.name).join(', ')} are selling quickly!</p>
          </div>
        )}
        {lowStockPredictions.length > 0 && (
          <div className="p-2 bg-black/30 rounded-lg">
            <p className="text-[10px] text-slate-400">⚠️ Low Stock Prediction</p>
            <p className="text-xs text-white">{lowStockPredictions.map(p => p.name).join(', ')} will run out soon.</p>
          </div>
        )}
        {recommendedPrice && (
          <div className="p-2 bg-black/30 rounded-lg">
            <p className="text-[10px] text-slate-400">💰 Recommended Price</p>
            <p className="text-xs text-white">Suggested retail: {fmt(recommendedPrice)} Ks</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================
// Hold Orders Modal
// ============================================
const HoldOrdersModal = React.memo(({ onClose, onLoadOrder, tenantId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      if (!tenantId) return;
      try {
        const q = query(
          collection(db, 'held_orders'),
          where('tenantId', '==', tenantId),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error loading holds:", error);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [tenantId]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-cyan-500/20 rounded-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-cyan-500/20">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Archive size={18} className="text-cyan-400" /> Held Orders (F5)
          </h2>
          <button onClick={onClose} className="text-slate-400"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-slate-400">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-slate-400">No held orders</p>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="bg-black/40 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{order.personName || 'Guest'}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-cyan-400 mt-1">
                        Items: {order.cart?.length || 0} | Total: {fmt(order.total)} Ks
                      </p>
                    </div>
                    <button
                      onClick={() => onLoadOrder(order)}
                      className="px-3 py-1 bg-cyan-600 rounded-lg text-xs font-bold"
                    >
                      Load
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

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
  
  // Product selection state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState('retail');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');

  // Refs for keyboard shortcuts
  const searchInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

  // ============================================
  // Keyboard Shortcuts
  // ============================================
  useKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onBarcode: () => barcodeInputRef.current?.focus(),
    onHold: () => saveCurrentOrderAsHold(),
    onClear: clearCart,
    onLoadHolds: () => setShowHoldModal(true),
    onPrint: () => window.print(),
    onSave: () => submitTransaction(),
    onEscape: () => {
      setSelectedProduct(null);
      setSelectedUnit(null);
      setStockWarning('');
    }
  });

  // ============================================
  // Save Hold Order
  // ============================================
  const saveCurrentOrderAsHold = async () => {
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
        total: getCartTotals.total,
        createdAt: new Date().toISOString(),
        date: entryDate
      });
      clearCart();
      alert('Order saved to holds! (F5 to load)');
    } catch (error) {
      console.error("Error saving hold order:", error);
      alert('Failed to save hold order');
    }
  };

  // ============================================
  // Load Hold Order
  // ============================================
  const loadHoldOrder = (order) => {
    setCart(order.cart || []);
    setPersonName(order.personName || '');
    setCustomerDebt(order.customerDebt || 0);
    setShowHoldModal(false);
    alert('Order loaded from holds');
  };

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

    if (isNaN(qty) || qty <= 0) {
      alert('Invalid quantity');
      return;
    }

    if (isNaN(price) || price <= 0) {
      alert('Invalid price');
      return;
    }

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
    if (isNaN(discountAmount)) return;
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

  const updateItemUnit = useCallback((id, newUnitName) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    const product = products.find(p => p.id === item.productId);
    const newUnit = product?.packageUnits?.find(u => u.name === newUnitName);
    if (!newUnit) return;
    
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newBaseQty = i.quantity * (newUnit.factor || 1);
      const newPrice = entryTab === 'Sale' 
        ? (newUnit.prices?.[i.priceType] || i.unitPrice)
        : (newUnit.costPrice || i.unitPrice);
      return {
        ...i,
        unitName: newUnit.name,
        unitFactor: newUnit.factor || 1,
        unitPrice: newPrice,
        baseQuantity: newBaseQty,
        subtotal: (newPrice * i.quantity) - (i.itemDiscount || 0)
      };
    }));
  }, [cart, products, entryTab]);

  const updateItemPriceType = useCallback((id, newPriceType) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    const product = products.find(p => p.id === item.productId);
    const unit = product?.packageUnits?.find(u => u.name === item.unitName);
    if (!unit) return;
    
    const newPrice = unit.prices?.[newPriceType] || item.unitPrice;
    
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      return {
        ...i,
        priceType: newPriceType,
        unitPrice: newPrice,
        subtotal: (newPrice * i.quantity) - (i.itemDiscount || 0)
      };
    }));
  }, [cart, products]);

  const clearCart = useCallback(() => {
    setCart([]);
    setPersonName('');
    setPaidAmount('');
    setGlobalDiscount({ amount: 0, type: 'flat' });
    setSelectedProduct(null);
    setSelectedUnit(null);
    setCustomerDebt(0);
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

    // Debt limit validation
    if (paymentMethod === 'Credit') {
      const newTotalDebt = customerDebt + getCartTotals.total;
      if (debtLimit > 0 && newTotalDebt > debtLimit) {
        alert(`Debt limit exceeded! Limit: ${fmt(debtLimit)} Ks`);
        return;
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
        customerDebt: paymentMethod === 'Credit' ? customerDebt + debt : customerDebt,
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
        const product = products.find(p => p.id === item.productId);
        batch.update(productRef, {
          stock: (product?.stock || 0) + stockChange
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
  // Receipt Print Handler with QR Code
  // ============================================
  const handlePrintReceipt = (record) => {
    const shopName = profile?.shopName || 'QuickPOS';
    const shopPhone = profile?.phone || '09-123456789';
    const shopAddress = profile?.address || 'No.123, Yangon';
    const cashierName = profile?.name || 'Cashier';
    
    const items = record.items || [];
    const qrData = JSON.stringify({
      invoice: record.invoiceNo,
      total: record.total,
      date: record.date
    });
    
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
          .qr-code { text-align: center; margin: 10px 0; font-family: monospace; font-size: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
          td { padding: 5px 0; }
          td:last-child { text-align: right; }
          .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 10px; margin-top: 8px; text-align: right; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #555; border-top: 1px dashed #ccc; padding-top: 10px; }
          .debt-info { background: #f0f0f0; padding: 8px; margin-top: 10px; font-size: 12px; }
          .cashier { font-size: 10px; text-align: right; margin-top: 5px; }
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
        
        <div class="qr-code">
          <small>Scan for details</small><br>
          [${qrData.substring(0, 30)}...]
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
        
        <div class="cashier">Cashier: ${cashierName}</div>
        
        <div class="footer">
          ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>
          Thank you for your purchase!
        </div>
        
        <script>
          window.onload = () => { 
            window.print(); 
            setTimeout(() => window.close(), 500);
          }
        </script>
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
        
        {/* Header with Keyboard Shortcuts hint */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2">
            <ShoppingCart size={24} />
            POS ENTRY
          </h1>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex gap-1 text-[10px] text-slate-500 bg-black/40 px-3 py-1.5 rounded-full">
              <span>F1🔍</span>
              <span>F2📷</span>
              <span>F3💾</span>
              <span>F4🗑️</span>
              <span>F5📋</span>
              <span>Ctrl+S✓</span>
            </div>
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
        </div>

        {/* Tabs */}
        <EntryTabs activeTab={entryTab} onTabChange={setEntryTab} />

        {/* Customer Section with Debt Limit */}
        {entryTab !== 'Expense' && (
          <CustomerSection 
            personName={personName} 
            setPersonName={setPersonName}
            customerDebt={customerDebt}
            setCustomerDebt={setCustomerDebt}
            debtLimit={debtLimit}
            setDebtLimit={setDebtLimit}
          />
        )}

        {/* Barcode + Product Search */}
        {entryTab !== 'Expense' && (
          <>
            <BarcodeSection 
              onScan={handleBarcodeScan} 
              onOpenScanner={() => setShowScanner(true)}
            />
            <ProductDropdown 
              products={products} 
              onSelectProduct={handleSelectProduct}
              isLoading={false}
            />
          </>
        )}

        {/* Stock Warning */}
        {stockWarning && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 mb-4 flex items-center gap-2 text-rose-400 text-sm"
          >
            <AlertTriangle size={16} />
            {stockWarning}
          </motion.div>
        )}

        {/* AI Insights */}
        <AIInsights products={products} cart={cart} totalSales={getCartTotals.total} />

        {/* Selected Product Details */}
        {selectedProduct && selectedUnit && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0f172a] rounded-2xl p-4 mb-6 border border-cyan-500/20"
          >
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
                    min="0.25"
                    step="0.25"
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
          </motion.div>
        )}

        {/* Cart and Checkout Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CartSection 
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onUpdateDiscount={updateItemDiscount}
              onUpdateUnit={updateItemUnit}
              onUpdatePriceType={updateItemPriceType}
              products={products}
              entryTab={entryTab}
            />
          </div>
          
          <div className="lg:col-span-1">
            {cart.length > 0 && (
              <>
                <SummarySection totals={getCartTotals} />
                
                {/* Global Discount */}
                <div className="bg-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 mb-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 block mb-1">Global Discount</label>
                      <input
                        type="number"
                        value={globalDiscount.amount}
                        onChange={(e) => setGlobalDiscount({ ...globalDiscount, amount: Number(e.target.value) || 0 })}
                        className="w-full bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400 text-sm"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setGlobalDiscount({ ...globalDiscount, type: '%' })}
                        className={`px-3 py-2 rounded-lg text-xs font-bold ${globalDiscount.type === '%' ? 'bg-amber-600 text-white' : 'bg-black/40 text-slate-400'}`}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setGlobalDiscount({ ...globalDiscount, type: 'flat' })}
                        className={`px-3 py-2 rounded-lg text-xs font-bold ${globalDiscount.type === 'flat' ? 'bg-amber-600 text-white' : 'bg-black/40 text-slate-400'}`}
                      >
                        Ks
                      </button>
                    </div>
                  </div>
                </div>
                
                <PaymentSection
                  total={getCartTotals.total}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paidAmount={paidAmount}
                  setPaidAmount={setPaidAmount}
                  onSubmit={submitTransaction}
                  isLoading={loading}
                  customerDebt={customerDebt}
                  debtLimit={debtLimit}
                />
              </>
            )}
          </div>
        </div>

        {/* Empty State */}
        {cart.length === 0 && !selectedProduct && entryTab !== 'Expense' && (
          <div className="text-center py-16">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-4"
            >
              <ShoppingCart size={40} className="text-cyan-400" />
            </motion.div>
            <h3 className="text-white font-bold mb-2">Cart is Empty</h3>
            <p className="text-slate-400 text-sm">Search for a product or scan a barcode to start</p>
            <p className="text-xs text-slate-500 mt-2">Shortcuts: F1 Search | F2 Barcode | F3 Hold | F4 Clear</p>
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
      <AnimatePresence>
        {showScanner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-[#0f172a] border border-cyan-500/20 rounded-2xl overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-cyan-500/20">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <ScanBarcode size={18} className="text-cyan-400" /> Scan Barcode
                </h2>
                <button onClick={() => setShowScanner(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 text-center">
                <div className="w-48 h-48 mx-auto border-2 border-cyan-400 rounded-2xl flex items-center justify-center mb-4 bg-black/40">
                  <ScanBarcode size={48} className="text-cyan-400 animate-pulse" />
                </div>
                <p className="text-slate-400 text-sm mb-2">Position barcode in frame</p>
                <p className="text-xs text-cyan-400">Press ESC to close</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hold Orders Modal */}
      <AnimatePresence>
        {showHoldModal && (
          <HoldOrdersModal 
            onClose={() => setShowHoldModal(false)}
            onLoadOrder={loadHoldOrder}
            tenantId={tenantId}
          />
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
