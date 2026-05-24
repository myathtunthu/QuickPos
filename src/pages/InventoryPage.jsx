import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Boxes, Search, Plus, Save, Trash2, Edit3, ScanBarcode, X } from 'lucide-react';

export default function InventoryPage({ products = [] }) {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false);

  const [form, setForm] = useState({
    name: '', category: '', baseUnit: 'Bottle',
    packageUnits: [
      { name: 'Bottle', multiplier: 1, barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' },
    ],
    minStock: '5',
  });

  const fmt = n => (Number(n) || 0).toLocaleString();

  // Unit Breakdown Helper
  const getUnitBreakdown = (stock, packageUnits) => {
    if (!packageUnits || packageUnits.length === 0) return [];
    const sorted = [...packageUnits].sort((a, b) => b.multiplier - a.multiplier);
    let remain = stock;
    return sorted.map(unit => ({
      unit: unit.name,
      qty: Math.floor(remain / unit.multiplier),
    }));
  };

  const playBeep = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type === 'success' ? 'sine' : 'square';
      osc.frequency.setValueAtTime(type === 'success' ? 880 : 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  useEffect(() => {
    if (!showScanner) return;
    let html5QrCode;
    const startScanner = async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(()=>{}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("product-barcode-reader"); scannerRef.current = html5QrCode;
        await html5QrCode.start({ facingMode: "environment" }, { fps: 20, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setForm(prev => {
              const newUnits = prev.packageUnits.map(u => ({ ...u, barcodes: { ...u.barcodes, retail: u.barcodes.retail || decodedText } }));
              return { ...prev, packageUnits: newUnits };
            });
            playBeep('success');
            (async () => { if (isStopping.current) return; isStopping.current = true; if (scannerRef.current) { await scannerRef.current.stop().catch(()=>{}); scannerRef.current = null; } isStopping.current = false; setShowScanner(false); })();
          }, () => {}
        );
      } catch (err) { alert('Camera access denied'); setShowScanner(false); }
    };
    if (!window.Html5Qrcode) { const script = document.createElement('script'); script.src = "https://unpkg.com/html5-qrcode"; script.onload = startScanner; document.body.appendChild(script); }
    else { startScanner(); }
    return () => { isStopping.current = true; if (scannerRef.current) scannerRef.current.stop().catch(()=>{}); };
  }, [showScanner]);

  // ✅ Dynamic Unit Functions
  const addPackageUnit = () => {
    setForm(prev => ({
      ...prev,
      packageUnits: [...prev.packageUnits, { name: '', multiplier: '', barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' }]
    }));
  };

  const removePackageUnit = (index) => {
    setForm(prev => ({
      ...prev,
      packageUnits: prev.packageUnits.filter((_, i) => i !== index)
    }));
  };

  const resetForm = () => setForm({
    name: '', category: '', baseUnit: 'Bottle',
    packageUnits: [
      { name: 'Bottle', multiplier: 1, barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' },
    ],
    minStock: '5',
  });

  const updatePackageUnit = (index, field, value) => {
    setForm(prev => {
      const newUnits = [...prev.packageUnits];
      if (field.startsWith('prices.')) {
        const priceKey = field.split('.')[1];
        newUnits[index] = { ...newUnits[index], prices: { ...newUnits[index].prices, [priceKey]: value } };
      } else if (field.startsWith('barcodes.')) {
        const barcodeKey = field.split('.')[1];
        newUnits[index] = { ...newUnits[index], barcodes: { ...newUnits[index].barcodes, [barcodeKey]: value } };
      } else {
        newUnits[index] = { ...newUnits[index], [field]: value };
      }
      return { ...prev, packageUnits: newUnits };
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!form.name) return alert("Product Name ထည့်ပါ");
    if (!profile?.tenantId) { alert("No tenant ID found."); return; }

    const validUnits = form.packageUnits.filter(u => u.name.trim() !== '');

    const payload = {
      name: form.name, category: form.category || 'General', baseUnit: form.baseUnit,
      packageUnits: validUnits.map(u => ({
        name: u.name, multiplier: Number(u.multiplier) || 1,
        barcodes: { retail: u.barcodes.retail || '' },
        prices: { retail: Number(u.prices.retail) || 0, wholesaleA: Number(u.prices.wholesaleA) || 0, wholesaleB: Number(u.prices.wholesaleB) || 0, wholesaleC: Number(u.prices.wholesaleC) || 0 },
        costPrice: Number(u.costPrice) || 0,
      })),
      minStock: Number(form.minStock) || 5,
    };

    try {
      if (editing) { await setDoc(doc(db, 'pos_products', editing.id), payload, { merge: true }); alert("Product updated!"); setEditing(null); }
      else { await addDoc(collection(db, 'pos_products'), { ...payload, tenantId: profile.tenantId, stock: 0, createdAt: Date.now() }); alert("Product added!"); setAdding(false); }
      resetForm();
    } catch (error) { alert("Error: " + error.message); }
  };

  const startEdit = (p) => {
    setEditing(p); setAdding(false);
    setForm({
      name: p.name || '', category: p.category || '', baseUnit: p.baseUnit || 'Bottle',
      packageUnits: (p.packageUnits || [{ name: 'Bottle', multiplier: 1, barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' }]).map(u => ({
        name: u.name, multiplier: String(u.multiplier || 1),
        barcodes: { retail: u.barcodes?.retail || '' },
        prices: { retail: String(u.prices?.retail || ''), wholesaleA: String(u.prices?.wholesaleA || ''), wholesaleB: String(u.prices?.wholesaleB || ''), wholesaleC: String(u.prices?.wholesaleC || '') },
        costPrice: String(u.costPrice || ''),
      })),
      minStock: String(p.minStock || '5'),
    });
  };

  const cancelEdit = () => { setEditing(null); setAdding(false); resetForm(); };

  const updateStock = async (id, newStock) => {
    const s = Number(newStock);
    if (!isNaN(s)) { await setDoc(doc(db, 'pos_products', id), { stock: s }, { merge: true }); }
  };

  const filteredProducts = products.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/15 shadow-xl gap-5">
        <h3 className="font-black text-2xl flex items-center gap-3"><Boxes className="text-cyan-500"/> Inventory</h3>
        <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]"><Search size={20} className="absolute left-4 top-3.5 text-slate-500"/><input type="text" placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border-2 border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400"/></div>
          <button onClick={()=>{setAdding(!adding);setEditing(null);}} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={20}/> Add Item</button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(adding || editing) && (
        <form onSubmit={handleSaveProduct} className="bg-[#0d1120] p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/20 shadow-xl space-y-5">
          <p className="text-sm font-black text-cyan-400 uppercase">{editing ? 'Edit Product' : 'New Product'}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Product Name" className="bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none"/>
            <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Category" className="bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none"/>
            <input value={form.baseUnit} onChange={e=>setForm({...form,baseUnit:e.target.value})} placeholder="Base Unit" className="bg-black border border-cyan-500/15 p-3 rounded-lg text-white outline-none"/>
          </div>

          {/* ✅ Responsive Package Table */}
          <div className="border-t border-white/5 pt-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-slate-500 font-bold uppercase">📦 Package Units</p>
              <button type="button" onClick={addPackageUnit} className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-bold flex items-center gap-1"><Plus size={14}/> Add Unit</button>
            </div>

            {/* Mobile: Card Style */}
            <div className="block sm:hidden space-y-3">
              {form.packageUnits.map((unit, idx) => (
                <div key={idx} className="bg-black/30 border border-cyan-500/10 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <input value={unit.name} onChange={e=>updatePackageUnit(idx,'name',e.target.value)} placeholder="Unit Name" className="w-24 bg-black border border-cyan-500/15 p-2 rounded text-white text-xs outline-none"/>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">×</span>
                      <input type="number" value={unit.multiplier} onChange={e=>updatePackageUnit(idx,'multiplier',e.target.value)} placeholder="1" className="w-16 bg-black border border-cyan-500/15 p-2 rounded text-white text-xs outline-none text-center"/>
                      <span className="text-xs text-slate-500">Base</span>
                    </div>
                    {form.packageUnits.length > 1 && (
                      <button type="button" onClick={()=>removePackageUnit(idx)} className="p-1.5 bg-rose-600/20 text-rose-400 rounded-lg"><Trash2 size={14}/></button>
                    )}
                  </div>
                  <div className="flex gap-1 items-center">
                    <input value={unit.barcodes.retail} onChange={e=>updatePackageUnit(idx,'barcodes.retail',e.target.value)} placeholder="Barcode" className="flex-1 bg-black border border-cyan-500/15 p-2 rounded text-white text-xs outline-none"/>
                    <button type="button" onClick={()=>setShowScanner(true)} className="px-2 py-2 bg-blue-600/20 rounded text-blue-400"><ScanBarcode size={14}/></button>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    <div><label className="text-[10px] text-slate-500">Retail</label><input type="number" value={unit.prices.retail} onChange={e=>updatePackageUnit(idx,'prices.retail',e.target.value)} placeholder="0" className="w-full bg-black border border-cyan-500/15 p-1.5 rounded text-cyan-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-slate-500">Wh A</label><input type="number" value={unit.prices.wholesaleA} onChange={e=>updatePackageUnit(idx,'prices.wholesaleA',e.target.value)} placeholder="0" className="w-full bg-black border border-amber-500/15 p-1.5 rounded text-amber-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-slate-500">Wh B</label><input type="number" value={unit.prices.wholesaleB} onChange={e=>updatePackageUnit(idx,'prices.wholesaleB',e.target.value)} placeholder="0" className="w-full bg-black border border-amber-500/15 p-1.5 rounded text-amber-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-slate-500">Wh C</label><input type="number" value={unit.prices.wholesaleC} onChange={e=>updatePackageUnit(idx,'prices.wholesaleC',e.target.value)} placeholder="0" className="w-full bg-black border border-amber-500/15 p-1.5 rounded text-amber-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-slate-500">Cost</label><input type="number" value={unit.costPrice} onChange={e=>updatePackageUnit(idx,'costPrice',e.target.value)} placeholder="0" className="w-full bg-black border border-blue-500/15 p-1.5 rounded text-blue-300 text-xs outline-none"/></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Horizontal Scroll Table */}
            <div className="hidden sm:block overflow-x-auto -mx-2 px-2">
              <div className="min-w-[700px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase">
                      <th className="p-2 text-left w-[100px]">Unit Name</th>
                      <th className="p-2 w-[70px]">Qty (×Base)</th>
                      <th className="p-2 w-[120px]">Barcode</th>
                      <th className="p-2 w-[80px]">Retail</th>
                      <th className="p-2 w-[80px]">Whole A</th>
                      <th className="p-2 w-[80px]">Whole B</th>
                      <th className="p-2 w-[80px]">Whole C</th>
                      <th className="p-2 w-[80px]">Cost</th>
                      <th className="p-2 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.packageUnits.map((unit, idx) => (
                      <tr key={idx} className="border-t border-white/5">
                        <td className="p-1.5"><input value={unit.name} onChange={e=>updatePackageUnit(idx,'name',e.target.value)} placeholder="e.g. Bottle" className="w-full bg-black border border-cyan-500/15 p-2 rounded text-white text-xs outline-none"/></td>
                        <td className="p-1.5"><input type="number" value={unit.multiplier} onChange={e=>updatePackageUnit(idx,'multiplier',e.target.value)} placeholder="1" className="w-full bg-black border border-cyan-500/15 p-2 rounded text-white text-xs outline-none text-center"/></td>
                        <td className="p-1.5">
                          <div className="flex gap-1"><input value={unit.barcodes.retail} onChange={e=>updatePackageUnit(idx,'barcodes.retail',e.target.value)} placeholder="BC" className="flex-1 bg-black border border-cyan-500/15 p-2 rounded text-white text-xs outline-none"/><button type="button" onClick={()=>setShowScanner(true)} className="px-2 bg-blue-600/20 rounded text-blue-400 flex-shrink-0"><ScanBarcode size={14}/></button></div>
                        </td>
                        <td className="p-1.5"><input type="number" value={unit.prices.retail} onChange={e=>updatePackageUnit(idx,'prices.retail',e.target.value)} placeholder="0" className="w-full bg-black border border-cyan-500/15 p-2 rounded text-cyan-300 text-xs outline-none"/></td>
                        <td className="p-1.5"><input type="number" value={unit.prices.wholesaleA} onChange={e=>updatePackageUnit(idx,'prices.wholesaleA',e.target.value)} placeholder="0" className="w-full bg-black border border-amber-500/15 p-2 rounded text-amber-300 text-xs outline-none"/></td>
                        <td className="p-1.5"><input type="number" value={unit.prices.wholesaleB} onChange={e=>updatePackageUnit(idx,'prices.wholesaleB',e.target.value)} placeholder="0" className="w-full bg-black border border-amber-500/15 p-2 rounded text-amber-300 text-xs outline-none"/></td>
                        <td className="p-1.5"><input type="number" value={unit.prices.wholesaleC} onChange={e=>updatePackageUnit(idx,'prices.wholesaleC',e.target.value)} placeholder="0" className="w-full bg-black border border-amber-500/15 p-2 rounded text-amber-300 text-xs outline-none"/></td>
                        <td className="p-1.5"><input type="number" value={unit.costPrice} onChange={e=>updatePackageUnit(idx,'costPrice',e.target.value)} placeholder="0" className="w-full bg-black border border-blue-500/15 p-2 rounded text-blue-300 text-xs outline-none"/></td>
                        <td className="p-1.5">{form.packageUnits.length > 1 && (<button type="button" onClick={()=>removePackageUnit(idx)} className="p-1.5 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/30"><Trash2 size={14}/></button>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div><label className="text-xs text-slate-500">Min Stock Alert (Base Unit)</label><input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} placeholder="5" className="w-full bg-black border border-amber-500/15 p-3 rounded-lg text-amber-300 outline-none"/></div>

          <div className="flex gap-3"><button type="submit" className="flex-1 bg-cyan-600 text-white p-4 rounded-xl font-black flex items-center justify-center gap-2"><Save size={20}/> Save</button><button type="button" onClick={cancelEdit} className="px-8 bg-slate-800 text-slate-400 rounded-xl font-black">Cancel</button></div>
        </form>
      )}

      {/* Product List */}
      <div className="space-y-3">
        {filteredProducts.length === 0 && <p className="text-center text-slate-500 py-14">No products found.</p>}
        {filteredProducts.map(p => {
          const isLowStock = (Number(p.stock) || 0) <= (Number(p.minStock) || 5);
          const breakdown = getUnitBreakdown(p.stock || 0, p.packageUnits || []);
          return (
            <div key={p.id} className={`p-5 rounded-2xl border-2 ${isLowStock ? 'bg-amber-950/20 border-amber-500/30' : 'bg-[#0d1120] border-white/5'}`}>
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3"><p className="font-black text-white text-xl">{p.name}</p><span className="text-xs bg-slate-800 px-2 py-1 rounded">{p.category||'General'}</span></div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-400">
                    <span className="text-white font-bold">Stock: {p.stock || 0} {p.baseUnit}</span>
                    {breakdown.filter(b => b.qty > 0).map((b, i) => (<span key={i}>• {b.qty} {b.unit}</span>))}
                  </div>
                  {(p.packageUnits || []).length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      {p.packageUnits.map((u, i) => (<span key={i}>1 {u.name}: {fmt(u.prices?.retail)} Ks (Retail) | Cost: {fmt(u.costPrice)}</span>))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end"><span className="text-xs text-slate-500">Stock (Base)</span><input type="number" defaultValue={p.stock||0} onBlur={e=>updateStock(p.id,e.target.value)} className={`w-24 text-center font-black text-xl px-2 py-3 rounded-lg outline-none border ${isLowStock?'bg-amber-950/40 border-amber-500/50 text-amber-300':'bg-black/50 border-cyan-500/30 text-cyan-300'}`}/></div>
                  <button onClick={()=>startEdit(p)} className="p-3 bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 rounded-lg"><Edit3 size={20}/></button>
                  <button onClick={()=>{if(window.confirm('Delete?')) deleteDoc(doc(db,'pos_products',p.id));}} className="p-3 bg-rose-950/50 border border-rose-500/20 text-rose-400 rounded-lg"><Trash2 size={20}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showScanner && (<div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4"><div className="bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/30 w-full max-w-lg"><div className="flex justify-between mb-6"><h3 className="font-black text-white text-xl">Scan Barcode</h3><button onClick={()=>setShowScanner(false)} className="text-slate-400"><X size={24}/></button></div><div id="product-barcode-reader" className="w-full rounded-2xl" style={{minHeight:'260px'}}></div></div></div>)}
    </div>
  );
}
