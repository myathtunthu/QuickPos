import React, { useState, useMemo, useCallback } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import { Calendar, User, ShoppingCart, Loader2, X, Printer } from 'lucide-react';

// Components များကို လှမ်းခေါ်ခြင်း
import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';

export default function EntryPage({ products = [] }) {
  // --- Auth & Base Profile ---
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopName = profile?.shopName || 'QuickPOS';
  const shopPhone = profile?.phone || '09-123456789';
  const shopAddress = profile?.address || 'No.123, Yangon';

  // --- Basic States ---
  const todayISO = new Date().toISOString().split('T')[0];
  const [entryDate, setEntryDate] = useState(todayISO);
  const [entryTab, setEntryTab] = useState('Sale'); // 'Sale', 'Purchase', 'Expense'
  const [personName, setPersonName] = useState(''); // Customer or Supplier Name

  // --- Search & Filter States ---
  const [selCategory, setSelCategory] = useState('All');
  const [prodSearch, setProdSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const debouncedSearch = useDebounce(prodSearch, 300);

  // --- Payment & Checkout States ---
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });

  // --- Expense States ---
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');

  // --- Cart Hook (Logic အားလုံးကို ဤ hook တွင်တွက်သည်) ---
  const { 
    cart, 
    addToCart, 
    removeCartItem, 
    updateCartItemQty, 
    clearCart, 
    cartTotals, 
    globalDiscountAmt, 
    setGlobalDiscountAmt, 
    globalDiscountType, 
    setGlobalDiscountType 
  } = useCart(products, entryTab);

  // --- Data Memos ---
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

  // --- Action Handlers ---
  const handleSelectProduct = useCallback((product) => {
    // ပုံသေအားဖြင့် ပထမဆုံး Unit နှင့် Retail Price ကို ရွေးပေးမည်
    const defaultUnit = product.packageUnits?.[0] || { name: 'ခု', factor: 1, prices: { retail: 0 }};
    const response = addToCart(product, defaultUnit, 'retail', 1);
    
    if (response.success) {
      setProdSearch(''); // ရွေးပြီးပါက Search box ကိုရှင်းမည်
    } else {
      alert(response.message); // Stock မရှိပါက Alert ပြမည်
    }
  }, [addToCart]);

  // --- Firebase Submit Logic ---
  const submitExpense = async () => {
    if (!expenseTitle || !expenseAmt || !tenantId) return;
    setLoading(true);
    try {
      await writeBatch(db).set(doc(collection(db, 'pos_records')), { 
        type: 'Expense', 
        tenantId, 
        item: expenseTitle, 
        amount: Number(expenseAmt), 
        date: entryDate, 
        createdAt: serverTimestamp() 
      }).commit();
      setExpenseTitle(''); setExpenseAmt('');
      alert("Expense Saved!");
    } catch (err) { 
      console.error(err); 
      alert("Error saving expense");
    }
    setLoading(false);
  };

  const submitTransaction = async () => {
    if (cart.length === 0 || !tenantId) return;
    setLoading(true);
    
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      
      const total = cartTotals.total;
      const paid = paidAmount === '' ? total : Number(paidAmount || 0);
      const remainingDebt = Math.max(0, total - paid);

      // Record Document တည်ဆောက်ခြင်း
      const record = { 
        id: ref.id,
        type: entryTab, 
        tenantId, 
        personName: personName || 'Walk-in', 
        itemsDetail: cart.map(i => ({ 
          productId: i.productId,
          name: i.name, 
          quantity: i.quantity, 
          unitPrice: i.unitPrice, 
          itemDiscountAmt: i.itemDiscountAmt, 
          unitName: i.unitName, 
          factor: i.factor, 
          priceType: i.priceType,
          baseQuantity: i.baseQuantity
        })), 
        amount: total, 
        subtotal: cartTotals.subtotal, 
        itemDiscount: cartTotals.itemDiscounts, 
        globalDiscount: cartTotals.globalDisc, 
        paymentMethod, 
        paidAmount: paid, 
        remainingDebt, 
        date: entryDate, 
        createdAt: serverTimestamp() 
      };

      batch.set(ref, record);

      // Product Collection ထဲရှိ Stock Base ကို အတိုး/အလျော့ လုပ်ခြင်း
      cart.forEach(item => {
        const prodData = products.find(x => x.id === item.productId);
        if (prodData) {
          const currentStockBase = Number(prodData.stockBase) || 0;
          const newStockBase = entryTab === 'Sale' 
            ? Math.max(0, currentStockBase - item.baseQuantity) 
            : currentStockBase + item.baseQuantity;
            
          batch.update(doc(db, 'pos_products', item.productId), { 
            stockBase: newStockBase 
          });
        }
      });

      await batch.commit();
      setReceiptModal({ show: true, record }); // ဘောင်ချာပြမည်
      clearCart();
      setPersonName('');
      setPaidAmount('');
      setPaymentMethod('Cash');

    } catch (err) { 
      console.error(err); 
      alert("Error saving transaction!");
    }
    setLoading(false);
  };

  // --- Print Logic ---
  const doPrint = (record) => {
    // Print JS Logic (ယခင်က ရေးခဲ့သည့် html string print out အတိုင်း)
    const items = record.itemsDetail || [];
    const fmt = (n) => Number(n).toLocaleString();
    const w = window.open('', '_blank', 'width=400,height=650');
    
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
    <style>body{font-family:'Courier New',monospace;font-size:13px;width:360px;margin:10px auto;padding:15px;border:2px dashed #000;} .header{text-align:center;border-bottom:2px dashed #000;padding-bottom:12px;margin-bottom:12px;} .shop-name{font-size:20px;font-weight:bold;} table{width:100%;border-collapse:collapse;margin:10px 0;} th{text-align:left;border-bottom:1px solid #000;} td{padding:4px 0;} td:last-child{text-align:right;} .total-row{font-weight:bold;font-size:18px;border-top:2px solid #000;padding-top:10px;} .footer{text-align:center;margin-top:15px;font-size:11px;}</style></head><body>
    <div class="header"><div class="shop-name">${shopName}</div><div>📞 ${shopPhone}</div><div>📅 ${record.date}</div><div>🧾 ${record.id.slice(-8)}</div></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>
    ${items.map(i => `<tr><td>${i.name}<br><small>${i.unitName}</small></td><td>${i.quantity}</td><td>${fmt(i.unitPrice * i.quantity)}</td></tr>`).join('')}
    </tbody></table>
    <div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
    <div class="footer">Thank you for your purchase!</div>
    <script>window.onload=()=>{window.print();}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="p-3 sm:p-4 pb-28 text-white max-w-5xl mx-auto space-y-4 bg-[#080c14] min-h-screen">
      
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2">
          <ShoppingCart size={22}/> POS ENTRY
        </h1>
        <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 rounded-xl px-3 py-1.5 shadow-inner">
          <Calendar size={14} className="text-cyan-400"/>
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="bg-transparent text-xs font-bold text-cyan-300 outline-none w-[110px]" style={{colorScheme:'dark'}}/>
        </div>
      </div>

      {/* Entry Tabs */}
      <div className="grid grid-cols-3 gap-2 bg-[#0d1120] p-1.5 rounded-xl border border-white/5">
        {['Sale', 'Purchase', 'Expense'].map(tab => (
          <button 
            key={tab} 
            onClick={() => { setEntryTab(tab); clearCart(); }} 
            className={`py-2 rounded-lg font-black text-xs transition-all ${entryTab === tab ? 'bg-cyan-600 shadow-md shadow-cyan-900/40 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {entryTab === 'Expense' ? (
        // --- Expense View ---
        <div className="bg-[#0d1120] border border-amber-500/20 rounded-xl p-4 space-y-3">
          <h2 className="text-amber-400 font-bold text-sm mb-2">Record Expense</h2>
          <input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="Expense Title (e.g. မီတာခ)" className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
          <input type="number" value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)} placeholder="Amount (Ks)" className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
          <button onClick={submitExpense} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 font-black text-sm active:scale-95 transition-transform">{loading ? 'Saving...' : 'Save Expense'}</button>
        </div>
      ) : (
        // --- Sale / Purchase View ---
        <div className="space-y-4">
          
          {/* Customer / Supplier Input */}
          <div className="relative">
            <User className="absolute left-3 top-3 text-cyan-500" size={16}/>
            <input 
              value={personName} 
              onChange={e => setPersonName(e.target.value)} 
              placeholder={entryTab === 'Sale' ? "Customer Name (Optional)" : "Supplier Name"} 
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-cyan-400 transition-colors" 
            />
          </div>

          {/* Search, Filter & Scanner */}
          <ProductSearch 
            categories={categories}
            selCategory={selCategory}
            setSelCategory={setSelCategory}
            prodSearch={prodSearch}
            setProdSearch={setProdSearch}
            setShowScanner={setShowScanner}
          />

          {/* Product Grid / Dropdown Toggling */}
          <div className="relative z-10">
            {debouncedSearch.length > 0 ? (
              <ProductDropdown 
                products={filteredProducts} 
                onSelect={handleSelectProduct} 
                isOpen={true} 
              />
            ) : (
              <ProductGrid 
                products={filteredProducts} 
                onSelect={handleSelectProduct} 
              />
            )}
          </div>

          {/* Cart UI Container */}
          <div className="bg-[#0d1120] border border-cyan-500/20 rounded-xl p-2 sm:p-3 mt-4">
            <h2 className="text-xs font-bold text-slate-400 mb-2 pl-1 uppercase tracking-wider">Current Order</h2>
            
            <CartSection 
              cart={cart}
              products={products}
              onUpdateQty={updateCartItemQty}
              onUpdateUnit={(id, unitName) => {/* To Be Handled by Context/Hook */}}
              onUpdatePriceType={(id, pType) => {/* To Be Handled by Context/Hook */}}
              onUpdateDiscount={(id, amt) => {/* To Be Handled by Context/Hook */}}
              onRemove={removeCartItem}
            />

            {/* Totals Summary Array */}
            {cart.length > 0 && (
              <div className="mt-3 bg-black/50 border border-cyan-500/10 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span><span>{Number(cartTotals.subtotal).toLocaleString()} Ks</span>
                </div>
                {cartTotals.itemDiscounts > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discounts</span><span>-{Number(cartTotals.itemDiscounts).toLocaleString()} Ks</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black text-cyan-300 border-t border-cyan-500/20 pt-2 mt-2">
                  <span>TOTAL</span><span>{Number(cartTotals.total).toLocaleString()} Ks</span>
                </div>
              </div>
            )}
          </div>

          {/* Checkout & Payment Area */}
          {cart.length > 0 && (
            <PaymentSection 
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paidAmount={paidAmount}
              setPaidAmount={setPaidAmount}
              submitTransaction={submitTransaction}
              loading={loading}
              entryTab={entryTab}
            />
          )}

        </div>
      )}

      {/* --- Receipt Modal Overlay --- */}
      {receiptModal.show && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="text-center border-b-2 border-dashed border-gray-300 pb-4">
              <h2 className="text-2xl font-black text-gray-800">{shopName}</h2>
              <p className="text-xs text-gray-500 mt-1">📞 {shopPhone}</p>
              <p className="text-xs text-gray-500">📍 {shopAddress}</p>
            </div>
            
            <div className="py-4 space-y-2 border-b-2 border-dashed border-gray-300">
              {(receiptModal.record?.itemsDetail||[]).map((item,i) => (
                <div key={i} className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>{item.name} <span className="text-gray-400 text-xs">({item.quantity} {item.unitName})</span></span>
                  <span>{Number((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0)).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-between text-xl font-black text-gray-800">
              <span>TOTAL</span>
              <span>{Number(receiptModal.record?.amount).toLocaleString()} Ks</span>
            </div>
            
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={() => doPrint(receiptModal.record)} className="w-full py-3 rounded-xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-cyan-600/30">
                <Printer size={18}/> Print Receipt
              </button>
              <button onClick={() => setReceiptModal({show:false, record:null})} className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors">
                New Transaction
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
