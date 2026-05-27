import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Loader2, Save, Archive, Zap } from 'lucide-react';

// Custom Hooks
import { useCart } from '../hooks/useCart';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useProductSearch } from '../hooks/useProductSearch';
import { useHoldOrders } from '../hooks/useHoldOrders';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// Components
import EntryTabs from './EntryTabs';
import CustomerSection from './CustomerSection';
import BarcodeSection from './BarcodeSection';
import ProductDropdown from './ProductDropdown';
import CartSection from './CartSection';
import PaymentSection from './PaymentSection';
import SummarySection from './SummarySection';
import ReceiptModal from './ReceiptModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import HoldOrdersModal from './HoldOrdersModal';
import QuickActions from './QuickActions';

// Utils
import { validateStock, calculateBaseQuantity, formatCurrency } from '../utils/stockConverter';
import { generateReceiptHTML } from '../utils/receiptGenerator';

const LazyReceiptModal = lazy(() => import('./ReceiptModal'));

export default function EntryPage({ products = [], onProductUpdate }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopInfo = {
    name: profile?.shopName || 'QuickPOS',
    phone: profile?.phone || '09-123456789',
    address: profile?.address || 'No.123, Yangon'
  };

  // State
  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [personName, setPersonName] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', debtLimit: 0 });
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showScanner, setShowScanner] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expenseData, setExpenseData] = useState({ title: '', amount: '' });

  // Custom Hooks
  const { 
    cart, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    updateItemDiscount,
    updateItemUnit,
    updateItemPriceType,
    clearCart,
    getCartTotals,
    getCartSummary
  } = useCart();

  const { 
    searchTerm, 
    setSearchTerm, 
    selectedProduct, 
    setSelectedProduct,
    selectedUnit,
    setSelectedUnit,
    selectedPriceType,
    setSelectedPriceType,
    filteredProducts,
    categories,
    selectProduct,
    clearSelection
  } = useProductSearch(products);

  const { 
    handleBarcodeScan,
    isScanning 
  } = useBarcodeScanner(products, (product, unit) => {
    selectProduct(product, unit);
  });

  const {
    saveHoldOrder,
    loadHoldOrder,
    deleteHoldOrder,
    getHoldOrders
  } = useHoldOrders(tenantId);

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    onSave: () => submitTransaction(),
    onClear: clearCart,
    onSearch: () => document.getElementById('product-search')?.focus(),
    onBarcode: () => document.getElementById('barcode-input')?.focus(),
    onHold: () => saveCurrentOrderAsHold(),
    onNew: clearCart
  });

  // Calculate totals with memo
  const totals = useMemo(() => getCartTotals(cart), [cart, getCartTotals]);
  
  // Stock validation before add
  const validateAndAdd = useCallback((product, unit, priceType, quantity, price) => {
    const baseQty = calculateBaseQuantity(quantity, unit);
    if (!validateStock(product, baseQty, entryTab === 'Sale' ? 'sale' : 'purchase')) {
      alert(`Stock insufficient! Available: ${product.stock} ${product.baseUnit}`);
      return false;
    }
    addToCart(product, unit, priceType, quantity, price);
    clearSelection();
    return true;
  }, [addToCart, clearSelection, entryTab]);

  // Submit transaction
  const submitTransaction = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    // Validate stock for sales
    if (entryTab === 'Sale') {
      for (const item of cart) {
        const baseQty = item.baseQuantity;
        if (item.productStock < baseQty) {
          alert(`Insufficient stock for ${item.name}. Available: ${item.productStock} ${item.baseUnit}`);
          return;
        }
      }
    }

    // Validate customer debt limit
    if (paymentMethod === 'Credit' && totals.total > 0) {
      const customerTotalDebt = customerInfo.currentDebt || 0;
      const newDebt = customerTotalDebt + totals.total;
      if (customerInfo.debtLimit && newDebt > customerInfo.debtLimit) {
        alert(`Customer debt limit exceeded! Limit: ${formatCurrency(customerInfo.debtLimit)}`);
        return;
      }
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const recordRef = doc(collection(db, 'pos_records'));
      
      const record = {
        type: entryTab,
        tenantId,
        personName: personName || 'Walk-in',
        customerInfo,
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
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        globalDiscount: totals.globalDiscount,
        total: totals.total,
        paymentMethod,
        paidAmount: Number(paidAmount) || (paymentMethod === 'Credit' ? 0 : totals.total),
        remainingDebt: paymentMethod === 'Credit' ? totals.total : Math.max(0, totals.total - (Number(paidAmount) || 0)),
        invoiceNo: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };
      
      batch.set(recordRef, record);
      
      // Update stock
      for (const item of cart) {
        const productRef = doc(db, 'pos_products', item.productId);
        const stockChange = entryTab === 'Sale' ? -item.baseQuantity : item.baseQuantity;
        batch.update(productRef, {
          stock: increment(stockChange)
        });
      }
      
      await batch.commit();
      setReceiptData({ ...record, id: recordRef.id });
      clearCart();
      setPersonName('');
      setPaidAmount('');
      
      // Play success sound
      playBeep('success');
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed: ' + error.message);
      playBeep('error');
    } finally {
      setLoading(false);
    }
  };

  // Save current order as hold
  const saveCurrentOrderAsHold = async () => {
    if (cart.length === 0) return;
    await saveHoldOrder({
      cart,
      personName,
      customerInfo,
      totals,
      date: entryDate,
      createdAt: new Date().toISOString()
    });
    clearCart();
    setPersonName('');
    alert('Order saved to Holds');
  };

  const playBeep = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type === 'success' ? 'sine' : 'square';
      osc.frequency.value = type === 'success' ? 900 : 180;
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-white">Processing transaction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060816] to-[#0a0f1a]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#060816]/95 backdrop-blur-lg border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              POS ENTRY
            </h1>
            <QuickActions 
              onHold={saveCurrentOrderAsHold}
              onLoad={() => setShowHoldModal(true)}
              onClear={clearCart}
              onPrint={() => window.print()}
              disabled={cart.length === 0}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 pb-32">
        {/* Tabs */}
        <EntryTabs activeTab={entryTab} onTabChange={setEntryTab} />

        {/* Customer Section */}
        <CustomerSection 
          personName={personName}
          setPersonName={setPersonName}
          customerInfo={customerInfo}
          setCustomerInfo={setCustomerInfo}
        />

        {/* Barcode + Search Row */}
        <div className="flex gap-3 mb-4">
          <BarcodeSection 
            onScan={handleBarcodeScan}
            onOpenScanner={() => setShowScanner(true)}
          />
          
          <ProductDropdown
            products={filteredProducts}
            categories={categories}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedProduct={selectedProduct}
            onSelectProduct={(product) => selectProduct(product)}
            isLoading={false}
          />
        </div>

        {/* Unit & Price Selection (when product selected) */}
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f172a] rounded-2xl p-4 mb-4 border border-cyan-500/20"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-400">
                  Stock: {selectedProduct.stock} {selectedProduct.baseUnit}
                </p>
              </div>
              <button onClick={clearSelection} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Unit Selector */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Unit</label>
                <select 
                  value={selectedUnit?.name || ''}
                  onChange={(e) => {
                    const unit = selectedProduct.packageUnits?.find(u => u.name === e.target.value);
                    setSelectedUnit(unit);
                  }}
                  className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {selectedProduct.packageUnits?.map(unit => (
                    <option key={unit.name} value={unit.name}>
                      {unit.name} (1 {unit.name} = {unit.factor} {selectedProduct.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Type Selector (for sales) */}
              {entryTab === 'Sale' && selectedUnit && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Price Type</label>
                  <select 
                    value={selectedPriceType}
                    onChange={(e) => {
                      setSelectedPriceType(e.target.value);
                      const price = selectedUnit.prices?.[e.target.value] || 0;
                      setUnitPrice(price);
                    }}
                    className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesaleA">Wholesale A</option>
                    <option value="wholesaleB">Wholesale B</option>
                    <option value="wholesaleC">Wholesale C</option>
                  </select>
                </div>
              )}

              {/* Price Input */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Price (Ks)</label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>

              {/* Quantity Input */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Quantity</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm"
                    min="1"
                  />
                  <button
                    onClick={() => validateAndAdd(selectedProduct, selectedUnit, selectedPriceType, Number(quantity), Number(unitPrice))}
                    className="px-4 bg-cyan-600 rounded-lg text-white font-bold hover:bg-cyan-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Cart Section */}
        {cart.length > 0 && (
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
              />
            </div>
            
            <div className="lg:col-span-1">
              {/* Discount Section */}
              <DiscountSection
                subtotal={totals.subtotal}
                itemDiscounts={totals.itemDiscounts}
                globalDiscount={totals.globalDiscount}
                onGlobalDiscountChange={(amt, type) => setGlobalDiscount({ amount: amt, type })}
              />
              
              {/* Summary Section */}
              <SummarySection totals={totals} />
              
              {/* Payment Section */}
              <PaymentSection
                total={totals.total}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paidAmount={paidAmount}
                setPaidAmount={setPaidAmount}
                onSubmit={submitTransaction}
                isLoading={loading}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {cart.length === 0 && !selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="w-12 h-12 text-cyan-400" />
            </div>
            <h3 className="text-white font-bold mb-2">Cart is Empty</h3>
            <p className="text-slate-400 text-sm">
              Search for a product or scan a barcode to start
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <button 
                onClick={() => document.getElementById('product-search')?.focus()}
                className="px-6 py-2 bg-cyan-600 rounded-xl text-white font-bold"
              >
                Search Products
              </button>
              <button 
                onClick={() => setShowScanner(true)}
                className="px-6 py-2 bg-blue-600 rounded-xl text-white font-bold"
              >
                Scan Barcode
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showScanner && (
          <BarcodeScannerModal
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
          />
        )}
        
        {showHoldModal && (
          <HoldOrdersModal
            tenantId={tenantId}
            onLoadOrder={loadHoldOrder}
            onClose={() => setShowHoldModal(false)}
          />
        )}
        
        {receiptData && (
          <LazyReceiptModal
            data={receiptData}
            shopInfo={shopInfo}
            onPrint={() => {
              const html = generateReceiptHTML(receiptData, shopInfo);
              const win = window.open();
              win.document.write(html);
              win.document.close();
              win.print();
            }}
            onClose={() => setReceiptData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper for Firestore increment
function increment(amount) {
  return { _increment: { operands: [{ _numberValue: amount }] } };
}
