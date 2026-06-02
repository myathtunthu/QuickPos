import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  collection, doc, writeBatch, serverTimestamp, increment,
  getDoc, getDocs, query, where, orderBy, limit, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../hooks/useCart';
import useDebounce from '../hooks/useDebounce';
import {
  Calendar, User, ShoppingCart, Printer, PauseCircle, RotateCcw, X
} from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

import ProductSearch from '../components/entry/ProductSearch';
import ProductGrid from '../components/entry/ProductGrid';
import ProductDropdown from '../components/entry/ProductDropdown';
import CartSection from '../components/entry/CartSection';
import PaymentSection from '../components/entry/PaymentSection';

// ---------- Scanner Modal (High-Resolution HD Fix) ----------
const ScannerModal = ({ onClose, onScan }) => {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);
  const readerRef = useRef(null);

  useEffect(() => {
    // Barcode formats စုံလင်စွာ ဖတ်နိုင်ရန် hints သတ်မှတ်ခြင်း
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE
    ]);

    const codeReader = new BrowserMultiFormatReader(hints);
    readerRef.current = codeReader;

    // 🌟 ဖြေရှင်းချက် - ကင်မရာလိုင်းစိပ်သမျှ အပြတ်ဖတ်နိုင်ရန် HD Resolution နှင့် အနောက်ကင်မရာကို Force လုပ်ခြင်း
    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
      if (result) {
        onScan(result.text);
        codeReader.reset();
        onClose();
      }
    })
    .catch((err) => {
      console.error('Camera error:', err);
      setCameraError(true);
    });

    // Unmount ဖြစ်ချိန်တွင် ကင်မရာ Hardware Stream အား အလိုအလျောက် ပိတ်သိမ်းခြင်း
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden relative shadow-2xl">
        <div className="p-4 bg-gray-100 flex justify-between items-center text-black border-b">
          <h3 className="font-black text-gray-800">Scan Barcode</h3>
          <button type="button" onClick={onClose} className="text-red-500 hover:text-red-700 font-black text-2xl leading-none">&times;</button>
        </div>
        {cameraError ? (
          <div className="p-6 text-center text-red-500 font-bold">Camera access denied or not available.</div>
        ) : (
          <video ref={videoRef} className="w-full h-auto min-h-[250px]" autoPlay playsInline muted />
        )}
        <div className="p-4 bg-gray-100 text-center text-xs text-gray-500 font-bold">
          ကင်မရာကို Barcode သို့ ချိန်ပါ
        </div>
      </div>
    </div>
  );
};

// ---------- Main EntryPage Component ----------
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

  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonAddress, setNewPersonAddress] = useState('');

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

  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // 🌟 Bug 9 Fix: Double Click ကာကွယ်ရန် Submit Lock Ref ဆောက်ခြင်း
  const submitLock = useRef(false);

  const {
    cart, setCart, addToCart, removeCartItem, updateCartItemQty,
    updateCartItemUnit, updateCartItemPriceType, updateCartItemDiscount,
    updateCartItemPrice, clearCart, cartTotals, globalDiscountAmt,
    setGlobalDiscountAmt, globalDiscountType, setGlobalDiscountType
  } = useCart(products, entryTab);

  // 🌟 Bug 6 Fix: Barcode search နှုန်း အလွန်မြန်ဆန်စေရန် Map Lookup ဆောက်ခြင်း
  const barcodeMap = useMemo(() => {
    const map = new Map();
    if (!products || !Array.isArray(products)) return map;
    
    products.forEach(p => {
      if (p.barcode) map.set(p.barcode.trim().toLowerCase(), { product: p, unit: p.packageUnits?.[0] });
      p.packageUnits?.forEach(u => {
        if (u.barcode) map.set(u.barcode.trim().toLowerCase(), { product: p, unit: u });
        if (u.barcodes?.retail) map.set(u.barcodes.retail.trim().toLowerCase(), { product: p, unit: u });
        if (u.barcodes?.wholesale) map.set(u.barcodes.wholesale.trim().toLowerCase(), { product: p, unit: u });
      });
    });
    return map;
  }, [products]);

  // Fetch customers/suppliers
  const fetchPersons = async () => {
    if (!tenantId) return;
    try {
      const custSnap = await getDocs(query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId)));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const suppSnap = await getDocs(query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId)));
      setSuppliers(suppSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  };

  const fetchDrafts = async () => {
    if (!tenantId) return;
    try {
      const q = query(
        collection(db, 'pos_drafts'),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setDrafts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPersons(); fetchDrafts(); }, [tenantId]);

  useEffect(() => {
    setPersonSearch('');
    setSelectedPerson(null);
    setNewPersonPhone('');
    setNewPersonAddress('');
  }, [entryTab]);

  const personList = entryTab === 'Sale' ? customers : suppliers;
  const filteredPersons = personList.filter(p =>
    p.name.toLowerCase().includes(personSearch.toLowerCase()) ||
    p.phone?.includes(personSearch)
  );

  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);

  // 🌟 Bug 4 Fix: Dropdown Crash ကာကွယ်ရန် products.length စစ်ဆေးခြင်း
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selCategory !== 'All') result = result.filter(p => p.category === selCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => {
        const hasBarcode = p.packageUnits?.some(u =>
          u.barcodes?.retail?.toLowerCase().includes(q) || u.barcodes?.wholesale?.toLowerCase().includes(q) || u.barcode?.toLowerCase().includes(q)
        );
        return (p.name || '').toLowerCase().includes(q) || hasBarcode;
      });
    }
    return result;
  }, [products, debouncedSearch, selCategory]);

  const handleSelectProduct = useCallback((product) => {
    const defaultUnit = product.packageUnits?.find(u => Number(u.multiplier) === 1) || product.packageUnits?.[0] || { name: 'ခု', multiplier: 1, prices: { retail: 0 } };
    const response = addToCart(product, defaultUnit, 'retail', 1);
    if (response.success) setProdSearch('');
    else alert(response.message);
  }, [addToCart]);

  const handleTabChange = (tab) => {
    if (cart.length > 0 && !window.confirm("Cart ထဲတွင် ပစ္စည်းများရှိနေပါသည်။ ဖယ်ရှားပြီး Tab အသစ်သို့ကူးပြောင်းမည်မှာ သေချာပါသလား?")) return;
    setEntryTab(tab);
    clearCart();
  };

  // ---------- Hold Invoice (Save Draft) ----------
  const handleHoldInvoice = async () => {
    if (cart.length === 0) return;
    
    // 🌟 Bug 5 Fix: Qty အလွတ် ဖြစ်နေလျှင် Hold ခွင့်မပြုပါ
    const hasInvalidQty = cart.some(x => x.quantity === '' || Number(x.quantity) <= 0);
    if (hasInvalidQty) {
      alert("အမှား: Cart ထဲရှိ ပစ္စည်းအရေအတွက်များအား သေချာစွာ ထည့်သွင်းပေးပါ (အလွတ် သို့မဟုတ် သုည ဖြစ်နေ၍ မရပါ)။");
      return;
    }

    const name = prompt("ခဏဆိုင်းထားမည့် ဘေလ်အတွက် မှတ်သားရန်အမည် (ဥပမာ - စားပွဲ ၃):", personSearch || "");
    if (name === null) return;

    setLoading(true);
    try {
      const draftRef = doc(collection(db, 'pos_drafts'));
      const sanitizedCart = cart.map(item => ({
        id: item.id,
        productId: item.productId || null,
        productSnapshot: products.find(p => p.id === item.productId) || null,
        unitName: item.unitName || '',
        multiplier: Number(item.multiplier) || 1,
        priceType: item.priceType || 'retail',
        unitPrice: Number(item.unitPrice) || 0,
        quantity: Number(item.quantity) || 1,
        baseQuantity: Number(item.baseQuantity) || Number(item.quantity) || 1,
        itemDiscountAmt: Number(item.itemDiscountAmt) || 0,
        notes: item.notes || ''
      }));

      await setDoc(draftRef, {
        tenantId: tenantId || '',
        draftName: name || 'No Name',
        type: entryTab || 'Sale',
        cart: sanitizedCart,
        cartTotals: {
          subtotal: Number(cartTotals.subtotal) || 0,
          itemDiscounts: Number(cartTotals.itemDiscounts) || 0,
          globalDisc: Number(cartTotals.globalDisc) || 0,
          total: Number(cartTotals.total) || 0
        },
        personSearch: personSearch || '',
        selectedPerson: selectedPerson || null,
        newPersonPhone: newPersonPhone || '',
        newPersonAddress: newPersonAddress || '',
        globalDiscountAmt: globalDiscountAmt || '',
        globalDiscountType: globalDiscountType || '%',
        paymentMethod: paymentMethod || 'Cash',
        paidAmount: paidAmount || '',
        createdAt: serverTimestamp()
      });
      alert("ဘေလ်ကို ခဏဆိုင်းထားလိုက်ပါပြီ။");
      clearCart(); setPersonSearch(''); setSelectedPerson(null);
      setNewPersonPhone(''); setNewPersonAddress('');
      fetchDrafts();
    } catch (err) {
      console.error(err);
      alert("Error saving draft: " + err.message);
    }
    setLoading(false);
  };

  // ---------- Restore Draft (Bug 2 Fix) ----------
  const restoreDraft = async (draft) => {
    if (cart.length > 0 && !window.confirm("လက်ရှိ cart ကို ဖျက်ပြီး draft ကို ပြန်ယူမှာ သေချာပါသလား?")) return;

    clearCart();
    setEntryTab(draft.type || 'Sale');
    setPersonSearch(draft.personSearch || '');
    setSelectedPerson(draft.selectedPerson || null);
    setNewPersonPhone(draft.newPersonPhone || '');
    setNewPersonAddress(draft.newPersonAddress || '');
    setGlobalDiscountAmt(draft.globalDiscountAmt || '');
    setGlobalDiscountType(draft.globalDiscountType || '%');
    setPaymentMethod(draft.paymentMethod || 'Cash');
    setPaidAmount(draft.paidAmount || '');

    // 🌟 Bug 2 Fix: ပြင်ဆင်ထားသည့် စျေးနှုန်းများနှင့် row discount များ အတိအကျ ပေါ်လာစေရန် setCart ကို တိုက်ရိုက်သုံးသည်
    if (draft.cart && Array.isArray(draft.cart)) {
      setCart(draft.cart.map(item => ({
        ...item,
        id: item.id || Date.now() + Math.random()
      })));
    }

    try {
      await deleteDoc(doc(db, 'pos_drafts', draft.id));
      fetchDrafts();
      setShowDrafts(false);
      alert("ဘေလ်မှတ်တမ်းအား ပြန်လည်ရယူပြီးပါပြီ။");
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDraft = async (id) => {
    if (window.confirm('Draft ကိုဖျက်မှာ သေချာပါသလား?')) {
      await deleteDoc(doc(db, 'pos_drafts', id));
      fetchDrafts();
    }
  };

  const submitExpense = async () => {
    // 🌟 Bug 9 Fix: Double Click ကာကွယ်ခြင်း Lock စစ်ဆေးချက်
    if (submitLock.current) return;
    if (!expenseTitle || !expenseAmt || !tenantId) return;

    submitLock.current = true;
    setLoading(true);
    try {
      const counterRef = doc(db, 'pos_counters', tenantId || 'default');
      const counterSnap = await getDoc(counterRef);
      const nextCount = (counterSnap.exists() ? (counterSnap.data().expenseCount || 0) : 0) + 1;
      const voucherNo = `Expense ${String(nextCount).padStart(5, '0')}`;

      const batch = writeBatch(db);
      const ref = doc(collection(db, 'pos_records'));

      batch.set(ref, {
        type: 'Expense', tenantId, item: expenseTitle, amount: Number(expenseAmt) || 0,
        date: entryDate,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cashier: cashierName, voucherNo: voucherNo, createdAt: serverTimestamp()
      });

      if (counterSnap.exists()) {
        batch.update(counterRef, { expenseCount: increment(1) });
      } else {
        batch.set(counterRef, { expenseCount: 1 });
      }
      await batch.commit();
      setExpenseTitle(''); setExpenseAmt('');
      alert("Expense Saved!");
    } catch (err) { console.error(err); alert("Error saving expense"); }
    
    submitLock.current = false;
    setLoading(false);
  };

  const submitTransaction = async () => {
    // 🌟 Bug 9 Fix: Double Click တားဆီးရန် ထိပ်ဆုံးမှ Lock ချခြင်း
    if (submitLock.current) return;
    if (cart.length === 0 || !tenantId) return;

    // 🌟 Bug 5 Fix: Qty အလွတ် ဖြစ်နေလျှင် သိမ်းခွင့်မပြုပါ
    const invalidItem = cart.find(item => item.quantity === '' || Number(item.quantity) <= 0);
    if (invalidItem) return alert(`အမှား: "${invalidItem.name}" ၏ အရေအတွက် အလွတ် သို့မဟုတ် မှားယွင်းနေပါသည်။`);

    const total = Number(cartTotals.total) || 0;
    const paid = paidAmount === '' ? total : Number(paidAmount) || 0;
    const remainingDebt = Math.max(0, total - paid);
    const changeAmount = Math.max(0, paid - total);

    let personIdForRecord = selectedPerson?.id || null;
    let personNameForRecord = selectedPerson?.name || personSearch.trim();

    if (!personNameForRecord) {
      personNameForRecord = entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier';
    }

    if (remainingDebt > 0 && personNameForRecord === (entryTab === 'Sale' ? 'Walk-in' : 'Unknown Supplier')) {
      alert(`အကြွေး (Credit) ဖြင့် ${entryTab === 'Sale' ? 'ရောင်းချပါက' : 'ဝယ်ယူပါက'} အမည်ကို မဖြစ်မနေ ထည့်သွင်းပေးပါ။`);
      return;
    }

    if (entryTab === 'Sale') {
      for (const item of cart) {
        const prodData = products.find(p => p.id === item.productId);
        const currentStockBase = Number(prodData?.stockBase) || Number(prodData?.stock) || 0;
        if (item.baseQuantity > currentStockBase) return alert(`${item.name} အတွက် Stock မလုံလောက်ပါ။ (လက်ကျန်: ${currentStockBase})`);
      }
    }

    submitLock.current = true;
    setLoading(true);
    try {
      const batch = writeBatch(db);

      if (personNameForRecord !== 'Walk-in' && personNameForRecord !== 'Unknown Supplier' && !personIdForRecord) {
        const collectionName = entryTab === 'Sale' ? 'pos_customers' : 'pos_suppliers';
        const newPersonRef = doc(collection(db, collectionName));
        personIdForRecord = newPersonRef.id;
        batch.set(newPersonRef, {
          tenantId: tenantId,
          name: personNameForRecord,
          phone: newPersonPhone.trim(),
          address: newPersonAddress.trim(),
          totalDebt: remainingDebt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (personIdForRecord && remainingDebt > 0) {
        const collectionName = entryTab === 'Sale' ? 'pos_customers' : 'pos_suppliers';
        const personRef = doc(db, collectionName, personIdForRecord);
        batch.update(personRef, { totalDebt: increment(remainingDebt) });
      }

      const counterRef = doc(db, 'pos_counters', tenantId || 'default');
      const counterSnap = await getDoc(counterRef);
      const countField = `${entryTab.toLowerCase()}Count`;
      const nextCount = (counterSnap.exists() ? (counterSnap.data()[countField] || 0) : 0) + 1;
      const voucherNo = `${entryTab} ${String(nextCount).padStart(5, '0')}`;

      const ref = doc(collection(db, 'pos_records'));
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const record = {
        id: ref.id, type: entryTab || 'Sale', tenantId,
        personName: personNameForRecord,
        customerId: entryTab === 'Sale' ? personIdForRecord : null,
        supplierId: entryTab === 'Purchase' ? personIdForRecord : null,
        cashier: cashierName, time: currentTime, voucherNo: voucherNo,
        itemsDetail: cart.map(i => ({
          productId: i.productId || '', name: i.name || 'Unknown Item', quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice) || 0, itemDiscountAmt: Number(i.itemDiscountAmt) || 0,
          unitName: i.unitName || 'ခု', multiplier: Number(i.multiplier) || 1, priceType: i.priceType || 'retail',
          baseQuantity: Number(i.baseQuantity) || Number(i.quantity) || 1
        })),
        amount: total, subtotal: Number(cartTotals.subtotal) || 0, itemDiscount: Number(cartTotals.itemDiscounts) || 0,
        globalDiscount: Number(cartTotals.globalDisc) || 0, paymentMethod: paymentMethod || 'Cash',
        paidAmount: paid, remainingDebt: remainingDebt, changeAmount: changeAmount,
        date: entryDate || todayISO, createdAt: serverTimestamp()
      };
      batch.set(ref, record);

      cart.forEach(item => {
        if (!item.productId) return;
        const itemBaseQty = Number(item.baseQuantity) || Number(item.quantity) || 0;
        const stockChange = entryTab === 'Sale' ? -Math.abs(itemBaseQty) : Math.abs(itemBaseQty);
        const prodRef = doc(db, 'pos_products', item.productId);
        batch.update(prodRef, { stockBase: increment(stockChange), stock: increment(stockChange) });
      });

      if (counterSnap.exists()) {
        batch.update(counterRef, { [countField]: increment(1) });
      } else {
        batch.set(counterRef, { [countField]: 1 });
      }

      await batch.commit();

      setReceiptModal({ show: true, record });
      clearCart(); setPersonSearch(''); setSelectedPerson(null);
      setNewPersonPhone(''); setNewPersonAddress('');
      setPaidAmount(''); setPaymentMethod('Cash');

      fetchPersons();
    } catch (err) { console.error("Firebase Save Error: ", err); alert("Error saving transaction!"); }
    
    submitLock.current = false;
    setLoading(false);
  };

  const doPrint = () => { window.print(); };

  // 🌟 Bug 6 Fix: Map Lookups အသုံးပြု၍ Barcode အား Instant ရှာဖွေခြင်း
  const handleBarcodeScanned = (text) => {
    const cleanText = text.trim().toLowerCase();
    const match = barcodeMap.get(cleanText);

    if (match) {
      const { product, unit } = match;
      const res = addToCart(product, unit, 'retail', 1);
      if (!res.success) alert(res.message);
      else {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
      }
    } else {
      alert(`Barcode (${text}) ဖြင့် ပစ္စည်းရှာမတွေ့ပါ။`);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 10px; }
          @page { margin: 0; }
        }
      `}</style>

      {showScanner && (
        <ScannerModal
          onClose={() => setShowScanner(false)}
          onScan={handleBarcodeScanned}
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
            <button key={tab} onClick={() => handleTabChange(tab)}
              className={`py-2 rounded-lg font-black text-xs transition-all ${entryTab === tab ? 'bg-cyan-600 shadow-md shadow-cyan-900/40 text-white' : 'text-slate-500 hover:text-white'}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={async () => { await fetchDrafts(); setShowDrafts(!showDrafts); }}
            className="text-xs bg-indigo-900/40 text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-800/40 flex items-center gap-1 border border-indigo-500/20"
          >
            <RotateCcw size={14}/> {showDrafts ? 'Close Drafts' : `Saved Drafts (${drafts.length})`}
          </button>
        </div>

        {showDrafts && (
          <div className="bg-[#0d1120] border border-indigo-500/20 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
            <h3 className="text-xs font-bold text-indigo-400 mb-2">Saved Hold Invoices</h3>
            {drafts.length === 0 && <p className="text-slate-500 text-xs">No saved drafts.</p>}
            {drafts.map(d => (
              <div key={d.id} className="flex justify-between items-center bg-black/30 p-2 rounded-lg border border-white/5">
                <div>
                  <p className="text-sm font-bold text-white">{d.draftName}</p>
                  {/* 🌟 Bug 8 Fix: Conditional Accessing သုံး၍ Server Timestamp render crash ကာကွယ်ခြင်း */}
                  <p className="text-[10px] text-slate-400">{d.type} | {d.cart?.length || 0} items | {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : 'Loading...'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => restoreDraft(d)} className="px-3 py-1 bg-cyan-600 rounded text-xs font-bold text-white">Restore</button>
                  <button onClick={() => deleteDraft(d.id)} className="px-2 py-1 bg-red-600 rounded text-xs text-white"><X size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {entryTab === 'Expense' ? (
          <div className="bg-[#0d1120] border border-amber-500/20 rounded-xl p-4 space-y-3">
            <h2 className="text-amber-400 font-bold text-sm mb-2">Record Expense</h2>
            <input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="Expense Title (e.g. မီတာခ)" className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
            <input type="number" value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)} placeholder="Amount (Ks)" className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-amber-400" />
            <button onClick={submitExpense} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 font-black text-sm active:scale-95 transition-transform">{loading ? 'Saving...' : 'Save Expense'}</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative z-20 space-y-2">
              <div className="relative">
                <User className={`absolute left-3 top-3.5 ${selectedPerson ? 'text-green-400' : 'text-cyan-500'}`} size={16}/>
                <input
                  value={personSearch}
                  onChange={e => { setPersonSearch(e.target.value); setSelectedPerson(null); setShowPersonDropdown(true); }}
                  onFocus={() => setShowPersonDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPersonDropdown(false), 200)}
                  placeholder={entryTab === 'Sale' ? "Customer အမည် ရှာဖွေပါ (သို့) အသစ်ရိုက်ထည့်ပါ" : "Supplier အမည် ရှာဖွေပါ (သို့) အသစ်ရိုက်ထည့်ပါ"}
                  className={`w-full bg-black/40 border rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none transition-colors ${selectedPerson ? 'border-green-500/50' : 'border-cyan-500/20 focus:border-cyan-400'}`}
                />
                {showPersonDropdown && personSearch.length > 0 && filteredPersons.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-slate-900 border border-cyan-500/30 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar z-50">
                    {filteredPersons.map(p => (
                      <div
                        key={p.id}
                        onMouseDown={() => {
                          setSelectedPerson(p);
                          setPersonSearch(p.name);
                          setShowPersonDropdown(false);
                          setNewPersonPhone('');
                          setNewPersonAddress('');
                        }}
                        className="px-4 py-2.5 hover:bg-cyan-600/30 cursor-pointer border-b border-white/5 last:border-0"
                      >
                        <p className="text-sm font-bold text-white">{p.name}</p>
                        {p.phone && <p className="text-[10px] text-cyan-400">{p.phone}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!selectedPerson && personSearch.trim().length > 0 && (
                <div className="p-3 bg-green-900/10 rounded-xl border border-green-500/20 shadow-inner">
                  <p className="text-[11px] font-bold text-green-400 mb-2">
                    <span className="text-white">"{personSearch}"</span> အား စာရင်းအသစ်အဖြစ် မှတ်သားမည်
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} placeholder="ဖုန်းနံပါတ် (မထည့်လည်းရသည်)" className="w-full sm:w-1/2 bg-black/40 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-400 transition-colors" />
                    <input value={newPersonAddress} onChange={e => setNewPersonAddress(e.target.value)} placeholder="လိပ်စာ (မထည့်လည်းရသည်)" className="w-full sm:w-1/2 bg-black/40 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-400 transition-colors" />
                  </div>
                </div>
              )}
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
              <div className="flex justify-between items-center mb-2 pl-1 pr-1">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Order</h2>
                <button onClick={handleHoldInvoice} disabled={cart.length === 0}
                  className={`text-[10px] px-3 py-1.5 rounded font-bold transition-colors flex items-center gap-1 ${cart.length === 0 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40'}`}
                >
                  <PauseCircle size={12}/> Pause / Hold
                </button>
              </div>

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
                      <input type="number" value={globalDiscountAmt} onChange={e => setGlobalDiscountAmt(e.target.value)} placeholder="0" className="w-16 bg-black/50 border border-amber-500/30 rounded px-1.5 py-1 text-right outline-none focus:border-amber-400 text-amber-400" />
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
              <PaymentSection
                paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                paidAmount={paidAmount} setPaidAmount={setPaidAmount}
                submitTransaction={submitTransaction} loading={loading}
                entryTab={entryTab}
              />
            )}
          </div>
        )}

        {receiptModal.show && receiptModal.record && (
          <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
            <div className="w-full max-w-sm bg-white text-black rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">{shopName}</h2>
                <p className="text-xs text-gray-500 mt-1">{shopAddress}</p>
                <p className="text-xs text-gray-500">Tel: {shopPhone}</p>
              </div>
              <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
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
                   <span>Paid ({receiptModal.record.paymentMethod}):</span>
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

      {receiptModal.show && receiptModal.record && (
         <div id="receipt-print-area" className="hidden print:block bg-white text-black font-sans text-[12px] leading-tight">
             <div className="text-center mb-3">
                 <h2 className="text-[18px] font-bold uppercase m-0">{shopName}</h2>
                 <p className="m-0 mt-1">{shopAddress}</p>
                 <p className="m-0">Tel: {shopPhone}</p>
             </div>
             <div className="border-t border-b border-dashed border-black py-2 mb-3 space-y-1">
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
