import { useState, useRef, useEffect, startTransition } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Boxes, Search, Plus, Save, Trash2, Edit3, ScanBarcode, Send, X } from 'lucide-react';

export default function InventoryPage({ products = [] }) {
  const { profile } = useAuth(); // ✅ userData အစား profile
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });
  
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false);

  const fmt = n => (Number(n) || 0).toLocaleString();

  const playBeep = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = type === 'success' ? 'sine' : 'square'; 
      osc.frequency.setValueAtTime(type === 'success' ? 880 : 200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  };

  useEffect(() => {
    if (!showScanner) return;
    let html5QrCode;
    const startScanner = async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("product-barcode-reader"); 
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" }, { fps: 20, qrbox: { width: 250, height: 250 } },
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
      } catch (err) { 
        alert('Camera access denied'); 
        setShowScanner(false); 
      }
    };
    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/html5-qrcode";
      script.onload = startScanner;
      document.body.appendChild(script);
    } else {
      startScanner();
    }
    return () => { 
      isStopping.current = true; 
      if (scannerRef.current) scannerRef.current.stop().catch(() => {}); 
    };
  }, [showScanner]);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.costPrice) return alert("Fill all fields");
    
    if (!profile?.tenantId) {
      alert("No tenant ID found. Please login again.");
      return;
    }

    const payload = { 
      name: form.name, category: form.category || 'General', barcode: form.barcode, 
      costPrice: Number(form.costPrice), price: Number(form.price), 
      minStock: Number(form.minStock) || 5, unit: form.unit || 'ခု' 
    };

    try {
      if (editing) {
        await setDoc(doc(db, 'pos_products', editing.id), payload, { merge: true });
        alert("Product updated!");
        startTransition(() => setEditing(null));
      } else {
        await addDoc(collection(db, 'pos_products'), { 
          ...payload, 
          tenantId: profile.tenantId, // ✅ profile.tenantId
          stock: 0, 
          createdAt: Date.now() 
        });
        alert("Product added!");
        startTransition(() => setAdding(false));
      }
      setForm({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });
    } catch (error) {
      alert("Error saving product: " + error.message);
      console.error(error);
    }
  };

  const startEdit = (p) => {
    startTransition(() => { setEditing(p); setAdding(false); });
    setForm({ name: p.name || '', category: p.category || '', barcode: p.barcode || '', costPrice: String(p.costPrice || ''), price: String(p.price || ''), minStock: String(p.minStock || '5'), unit: p.unit || 'ခု' });
  };

  const cancelEdit = () => {
    startTransition(() => { setEditing(null); setAdding(false); });
    setForm({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });
  };

  const updateStock = async (id, newStock, oldStock) => {
    const s = Number(newStock);
    if (s !== oldStock && !isNaN(s)) {
      await setDoc(doc(db, 'pos_products', id), { stock: s }, { merge: true });
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode || '').includes(searchTerm)
  );

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/15 shadow-xl gap-5">
        <h3 className="font-black text-2xl flex items-center gap-3"><Boxes className="text-cyan-500"/> Inventory</h3>
        <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={20} className="absolute left-4 top-3.5 text-slate-500" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border-2 border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400" />
          </div>
          <button onClick={() => startTransition(() => { setAdding(!adding); setEditing(null); })} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2">
            <Plus size={20} /> Add Item
          </button>
        </div>
      </div>

      {(adding || editing) && (
        <form onSubmit={handleSaveProduct} className="bg-[#0d1120] p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/20 shadow-xl space-y-5">
          <p className="text-sm font-black text-cyan-400 uppercase">{editing ? 'Edit Product' : 'New Product'}</p>
          <input required placeholder="Product Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-black border-2 border-cyan-500/15 p-4 rounded-xl text-lg outline-none" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <input placeholder="Category" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="bg-black border-2 border-cyan-500/15 p-4 rounded-xl text-lg outline-none" />
            <div className="flex gap-3">
              <input placeholder="Barcode" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="flex-1 bg-black border-2 border-cyan-500/15 p-4 rounded-xl text-lg outline-none" />
              <button type="button" onClick={() => setShowScanner(true)} className="px-4 bg-blue-600/20 border-2 border-blue-500/40 rounded-xl text-blue-400"><ScanBarcode size={24}/></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div><label className="text-xs text-slate-500">Cost Price</label><input type="number" required value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} className="w-full bg-black border-2 border-blue-500/15 p-4 rounded-xl text-blue-300 outline-none" /></div>
            <div><label className="text-xs text-slate-500">Selling Price</label><input type="number" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full bg-black border-2 border-cyan-500/15 p-4 rounded-xl text-cyan-300 outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <input placeholder="Unit" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="bg-black border-2 border-cyan-500/15 p-4 rounded-xl outline-none" />
            <input type="number" placeholder="Min Stock" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} className="bg-black border-2 border-amber-500/15 p-4 rounded-xl text-amber-300 outline-none" />
          </div>
          <div className="flex gap-4 pt-3">
            <button type="submit" className="flex-1 bg-cyan-600 text-white p-4 rounded-xl font-black"><Save size={22}/> Save</button>
            <button type="button" onClick={cancelEdit} className="px-8 bg-slate-800 text-slate-400 rounded-xl">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {filteredProducts.length === 0 && <p className="text-center text-slate-500 py-14">No products found.</p>}
        {filteredProducts.map(p => {
          const isLowStock = (Number(p.stock) || 0) <= (Number(p.minStock) || 5);
          return (
            <div key={p.id} className={`p-5 rounded-2xl border-2 flex justify-between items-center ${isLowStock ? 'bg-amber-950/20 border-amber-500/30' : 'bg-[#0d1120] border-white/5'}`}>
              <div>
                <p className="font-black text-white text-xl">{p.name}</p>
                <div className="flex gap-4 text-sm mt-1">
                  <span className="text-blue-400">Cost: {fmt(p.costPrice)}</span>
                  <span className="text-cyan-400">Sell: {fmt(p.price)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input type="number" defaultValue={p.stock || 0} onBlur={e => updateStock(p.id, e.target.value, p.stock || 0)} className="w-24 text-center font-black text-xl bg-black/50 border-2 border-cyan-500/30 rounded-xl px-2 py-3 text-cyan-300 outline-none" />
                <button onClick={() => startEdit(p)} className="p-3 bg-indigo-950/50 border-2 border-indigo-500/20 text-indigo-400 rounded-xl"><Edit3 size={20}/></button>
                <button onClick={() => { if(window.confirm('Delete?')) deleteDoc(doc(db, 'pos_products', p.id)); }} className="p-3 bg-rose-950/50 border-2 border-rose-500/20 text-rose-400 rounded-xl"><Trash2 size={20}/></button>
              </div>
            </div>
          );
        })}
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/30 w-full max-w-lg">
            <div className="flex justify-between mb-6">
              <h3 className="font-black text-white text-xl">Scan Barcode</h3>
              <button onClick={() => setShowScanner(false)} className="text-slate-400"><X size={24}/></button>
            </div>
            <div id="product-barcode-reader" className="w-full rounded-2xl" style={{minHeight:'260px'}}></div>
          </div>
        </div>
      )}
    </div>
  );
}
