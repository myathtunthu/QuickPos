import { useState, useMemo, useEffect, useRef } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode'; // ✅ Scanner Import
import {
  ShoppingCart, PlusCircle, Trash2, Search, ScanBarcode,
  Wallet, X, Printer, Tag, User, Calendar, Loader2
} from 'lucide-react';

export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopName = profile?.shopName || 'My POS';
  const shopPhone = profile?.phone || '09-123456789';
  const shopAddress = profile?.address || 'No.123, Yangon';

  const todayISO = new Date().toISOString().split('T')[0];
  const fmt = n => (Number(n) || 0).toLocaleString();

  const [loading, setLoading] = useState(false);
  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(todayISO);
  const [personName, setPersonName] = useState('');
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [selCategory, setSelCategory] = useState('All');
  const [selProdId, setSelProdId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const scannerRef = useRef(null);

  const playBeep = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type === 'success' ? 'sine' : 'square';
      osc.frequency.value = type === 'success' ? 900 : 180;
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const ms = (p.name || '').toLowerCase().includes(prodSearch.toLowerCase()) || (p.barcode || '').includes(prodSearch);
      return (selCategory === 'All' || p.category === selCategory) && ms;
    });
  }, [products, prodSearch, selCategory]);

  const cartTotals = useMemo(() => {
    const s = cart.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
    const d = cart.reduce((a, i) => a + Number(i.itemDiscountAmt || 0), 0);
    const g = globalDiscountType === '%' ? (s - d) * (Number(globalDiscountAmt || 0) / 100) : Number(globalDiscountAmt || 0);
    return { subtotal: s, itemDiscounts: d, globalDisc: g, total: Math.max(s - d - g, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  const handleBarcodeSubmit = (value) => {
    const code = value.trim(); if (!code) return;
    const prod = products.find(p => p.barcode === code || p.id === code);
    if (!prod) { playBeep('error'); return; }
    const price = entryTab === 'Sale' ? Number(prod.price || 0) : Number(prod.costPrice || 0);
    setCart(prev => {
      const ex = prev.find(c => c.productId === prod.id && c.unitPrice === price);
      return ex ? prev.map(c => c.id === ex.id ? { ...c, quantity: c.quantity + 1 } : c) : [...prev, { id: Date.now(), productId: prod.id, name: prod.name, quantity: 1, unitPrice: price, costPrice: Number(prod.costPrice || 0), itemDiscountAmt: 0 }];
    });
    playBeep('success'); setBarcodeInput('');
  };

  const addToCart = () => {
    if (!selProdId || !unitPrice || !quantity) return;
    const p = products.find(x => x.id === selProdId); if (!p) return;
    const pr = Number(unitPrice), q = Number(quantity);
    setCart(prev => {
      const ex = prev.find(x => x.productId === p.id && x.unitPrice === pr);
      return ex ? prev.map(x => x.id === ex.id ? { ...x, quantity: x.quantity + q } : x) : [...prev, { id: Date.now(), productId: p.id, name: p.name, quantity: q, unitPrice: pr, costPrice: Number(p.costPrice || 0), itemDiscountAmt: 0 }];
    });
    setProdSearch(''); setSelProdId(''); setUnitPrice(''); setQuantity('1'); setShowProdDropdown(false);
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const updateItemDiscount = (id, amt) => setCart(prev => prev.map(c => c.id === id ? { ...c, itemDiscountAmt: Number(amt) || 0 } : c));
  const clearCart = () => {
    setCart([]); setPersonName(''); setGlobalDiscountAmt(''); setPaidAmount('');
    setPaymentMethod('Cash'); setProdSearch(''); setSelProdId(''); setUnitPrice(''); setQuantity('1');
  };

  // ✅ FIXED SCANNER
  useEffect(() => {
    if (!showScanner) return;
    let html5QrCode;
    const start = async () => {
      try {
        html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => {
            handleBarcodeSubmit(text);
            if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
            setShowScanner(false);
          },
          () => {}
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setShowScanner(false);
      }
    };
    start();
    return () => {
      if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
    };
  }, [showScanner]);

  const submitExpense = async () => {
    if (!expenseTitle || !expenseAmt) return;
    setLoading(true);
    try {
      await writeBatch(db).set(doc(collection(db, 'pos_records')), {
        type: 'Expense', tenantId, item: expenseTitle, amount: Number(expenseAmt),
        date: entryDate, createdAt: serverTimestamp()
      }).commit();
      setExpenseTitle(''); setExpenseAmt('');
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const submitTransaction = async () => {
    if (cart.length === 0) return; if (!tenantId) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      const total = cartTotals.total;
      const paid = paidAmount === '' ? total : Number(paidAmount || 0);
      const debt = Math.max(0, total - paid);
      const rec = {
        type: entryTab, tenantId, personName: personName || 'Walk-in',
        itemsDetail: cart.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, costPrice: i.costPrice, itemDiscountAmt: i.itemDiscountAmt })),
        amount: total, subtotal: cartTotals.subtotal, itemDiscount: cartTotals.itemDiscounts, globalDiscount: cartTotals.globalDisc,
        paymentMethod, paidAmount: paid, remainingDebt: debt, date: entryDate, createdAt: serverTimestamp()
      };
      batch.set(ref, rec);
      cart.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) {
          const cs = Number(p.stock || 0);
          batch.update(doc(db, 'pos_products', item.productId), { stock: Math.max(0, entryTab === 'Sale' ? cs - item.quantity : cs + item.quantity) });
        }
      });
      await batch.commit();
      setReceiptModal({ show: true, record: { ...rec, id: ref.id } });
      clearCart();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const doPrint = (record) => {
    const items = record.itemsDetail || [];
    const w = window.open('', '_blank', 'width=380,height=600');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
    <style>body{font-family:'Courier New',monospace;font-size:13px;width:340px;margin:10px auto;padding:15px;border:1px dashed #000;background:#fff;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;}.shop-name{font-size:18px;font-weight:bold;}.shop-info{font-size:11px;color:#555;margin:2px 0;}table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{padding:5px 0;border-bottom:1px dotted #ccc;font-size:12px;}th{border-bottom:1px solid #000;text-align:left;}td{text-align:right;}td:first-child{text-align:left;}.total-row{font-weight:bold;font-size:16px;border-top:1px solid #000;padding-top:8px;}.footer{text-align:center;margin-top:15px;font-size:11px;color:#555;}</style></head><body>
    <div class="header"><div class="shop-name">${shopName}</div><div class="shop-info">📞 ${shopPhone}</div><div class="shop-info">📍 ${shopAddress}</div><div class="shop-info">📅 ${record.date || ''}</div></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
    ${items.map(i => `<tr><td>${i.name}${i.itemDiscountAmt>0?'<br><small>Disc: -'+fmt(i.itemDiscountAmt)+'</small>':''}</td><td>${i.quantity}</td><td>${fmt(i.unitPrice)}</td><td>${fmt(i.unitPrice*i.quantity-(i.itemDiscountAmt||0))}</td></tr>`).join('')}
    </tbody></table>
    ${record.globalDiscount>0?`<p style="text-align:right;font-size:12px;">Global Disc: -${fmt(record.globalDiscount)} Ks</p>`:''}
    <div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
    <p style="text-align:right;font-size:12px;">Method: ${record.paymentMethod}</p>
    <p style="text-align:right;font-size:12px;">Paid: ${fmt(record.paidAmount||0)} Ks | Debt: ${fmt(record.remainingDebt||0)} Ks</p>
    <div class="footer">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>Thank you!</div>
    <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="p-4 pb-28 text-white max-w-5xl mx-auto space-y-5 bg-[#080c14] min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-cyan-400"><ShoppingCart size={24} className="inline mr-1"/>POS ENTRY</h1>
        <div className="flex items-center gap-2 bg-black/40 border border-cyan-500/20 rounded-2xl px-4 py-2"><Calendar size={16}/><span className="text-sm font-bold text-cyan-300">{entryDate}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['Sale','Purchase','Expense'].map(tab => (
          <button key={tab} onClick={() => { setEntryTab(tab); clearCart(); }} className={`py-3 rounded-2xl font-black border ${entryTab===tab?'bg-cyan-600 border-cyan-400 text-white':'bg-[#0d1120] border-white/5 text-slate-500'}`}>{tab}</button>
        ))}
      </div>
      <div><label className="block mb-1 text-xs uppercase text-slate-500 font-bold">Date</label><input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 outline-none text-white" /></div>

      {entryTab === 'Expense' ? (
        <div className="space-y-4">
          <input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="Title" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-white" />
          <input value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)} placeholder="Amount" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-3 text-white" />
          <button onClick={submitExpense} disabled={loading} className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 font-black">{loading?'Saving...':'Save Expense'}</button>
        </div>
      ) : (
        <>
          <div><label className="block mb-1 text-xs uppercase text-slate-500 font-bold">Customer</label><div className="relative"><User className="absolute left-4 top-3 text-cyan-500" size={18}/><input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Name" className="w-full bg-black/40 border border-cyan-500/20 rounded-xl pl-12 pr-5 py-3 text-white" /></div></div>
          <div className="flex gap-3"><div className="relative flex-1"><ScanBarcode className="absolute left-4 top-3 text-blue-500" size={18}/><input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') handleBarcodeSubmit(barcodeInput); }} placeholder="Scan barcode..." className="w-full bg-black/40 border border-blue-500/20 rounded-xl pl-12 pr-5 py-3 text-white" /></div><button onClick={() => setShowScanner(true)} className="px-5 bg-blue-600 rounded-xl"><ScanBarcode size={20}/></button></div>
          <div className="flex gap-2 overflow-x-auto">{categories.map(cat => (<button key={cat} onClick={() => setSelCategory(cat)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${selCategory===cat?'bg-cyan-600 text-white':'bg-black/40 text-slate-400'}`}>{cat}</button>))}</div>
          <div className="relative"><Search className="absolute left-4 top-3 text-cyan-500" size={18}/><input value={prodSearch} onChange={e => { setProdSearch(e.target.value); setShowProdDropdown(true); }} onFocus={()=>setShowProdDropdown(true)} placeholder="Search product..." className="w-full bg-black border border-cyan-500/20 rounded-xl pl-12 pr-5 py-3 text-white" />
            {showProdDropdown && (<div className="absolute z-50 mt-2 w-full bg-[#111827] border border-cyan-500/30 rounded-xl max-h-72 overflow-y-auto">{filteredProducts.slice(0,20).map(prod => (<div key={prod.id} onClick={()=>{setSelProdId(prod.id);setProdSearch(prod.name);setUnitPrice(String(entryTab==='Sale'?prod.price||0:prod.costPrice||0));setShowProdDropdown(false);}} className="p-4 border-b border-white/5 hover:bg-cyan-900/20 cursor-pointer flex justify-between"><div><p className="font-black">{prod.name}</p><p className="text-sm text-cyan-400">{fmt(entryTab==='Sale'?prod.price:prod.costPrice)} Ks</p></div><p className="text-sm text-slate-500">Stock: {prod.stock}</p></div>))}</div>)}
          </div>
          <div className="grid grid-cols-2 gap-4"><input value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="Price" className="bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-white" /><input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qty" className="bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-white" /></div>
          <button onClick={addToCart} className="w-full py-3 rounded-xl bg-cyan-600 font-black flex justify-center items-center gap-2"><PlusCircle size={20}/> Add To Cart</button>

          {cart.length > 0 && (
            <div className="space-y-3">
              {cart.map(item => (<div key={item.id} className="bg-black/40 border border-cyan-500/10 rounded-xl p-4"><div className="flex justify-between"><div><p className="font-black">{item.name}</p><p className="text-cyan-400 text-sm">{fmt(item.unitPrice)} × {item.quantity} = {fmt(item.unitPrice*item.quantity)} Ks</p></div><button onClick={()=>removeFromCart(item.id)} className="text-rose-400"><Trash2 size={18}/></button></div><div className="mt-3 flex items-center gap-2 text-amber-400 text-sm"><Tag size={14}/> Disc:<input value={item.itemDiscountAmt||''} onChange={e=>updateItemDiscount(item.id,e.target.value)} placeholder="0" className="w-24 bg-black border border-amber-500/20 rounded-lg px-3 py-1.5 text-white text-sm" /> Ks</div></div>))}
              <div className="flex gap-2 items-end"><div className="flex-1"><label className="text-xs text-slate-500">Global Discount</label><input value={globalDiscountAmt} onChange={e=>setGlobalDiscountAmt(e.target.value)} placeholder="0" className="w-full bg-black/40 border border-amber-500/20 rounded-xl px-4 py-2 text-amber-400" /></div><button onClick={()=>setGlobalDiscountType('%')} className={`px-4 py-2 rounded-lg text-sm font-bold ${globalDiscountType==='%'?'bg-amber-600 text-white':'bg-black/40 text-slate-400'}`}>%</button><button onClick={()=>setGlobalDiscountType('flat')} className={`px-4 py-2 rounded-lg text-sm font-bold ${globalDiscountType==='flat'?'bg-amber-600 text-white':'bg-black/40 text-slate-400'}`}>Ks</button></div>
              <div className="bg-black/50 border border-cyan-500/20 rounded-xl p-4 space-y-2"><div className="flex justify-between text-sm"><span>Subtotal</span><span>{fmt(cartTotals.subtotal)} Ks</span></div>{(cartTotals.itemDiscounts+cartTotals.globalDisc)>0 && <div className="flex justify-between text-sm text-amber-400"><span>Discount</span><span>-{fmt(cartTotals.itemDiscounts+cartTotals.globalDisc)} Ks</span></div>}<div className="flex justify-between text-xl font-black text-cyan-300 border-t border-cyan-500/20 pt-3"><span>TOTAL</span><span>{fmt(cartTotals.total)} Ks</span></div></div>
              <div className="grid grid-cols-4 gap-2">{['Cash','Kpay','Wave','AYAPay'].map(method => (<button key={method} onClick={()=>setPaymentMethod(method)} className={`py-2 rounded-xl text-xs font-bold border ${paymentMethod===method?'bg-cyan-600 border-cyan-400 text-white':'bg-black/40 border-white/5 text-slate-400'}`}>{method}</button>))}</div>
              <div><label className="block mb-1 text-xs text-slate-500 font-bold">💵 Paid Amount {paidAmount==='' && <span className="text-emerald-400">(Full: {fmt(cartTotals.total)} Ks)</span>}</label><div className="relative"><Wallet className="absolute left-4 top-3 text-emerald-400" size={18}/><input value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} placeholder="Leave empty for full payment" className="w-full bg-black/40 border border-emerald-500/20 rounded-xl pl-12 pr-5 py-3 text-emerald-300" /></div></div>
              <button onClick={submitTransaction} disabled={loading} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xl font-black flex items-center gap-2">{loading?<Loader2 className="animate-spin"/>:<ShoppingCart size={20}/>}{loading?'Processing...':entryTab==='Sale'?'Complete Sale':'Complete Purchase'}</button>
            </div>
          )}
        </>
      )}

      {showScanner && (<div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-[#0d1120] border border-cyan-500/20 rounded-3xl p-6"><div className="flex justify-between mb-5"><h2 className="text-xl font-black"><ScanBarcode className="inline text-cyan-400"/> Scanner</h2><button onClick={()=>setShowScanner(false)}><X/></button></div><div id="barcode-reader" className="overflow-hidden rounded-2xl"/></div></div>)}
      {receiptModal.show && (<div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 max-h-[90vh] overflow-y-auto"><div className="text-center border-b border-dashed pb-4"><h2 className="text-xl font-black">{shopName}</h2><p className="text-xs text-gray-500">📞 {shopPhone}</p><p className="text-xs text-gray-500">📍 {shopAddress}</p><p className="text-xs text-gray-500 mt-2">{receiptModal.record?.date}</p></div><div className="space-y-2 py-4 text-sm">{(receiptModal.record?.itemsDetail||[]).map((item,i)=>(<div key={i} className="flex justify-between"><span>{item.name} × {item.quantity}</span><span>{fmt((item.unitPrice*item.quantity)-(item.itemDiscountAmt||0))}</span></div>))}</div>{(receiptModal.record?.globalDiscount||0)>0 && <p className="text-right text-sm text-gray-500">Disc: -{fmt(receiptModal.record.globalDiscount)} Ks</p>}<div className="border-t pt-3 flex justify-between text-xl font-black"><span>TOTAL</span><span>{fmt(receiptModal.record?.amount)} Ks</span></div><p className="text-sm text-right mt-1">Paid: {fmt(receiptModal.record?.paidAmount||0)} Ks | Debt: {fmt(receiptModal.record?.remainingDebt||0)} Ks</p><div className="grid grid-cols-2 gap-3 mt-4"><button onClick={()=>doPrint(receiptModal.record)} className="py-3 rounded-2xl bg-cyan-600 text-white font-black flex items-center gap-2"><Printer size={18}/> Print</button><button onClick={()=>setReceiptModal({show:false,record:null})} className="py-3 rounded-2xl bg-gray-200 text-black font-black">Close</button></div></div></div>)}
    </div>
  );
}
