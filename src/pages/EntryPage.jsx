import React, { useState, useMemo, useCallback } from 'react';
import { collection, doc, writeBatch, serverTimestamp, getDoc, increment } from 'firebase/firestore'; // 🌟 getDoc, increment အသစ်ပါသည်
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import { Calendar, User, ShoppingCart, Printer } from 'lucide-react'; // 🌟 မလိုတဲ့ Imports တွေ ဖြုတ်ထားသည်

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

  // --- Cart Hook ---
  const { 
    cart, 
    addToCart, 
    removeCartItem, 
    updateCartItemQty,
    updateCartItemUnit, 
    updateCartItemPriceType, 
    updateCartItemDiscount, 
    updateCartItemPrice, // 🌟 UI မှ အဝယ်ဈေး ပြင်ရန်
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
    const defaultUnit = product.packageUnits?.[0] || { name: 'ခု', factor: 1, prices: { retail: 0 }};
    const response = addToCart(product, defaultUnit, 'retail', 1);
    
    if (response.success) {
      setProdSearch(''); 
    } else {
      alert(response.message); 
    }
  }, [addToCart]);

  // --- Firebase Submit Logic ---
  
  // 🌟 BUG FIX 1: Expense ကို မှန်ကန်သော Batch Pattern ဖြင့် ပြင်ထားသည်
  const submitExpense = async () => {
    if (!expenseTitle || !expenseAmt || !tenantId) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      
      batch.set(ref, { 
        type: 'Expense', 
        tenantId, 
        item: expenseTitle, 
        amount: Number(expenseAmt) || 0, 
        date: entryDate, 
        createdAt: serverTimestamp() 
      });
      
      await batch.commit();
      
      setExpenseTitle(''); setExpenseAmt('');
      alert("Expense Saved!");
    } catch (err) { 
      console.error(err); 
      alert("Error saving expense");
    }
    setLoading(false);
  };

  // 🌟 BUG FIX 2: Transaction လုံခြုံမှုနှင့် Data Mismatch ပြဿနာများ ဖြေရှင်းထားသည်
  const submitTransaction = async () => {
    if (cart.length === 0 || !tenantId) return;
    setLoading(true);
    
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      
      const total = Number(cartTotals.total) || 0;
      // Empty string error ကို ကာကွယ်ထားသည်
      const paid = paidAmount === '' ? total : Number(paidAmount) || 0;
      const remainingDebt = Math.max(0, total - paid);

      const finalPersonName = personName || (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier');

      const record = { 
        id: ref.id,
        type: entryTab || 'Sale', 
        tenantId: tenantId, 
        personName: finalPersonName, 
        itemsDetail: cart.map(i => ({ 
          productId: i.productId || '',
          name: i.name || 'Unknown Item', 
          quantity: Number(i.quantity) || 1, 
          unitPrice: Number(i.unitPrice) || 0, 
          itemDiscountAmt: Number(i.itemDiscountAmt) || 0,
          unitName: i.unitName || 'ခု', 
          factor: Number(i.factor) || 1, 
          priceType: i.priceType || 'retail',
          baseQuantity: Number(i.baseQuantity) || Number(i.quantity) || 1
        })), 
        amount: total, 
        subtotal: Number(cartTotals.subtotal) || 0, 
        itemDiscount: Number(cartTotals.itemDiscounts) || 0, 
        globalDiscount: Number(cartTotals.globalDisc) || 0, 
        paymentMethod: paymentMethod || 'Cash', 
        paidAmount: paid, 
        remainingDebt: remainingDebt, 
        date: entryDate || new Date().toISOString().split('T')[0], 
        createdAt: serverTimestamp() 
      };

      batch.set(ref, record);

      // 🌟 BUG FIX 4: Outdated Cache ပြဿနာနှင့် Race Condition ဖြေရှင်းရန် Database မှ တိုက်ရိုက်ယူပြီး Increment ဖြင့် Update လုပ်သည်
      for (const item of cart) {
        if (!item.productId) continue;
        
        const itemBaseQty = Number(item.baseQuantity) || Number(item.quantity) || 0;
        const stockChange = entryTab === 'Sale' ? -Math.abs(itemBaseQty) : Math.abs(itemBaseQty);
        
        const prodRef = doc(db, 'pos_products', item.productId);
        batch.update(prodRef, { 
          stockBase: increment(stockChange) 
        });
      }

      await batch.commit();
      
      setReceiptModal({ show: true, record }); 
      clearCart();
      setPersonName('');
      setPaidAmount('');
      setPaymentMethod('Cash');

    } catch (err) { 
      console.error("Firebase Save Error: ", err); 
      alert("Error saving transaction! Please check console.");
    }
    setLoading(false);
  };

  // 🌟 BUG FIX 8: Mobile တွင် Popup Block ခံရခြင်းမှ ကာကွယ်ရန် တိုက်ရိုက် Print ခေါ်ထားသည်
  const doPrint = () => {
     window.print();
  };

  return (
    <div className="p-3 sm:p-4 pb-28 text-white max-w-5xl mx-auto space-y-4 bg-[#080c14] min-h-screen">
      
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2">
          <ShoppingCart size={22}/> POS ENTRY
        </h1>
        <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 rounded-xl px-3 py-1.5 shadow-inner">
          <Calendar size={14} className="text-cyan-400"/>
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="bg-transparent text-xs font-bold text-cyan-300 outline-none w-[110px]" style={{colorScheme:'dark'}}/>
        </div>
      </div>

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
        <div className="bg-[#0d1120] border border-amber-500/20 rounded-xl p-4 space-y-3">
          <h2 className="text-amber-400 font-bold text-sm mb-2">Record Expense</h2>
          <input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="Expense Title (e.g. မီတာခ)" className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
          <input type="number" value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)} placeholder="Amount (Ks)" className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
          <button onClick={submitExpense} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 font-black text-sm active:scale-95 transition-transform">{loading ? 'Saving...' : 'Save Expense'}</button>
        </div>
      ) : (
        <div className="space-y-4">
          
          <div className="relative">
            <User className="absolute left-3 top-3 text-cyan-500" size={16}/>
            <input 
              value={personName} 
              onChange={e => setPersonName(e.target.value)} 
              placeholder={entryTab === 'Sale' ? "Customer Name (Optional)" : "Supplier Name"} 
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-cyan-400 transition-colors" 
            />
          </div>

          <ProductSearch 
            categories={categories}
            selCategory={selCategory}
            setSelCategory={setSelCategory}
            prodSearch={prodSearch}
            setProdSearch={setProdSearch}
            setShowScanner={setShowScanner}
          />

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

          <div className="bg-[#0d1120] border border-cyan-500/20 rounded-xl p-2 sm:p-3 mt-4">
            <h2 className="text-xs font-bold text-slate-400 mb-2 pl-1 uppercase tracking-wider">Current Order</h2>
            
            <CartSection 
              cart={cart}
              products={products}
              onUpdateQty={updateCartItemQty}
              onUpdateUnit={updateCartItemUnit} 
              onUpdatePriceType={updateCartItemPriceType} 
              onUpdateDiscount={updateCartItemDiscount} 
              onUpdatePrice={updateCartItemPrice} 
              onRemove={removeCartItem}
            />

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
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
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
                  {/* 🌟 BUG FIX 6: UI နှင့် Backend Total တူညီစေရန် Discount နှုတ်ပြီးသားကိုသာ ပြသည် */}
                  <span>{Number((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0)).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-between text-xl font-black text-gray-800">
              <span>TOTAL</span>
              <span>{Number(receiptModal.record?.amount).toLocaleString()} Ks</span>
            </div>
            
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={doPrint} className="w-full py-3 rounded-xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-cyan-600/30">
                <Printer size={18}/> Print Receipt
              </button>
              <button onClick={() => setReceiptModal({show:false, record:null})} className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors">
                New Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Printable Area (Hidden on screen, shown on print) --- */}
      {receiptModal.show && receiptModal.record && (
         <div className="hidden print:block fixed inset-0 bg-white text-black text-xs font-mono p-4 z-[9999]">
             <div className="text-center mb-4">
                 <h2 className="text-lg font-bold">{shopName}</h2>
                 <p>📞 {shopPhone}</p>
                 <p>📍 {shopAddress}</p>
                 <p>📅 {receiptModal.record.date}</p>
                 <p>🧾 {receiptModal.record.id.slice(-8)}</p>
             </div>
             <table className="w-full border-collapse mb-4">
                 <thead>
                     <tr className="border-b border-black">
                         <th className="text-left py-1">Item</th>
                         <th className="text-center py-1">Qty</th>
                         <th className="text-right py-1">Total</th>
                     </tr>
                 </thead>
                 <tbody>
                     {receiptModal.record.itemsDetail.map((item, i) => (
                         <tr key={i} className="border-b border-gray-300">
                             <td className="py-1">{item.name}<br/><span className="text-[10px] text-gray-600">{item.unitName}</span></td>
                             <td className="text-center py-1">{item.quantity}</td>
                             <td className="text-right py-1">{Number((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0)).toLocaleString()}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
             <div className="flex justify-between font-bold border-t border-black pt-2 text-sm">
                 <span>TOTAL:</span>
                 <span>{Number(receiptModal.record.amount).toLocaleString()} Ks</span>
             </div>
             <div className="text-center mt-6 text-[10px]">
                 Thank you for your purchase!
             </div>
         </div>
      )}

    </div>
  );
}
