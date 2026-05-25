import { useState, useMemo, useEffect, useRef } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ShoppingCart, PlusCircle, Trash2, Search, ScanBarcode,
  Wallet, X, Printer, Tag, User, Calendar, Loader2, AlertTriangle, Package
} from 'lucide-react';

export default function EntryPage({ products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const shopName = profile?.shopName || 'QuickPOS';
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

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [priceType, setPriceType] = useState('retail');
  const [stockWarning, setStockWarning] = useState('');

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
    let result = products;
    if (selCategory !== 'All') result = result.filter(p => p.category === selCategory);
    if (prodSearch.trim()) {
      const q = prodSearch.toLowerCase();
      result = result.filter(p => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').includes(q));
    }
    return result;
  }, [products, prodSearch, selCategory]);

  const cartTotals = useMemo(() => {
    const s = cart.reduce((a, i) => a + i.unitPrice * i.quantity, 0);
    const d = cart.reduce((a, i) => a + Number(i.itemDiscountAmt || 0), 0);
    const g = globalDiscountType === '%' ? (s - d) * (Number(globalDiscountAmt || 0) / 100) : Number(globalDiscountAmt || 0);
    return { subtotal: s, itemDiscounts: d, globalDisc: g, total: Math.max(s - d - g, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  const selectProduct = (prod) => {
    setSelProdId(prod.id);
    setProdSearch(prod.name);
    const defaultUnit = prod.packageUnits?.[0] || null;
    setSelectedUnit(defaultUnit);
    if (defaultUnit) {
      if (entryTab === 'Sale') setUnitPrice(String(defaultUnit.prices?.retail || 0));
      else setUnitPrice(String(defaultUnit.costPrice || 0));
    }
    setStockWarning('');
  };

  const handleUnitChange = (unitName) => {
    const prod = products.find(p => p.id === selProdId);
    const unit = prod?.packageUnits?.find(u => u.name === unitName);
    setSelectedUnit(unit);
    if (unit) {
      if (entryTab === 'Sale') setUnitPrice(String(unit.prices?.[priceType] || 0));
      else setUnitPrice(String(unit.costPrice || 0));
    }
  };

  const handlePriceTypeChange = (type) => {
    setPriceType(type);
    if (selectedUnit) setUnitPrice(String(selectedUnit.prices?.[type] || 0));
  };

  const handleBarcodeSubmit = (value) => {
    const code = value.trim(); if (!code) return;
    for (const p of products) {
      for (const unit of (p.packageUnits || [])) {
        if (unit.barcodes?.retail === code) {
          setSelProdId(p.id); setProdSearch(p.name); setSelectedUnit(unit);
          if (entryTab === 'Sale') setUnitPrice(String(unit.prices?.retail || 0));
          else setUnitPrice(String(unit.costPrice || 0));
          playBeep('success'); setBarcodeInput(''); setStockWarning('');
          return;
        }
      }
    }
    playBeep('error');
  };

  const addToCart = () => {
    if (!selProdId || !selectedUnit || !unitPrice || !quantity) return;
    const prod = products.find(x => x.id === selProdId); if (!prod) return;
    if (entryTab === 'Sale') {
      const stockNeeded = Number(quantity) * (selectedUnit.multiplier || 1);
      if ((Number(prod.stock) || 0) < stockNeeded) {
        setStockWarning('Stock မလုံလောက်ပါ');
        playBeep('error');
        return;
      }
    }
    const pr = Number(unitPrice);
    const q = Number(quantity);
    setCart(prev => {
      const ex = prev.find(x => x.productId === prod.id && x.unitName === selectedUnit.name && x.priceType === priceType);
      if (ex) return prev.map(x => x.id === ex.id ? { ...x, quantity: x.quantity + q } : x);
      return [...prev, { id: Date.now(), productId: prod.id, name: prod.name, unitName: selectedUnit.name, multiplier: selectedUnit.multiplier || 1, quantity: q, priceType, unitPrice: pr, costPrice: entryTab === 'Sale' ? (selectedUnit.costPrice || 0) : pr, itemDiscountAmt: 0 }];
    });
    setProdSearch(''); setSelProdId(''); setSelectedUnit(null); setUnitPrice(''); setQuantity('1'); setStockWarning('');
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const updateItemDiscount = (id, amt) => setCart(prev => prev.map(c => c.id === id ? { ...c, itemDiscountAmt: Number(amt) || 0 } : c));
  const clearCart = () => {
    setCart([]); setPersonName(''); setGlobalDiscountAmt(''); setPaidAmount('');
    setPaymentMethod('Cash'); setProdSearch(''); setSelProdId(''); setSelectedUnit(null); setUnitPrice(''); setQuantity('1'); setStockWarning('');
  };

  useEffect(() => {
    if (!showScanner) return;
    let html5QrCode;
    const start = async () => {
      try {
        html5QrCode = new Html5Qrcode("barcode-reader"); scannerRef.current = html5QrCode;
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { handleBarcodeSubmit(text); if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } setShowScanner(false); }, () => {}
        );
      } catch (err) { setShowScanner(false); }
    };
    start();
    return () => { if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } };
  }, [showScanner]);

  const submitExpense = async () => {
    if (!expenseTitle || !expenseAmt) return;
    setLoading(true);
    try {
      await writeBatch(db).set(doc(collection(db, 'pos_records')), { type: 'Expense', tenantId, item: expenseTitle, amount: Number(expenseAmt), date: entryDate, createdAt: serverTimestamp() }).commit();
      setExpenseTitle(''); setExpenseAmt('');
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const submitTransaction = async () => {
    if (cart.length === 0) return; if (!tenantId) return;
    if (entryTab === 'Sale') {
      for (const item of cart) {
        const p = products.find(x => x.id === item.productId);
        if (p && (Number(p.stock) || 0) < item.quantity * (item.multiplier || 1)) {
          alert('Stock မလုံလောက်ပါ: ' + item.name); setLoading(false); return;
        }
      }
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));
      const total = cartTotals.total;
      const paid = paidAmount === '' ? total : Number(paidAmount || 0);
      const debt = Math.max(0, total - paid);
      const rec = { type: entryTab, tenantId, personName: personName || 'Walk-in', itemsDetail: cart.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, costPrice: i.costPrice, itemDiscountAmt: i.itemDiscountAmt, unitName: i.unitName, multiplier: i.multiplier, priceType: i.priceType })), amount: total, subtotal: cartTotals.subtotal, itemDiscount: cartTotals.itemDiscounts, globalDiscount: cartTotals.globalDisc, paymentMethod, paidAmount: paid, remainingDebt: debt, date: entryDate, createdAt: serverTimestamp() };
      batch.set(ref, rec);
      cart.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) {
          const sc = item.quantity * (item.multiplier || 1);
          batch.update(doc(db, 'pos_products', item.productId), { stock: Math.max(0, entryTab === 'Sale' ? (Number(p.stock)||0) - sc : (Number(p.stock)||0) + sc) });
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
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title><style>body{font-family:'Courier New',monospace;font-size:13px;width:340px;margin:10px auto;padding:15px;border:1px dashed #000;background:#fff;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;}.shop-name{font-size:18px;font-weight:bold;}.shop-info{font-size:11px;color:#555;margin:2px 0;}table{width:100%;border-collapse:collapse;margin:10px 0;}th,td{padding:5px 0;border-bottom:1px dotted #ccc;font-size:12px;}th{border-bottom:1px solid #000;text-align:left;}td{text-align:right;}td:first-child{text-align:left;}.total-row{font-weight:bold;font-size:16px;border-top:1px solid #000;padding-top:8px;}.footer{text-align:center;margin-top:15px;font-size:11px;color:#555;}</style></head><body><div class="header"><div class="shop-name">${shopName}</div><div class="shop-info">📞 ${shopPhone}</div><div class="shop-info">📍 ${shopAddress}</div><div class="shop-info">📅 ${record.date || ''}</div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.unitName||'-'}</td><td>${fmt(i.unitPrice)}</td><td>${fmt(i.unitPrice*i.quantity-(i.itemDiscountAmt||0))}</td></tr>`).join('')}</tbody></table>${record.globalDiscount>0?`<p style="text-align:right;font-size:12px;">Global Disc: -${fmt(record.globalDiscount)} Ks</p>`:''}<div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div><p style="text-align:right;font-size:12px;">Method: ${record.paymentMethod}</p><p style="text-align:right;font-size:12px;">Paid: ${fmt(record.paidAmount||0)} Ks | Debt: ${fmt(record.remainingDebt||0)} Ks</p><div class="footer">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>Thank you!</div><script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="p-2 sm:p-4 pb-28 text-white max-w-6xl mx-auto space-y-3 bg-[#080c14] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-black text-cyan-400"><ShoppingCart size={20} className="inline mr-1"/>POS ENTRY</h1>
        <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 rounded-2xl px-3 py-1"><Calendar size={14}/><span className="text-xs font-bold text-cyan-300">{entryDate}</span></div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {['Sale','Purchase','Expense'].map(tab => (
          <button key={tab} onClick={() => { setEntryTab(tab); clearCart(); }} className={`py-1.5 rounded-lg font-black text-xs border ${entryTab===tab?'bg-cyan-600 border-cyan-400 text-white':'bg-[#0d1120] border-white/5 text-slate-500'}`}>{tab}</button>
        ))}
      </div>

      {stockWarning && <div className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-1.5 flex items-center gap-1.5 text-rose-400 text-[11px]"><AlertTriangle size={14}/> {stockWarning}</div>}

      {entryTab === 'Expense' ? (
        <div className="space-y-2">
          <input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="Title" className="w-full bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white" />
          <input value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)} placeholder="Amount" className="w-full bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white" />
          <button onClick={submitExpense} disabled={loading} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 font-black text-xs">{loading?'Saving...':'Save Expense'}</button>
        </div>
      ) : (
        <>
          {/* Customer + Barcode Row */}
          <div className="flex gap-1.5">
            <div className="relative flex-1"><User className="absolute left-2.5 top-2 text-cyan-500" size={14}/><input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Customer" className="w-full bg-black/40 border border-cyan-500/20 rounded-lg pl-8 pr-2 py-2 text-xs text-white" /></div>
            <div className="relative flex-1"><ScanBarcode className="absolute left-2.5 top-2 text-blue-500" size={14}/><input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') handleBarcodeSubmit(barcodeInput); }} placeholder="Barcode" className="w-full bg-black/40 border border-blue-500/20 rounded-lg pl-8 pr-2 py-2 text-xs text-white" /></div>
            <button onClick={() => setShowScanner(true)} className="px-2.5 bg-blue-600 rounded-lg"><ScanBarcode size={16}/></button>
          </div>

          {/* Categories */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelCategory(cat)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${selCategory===cat?'bg-cyan-600 text-white':'bg-black/40 text-slate-400 border border-white/5'}`}>{cat}</button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-cyan-500" size={14}/>
            <input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search..." className="w-full bg-black border border-cyan-500/20 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none" />
            {prodSearch && <button onClick={() => setProdSearch('')} className="absolute right-2 top-1.5 text-slate-500"><X size={14}/></button>}
          </div>

          {/* Product Grid */}
          {(prodSearch.trim() || selCategory !== 'All') ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
              {filteredProducts.slice(0, 25).map(prod => (
                <button key={prod.id} onClick={() => selectProduct(prod)} className={`bg-[#0d1120] border-2 rounded-lg p-1.5 text-center transition-all active:scale-95 ${selProdId===prod.id?'border-cyan-400 bg-cyan-900/20':'border-white/5'}`}>
                  <div className="w-7 h-7 mx-auto bg-cyan-500/10 rounded-md flex items-center justify-center mb-0.5"><Package size={12} className="text-cyan-400"/></div>
                  <p className="text-[10px] font-bold text-white truncate">{prod.name}</p>
                  <p className="text-[10px] text-cyan-400 font-bold">{fmt(prod.packageUnits?.[0]?.prices?.retail || 0)}</p>
                  <p className="text-[10px] text-slate-500">({prod.stock})</p>
                </button>
              ))}
              {filteredProducts.length === 0 && <div className="col-span-full text-center text-slate-500 text-xs py-6">No products</div>}
            </div>
          ) : (
            <div className="text-center text-slate-600 text-xs py-6 border border-dashed border-slate-800 rounded-lg">
              🔍 Search or select category
            </div>
          )}

          {/* Selected Product Detail */}
          {selProdId && selectedUnit && (
            <div className="bg-[#0d1120] border border-cyan-500/20 rounded-lg p-2 space-y-1.5">
              <p className="text-[11px] font-black text-cyan-400">{products.find(p=>p.id===selProdId)?.name}</p>
              <div className="flex gap-1.5">
                <select value={selectedUnit?.name || ''} onChange={(e) => handleUnitChange(e.target.value)} className="flex-1 bg-black border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white outline-none">
                  {products.find(p => p.id === selProdId)?.packageUnits?.map(unit => (<option key={unit.name} value={unit.name}>{unit.name} (×{unit.multiplier})</option>))}
                </select>
                {entryTab === 'Sale' && (
                  <select value={priceType} onChange={(e) => handlePriceTypeChange(e.target.value)} className="flex-1 bg-black border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white outline-none">
                    <option value="retail">Retail</option>
                    <option value="wholesaleA">Wholesale A</option>
                    <option value="wholesaleB">Wholesale B</option>
                    <option value="wholesaleC">Wholesale C</option>
                  </select>
                )}
              </div>
              <div className="flex gap-1.5 items-center">
                <input value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="Price" className="w-16 bg-black/40 border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white text-center" />
                <span className="text-slate-500 text-[10px]">×</span>
                <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" className="w-10 bg-black/40 border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white text-center" />
                <button onClick={addToCart} className="flex-1 py-1.5 bg-cyan-600 rounded-md font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95"><PlusCircle size={12}/> Add</button>
              </div>
            </div>
          )}

          {/* Cart */}
          {cart.length > 0 && (
            <div className="space-y-1.5">
              {cart.map(item => (
                <div key={item.id} className="bg-black/40 border border-cyan-500/10 rounded-lg p-2">
                  <div className="flex justify-between items-start">
                    <div><p className="font-bold text-xs">{item.name}</p><p className="text-cyan-400 text-[10px] mt-0.5">{fmt(item.unitPrice)} × {item.quantity} {item.unitName} = {fmt(item.unitPrice*item.quantity)} Ks</p><p className="text-[9px] text-slate-500">{item.priceType} | ×{item.multiplier}</p></div>
                    <div className="flex items-center gap-1"><div className="flex items-center gap-1 text-amber-400 text-[10px]"><Tag size={10}/> <input value={item.itemDiscountAmt||''} onChange={e=>updateItemDiscount(item.id,e.target.value)} placeholder="0" className="w-14 bg-black border border-amber-500/20 rounded px-1.5 py-1 text-[10px] text-white"/> Ks</div><button onClick={()=>removeFromCart(item.id)} className="text-rose-400"><Trash2 size={14}/></button></div>
                  </div>
                </div>
              ))}

              <div className="flex gap-1.5 items-end text-[10px]"><div className="flex-1"><label className="text-[9px] text-slate-500">Global Disc</label><input value={globalDiscountAmt} onChange={e=>setGlobalDiscountAmt(e.target.value)} placeholder="0" className="w-full bg-black/40 border border-amber-500/20 rounded-md px-2 py-1.5 text-amber-400"/></div><button onClick={()=>setGlobalDiscountType('%')} className={`px-2 py-1.5 rounded text-[10px] font-bold ${globalDiscountType==='%'?'bg-amber-600 text-white':'bg-black/40 text-slate-400'}`}>%</button><button onClick={()=>setGlobalDiscountType('flat')} className={`px-2 py-1.5 rounded text-[10px] font-bold ${globalDiscountType==='flat'?'bg-amber-600 text-white':'bg-black/40 text-slate-400'}`}>Ks</button></div>
              <div className="bg-black/50 border border-cyan-500/20 rounded-lg p-2 space-y-1 text-[10px]"><div className="flex justify-between"><span>Subtotal</span><span>{fmt(cartTotals.subtotal)} Ks</span></div>{(cartTotals.itemDiscounts+cartTotals.globalDisc)>0 && <div className="flex justify-between text-amber-400"><span>Discount</span><span>-{fmt(cartTotals.itemDiscounts+cartTotals.globalDisc)} Ks</span></div>}<div className="flex justify-between text-sm font-black text-cyan-300 border-t border-cyan-500/20 pt-1.5"><span>TOTAL</span><span>{fmt(cartTotals.total)} Ks</span></div></div>
              <div className="grid grid-cols-4 gap-1">{['Cash','Kpay','Wave','AYAPay'].map(m => (<button key={m} onClick={()=>setPaymentMethod(m)} className={`py-1.5 rounded-md text-[9px] font-bold border ${paymentMethod===m?'bg-cyan-600 border-cyan-400 text-white':'bg-black/40 border-white/5 text-slate-400'}`}>{m}</button>))}</div>
              <div className="relative"><Wallet className="absolute left-2.5 top-1.5 text-emerald-400" size={12}/><input value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} placeholder="Paid (empty=full)" className="w-full bg-black/40 border border-emerald-500/20 rounded-md pl-8 pr-2 py-1.5 text-[10px] text-emerald-300"/></div>
              <button onClick={submitTransaction} disabled={loading} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-black flex items-center justify-center gap-1.5">{loading ? <><Loader2 className="animate-spin"/> Processing...</> : <><ShoppingCart size={14}/> Complete {entryTab === 'Sale' ? 'Sale' : 'Purchase'}</>}</button>
            </div>
          )}
        </>
      )}

      {showScanner && <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-[#0d1120] border border-cyan-500/20 rounded-3xl p-6"><div className="flex justify-between mb-5"><h2 className="text-xl font-black"><ScanBarcode className="inline text-cyan-400"/> Scanner</h2><button onClick={()=>setShowScanner(false)}><X/></button></div><div id="barcode-reader" className="overflow-hidden rounded-2xl"/></div></div>}
      {receiptModal.show && <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 max-h-[90vh] overflow-y-auto"><div className="text-center border-b border-dashed pb-4"><h2 className="text-xl font-black">{shopName}</h2><p className="text-xs text-gray-500">📞 {shopPhone}</p><p className="text-xs text-gray-500">📍 {shopAddress}</p><p className="text-xs text-gray-500 mt-2">{receiptModal.record?.date}</p></div><div className="space-y-2 py-4 text-sm">{(receiptModal.record?.itemsDetail||[]).map((item,i)=>(<div key={i} className="flex justify-between"><span>{item.name} × {item.quantity} ({item.unitName})</span><span>{fmt((item.unitPrice*item.quantity)-(item.itemDiscountAmt||0))}</span></div>))}</div>{(receiptModal.record?.globalDiscount||0)>0 && <p className="text-right text-sm text-gray-500">Disc: -{fmt(receiptModal.record.globalDiscount)} Ks</p>}<div className="border-t pt-3 flex justify-between text-xl font-black"><span>TOTAL</span><span>{fmt(receiptModal.record?.amount)} Ks</span></div><p className="text-sm text-right mt-1">Paid: {fmt(receiptModal.record?.paidAmount||0)} Ks | Debt: {fmt(receiptModal.record?.remainingDebt||0)} Ks</p><div className="grid grid-cols-2 gap-3 mt-4"><button onClick={()=>doPrint(receiptModal.record)} className="py-3 rounded-2xl bg-cyan-600 text-white font-black flex items-center gap-2"><Printer size={18}/> Print</button><button onClick={()=>setReceiptModal({show:false,record:null})} className="py-3 rounded-2xl bg-gray-200 text-black font-black">Close</button></div></div></div>}
    </div>
  );
}
