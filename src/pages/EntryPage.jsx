import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { collection, doc, writeBatch, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import { Calendar, User, ShoppingCart, Printer } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode'; 

// Components များကို လှမ်းခေါ်ခြင်း
import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';

// 🌟 Memory Leak မဖြစ်စေသော Barcode Scanner Modal
const ScannerModal = ({ onClose, onScan }) => {
  useEffect(() => {
    let html5QrCode;
    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("barcode-reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                html5QrCode.clear();
                onScan(decodedText);
              }).catch(console.error);
            }
          },
          (errorMessage) => { /* ignore */ }
        );
      } catch (err) {
        console.error("Scanner Error:", err);
      }
    };
    startScanner();

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(console.error);
      } else if (html5QrCode) {
        html5QrCode.clear();
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden relative shadow-2xl">
        <div className="p-4 bg-gray-100 flex justify-between items-center text-black border-b">
          <h3 className="font-black text-gray-800">Scan Barcode</h3>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 font-black text-2xl leading-none">&times;</button>
        </div>
        <div id="barcode-reader" className="w-full bg-black min-h-[250px]"></div>
        <div className="p-4 bg-gray-100 text-center text-xs text-gray-500 font-bold">
          ကင်မရာကို Barcode တည့်တည့်သို့ ချိန်ပါ
        </div>
      </div>
    </div>
  );
};

export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopName = profile?.shopName || 'QuickPOS';
  const shopPhone = profile?.phone || '09-123456789';
  const shopAddress = profile?.address || 'No.123, Yangon';
  const cashierName = profile?.name || profile?.email?.split('@')[0] || 'Admin';

  const todayISO = new Date().toISOString().split('T')[0];
  const [entryDate, setEntryDate] = useState(todayISO);
  const [entryTab, setEntryTab] = useState('Sale'); 
  const [personName, setPersonName] = useState(''); 

  const [selCategory, setSelCategory] = useState('All');
  const [prodSearch, setProdSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false); 
  const debouncedSearch = useDebounce(prodSearch, 300);

  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');

  const { 
    cart, addToCart, removeCartItem, updateCartItemQty,
    updateCartItemUnit, updateCartItemPriceType, updateCartItemDiscount,
    updateCartItemPrice, 
    clearCart, cartTotals, globalDiscountAmt, setGlobalDiscountAmt, 
    globalDiscountType, setGlobalDiscountType 
  } = useCart(products, entryTab);

  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selCategory !== 'All') result = result.filter(p => p.category === selCategory);
    
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => {
        const hasBarcode = p.packageUnits?.some(u => 
          u.barcodes?.retail?.toLowerCase().includes(q) || 
          u.barcodes?.wholesale?.toLowerCase().includes(q) ||
          u.barcode?.toLowerCase().includes(q) 
        );
        return (p.name || '').toLowerCase().includes(q) || hasBarcode;
      });
    }
    return result;
  }, [products, debouncedSearch, selCategory]);

  const handleSelectProduct = useCallback((product) => {
    const defaultUnit = product.packageUnits?.find(u => Number(u.multiplier) === 1) || product.packageUnits?.[0] || { name: 'ခု', multiplier: 1, prices: { retail: 0 }};
    const response = addToCart(product, defaultUnit, 'retail', 1);
    
    if (response.success) {
      setProdSearch(''); 
    } else {
      alert(response.message); 
    }
  }, [addToCart]);

  const handleTabChange = (tab) => {
    if (cart.length > 0) {
      if (!window.confirm("Cart ထဲတွင် ပစ္စည်းများရှိနေပါသည်။ ဖယ်ရှားပြီး Tab အသစ်သို့ကူးပြောင်းမည်မှာ သေချာပါသလား?")) return;
    }
    setEntryTab(tab);
    clearCart();
  };

  const submitExpense = async () => {
    if (!expenseTitle || !expenseAmt || !tenantId || loading) return;
    setLoading(true);
    try {
      // 🌟 Voucher Number Counter (Expense အတွက်)
      const counterRef = doc(db, 'pos_counters', tenantId || 'default');
      const counterSnap = await getDoc(counterRef);
      let currentCount = 0;
      if (counterSnap.exists()) {
        currentCount = counterSnap.data().expenseCount || 0;
      }
      const nextCount = currentCount + 1;
      const voucherNo = `Expense ${String(nextCount).padStart(5, '0')}`; // ဥပမာ: Expense 00001

      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      
      batch.set(ref, { 
        type: 'Expense', tenantId, item: expenseTitle, 
        amount: Number(expenseAmt) || 0, date: entryDate, 
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), 
        cashier: cashierName,
        voucherNo: voucherNo, // ဘောက်ချာနံပါတ် အသစ်
        createdAt: serverTimestamp() 
      });

      // Update Counter
      batch.set(counterRef, { expenseCount: increment(1) }, { merge: true });

      await batch.commit();
      setExpenseTitle(''); setExpenseAmt('');
      alert("Expense Saved!");
    } catch (err) { 
      console.error(err); alert("Error saving expense");
    }
    setLoading(false);
  };

  const submitTransaction = async () => {
    if (loading) return; 
    if (cart.length === 0 || !tenantId) return;

    const total = Number(cartTotals.total) || 0;
    const paid = paidAmount === '' ? total : Number(paidAmount) || 0;
    const remainingDebt = Math.max(0, total - paid);
    const changeAmount = Math.max(0, paid - total);

    if (remainingDebt > 0 && !personName.trim()) {
      alert(`အကြွေး (Credit) ဖြင့် ${entryTab === 'Sale' ? 'ရောင်းချပါက' : 'ဝယ်ယူပါက'} ${entryTab === 'Sale' ? 'Customer' : 'Supplier'} အမည်ကို မဖြစ်မနေ ထည့်သွင်းပေးပါ။`);
      return; 
    }

    if (entryTab === 'Sale') {
      for (const item of cart) {
        const prodData = products.find(p => p.id === item.productId);
        const currentStockBase = Number(prodData?.stockBase) || Number(prodData?.stock) || 0;
        if (item.baseQuantity > currentStockBase) {
           alert(`${item.name} အတွက် Stock မလုံလောက်ပါ။ (လက်ကျန်: ${currentStockBase})`);
           return;
        }
      }
    }

    setLoading(true);
    try {
      // 🌟 Voucher Number Counter (Sale/Purchase အတွက်)
      const counterRef = doc(db, 'pos_counters', tenantId || 'default');
      const counterSnap = await getDoc(counterRef);
      let currentCount = 0;
      const countField = `${entryTab.toLowerCase()}Count`; // saleCount or purchaseCount
      if (counterSnap.exists()) {
        currentCount = counterSnap.data()[countField] || 0;
      }
      const nextCount = currentCount + 1;
      const voucherNo = `${entryTab} ${String(nextCount).padStart(5, '0')}`; // ဥပမာ: Sale 00001 / Purchase 00001

      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      
      const finalPersonName = personName || (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier');
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const record = { 
        id: ref.id, type: entryTab || 'Sale', tenantId, personName: finalPersonName, 
        cashier: cashierName, 
        time: currentTime,    
        voucherNo: voucherNo, // ဘောက်ချာနံပါတ် အသစ်
        itemsDetail: cart.map(i => ({ 
          productId: i.productId || '', name: i.name || 'Unknown Item', 
          quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) || 0, 
          itemDiscountAmt: Number(i.itemDiscountAmt) || 0, unitName: i.unitName || 'ခု', 
          multiplier: Number(i.multiplier) || 1, priceType: i.priceType || 'retail',
          baseQuantity: Number(i.baseQuantity) || Number(i.quantity) || 1
        })), 
        amount: total, subtotal: Number(cartTotals.subtotal) || 0, 
        itemDiscount: Number(cartTotals.itemDiscounts) || 0, globalDiscount: Number(cartTotals.globalDisc) || 0, 
        paymentMethod: paymentMethod || 'Cash', paidAmount: paid, remainingDebt: remainingDebt, 
        changeAmount: changeAmount, 
        date: entryDate || todayISO, createdAt: serverTimestamp() 
      };
      
      batch.set(ref, record);

      // Update Stock
      cart.forEach(item => {
        if (!item.productId) return;
        const itemBaseQty = Number(item.baseQuantity) || Number(item.quantity) || 0;
        const stockChange = entryTab === 'Sale' ? -Math.abs(itemBaseQty) : Math.abs(itemBaseQty);
        
        const prodRef = doc(db, 'pos_products', item.productId);
        batch.set(prodRef, { 
          stockBase: increment(stockChange),
          stock: increment(stockChange) 
        }, { merge: true });
      });

      // Update Counter
      batch.set(counterRef, { [countField]: increment(1) }, { merge: true });

      await batch.commit();
      
      setReceiptModal({ show: true, record }); 
      clearCart(); setPersonName(''); setPaidAmount(''); setPaymentMethod('Cash');

    } catch (err) { 
      console.error("Firebase Save Error: ", err); alert("Error saving transaction!");
    }
    setLoading(false);
  };

  const doPrint = () => { window.print(); };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 80mm; /* Standard Thermal Printer Width */
            margin: 0;
            padding: 10px;
          }
          @page { margin: 0; }
        }
      `}</style>

      {showScanner && (
        <ScannerModal 
          onClose={() => setShowScanner(false)}
          onScan={(text) => {
             setProdSearch(text); 
             setShowScanner(false); 
          }}
        />
      )}

      <div className="p-3 sm:p-4 pb-28 text-white max-w-5xl mx-auto space-y-4 bg-[#080c14] min-h-screen print:hidden">
        
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-cyan-400 flex items-center gap-2"><ShoppingCart size={22}/> POS ENTRY</h1>
          <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 rounded-xl px-3 py-1.5 shadow-inner">
            <Calendar size={14} className="text-cyan-400"/>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="bg-transparent text-xs font-bold text-cyan-300 outline-none w-[110px]" style={{colorScheme:'dark'}}/>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-[#0d1120] p-1.5 rounded-xl border border-white/5">
          {['Sale', 'Purchase', 'Expense'].map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab)} className={`py-2 rounded-lg font-black text-xs transition-all ${entryTab === tab ? 'bg-cyan-600 shadow-md shadow-cyan-900/40 text-white' : 'text-slate-500 hover:text-white'}`}>{tab}</button>
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
              <input value={personName} onChange={e => setPersonName(e.target.value)} placeholder={entryTab === 'Sale' ? "Customer Name (Optional)" : "Supplier Name"} className="w-full bg-black/40 border border-cyan-500/20 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-cyan-400 transition-colors" />
            </div>

            <ProductSearch categories={categories} selCategory={selCategory} setSelCategory={setSelCategory} prodSearch={prodSearch} setProdSearch={setProdSearch} setShowScanner={setShowScanner} />

            <div className="relative z-10">
              {debouncedSearch.length > 0 ? (
                <ProductDropdown products={filteredProducts} onSelect={handleSelectProduct} isOpen={true} />
              ) : (
                <ProductGrid products={filteredProducts} onSelect={handleSelectProduct} />
              )}
            </div>

            <div className="bg-[#0d1120] border border-cyan-500/20 rounded-xl p-2 sm:p-3 mt-4">
              <h2 className="text-xs font-bold text-slate-400 mb-2 pl-1 uppercase tracking-wider">Current Order</h2>
              
              <CartSection cart={cart} products={products} onUpdateQty={updateCartItemQty} onUpdateUnit={updateCartItemUnit} onUpdatePriceType={updateCartItemPriceType} onUpdateDiscount={updateCartItemDiscount} onUpdatePrice={updateCartItemPrice} onRemove={removeCartItem} />

              {cart.length > 0 && (
                <div className="mt-3 bg-black/50 border border-cyan-500/10 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{Number(cartTotals.subtotal).toLocaleString()} Ks</span></div>
                  {cartTotals.itemDiscounts > 0 && (
                    <div className="flex justify-between text-amber-400"><span>Item Discounts</span><span>-{Number(cartTotals.itemDiscounts).toLocaleString()} Ks</span></div>
                  )}
                  
                  {entryTab === 'Sale' && (
                    <div className="flex justify-between items-center text-amber-400 border-t border-white/5 pt-2">
                      <span className="flex items-center gap-1">
                        Invoice Discount
                        <select value={globalDiscountType} onChange={e => setGlobalDiscountType(e.target.value)} className="bg-black/50 text-white rounded px-1 py-0.5 outline-none border border-amber-500/20">
                          <option value="%">%</option>
                          <option value="flat">Ks</option>
                        </select>
                      </span>
                      <input 
                        type="number" value={globalDiscountAmt} onChange={e => setGlobalDiscountAmt(e.target.value)} 
                        placeholder="0" className="w-16 bg-black/50 border border-amber-500/30 rounded px-1.5 py-1 text-right outline-none focus:border-amber-400 text-amber-400"
                      />
                    </div>
                  )}
                  {cartTotals.globalDisc > 0 && (
                    <div className="flex justify-between text-amber-400"><span>Applied Discount</span><span>-{Number(cartTotals.globalDisc).toLocaleString()} Ks</span></div>
                  )}

                  <div className="flex justify-between text-lg font-black text-cyan-300 border-t border-cyan-500/20 pt-2 mt-2">
                    <span>TOTAL</span><span>{Number(cartTotals.total).toLocaleString()} Ks</span>
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <PaymentSection paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paidAmount={paidAmount} setPaidAmount={setPaidAmount} submitTransaction={submitTransaction} loading={loading} entryTab={entryTab} />
            )}
          </div>
        )}

        {/* 🌟 Professional Receipt Modal (UI) */}
        {receiptModal.show && receiptModal.record && (
          <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
            <div className="w-full max-w-sm bg-white text-black rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans">
              
              <div className="text-center mb-4">
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">{shopName}</h2>
                <p className="text-xs text-gray-500 mt-1">{shopAddress}</p>
                <p className="text-xs text-gray-500">Tel: {shopPhone}</p>
              </div>
              
              <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
                {/* 🌟 Sequence Number ပြသခြင်း */}
                <div className="flex justify-between"><span>Voucher No:</span> <span className="text-gray-900">{receiptModal.record.voucherNo}</span></div>
                <div className="flex justify-between"><span>Date & Time:</span> <span className="text-gray-900">{receiptModal.record.date} | {receiptModal.record.time}</span></div>
                <div className="flex justify-between"><span>Cashier:</span> <span className="text-gray-900">{receiptModal.record.cashier}</span></div>
                <div className="flex justify-between"><span>Customer:</span> <span className="text-gray-900">{receiptModal.record.personName}</span></div>
              </div>

              <div className="mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-500">
                      <th className="text-left py-2 font-bold uppercase tracking-wider">Description</th>
                      <th className="text-right py-2 font-bold uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptModal.record.itemsDetail.map((item,i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5">
                          <div className="font-bold text-gray-800">{item.name}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">
                            {item.quantity} {item.unitName} x {Number(item.unitPrice).toLocaleString()}
                            {item.itemDiscountAmt > 0 && ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-bold text-gray-800 align-top">
                          {Number((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="border-t border-dashed border-gray-300 pt-3 text-[11px] font-semibold text-gray-600 space-y-1.5">
                 <div className="flex justify-between"><span>Subtotal:</span><span className="text-gray-900">{Number(receiptModal.record.subtotal).toLocaleString()} Ks</span></div>
                 {(receiptModal.record.itemDiscount > 0 || receiptModal.record.globalDiscount > 0) && (
                    <div className="flex justify-between text-red-500">
                      <span>Discount:</span><span>-{Number(receiptModal.record.itemDiscount + receiptModal.record.globalDiscount).toLocaleString()} Ks</span>
                    </div>
                 )}
              </div>

              <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between text-lg font-black text-gray-900">
                <span>GRAND TOTAL</span><span>{Number(receiptModal.record.amount).toLocaleString()} Ks</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mt-4 space-y-1.5 text-xs font-semibold text-gray-600 border border-gray-200">
                 <div className="flex justify-between">
                   <span>Paid Amount ({receiptModal.record.paymentMethod}):</span>
                   <span className="text-gray-900">{Number(receiptModal.record.paidAmount).toLocaleString()} Ks</span>
                 </div>
                 {receiptModal.record.remainingDebt > 0 ? (
                   <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                     <span>Credit Balance (အကြွေး):</span>
                     <span>{Number(receiptModal.record.remainingDebt).toLocaleString()} Ks</span>
                   </div>
                 ) : (
                   <div className="flex justify-between text-green-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                     <span>Change (ပြန်အမ်းငွေ):</span>
                     <span>{Number(receiptModal.record.changeAmount).toLocaleString()} Ks</span>
                   </div>
                 )}
              </div>
              
              <div className="text-center mt-6 flex flex-col items-center gap-2">
                <span className={`font-black tracking-widest border-2 px-4 py-1 rounded-sm text-sm ${receiptModal.record.remainingDebt > 0 ? 'text-red-500 border-red-500' : 'text-green-500 border-green-500'}`}>
                  {receiptModal.record.remainingDebt > 0 ? 'CREDIT' : 'PAID'}
                </span>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">Thank you for your business!</p>
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
      </div>

      {/* 🌟 Professional Receipt Print Area (Thermal) */}
      {receiptModal.show && receiptModal.record && (
         <div id="receipt-print-area" className="hidden print:block bg-white text-black font-sans text-[12px] leading-tight">
             <div className="text-center mb-3">
                 <h2 className="text-[18px] font-bold uppercase m-0">{shopName}</h2>
                 <p className="m-0 mt-1">{shopAddress}</p>
                 <p className="m-0">Tel: {shopPhone}</p>
             </div>
             
             <div className="border-t border-b border-dashed border-black py-2 mb-3 space-y-1">
                 {/* 🌟 Sequence Number ပြသခြင်း */}
                 <div className="flex justify-between"><span>Voucher:</span> <span className="font-bold">{receiptModal.record.voucherNo}</span></div>
                 <div className="flex justify-between"><span>Date:</span> <span>{receiptModal.record.date} {receiptModal.record.time}</span></div>
                 <div className="flex justify-between"><span>Cashier:</span> <span>{receiptModal.record.cashier}</span></div>
                 <div className="flex justify-between"><span>Customer:</span> <span>{receiptModal.record.personName}</span></div>
             </div>

             <table className="w-full border-collapse mb-3">
                 <thead>
                     <tr className="border-b border-black">
                         <th className="text-left pb-1 font-bold">Item</th>
                         <th className="text-right pb-1 font-bold">Amount</th>
                     </tr>
                 </thead>
                 <tbody>
                     {receiptModal.record.itemsDetail.map((item, i) => (
                         <tr key={i}>
                             <td className="py-1.5 align-top">
                                <div className="font-bold">{item.name}</div>
                                <div className="text-[10px] mt-0.5">
                                  {item.quantity} {item.unitName} x {Number(item.unitPrice).toLocaleString()}
                                  {item.itemDiscountAmt > 0 && ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                                </div>
                             </td>
                             <td className="text-right py-1.5 align-top font-bold">
                               {Number((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0)).toLocaleString()}
                             </td>
                         </tr>
                     ))}
                 </tbody>
             </table>
             
             <div className="border-t border-dashed border-black pt-2 mb-2 space-y-1">
                 <div className="flex justify-between"><span>Subtotal:</span><span>{Number(receiptModal.record.subtotal).toLocaleString()}</span></div>
                 {(receiptModal.record?.itemDiscount > 0 || receiptModal.record?.globalDiscount > 0) && (
                    <div className="flex justify-between"><span>Discount:</span><span>-{Number(receiptModal.record.itemDiscount + receiptModal.record.globalDiscount).toLocaleString()}</span></div>
                 )}
             </div>
             
             <div className="flex justify-between font-bold border-t border-black pt-2 mb-3 text-[14px]">
               <span>TOTAL:</span><span>{Number(receiptModal.record.amount).toLocaleString()}</span>
             </div>

             <div className="border-t border-black pt-2 mb-4 space-y-1">
                 <div className="flex justify-between">
                   <span>Paid ({receiptModal.record.paymentMethod}):</span>
                   <span>{Number(receiptModal.record.paidAmount).toLocaleString()}</span>
                 </div>
                 {receiptModal.record.remainingDebt > 0 ? (
                   <div className="flex justify-between font-bold">
                     <span>Credit Balance:</span>
                     <span>{Number(receiptModal.record.remainingDebt).toLocaleString()}</span>
                   </div>
                 ) : (
                   <div className="flex justify-between font-bold">
                     <span>Change:</span>
                     <span>{Number(receiptModal.record.changeAmount).toLocaleString()}</span>
                   </div>
                 )}
             </div>

             <div className="text-center font-bold text-[14px] mb-2">
                {receiptModal.record.remainingDebt > 0 ? '*** CREDIT ***' : '*** PAID ***'}
             </div>
             <div className="text-center text-[10px]">Thank you for your business!</div>
         </div>
      )}
    </>
  );
}
