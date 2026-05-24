import { useState, useRef, useEffect, startTransition } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Boxes, Search, Plus, Save, Trash2, Edit3, ScanBarcode, Send, X } from 'lucide-react';

export default function InventoryPage({ products = [] }) {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false);

  const [form, setForm] = useState({ 
    name: '', category: '', barcode: '', 
    costPrice: '', 
    retailPrice: '',
    wholesalePrice: '',
    staffPrice: '',
    specialPrice: '',
    minStock: '5', 
    unit: 'ခု',
    packUnitName: 'ဗူး',
    packQty: '',
    bundleUnitName: 'တွဲ',
    bundleQty: '',
    customUnitName: '',
    customQty: '',
  });

  const fmt = n => (Number(n) || 0).toLocaleString();

  // ─── BEEP ───
  const playBeep = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type === 'success' ? 'sine' : 'square'; 
      osc.frequency.setValueAtTime(type === 'success' ? 880 : 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  // ─── SCANNER ───
  useEffect(() => {
    if (!showScanner) return;
    let html5QrCode;
    const startScanner = async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("product-barcode-reader"); 
        scannerRef.current = html5QrCode;
        await html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: { width: 250, height: 250 } },
          (decodedText) => { 
            setForm(prev => ({ ...prev, barcode: decodedText.trim() }));
            playBeep('success');
            (async () => { 
              if (isStopping.current) return; 
              isStopping.current = true; 
              if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } 
              isStopping.current = false; 
              setShowScanner(false); 
            })(); 
          }, () => {}
        );
      } catch (err) { alert('Camera access denied'); setShowScanner(false); }
    };
    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/html5-qrcode";
      script.onload = startScanner;
      document.body.appendChild(script);
    } else { startScanner(); }
    return () => { isStopping.current = true; if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, [showScanner]);

  // ─── RESET FORM ───
  const resetForm = () => setForm({ 
    name: '', category: '', barcode: '', 
    costPrice: '', retailPrice: '', wholesalePrice: '', staffPrice: '', specialPrice: '',
    minStock: '5', unit: 'ခု',
    packUnitName: 'ဗူး', packQty: '',
    bundleUnitName: 'တွဲ', bundleQty: '',
    customUnitName: '', customQty: '',
  });

  // ─── SAVE PRODUCT ───
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!form.name || !form.retailPrice || !form.costPrice) return alert("အချက်အလက်များ ပြည့်စုံအောင် ထည့်ပါ။");
    if (!profile?.tenantId) { alert("No tenant ID found."); return; }

    const payload = { 
      name: form.name, category: form.category || 'General', barcode: form.barcode, 
      costPrice: Number(form.costPrice), 
      retailPrice: Number(form.retailPrice),
      wholesalePrice: Number(form.wholesalePrice) || Number(form.retailPrice),
      staffPrice: Number(form.staffPrice) || Number(form.retailPrice),
      specialPrice: Number(form.specialPrice) || Number(form.retailPrice),
      minStock: Number(form.minStock) || 5, unit: form.unit || 'ခု',
      packUnitName: form.packUnitName || 'ဗူး', packQty: Number(form.packQty) || 0,
      bundleUnitName: form.bundleUnitName || 'တွဲ', bundleQty: Number(form.bundleQty) || 0,
      customUnitName: form.customUnitName || '', customQty: Number(form.customQty) || 0,
    };

    try {
      if (editing) {
        await setDoc(doc(db, 'pos_products', editing.id), payload, { merge: true });
        alert("Product updated!"); setEditing(null);
      } else {
        await addDoc(collection(db, 'pos_products'), { ...payload, tenantId: profile.tenantId, stock: 0, createdAt: Date.now() });
        alert("Product added!"); setAdding(false);
      }
      resetForm();
    } catch (error) { alert("Error: " + error.message); }
  };

  // ─── EDIT ───
  const startEdit = (p) => {
    setEditing(p); setAdding(false);
    setForm({ 
      name: p.name || '', category: p.category || '', barcode: p.barcode || '', 
      costPrice: String(p.costPrice || ''), retailPrice: String(p.retailPrice || p.price || ''), 
      wholesalePrice: String(p.wholesalePrice || ''), staffPrice: String(p.staffPrice || ''), 
      specialPrice: String(p.specialPrice || ''), minStock: String(p.minStock || '5'), 
      unit: p.unit || 'ခု',
      packUnitName: p.packUnitName || 'ဗူး', packQty: String(p.packQty || ''),
      bundleUnitName: p.bundleUnitName || 'တွဲ', bundleQty: String(p.bundleQty || ''),
      customUnitName: p.customUnitName || '', customQty: String(p.customQty || ''),
    });
  };

  const cancelEdit = () => { setEditing(null); setAdding(false); resetForm(); };

  // ─── UPDATE STOCK ───
  const updateStock = async (id, newStock, oldStock) => {
    const s = Number(newStock);
    if (s !== oldStock && !isNaN(s)) {
      await setDoc(doc(db, 'pos_products', id), { stock: s }, { merge: true });
    }
  };

  // ─── FILTER ───
  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode || '').includes(searchTerm)
  );

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/15 shadow-xl gap-5">
        <h3 className="font-black text-2xl flex items-center gap-3"><Boxes className="text-cyan-500"/> Inventory</h3>
        <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={20} className="absolute left-4 top-3.5 text-slate-500" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border-2 border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400" />
          </div>
          <button onClick={() => { setAdding(!adding); setEditing(null); }} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> Add Item</button>
        </div>
      </div>

      {/* ADD / EDIT FORM */}
      {(adding || editing) && (
        <form onSubmit={handleSaveProduct} className="bg-[#0d1120] p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/20 shadow-xl space-y-5">
          <p className="text-sm font-black text-cyan-400 uppercase">{editing ? 'Edit Product' : 'New Product'}</p>
          
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Product Name" className="bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none" />
            <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Category" className="bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none" />
            <div className="flex gap-2">
              <input value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} placeholder="Barcode" className="flex-1 bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none" />
              <button type="button" onClick={()=>setShowScanner(true)} className="px-4 bg-blue-600/20 border border-blue-500/40 rounded-lg text-blue-400"><ScanBarcode size={20}/></button>
            </div>
            <div className="flex gap-2">
              <input type="number" required value={form.costPrice} onChange={e=>setForm({...form,costPrice:e.target.value})} placeholder="Cost Price" className="flex-1 bg-black border border-blue-500/15 p-3 rounded-lg text-blue-300 outline-none" />
              <input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="Unit" className="w-20 bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none" />
            </div>
          </div>

          {/* ✅ Price 4 Types */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs text-slate-500 mb-3 font-bold uppercase">💰 Price Options (၄ မျိုး)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">လက်လီစျေး *</label>
                <input type="number" required value={form.retailPrice} onChange={e=>setForm({...form,retailPrice:e.target.value})} placeholder="Retail" className="w-full bg-black border border-cyan-500/15 p-3 rounded-lg text-cyan-300 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">လက်ကားစျေး</label>
                <input type="number" value={form.wholesalePrice} onChange={e=>setForm({...form,wholesalePrice:e.target.value})} placeholder="Wholesale" className="w-full bg-black border border-amber-500/15 p-3 rounded-lg text-amber-300 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Staff စျေး</label>
                <input type="number" value={form.staffPrice} onChange={e=>setForm({...form,staffPrice:e.target.value})} placeholder="Staff" className="w-full bg-black border border-blue-500/15 p-3 rounded-lg text-blue-300 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">အထူးစျေး</label>
                <input type="number" value={form.specialPrice} onChange={e=>setForm({...form,specialPrice:e.target.value})} placeholder="Special" className="w-full bg-black border border-purple-500/15 p-3 rounded-lg text-purple-300 outline-none" />
              </div>
            </div>
          </div>

          {/* ✅ Dynamic Packing Options */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-xs text-slate-500 mb-3 font-bold uppercase">📦 Packing Options (ကိုယ်တိုင်ရိုက်ထည့်ပါ)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pack */}
              <div>
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  <input type="text" value={form.packUnitName} onChange={e => setForm({...form, packUnitName: e.target.value})} placeholder="Unit" className="w-16 bg-transparent border-b border-slate-500 text-white text-xs outline-none" />
                  တစ်<span className="text-cyan-400">{form.packUnitName || 'ဗူး'}</span> = 
                </label>
                <input type="number" value={form.packQty} onChange={e => setForm({...form, packQty: e.target.value})} placeholder="Qty (e.g. 6)" className="w-full bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none mt-1" />
              </div>
              {/* Bundle */}
              <div>
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  <input type="text" value={form.bundleUnitName} onChange={e => setForm({...form, bundleUnitName: e.target.value})} placeholder="Unit" className="w-16 bg-transparent border-b border-slate-500 text-white text-xs outline-none" />
                  တစ်<span className="text-cyan-400">{form.bundleUnitName || 'တွဲ'}</span> = 
                </label>
                <input type="number" value={form.bundleQty} onChange={e => setForm({...form, bundleQty: e.target.value})} placeholder="Qty (e.g. 12)" className="w-full bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none mt-1" />
              </div>
              {/* Custom */}
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  <input type="text" value={form.customUnitName} onChange={e => setForm({...form, customUnitName: e.target.value})} placeholder="Unit Name" className="w-24 bg-transparent border-b border-slate-500 text-white text-xs outline-none" />
                  တစ်<span className="text-cyan-400">{form.customUnitName || '___'}</span> = 
                </label>
                <input type="number" value={form.customQty} onChange={e => setForm({...form, customQty: e.target.value})} placeholder="Qty (Optional)" className="w-full bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none mt-1" />
              </div>
            </div>
          </div>

          {/* Min Stock */}
          <div>
            <label className="text-xs text-slate-500">Min Stock Alert</label>
            <input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} placeholder="5" className="w-full bg-black border border-amber-500/15 p-3 rounded-lg text-amber-300 outline-none" />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-cyan-600 text-white p-4 rounded-xl font-black flex items-center justify-center gap-2"><Save size={20}/> Save</button>
            <button type="button" onClick={cancelEdit} className="px-8 bg-slate-800 text-slate-400 rounded-xl font-black">Cancel</button>
          </div>
        </form>
      )}

      {/* PRODUCT LIST */}
      <div className="space-y-3">
        {filteredProducts.length === 0 && <p className="text-center text-slate-500 py-14">No products found.</p>}
        {filteredProducts.map(p => {
          const isLowStock = (Number(p.stock) || 0) <= (Number(p.minStock) || 5);
          return (
            <div key={p.id} className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isLowStock ? 'bg-amber-950/20 border-amber-500/30' : 'bg-[#0d1120] border-white/5'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="font-black text-white text-xl">{p.name}</p>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded">{p.category || 'General'}</span>
                  {isLowStock && <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded">Low Stock</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                  <span className="text-blue-400">Cost: {fmt(p.costPrice)}</span>
                  <span className="text-cyan-400">Retail: {fmt(p.retailPrice || p.price)}</span>
                  {p.wholesalePrice > 0 && <span className="text-amber-400">Wholesale: {fmt(p.wholesalePrice)}</span>}
                  {p.staffPrice > 0 && <span className="text-blue-300">Staff: {fmt(p.staffPrice)}</span>}
                  {p.specialPrice > 0 && <span className="text-purple-300">Special: {fmt(p.specialPrice)}</span>}
                </div>
                {/* Show Packing Info */}
                {(p.packQty > 0 || p.bundleQty > 0 || p.customQty > 0) && (
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                    {p.packQty > 0 && <span>📦 1 {p.packUnitName||'ဗူး'} = {p.packQty} ခု</span>}
                    {p.bundleQty > 0 && <span>📦 1 {p.bundleUnitName||'တွဲ'} = {p.bundleQty} ခု</span>}
                    {p.customQty > 0 && p.customUnitName && <span>📦 1 {p.customUnitName} = {p.customQty} ခု</span>}
                  </div>
                )}
                {p.barcode && <p className="text-xs font-mono text-slate-600 mt-1">BC: {p.barcode}</p>}
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-500">Stock</span>
                  <input type="number" defaultValue={p.stock || 0} onBlur={e => updateStock(p.id, e.target.value, p.stock || 0)} className={`w-24 text-center font-black text-xl px-2 py-3 rounded-lg outline-none border ${isLowStock ? 'bg-amber-950/40 border-amber-500/50 text-amber-300' : 'bg-black/50 border-cyan-500/30 text-cyan-300'}`} />
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>startEdit(p)} className="p-3 bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 rounded-lg"><Edit3 size={20}/></button>
                  <button onClick={()=>{ if(window.confirm('Delete?')) deleteDoc(doc(db,'pos_products',p.id)); }} className="p-3 bg-rose-950/50 border border-rose-500/20 text-rose-400 rounded-lg"><Trash2 size={20}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/30 w-full max-w-lg">
            <div className="flex justify-between mb-6"><h3 className="font-black text-white text-xl">Scan Barcode</h3><button onClick={()=>setShowScanner(false)} className="text-slate-400"><X size={24}/></button></div>
            <div id="product-barcode-reader" className="w-full rounded-2xl" style={{minHeight:'260px'}}></div>
          </div>
        </div>
      )}
    </div>
  );
}
