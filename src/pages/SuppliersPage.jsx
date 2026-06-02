import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { Truck, Search, Plus, Edit3, Trash2, DollarSign, ClipboardList, X, Save, Phone } from 'lucide-react';

export default function SuppliersPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [suppliers, setSuppliers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);

  // Forms
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // --- Fetch Suppliers ---
  const fetchSuppliers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setSuppliers(data);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [tenantId]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const lowerSearch = searchTerm.toLowerCase();
    return suppliers.filter(s => 
      (s.name || '').toLowerCase().includes(lowerSearch) || 
      (s.phone || '').includes(lowerSearch)
    );
  }, [suppliers, searchTerm]);

  // --- Save Supplier ---
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return alert("Supplier အမည် ထည့်ပါ");
    
    setLoading(true);
    try {
      const payload = {
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim(),
        tenantId: tenantId,
        updatedAt: serverTimestamp()
      };

      if (editingSupplier) {
        await setDoc(doc(db, 'pos_suppliers', editingSupplier.id), payload, { merge: true });
        alert("Supplier အချက်အလက် ပြင်ဆင်ပြီးပါပြီ။");
      } else {
        await addDoc(collection(db, 'pos_suppliers'), {
          ...payload,
          totalDebt: 0, 
          createdAt: serverTimestamp()
        });
        alert("Supplier အသစ် ထည့်သွင်းပြီးပါပြီ။");
      }
      setSupplierModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      alert("Error saving supplier.");
    }
    setLoading(false);
  };

  // --- Delete Supplier ---
  const handleDeleteSupplier = async (id, name, debt) => {
    if (debt > 0) {
      return alert(`အမှား: ${name} သို့ ပေးရန်ကျန်ငွေ (${debt.toLocaleString()} Ks) ရှိနေသဖြင့် ဖျက်၍မရပါ။`);
    }
    if (!window.confirm(`${name} ကို ဖျက်ရန် သေချာပါသလား?`)) return;

    try {
      await deleteDoc(doc(db, 'pos_suppliers', id));
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      alert("Error deleting supplier.");
    }
  };

  // --- Handle Payment (ပွဲရုံသို့ အကြွေးဆပ်ခြင်း) ---
  const handlePayment = async (e) => {
    e.preventDefault();
    const payAmount = Number(paymentForm.amount);
    if (!payAmount || payAmount <= 0) return alert("ငွေပမာဏ မှန်ကန်စွာထည့်ပါ။");
    
    // 🌟 Error ကင်းစေရန် အနည်းငယ် ပိုဆပ်ခွင့်ပြုလိုက်သည် (Rounding error များအတွက်)
    if (payAmount > selectedSupplier.totalDebt + 10) return alert(`ဆပ်သည့်ငွေသည် ပေးရန်ရှိသောအကြွေး (${selectedSupplier.totalDebt.toLocaleString()}) ထက် များနေပါသည်။`);

    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const supplierRef = doc(db, 'pos_suppliers', selectedSupplier.id);
      batch.update(supplierRef, {
        totalDebt: increment(-payAmount)
      });

      const recordRef = doc(collection(db, 'pos_records'));
      batch.set(recordRef, {
        type: 'Supplier Payment',
        tenantId: tenantId,
        supplierId: selectedSupplier.id,
        personName: selectedSupplier.name,
        amount: payAmount,
        note: paymentForm.note || 'ပွဲရုံသို့ ငွေချေသည်',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cashier: profile?.username || profile?.name || 'Admin',
        createdAt: serverTimestamp()
      });

      await batch.commit();
      alert("ငွေပေးချေမှု မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။");
      setPaymentModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error(error);
      alert("Error saving payment.");
    }
    setLoading(false);
  };

  // --- View Ledger 🌟 FIXED: Firebase Index Errors ---
  const viewLedger = async (supplier) => {
    setSelectedSupplier(supplier);
    setLedgerModalOpen(true);
    setLedgers([]); 
    
    try {
      // 🌟 Firebase Index Error မတက်စေရန် Tenant နဲ့သက်ဆိုင်သမျှ အရင်ဆွဲထုတ်မည်
      const q = query(
        collection(db, 'pos_records'), 
        where('tenantId', '==', tenantId)
      );
      const snap = await getDocs(q);
      const allRecords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 🌟 Frontend (Client-side) ဘက်တွင် လိုအပ်သည်များကိုသာ ပြန်လည်စစ်ထုတ်မည်
      const relevantLedgers = allRecords.filter(r => 
        (r.supplierId === supplier.id || r.personName === supplier.name) &&
        (r.type === 'Supplier Payment' || (r.type === 'Purchase' && r.remainingDebt > 0))
      );

      // 🌟 အချိန်အစဉ်လိုက် အသစ်ဆုံးကို အပေါ်ရောက်အောင် စီမည် (Sort)
      relevantLedgers.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      });
      
      setLedgers(relevantLedgers);
    } catch (error) {
      console.error("Error fetching ledger:", error);
    }
  };

  const openAddModal = () => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', address: '' }); setSupplierModalOpen(true); };
  const openEditModal = (s) => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone || '', address: s.address || '' }); setSupplierModalOpen(true); };
  const openPaymentModal = (s) => { setSelectedSupplier(s); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); };

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-rose-500/15 shadow-xl gap-5 animate-in fade-in">
        <div className="text-center md:text-left w-full md:w-auto">
          <h3 className="font-black text-2xl flex items-center justify-center md:justify-start gap-3"><Truck className="text-rose-500"/> Suppliers</h3>
          <p className="text-slate-400 text-sm mt-1">ပွဲရုံ/ဒိုင် စာရင်းနှင့် ပေးရန်ကျန်ငွေ မှတ်တမ်းများ</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:min-w-[250px]">
            <Search size={20} className="absolute left-4 top-3.5 text-slate-500"/>
            <input type="text" placeholder="အမည် သို့မဟုတ် ဖုန်းဖြင့် ရှာရန်..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border border-rose-500/20 rounded-xl outline-none focus:border-rose-400 text-sm"/>
          </div>
          <button onClick={openAddModal} className="bg-rose-600 text-white px-5 py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-rose-500 transition-colors active:scale-95 shadow-lg shadow-rose-900/50">
            <Plus size={20}/> အသစ်ထည့်မည်
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         <div className="bg-[#0d1120] p-5 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl"><Truck size={24}/></div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Total Suppliers</p>
              <p className="text-xl font-black">{suppliers.length}</p>
            </div>
         </div>
         <div className="bg-[#0d1120] p-5 rounded-2xl border border-rose-500/20 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl"><DollarSign size={24}/></div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Total Payable Debt</p>
              <p className="text-xl font-black text-rose-400">
                {suppliers.reduce((sum, s) => sum + (Number(s.totalDebt) || 0), 0).toLocaleString()} Ks
              </p>
            </div>
         </div>
      </div>

      {/* 🌟 Mobile Responsive Card View / Table View */}
      <div className="bg-[#0d1120] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 text-slate-400">
              <tr>
                <th className="p-4 font-bold">Supplier Info</th>
                <th className="p-4 font-bold">Contact</th>
                <th className="p-4 font-bold text-right">Payable Balance</th>
                <th className="p-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading suppliers...</td></tr>}
              {!loading && filteredSuppliers.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Supplier မတွေ့ပါ။</td></tr>}
              
              {filteredSuppliers.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-white text-base">{s.name}</p>
                  </td>
                  <td className="p-4 text-slate-400">
                    <p>{s.phone || '-'}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.address || '-'}</p>
                  </td>
                  <td className="p-4 text-right">
                    {Number(s.totalDebt) > 0 ? (
                       <span className="font-black text-rose-400 text-base">{Number(s.totalDebt).toLocaleString()} Ks</span>
                    ) : (
                       <span className="font-bold text-green-500 text-sm">ရှင်းပြီး</span>
                    )}
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button onClick={() => openPaymentModal(s)} disabled={Number(s.totalDebt) <= 0} className={`p-2 rounded-lg transition-colors ${Number(s.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 active:scale-95' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`} title="ငွေချေမည်"><DollarSign size={18}/></button>
                    <button onClick={() => viewLedger(s)} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors active:scale-95" title="မှတ်တမ်းကြည့်မည်"><ClipboardList size={18}/></button>
                    <button onClick={() => openEditModal(s)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40 transition-colors active:scale-95" title="ပြင်မည်"><Edit3 size={18}/></button>
                    <button onClick={() => handleDeleteSupplier(s.id, s.name, Number(s.totalDebt))} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40 transition-colors active:scale-95" title="ဖျက်မည်"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden p-4 space-y-4">
          {loading && <p className="text-center text-slate-500 py-4">Loading suppliers...</p>}
          {!loading && filteredSuppliers.length === 0 && <p className="text-center text-slate-500 py-4">Supplier မတွေ့ပါ။</p>}
          
          {filteredSuppliers.map(s => (
            <div key={s.id} className="bg-black/30 border border-white/5 p-4 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-lg">{s.name}</h4>
                  {s.phone && <p className="text-slate-400 text-xs mt-1 flex items-center gap-1"><Phone size={12}/> {s.phone}</p>}
                  {s.address && <p className="text-slate-500 text-[10px] mt-1 line-clamp-1">{s.address}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Payable</p>
                  {Number(s.totalDebt) > 0 ? (
                    <p className="font-black text-rose-400 text-lg leading-tight">{Number(s.totalDebt).toLocaleString()} <span className="text-xs">Ks</span></p>
                  ) : (
                    <p className="font-bold text-green-500 text-sm mt-1">ရှင်းပြီး</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
                <button onClick={() => openPaymentModal(s)} disabled={Number(s.totalDebt) <= 0} className={`py-2 flex justify-center items-center rounded-xl transition-all ${Number(s.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 active:bg-amber-600/40' : 'bg-gray-800 text-gray-600'}`}>
                  <DollarSign size={20}/>
                </button>
                <button onClick={() => viewLedger(s)} className="py-2 flex justify-center items-center bg-blue-600/20 text-blue-400 rounded-xl active:bg-blue-600/40 transition-all">
                  <ClipboardList size={20}/>
                </button>
                <button onClick={() => openEditModal(s)} className="py-2 flex justify-center items-center bg-indigo-600/20 text-indigo-400 rounded-xl active:bg-indigo-600/40 transition-all">
                  <Edit3 size={20}/>
                </button>
                <button onClick={() => handleDeleteSupplier(s.id, s.name, Number(s.totalDebt))} className="py-2 flex justify-center items-center bg-rose-600/20 text-rose-400 rounded-xl active:bg-rose-600/40 transition-all">
                  <Trash2 size={20}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Add/Edit Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleSaveSupplier} className="bg-[#0d1120] border-t-2 sm:border-2 border-rose-500/20 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-rose-400">{editingSupplier ? 'Supplier ပြင်ရန်' : 'Supplier အသစ်'}</h3>
              <button type="button" onClick={() => setSupplierModalOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">ပွဲရုံ/ဒိုင် အမည် *</label>
                <input required value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm, name: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-rose-500 text-sm" placeholder="e.g. ABC Trading"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">ဖုန်းနံပါတ် (Optional)</label>
                <input type="tel" value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm, phone: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-rose-500 text-sm" placeholder="09..."/>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">လိပ်စာ (Optional)</label>
                <textarea value={supplierForm.address} onChange={e=>setSupplierForm({...supplierForm, address: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-rose-500 text-sm custom-scrollbar" rows="2" placeholder="လိပ်စာ..."></textarea>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-rose-600 text-white font-black py-4 rounded-xl active:bg-rose-700 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-rose-900/50">
              <Save size={20}/> {loading ? 'Saving...' : 'သိမ်းမည်'}
            </button>
          </form>
        </div>
      )}

      {/* 2. Payment Modal */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handlePayment} className="bg-[#0d1120] border-t-2 sm:border-2 border-amber-500/30 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-amber-400">ငွေပေးချေမှုမှတ်တမ်း</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={24}/></button>
            </div>
            <div className="bg-black/40 p-5 rounded-2xl mb-6 text-center border border-white/5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payable Balance</p>
              <p className="text-3xl font-black text-rose-400 mt-2">{Number(selectedSupplier.totalDebt).toLocaleString()} <span className="text-sm">Ks</span></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">ပေးချေမည့် ငွေပမာဏ *</label>
                <input type="number" required max={selectedSupplier.totalDebt + 10} value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full mt-1 bg-black/50 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-xl font-black outline-none focus:border-amber-400 text-center tracking-wider" placeholder="0"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">မှတ်ချက် (Optional)</label>
                <input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm, note: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-amber-400 text-sm" placeholder="ဥပမာ - KBZ Pay ဖြင့်လွှဲသည်"/>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-amber-600 text-white font-black py-4 rounded-xl active:bg-amber-700 transition-colors shadow-lg shadow-amber-900/50">
              {loading ? 'Processing...' : 'ငွေချေမည်'}
            </button>
          </form>
        </div>
      )}

      {/* 3. Ledger Modal */}
      {isLedgerModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0d1120] border-t-2 sm:border-2 border-blue-500/20 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 overflow-hidden">
            <div className="p-5 sm:p-6 pb-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-blue-400 flex items-center gap-2"><ClipboardList size={20}/> {selectedSupplier.name}</h3>
                <p className="text-xs text-slate-400 mt-1 font-bold">Current Payable: <span className="text-rose-400 text-sm">{Number(selectedSupplier.totalDebt).toLocaleString()} Ks</span></p>
              </div>
              <button onClick={() => setLedgerModalOpen(false)} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 bg-black/10">
              {ledgers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <ClipboardList size={48} className="text-slate-500 mb-3"/>
                  <p className="text-center text-slate-400 font-bold">မှတ်တမ်း မရှိသေးပါ။</p>
                  <p className="text-center text-xs text-slate-500 mt-1">အကြွေးဝယ်ထားခြင်း (သို့) ငွေချေထားခြင်း မှတ်တမ်းများ ဤနေရာတွင် ပေါ်ပါမည်။</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ledgers.map(record => (
                    <div key={record.id} className="bg-[#12182b] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-blue-500/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${record.type === 'Supplier Payment' ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {record.type === 'Supplier Payment' ? 'Payment Out' : 'Credit Purchase'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">{record.date} {record.time}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{record.type === 'Purchase' ? `Voucher: ${record.voucherNo || '-'}` : (record.note || 'ငွေချေခြင်း')}</p>
                        {record.type === 'Purchase' && <p className="text-[11px] font-bold text-slate-500 mt-1">Total Bill: {Number(record.amount).toLocaleString()} • Paid: {Number(record.paidAmount).toLocaleString()}</p>}
                      </div>
                      <div className="text-left sm:text-right pt-2 sm:pt-0 border-t border-white/5 sm:border-0 mt-2 sm:mt-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{record.type === 'Supplier Payment' ? 'Amount Paid' : 'Debt Added'}</p>
                        {record.type === 'Supplier Payment' ? (
                          <p className="text-lg font-black text-green-400 mt-0.5">-{Number(record.amount).toLocaleString()} <span className="text-xs">Ks</span></p>
                        ) : (
                          <p className="text-lg font-black text-rose-400 mt-0.5">+{Number(record.remainingDebt).toLocaleString()} <span className="text-xs">Ks</span></p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-black/40 text-center block sm:hidden">
               <button onClick={() => setLedgerModalOpen(false)} className="w-full py-3 bg-white/10 rounded-xl text-sm font-bold text-white active:bg-white/20">Close View</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
