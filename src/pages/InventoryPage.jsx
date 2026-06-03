import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, doc, setDoc, deleteDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Boxes, Search, Plus, Save, Trash2, Edit3, ScanBarcode, X, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import useDebounce from '../hooks/useDebounce';

// 🌟 Custom UI & Utilities
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import logger from '../utils/logger';

// ---------- Scanner Modal ----------
const ScannerModal = ({ onClose, onScan }) => {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);
  const readerRef = useRef(null);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
      BarcodeFormat.ITF, BarcodeFormat.QR_CODE
    ]);

    const codeReader = new BrowserMultiFormatReader(hints);
    readerRef.current = codeReader;

    const constraints = { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } };

    codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
      if (result) {
        onScan(result.text);
        codeReader.reset();
        onClose();
      }
    }).catch((err) => {
      logger.error('Camera error in Inventory Scanner:', err);
      setCameraError(true);
    });

    return () => { if (readerRef.current) readerRef.current.reset(); };
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
        <div className="p-4 bg-gray-100 text-center text-xs text-gray-500 font-bold">ကင်မရာကို Barcode သို့ ချိန်ပါ</div>
      </div>
    </div>
  );
};

// ---------- Inventory Page ----------
export default function InventoryPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // 🌟 Category Filter State အသစ်
  const [selCategory, setSelCategory] = useState('All');

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeScanIdx, setActiveScanIdx] = useState(null); 
  const [expandedRows, setExpandedRows] = useState({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  const submitLock = useRef(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [form, setForm] = useState({
    name: '', category: '', baseUnit: 'Bottle',
    packageUnits: [{ name: 'Bottle', multiplier: 1, barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' }],
    minStock: '5',
  });

  // Fetch real-time products
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [tenantId]);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!products) return ['General'];
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['General', ...Array.from(cats).sort()];
  }, [products]);

  const fmt = n => (Number(n) || 0).toLocaleString();
  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  const getUnitBreakdown = (stock, packageUnits) => {
    if (!packageUnits || packageUnits.length === 0) return [];
    const sorted = [...packageUnits].sort((a, b) => b.multiplier - a.multiplier);
    let remain = stock;
    return sorted.map(unit => {
      const qty = Math.floor(remain / unit.multiplier);
      remain = remain % unit.multiplier;
      return { unit: unit.name, qty };
    });
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

  const addPackageUnit = () => setForm(p => ({ ...p, packageUnits: [...p.packageUnits, { name: '', multiplier: '', barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' }] }));
  const removePackageUnit = (index) => setForm(p => ({ ...p, packageUnits: p.packageUnits.filter((_, i) => i !== index) }));
  const resetForm = () => {
    setForm({ name: '', category: '', baseUnit: 'Bottle', packageUnits: [{ name: 'Bottle', multiplier: 1, barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' }], minStock: '5' });
    setShowNewCategoryInput(false);
  };

  const updatePackageUnit = useCallback((index, field, value) => {
    setForm(prev => {
      const newUnits = [...prev.packageUnits];
      if (!newUnits[index]) return prev;
      if (field.startsWith('prices.')) newUnits[index].prices = { ...newUnits[index].prices, [field.split('.')[1]]: value };
      else if (field.startsWith('barcodes.')) newUnits[index].barcodes = { ...newUnits[index].barcodes, [field.split('.')[1]]: value };
      else newUnits[index][field] = value;
      return { ...prev, packageUnits: newUnits };
    });
  }, []);

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (submitLock.current) return; 
    
    if (!form.name.trim()) return showToast("Product Name ထည့်ပါ", "error");
    if (!tenantId) return showToast("No tenant ID found.", "error");

    const validUnits = form.packageUnits.filter(u => u.name.trim() !== '');
    if (validUnits.length === 0) return showToast("အမှား: အနည်းဆုံး ပါကင်ယူနစ် (Package Unit) တစ်ခုထည့်သွင်းပေးရန် လိုအပ်ပါသည်။", "error");

    const incomingBarcodes = validUnits.map(u => u.barcodes?.retail?.trim()).filter(b => b);
    const isDuplicate = products.some(p => {
      if (editing && p.id === editing.id) return false;
      return p.packageUnits?.some(u => incomingBarcodes.includes(u.barcodes?.retail?.trim()));
    });

    if (isDuplicate) return showToast("အမှား: ဤ Barcode သည် အခြားပစ္စည်းတွင် သုံးထားပြီးဖြစ်ပါသည်။", "error");

    submitLock.current = true;
    const payload = {
      name: form.name.trim(), category: form.category || 'General', baseUnit: form.baseUnit || 'Bottle',
      packageUnits: validUnits.map(u => ({
        name: u.name.trim(), multiplier: Number(u.multiplier) || 1, barcodes: { retail: u.barcodes?.retail?.trim() || '' },
        prices: { retail: Number(u.prices?.retail) || 0, wholesaleA: Number(u.prices?.wholesaleA) || 0, wholesaleB: Number(u.prices?.wholesaleB) || 0, wholesaleC: Number(u.prices?.wholesaleC) || 0 },
        costPrice: Number(u.costPrice) || 0,
      })),
      minStock: Number(form.minStock) || 5,
    };

    try {
      if (editing) {
        await setDoc(doc(db, 'pos_products', editing.id), payload, { merge: true });
        showToast("Product updated successfully!", "success"); setEditing(null);
      } else {
        await addDoc(collection(db, 'pos_products'), { ...payload, tenantId: tenantId, stock: 0, stockBase: 0, createdAt: Date.now() });
        showToast("Product added successfully!", "success"); setAdding(false);
      }
      resetForm();
    } catch (error) { 
      logger.error('Error saving product:', error); showToast("Error: " + error.message, "error"); 
    } finally { submitLock.current = false; }
  };

  const startEdit = (p) => {
    setEditing(p); setAdding(false);
    setForm({
      name: p.name || '', category: p.category || '', baseUnit: p.baseUnit || 'Bottle',
      packageUnits: (p.packageUnits || [{ name: 'Bottle', multiplier: 1, barcodes: { retail: '' }, prices: { retail: '', wholesaleA: '', wholesaleB: '', wholesaleC: '' }, costPrice: '' }]).map(u => ({
        name: u.name, multiplier: String(u.multiplier || 1), barcodes: { retail: u.barcodes?.retail || '' },
        prices: { retail: String(u.prices?.retail || ''), wholesaleA: String(u.prices?.wholesaleA || ''), wholesaleB: String(u.prices?.wholesaleB || ''), wholesaleC: String(u.prices?.wholesaleC || '') },
        costPrice: String(u.costPrice || ''),
      })),
      minStock: String(p.minStock || '5'),
    });
    setShowNewCategoryInput(false);
  };

  const updateStock = async (id, newStock) => {
    const s = Number(newStock);
    if (!isNaN(s)) {
      try {
        await setDoc(doc(db, 'pos_products', id), { stock: s, stockBase: s }, { merge: true });
        showToast("Stock updated successfully!", "success");
      } catch (err) { logger.error('Error updating stock:', err); showToast("Error updating stock", "error"); }
    }
  };

  const handleDeleteProduct = (id, name) => {
    setConfirmDialog({
      isOpen: true, title: "ပစ္စည်း ဖျက်သိမ်းခြင်း", message: `"${name}" ကို ဖျက်ရန် သေချာပါသလား?`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          await deleteDoc(doc(db, 'pos_products', id));
          showToast("Product deleted successfully!", "success");
        } catch (err) { logger.error('Error deleting product:', err); showToast("Failed to delete product.", "error"); }
      }
    });
  };

  // 🌟 Filter Logic Updated with Category
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selCategory !== 'All') result = result.filter(p => p.category === selCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => (p.name || '').toLowerCase().includes(q));
    }
    return result;
  }, [products, debouncedSearch, selCategory]);

  return (
    <div className="p-4 sm:p-6 text-white max-w-7xl mx-auto space-y-6 pb-20 overflow-x-hidden">
      
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />

      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-4 sm:p-6 rounded-3xl border border-cyan-500/15 gap-5 shadow-xl">
        <h3 className="font-black text-2xl flex items-center gap-2 tracking-wide"><Boxes className="text-cyan-500"/> Inventory</h3>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={18} className="absolute left-4 top-3.5 text-slate-500"/>
            <input type="text" placeholder="Search product..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-black/50 border border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400 text-sm shadow-inner transition-colors"/>
          </div>
          <button onClick={()=>{setAdding(!adding);setEditing(null); if(!adding) resetForm();}} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex justify-center items-center gap-2 text-sm shadow-lg shadow-cyan-900/50 active:scale-95 transition-all">
            <Plus size={18}/> Add Item
          </button>
        </div>
      </div>

      {/* 🌟 Categories Filter Horizontal Scroll */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1 px-1">
        <button onClick={() => setSelCategory('All')} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-md ${selCategory === 'All' ? 'bg-cyan-600 text-white' : 'bg-[#0d1120] text-slate-400 border border-white/5 hover:border-cyan-500/30'}`}>All</button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelCategory(cat)} className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-md ${selCategory === cat ? 'bg-cyan-600 text-white' : 'bg-[#0d1120] text-slate-400 border border-white/5 hover:border-cyan-500/30'}`}>{cat}</button>
        ))}
      </div>

      {/* Add / Edit Form */}
      {(adding || editing) && (
        <form onSubmit={handleSaveProduct} className="bg-[#0d1120] p-5 sm:p-6 rounded-3xl border border-cyan-500/30 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
          <p className="text-sm font-black text-cyan-400 uppercase tracking-wider">{editing ? 'Edit Product' : 'New Product'}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-bold mb-1.5 block">Product Name *</label>
              <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Shark Energy Drink" className="w-full bg-black/50 border border-cyan-500/20 p-3 rounded-xl text-white outline-none text-sm focus:border-cyan-400"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold mb-1.5 block">Category</label>
              {showNewCategoryInput ? (
                <div className="flex gap-2">
                  <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="New Category" className="flex-1 bg-black/50 border border-green-500/40 p-3 rounded-xl text-white outline-none text-sm focus:border-green-400" autoFocus />
                  <button type="button" onClick={() => setShowNewCategoryInput(false)} className="px-3 bg-slate-800 rounded-xl text-xs font-bold">✕</button>
                </div>
              ) : (
                <select value={form.category} onChange={e => {
                  if (e.target.value === '__add_new__') { setShowNewCategoryInput(true); setForm(prev => ({...prev, category: ''})); }
                  else setForm({...form, category: e.target.value});
                }} className="w-full bg-black/50 border border-cyan-500/20 p-3 rounded-xl text-white outline-none text-sm focus:border-cyan-400">
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="__add_new__">+ Add New Category</option>
                </select>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold mb-1.5 block">Base Unit</label>
              <input value={form.baseUnit} onChange={e=>setForm({...form,baseUnit:e.target.value})} placeholder="e.g. Bottle, Pcs" className="w-full bg-black/50 border border-cyan-500/20 p-3 rounded-xl text-white outline-none text-sm focus:border-cyan-400"/>
            </div>
          </div>

          <div className="border-t border-white/5 pt-5">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2"><Package size={14}/> Package Units</p>
              <button type="button" onClick={addPackageUnit} className="px-3 py-2 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-cyan-600/30 transition-colors"><Plus size={14}/> Add Unit</button>
            </div>
            
            {/* Mobile form view */}
            <div className="block lg:hidden space-y-4">
              {form.packageUnits.map((unit, idx) => (
                <div key={idx} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-3 relative shadow-inner">
                  {form.packageUnits.length > 1 && (
                    <button type="button" onClick={()=>removePackageUnit(idx)} className="absolute top-4 right-4 p-1.5 bg-rose-900/30 text-rose-400 rounded-lg"><Trash2 size={14}/></button>
                  )}
                  <div className="grid grid-cols-2 gap-3 pr-10">
                    <div><label className="text-[10px] text-slate-500 font-bold">Unit Name</label><input value={unit.name} onChange={e=>updatePackageUnit(idx,'name',e.target.value)} placeholder="e.g. Box" className="w-full bg-black/50 border border-cyan-500/20 p-2.5 rounded-lg text-white text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-slate-500 font-bold">Qty (Multiplier)</label><input type="number" value={unit.multiplier} onChange={e=>updatePackageUnit(idx,'multiplier',e.target.value)} placeholder="e.g. 24" className="w-full bg-black/50 border border-cyan-500/20 p-2.5 rounded-lg text-white text-xs outline-none text-center"/></div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold">Barcode</label>
                    <div className="flex gap-2 mt-1">
                      <input value={unit.barcodes?.retail || ''} onChange={e=>updatePackageUnit(idx,'barcodes.retail',e.target.value)} placeholder="Scan or Type" className="flex-1 bg-black/50 border border-cyan-500/20 p-2.5 rounded-lg text-white text-xs outline-none"/>
                      <button type="button" onClick={()=>setActiveScanIdx(idx)} className="px-4 bg-blue-600/20 rounded-lg text-blue-400 flex items-center justify-center border border-blue-500/20"><ScanBarcode size={18}/></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
                    <div><label className="text-[10px] text-cyan-400 font-bold">Retail Price</label><input type="number" value={unit.prices.retail} onChange={e=>updatePackageUnit(idx,'prices.retail',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-cyan-500/30 p-2 rounded text-cyan-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-amber-500 font-bold">Wholesale A</label><input type="number" value={unit.prices.wholesaleA} onChange={e=>updatePackageUnit(idx,'prices.wholesaleA',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 p-2 rounded text-amber-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-amber-500 font-bold">Wholesale B</label><input type="number" value={unit.prices.wholesaleB} onChange={e=>updatePackageUnit(idx,'prices.wholesaleB',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 p-2 rounded text-amber-300 text-xs outline-none"/></div>
                    <div><label className="text-[10px] text-blue-400 font-bold">Cost Price</label><input type="number" value={unit.costPrice} onChange={e=>updatePackageUnit(idx,'costPrice',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-blue-500/30 p-2 rounded text-blue-300 text-xs outline-none"/></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop form view */}
            <div className="hidden lg:block overflow-x-auto -mx-2 px-2 custom-scrollbar pb-3">
              <div className="min-w-[850px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-2 text-left w-[120px]">Unit Name</th>
                      <th className="p-2 w-[80px]">Qty (×Base)</th>
                      <th className="p-2 w-[150px]">Barcode</th>
                      <th className="p-2 w-[90px] text-cyan-400">Retail</th>
                      <th className="p-2 w-[90px] text-amber-500">Whole A</th>
                      <th className="p-2 w-[90px] text-amber-500">Whole B</th>
                      <th className="p-2 w-[90px] text-amber-500">Whole C</th>
                      <th className="p-2 w-[90px] text-blue-400">Cost</th>
                      <th className="p-2 w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.packageUnits.map((unit, idx) => (
                      <tr key={idx} className="border-t border-white/5">
                        <td className="p-1.5"><input value={unit.name} onChange={e=>updatePackageUnit(idx,'name',e.target.value)} placeholder="e.g. Box" className="w-full bg-black/50 border border-cyan-500/20 p-2.5 rounded-lg text-white text-xs outline-none focus:border-cyan-400"/></td>
                        <td className="p-1.5"><input type="number" value={unit.multiplier} onChange={e=>updatePackageUnit(idx,'multiplier',e.target.value)} placeholder="1" className="w-full bg-black/50 border border-cyan-500/20 p-2.5 rounded-lg text-white text-xs outline-none text-center focus:border-cyan-400"/></td>
                        <td className="p-1.5">
                          <div className="flex gap-1.5">
                            <input value={unit.barcodes?.retail || ''} onChange={e=>updatePackageUnit(idx,'barcodes.retail',e.target.value)} placeholder="Scan/Type" className="flex-1 bg-black/50 border border-cyan-500/20 p-2.5 rounded-lg text-white text-xs outline-none focus:border-cyan-400"/>
                            <button type="button" onClick={()=>setActiveScanIdx(idx)} className="px-2.5 bg-blue-600/20 border border-blue-500/20 rounded-lg text-blue-400 flex-shrink-0 hover:bg-blue-600/30 transition-colors"><ScanBarcode size={16}/></button>
                          </div>
                        </td>
                        <td className="p-1.5"><input type="number" value={unit.prices.retail} onChange={e=>updatePackageUnit(idx,'prices.retail',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-cyan-500/30 p-2.5 rounded-lg text-cyan-300 text-xs outline-none font-mono focus:border-cyan-400"/></td>
                        <td className="p-1.5"><input type="number" value={unit.prices.wholesaleA} onChange={e=>updatePackageUnit(idx,'prices.wholesaleA',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 p-2.5 rounded-lg text-amber-300 text-xs outline-none font-mono focus:border-amber-400"/></td>
                        <td className="p-1.5"><input type="number" value={unit.prices.wholesaleB} onChange={e=>updatePackageUnit(idx,'prices.wholesaleB',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 p-2.5 rounded-lg text-amber-300 text-xs outline-none font-mono focus:border-amber-400"/></td>
                        <td className="p-1.5"><input type="number" value={unit.prices.wholesaleC} onChange={e=>updatePackageUnit(idx,'prices.wholesaleC',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 p-2.5 rounded-lg text-amber-300 text-xs outline-none font-mono focus:border-amber-400"/></td>
                        <td className="p-1.5"><input type="number" value={unit.costPrice} onChange={e=>updatePackageUnit(idx,'costPrice',e.target.value)} placeholder="0" className="w-full bg-black/50 border border-blue-500/30 p-2.5 rounded-lg text-blue-300 text-xs outline-none font-mono focus:border-blue-400"/></td>
                        <td className="p-1.5">{form.packageUnits.length > 1 && (<button type="button" onClick={()=>removePackageUnit(idx)} className="p-2 bg-rose-900/30 text-rose-400 rounded-lg hover:bg-rose-900/50 transition-colors"><Trash2 size={16}/></button>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs text-slate-400 font-bold mb-1.5 block">Min Stock Alert (Base Unit)</label>
            <input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} placeholder="5" className="w-full sm:w-1/3 bg-black/50 border border-amber-500/20 p-3 rounded-xl text-amber-300 outline-none text-sm focus:border-amber-400"/>
          </div>

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button type="submit" className="flex-1 sm:flex-none sm:w-48 bg-cyan-600 text-white p-3 rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-cyan-900/50"><Save size={18}/> Save Product</button>
            <button type="button" onClick={cancelEdit} className="flex-1 sm:flex-none sm:w-32 bg-black/50 border border-white/10 text-slate-300 rounded-xl font-bold hover:bg-white/5 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* 🌟 Mobile Product Card View / Desktop Table View */}
      <div className="bg-[#0d1120] border border-cyan-500/15 rounded-3xl overflow-hidden shadow-xl">
        
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-400 text-[11px] uppercase font-bold tracking-wider bg-black/40 border-b border-white/5">
                <th className="p-4 w-10"></th>
                <th className="p-4">Product Name</th>
                <th className="p-4 text-center">Base Unit</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 text-right text-cyan-400">Retail Price</th>
                <th className="p-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-500 font-bold">No products found.</td></tr>
              )}
              {filteredProducts.map(p => {
                const isLowStock = (Number(p.stockBase) || Number(p.stock) || 0) <= (Number(p.minStock) || 5);
                const baseUnitName = p.baseUnit || (p.packageUnits?.find(u => Number(u.multiplier) === 1)?.name) || 'unit';
                const stockVal = p.stockBase ?? p.stock ?? 0;
                const retailPrice = p.packageUnits?.find(u => Number(u.multiplier) === 1)?.prices?.retail ?? p.packageUnits?.[0]?.prices?.retail ?? 0;
                const isExpanded = expandedRows[p.id] || false;

                return (
                  <React.Fragment key={p.id}>
                    <tr onClick={() => toggleRow(p.id)} className={`hover:bg-white/[0.02] cursor-pointer transition-colors ${isLowStock ? 'bg-amber-950/10' : ''}`}>
                      <td className="p-4">{isExpanded ? <ChevronUp size={16} className="text-cyan-400"/> : <ChevronDown size={16} className="text-slate-500"/>}</td>
                      <td className="p-4 font-bold text-white flex items-center gap-3">
                        {p.name}
                        {isLowStock && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full tracking-wider">Low Stock</span>}
                      </td>
                      <td className="p-4 text-center text-slate-400 font-bold">{baseUnitName}</td>
                      <td className={`p-4 text-center font-black text-lg ${isLowStock ? 'text-amber-400' : 'text-white'}`}>{stockVal}</td>
                      <td className="p-4 text-right font-black text-cyan-400 text-base">{fmt(retailPrice)} <span className="text-xs font-bold text-cyan-600">Ks</span></td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(p); }} className="p-2 bg-indigo-900/30 border border-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-900/50 transition-colors"><Edit3 size={16}/></button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id, p.name); }} className="p-2 bg-rose-900/30 border border-rose-500/20 rounded-lg text-rose-400 hover:bg-rose-900/50 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-black/30 border-b-2 border-cyan-500/20">
                        <td colSpan={6} className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                              <p className="text-xs text-slate-500 font-black uppercase mb-3 flex items-center gap-2"><Boxes size={14}/> Stock Breakdown</p>
                              <div className="space-y-2 mb-4">
                                {getUnitBreakdown(stockVal, p.packageUnits || []).filter(b => b.qty > 0).map((b, i) => (
                                  <div key={i} className="flex justify-between items-center border-b border-white/5 pb-1 last:border-0">
                                    <span className="text-slate-300 font-bold">{b.unit}</span>
                                    <span className="font-black text-cyan-400 text-base">{b.qty}</span>
                                  </div>
                                ))}
                                {getUnitBreakdown(stockVal, p.packageUnits || []).filter(b => b.qty > 0).length === 0 && (
                                  <p className="text-xs text-slate-500 italic">No stock available.</p>
                                )}
                              </div>
                              <div className="pt-2 border-t border-white/5">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Manual Adjust Stock (Base)</label>
                                <input type="number" defaultValue={stockVal} onBlur={e => updateStock(p.id, e.target.value)} className="w-full bg-black/50 border border-cyan-500/30 rounded-lg px-3 py-2 text-white font-bold outline-none focus:border-cyan-400" />
                              </div>
                            </div>
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                              <p className="text-xs text-slate-500 font-black uppercase mb-3 flex items-center gap-2"><Package size={14}/> Units & Retail Prices</p>
                              <div className="space-y-2">
                                {p.packageUnits?.map((u, i) => (
                                  <div key={i} className="flex justify-between items-center border-b border-white/5 pb-1 last:border-0">
                                    <span className="text-slate-300 font-bold">1 {u.name} <span className="text-[10px] text-slate-500">(x{u.multiplier})</span></span>
                                    <span className="font-black text-cyan-400">{fmt(u.prices?.retail)} Ks</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                              <p className="text-xs text-slate-500 font-black uppercase mb-3">Product Details</p>
                              <div className="space-y-2">
                                <p className="text-sm"><span className="text-slate-500">Category:</span> <span className="font-bold text-white">{p.category || 'General'}</span></p>
                                <p className="text-sm"><span className="text-slate-500">Min Alert:</span> <span className="font-bold text-amber-400">{p.minStock || 5}</span></p>
                                <div className="pt-2 border-t border-white/5">
                                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Barcodes</p>
                                  {p.packageUnits?.filter(u => u.barcodes?.retail).map((u, i) => (
                                    <p key={i} className="text-xs text-slate-300 font-mono bg-black/50 px-2 py-1 rounded mb-1">{u.name}: {u.barcodes.retail}</p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 🌟 Mobile Card View */}
        <div className="block sm:hidden divide-y divide-white/5">
          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-slate-500 font-bold">No products found.</div>
          )}
          {filteredProducts.map(p => {
            const isLowStock = (Number(p.stockBase) || Number(p.stock) || 0) <= (Number(p.minStock) || 5);
            const stockVal = p.stockBase ?? p.stock ?? 0;
            const retailPrice = p.packageUnits?.find(u => Number(u.multiplier) === 1)?.prices?.retail ?? p.packageUnits?.[0]?.prices?.retail ?? 0;
            const isExpanded = expandedRows[p.id] || false;

            return (
              <div key={p.id} className="bg-[#0d1120] transition-colors">
                <div onClick={() => toggleRow(p.id)} className={`p-4 flex justify-between items-center cursor-pointer ${isLowStock ? 'bg-amber-950/20' : ''}`}>
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      {p.name}
                      {isLowStock && <span className="text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Low</span>}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{p.category || 'General'}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className={`font-black text-xl leading-none ${isLowStock ? 'text-amber-400' : 'text-white'}`}>{stockVal}</p>
                    <p className="text-[10px] text-cyan-400 font-bold mt-1 tracking-wider">{fmt(retailPrice)} Ks</p>
                  </div>
                  <div className="ml-3 pl-3 border-l border-white/10">
                    {isExpanded ? <ChevronUp size={20} className="text-cyan-400"/> : <ChevronDown size={20} className="text-slate-500"/>}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-black/40 border-t border-cyan-500/10 space-y-4">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(p)} className="flex-1 py-2 bg-indigo-900/30 border border-indigo-500/20 rounded-xl text-indigo-400 font-bold flex justify-center items-center gap-2 active:scale-95"><Edit3 size={16}/> Edit</button>
                      <button type="button" onClick={() => handleDeleteProduct(p.id, p.name)} className="flex-1 py-2 bg-rose-900/30 border border-rose-500/20 rounded-xl text-rose-400 font-bold flex justify-center items-center gap-2 active:scale-95"><Trash2 size={16}/> Delete</button>
                    </div>
                    
                    <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-black uppercase mb-2">Stock Breakdown</p>
                      <div className="space-y-1 mb-3">
                        {getUnitBreakdown(stockVal, p.packageUnits || []).filter(b => b.qty > 0).map((b, i) => (
                          <div key={i} className="flex justify-between items-center bg-black/30 px-2 py-1.5 rounded-lg border border-white/5">
                            <span className="text-xs font-bold text-slate-300">{b.unit}</span>
                            <span className="font-black text-cyan-400 text-sm">{b.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 font-bold">Adjust Base Stock:</label>
                        <input type="number" defaultValue={stockVal} onBlur={e => updateStock(p.id, e.target.value)} className="w-20 bg-[#0d1120] border border-cyan-500/30 rounded-lg px-2 py-1.5 text-white font-bold outline-none focus:border-cyan-400 text-center text-sm" />
                      </div>
                    </div>

                    <div className="bg-black/50 p-3 rounded-xl border border-white/5 space-y-1.5">
                      <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Package Prices</p>
                      {p.packageUnits?.map((u, i) => (
                        <div key={i} className="flex justify-between text-xs border-b border-white/5 pb-1 last:border-0">
                          <span className="font-bold text-slate-300">{u.name} <span className="text-slate-600">(x{u.multiplier})</span></span>
                          <span className="font-black text-cyan-400">{fmt(u.prices?.retail)} Ks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scanner Modal */}
      {activeScanIdx !== null && (
        <ScannerModal
          onClose={() => setActiveScanIdx(null)}
          onScan={(text) => { updatePackageUnit(activeScanIdx, 'barcodes.retail', text); playBeep('success'); setActiveScanIdx(null); }}
        />
      )}
    </div>
  );
}
