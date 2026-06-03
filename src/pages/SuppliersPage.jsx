import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { Truck, Search, Plus, Edit3, Trash2, DollarSign, ClipboardList, X, History, Receipt, ChevronDown, ChevronUp, Download, Upload } from 'lucide-react';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';

export default function SuppliersPage() {
  // 🌟 Permission စစ်ဆေးရန် hasPermission ကို ယူပါသည်
  const { profile, hasPermission } = useAuth();
  const tenantId = profile?.tenantId;
  const isAdmin = profile?.role === 'admin';

  const [activeTab, setActiveTab] = useState('book');
  const [suppliers, setSuppliers] = useState([]);
  const [allRecords, setAllRecords] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [autoMergeDone, setAutoMergeDone] = useState(false);

  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [expandedSupp, setExpandedSupp] = useState({});
  const [expandedHist, setExpandedHist] = useState({});
  const toggleSupp = (id) => setExpandedSupp(p => ({ ...p, [id]: !p[id] }));
  const toggleHist = (name) => setExpandedHist(p => ({ ...p, [name]: !p[name] }));

  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const fileRef = useRef(null); 

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const suppQ = query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId));
      const suppSnap = await getDocs(suppQ);
      const suppData = suppSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      suppData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setSuppliers(suppData);

      const recQ = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId));
      const recSnap = await getDocs(recQ);
      setAllRecords(recSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error("Error fetching data:", error); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  useEffect(() => {
    if (suppliers.length > 0 && allRecords.length > 0 && !autoMergeDone) checkAndMergeDuplicates();
  }, [suppliers, allRecords, autoMergeDone]);

  const checkAndMergeDuplicates = async () => {
    const groups = {};
    let hasDuplicates = false;
    suppliers.forEach(s => {
      const key = `${(s.name || '').trim().toLowerCase()}_${(s.phone || '').trim()}_${(s.address || '').trim().toLowerCase()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
      if (groups[key].length > 1) hasDuplicates = true;
    });

    if (!hasDuplicates) return setAutoMergeDone(true);

    try {
      const batch = writeBatch(db);
      let mergedCount = 0;
      for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
          group.sort((a, b) => (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0));
          const primary = group[0];
          let additionalDebt = 0;
          for (let i = 1; i < group.length; i++) {
            const duplicate = group[i];
            additionalDebt += (Number(duplicate.totalDebt) || 0);
            const dupRecords = allRecords.filter(r => r.supplierId === duplicate.id);
            dupRecords.forEach(rec => batch.update(doc(db, 'pos_records', rec.id), { supplierId: primary.id }));
            batch.delete(doc(db, 'pos_suppliers', duplicate.id));
            mergedCount++;
          }
          if (additionalDebt > 0) batch.update(doc(db, 'pos_suppliers', primary.id), { totalDebt: increment(additionalDebt) });
        }
      }
      if (mergedCount > 0) { await batch.commit(); fetchData(); }
    } catch (error) { console.error("Auto merge error:", error); } 
    finally { setAutoMergeDone(true); }
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const lowerSearch = searchTerm.toLowerCase();
    return suppliers.filter(s => (s.name || '').toLowerCase().includes(lowerSearch) || (s.phone || '').includes(lowerSearch));
  }, [suppliers, searchTerm]);

  const mergedHistory = useMemo(() => {
    const payments = allRecords.filter(r => r.type === 'Supplier Payment');
    const merged = {};
    payments.forEach(p => {
      const sId = p.supplierId || p.personName;
      if (!merged[sId]) merged[sId] = { supplierId: p.supplierId, personName: p.personName, totalPaid: 0, paymentCount: 0, lastPaymentDate: p.date, details: [] };
      merged[sId].totalPaid += Number(p.amount) || 0;
      merged[sId].paymentCount += 1;
      merged[sId].details.push(p);
      if (new Date(p.date) > new Date(merged[sId].lastPaymentDate)) merged[sId].lastPaymentDate = p.date;
    });
    let historyArr = Object.values(merged).sort((a, b) => new Date(b.lastPaymentDate) - new Date(a.lastPaymentDate));
    if (searchTerm.trim()) historyArr = historyArr.filter(h => (h.personName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return historyArr;
  }, [allRecords, searchTerm]);

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!hasPermission('create_purchase')) return showToast("လုပ်ပိုင်ခွင့် မရှိပါ။", "error"); // 🌟 Guard

    const nName = supplierForm.name.trim();
    if (!nName) return showToast("Supplier အမည် ထည့်ပါ", "error");
    setLoading(true);

    try {
      if (!editingSupplier) {
        const key = `${nName.toLowerCase()}_${supplierForm.phone.trim()}_${supplierForm.address.trim().toLowerCase()}`;
        const existing = suppliers.find(s => `${(s.name||'').trim().toLowerCase()}_${(s.phone||'').trim()}_${(s.address||'').trim().toLowerCase()}` === key);
        if (existing) {
           setSupplierModalOpen(false); setLoading(false);
           return showToast("စာရင်းရှိပြီးသား ဖြစ်ပါသည်။", "warning"); 
        }
      }

      const payload = { name: nName, phone: supplierForm.phone.trim(), address: supplierForm.address.trim(), tenantId: tenantId, updatedAt: serverTimestamp() };
      if (editingSupplier) await setDoc(doc(db, 'pos_suppliers', editingSupplier.id), payload, { merge: true });
      else await addDoc(collection(db, 'pos_suppliers'), { ...payload, totalDebt: 0, createdAt: serverTimestamp() });
      
      setSupplierModalOpen(false); showToast("သိမ်းဆည်းပြီးပါပြီ", "success"); fetchData();
    } catch (error) { console.error(error); showToast("Error saving", "error"); }
    setLoading(false);
  };

  const handleDeleteSupplier = (id, name, debt) => {
    if (!hasPermission('create_purchase')) return; // 🌟 Guard
    if (debt > 0) return showToast(`${name} သို့ ပေးရန်ကျန်ငွေ ရှိနေသဖြင့် ဖျက်၍မရပါ။`, "error");
    setConfirmDialog({
      isOpen: true, title: "Supplier ဖျက်သိမ်းခြင်း", message: `"${name}" ကို ဖျက်ရန် သေချာပါသလား?`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try { await deleteDoc(doc(db, 'pos_suppliers', id)); showToast("ဖျက်သိမ်းပြီးပါပြီ", "success"); fetchData(); } 
        catch (error) { console.error(error); showToast("Error deleting", "error"); }
      }
    });
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!hasPermission('create_purchase')) return showToast("ငွေချေခွင့် မရှိပါ။", "error"); // 🌟 Guard

    const payAmount = Number(paymentForm.amount);
    if (!payAmount || payAmount <= 0) return showToast("ငွေပမာဏ မှန်ကန်စွာထည့်ပါ။", "error");
    if (payAmount > selectedSupplier.totalDebt + 10) return showToast("ဆပ်သည့်ငွေသည် အကြွေးထက် များနေပါသည်။", "error");

    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'pos_suppliers', selectedSupplier.id), { totalDebt: increment(-payAmount) });
      batch.set(doc(collection(db, 'pos_records')), {
        type: 'Supplier Payment', tenantId: tenantId, supplierId: selectedSupplier.id, personName: selectedSupplier.name, 
        amount: payAmount, note: paymentForm.note || 'ပွဲရုံသို့ ငွေချေသည်', date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cashier: profile?.username || profile?.name || 'Admin', createdAt: serverTimestamp()
      });
      await batch.commit(); setPaymentModalOpen(false); showToast("ငွေချေမှတ်တမ်း သိမ်းပြီးပါပြီ", "success"); fetchData();
    } catch (error) { console.error(error); showToast("Error saving payment", "error"); }
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (suppliers.length === 0) return showToast("Export ထုတ်ရန် Supplier မရှိပါ။", "warning");
    let csv = "Name,Phone,Address,Total Debt\n";
    suppliers.forEach(s => { csv += `"${s.name || ''}","${s.phone || ''}","${s.address || ''}","${s.totalDebt || 0}"\n`; });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Suppliers_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    showToast("CSV ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ", "success");
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setConfirmDialog({
      isOpen: true, title: "Supplier CSV သွင်းခြင်း", message: "Supplier စာရင်းအသစ်များကို Database သို့ ထည့်သွင်းမှာ သေချာပါသလား?",
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false }); setLoading(true);
        try {
          const text = await file.text();
          const rows = text.split('\n').filter(r => r.trim() !== '');
          if (rows.length <= 1) { setLoading(false); return showToast("ဖိုင်ထဲတွင် ဒေတာမရှိပါ။", "warning"); }

          let batch = writeBatch(db); let count = 0;
          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
            if (!cols[0]) continue; 
            batch.set(doc(collection(db, 'pos_suppliers')), {
              tenantId: tenantId, name: cols[0], phone: cols[1] || '', address: cols[2] || '', totalDebt: Number(cols[3]) || 0,
              createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            count++;
            if (count % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
          }
          if (count % 400 !== 0) await batch.commit();
          showToast(`${count} ခု အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`, "success"); fetchData();
        } catch (error) { console.error(error); showToast("Import လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။", "error"); }
        setLoading(false); if (fileRef.current) fileRef.current.value = '';
      }
    });
  };

  const currentLedger = useMemo(() => {
    if (!selectedSupplier) return [];
    const relevant = allRecords.filter(r => (r.supplierId === selectedSupplier.id || r.personName === selectedSupplier.name) && (r.type === 'Supplier Payment' || (r.type === 'Purchase' && Number(r.remainingDebt) > 0)));
    relevant.sort((a, b) => (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0));
    let runningBalance = 0;
    return relevant.map(r => {
      if (r.type === 'Purchase') runningBalance += Number(r.remainingDebt);
      if (r.type === 'Supplier Payment') runningBalance -= Number(r.amount);
      return { ...r, runningBalance };
    }).reverse();
  }, [allRecords, selectedSupplier]);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />

      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-4 sm:p-6 rounded-3xl border border-rose-500/15 shadow-xl gap-5 animate-in fade-in">
        <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-2xl border border-white/5 w-full md:w-auto">
          <button onClick={() => setActiveTab('book')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'book' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><Truck size={18}/> Supplier Book</button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'history' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><History size={18}/> Payment History</button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search size={18} className="absolute left-4 top-3.5 text-slate-500"/>
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-black/50 border border-rose-500/20 rounded-xl outline-none focus:border-rose-400 text-sm"/>
          </div>
          {activeTab === 'book' && (
            <div className="flex gap-2">
              {/* 🌟 Import/Export ကို Admin သီးသန့် ကန့်သတ်ထားသည် */}
              {isAdmin && (
                <>
                  <button onClick={handleExportCSV} className="bg-emerald-600/20 text-emerald-400 p-3 rounded-xl hover:bg-emerald-600/40 transition-colors" title="Export CSV"><Download size={20}/></button>
                  <button onClick={() => fileRef.current?.click()} className="bg-amber-600/20 text-amber-400 p-3 rounded-xl hover:bg-amber-600/40 transition-colors" title="Import CSV"><Upload size={20}/></button>
                  <input type="file" accept=".csv" ref={fileRef} onChange={handleImportCSV} className="hidden"/>
                </>
              )}
              {/* 🌟 ပေါင်းထည့်ခွင့်ကို Permission စစ်ထားသည် */}
              {hasPermission('create_purchase') && (
                <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', address: '' }); setSupplierModalOpen(true); }} className="bg-rose-600 text-white px-5 py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-rose-500 transition-colors shadow-lg active:scale-95"><Plus size={20}/> Add</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0d1120] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        {activeTab === 'book' && (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/40 text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Supplier Info</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs">Contact</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Payable Balance</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-xs text-center w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredSuppliers.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-500">No Suppliers</td></tr> : 
                  filteredSuppliers.map(s => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-white text-base">{s.name}</td>
                      <td className="p-4 text-slate-400"><p>{s.phone || '-'}</p><p className="text-xs text-slate-500 truncate max-w-[200px]">{s.address || '-'}</p></td>
                      <td className="p-4 text-right">{Number(s.totalDebt) > 0 ? <span className="font-black text-rose-400 text-base">{Number(s.totalDebt).toLocaleString()} Ks</span> : <span className="font-bold text-green-500 text-sm">ရှင်းပြီး</span>}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          {/* 🌟 Permission စစ်ဆေးထားသည် */}
                          <button onClick={() => { setSelectedSupplier(s); setLedgerModalOpen(true); }} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors active:scale-95" title="မှတ်တမ်းကြည့်မည်"><ClipboardList size={16}/></button>
                          {hasPermission('create_purchase') && (
                            <>
                              <button onClick={() => { setSelectedSupplier(s); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); }} disabled={Number(s.totalDebt) <= 0} className={`p-2 rounded-lg transition-colors ${Number(s.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 active:scale-95' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`} title="ငွေချေမည်"><DollarSign size={16}/></button>
                              <button onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone || '', address: s.address || '' }); setSupplierModalOpen(true); }} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40 transition-colors active:scale-95" title="ပြင်မည်"><Edit3 size={16}/></button>
                              <button onClick={() => handleDeleteSupplier(s.id, s.name, Number(s.totalDebt))} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40 transition-colors active:scale-95" title="ဖျက်မည်"><Trash2 size={16}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="block sm:hidden divide-y divide-white/5">
              {filteredSuppliers.map(s => {
                const isExpanded = expandedSupp[s.id];
                return (
                  <div key={s.id} className="bg-[#0d1120] transition-colors">
                    <div onClick={() => toggleSupp(s.id)} className="p-4 flex justify-between items-center cursor-pointer">
                      <div className="flex-1">
                        <h4 className="font-bold text-white text-base">{s.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{s.phone || 'No phone'}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payable</p>
                        {Number(s.totalDebt) > 0 ? <p className="font-black text-rose-400 text-lg leading-none">{Number(s.totalDebt).toLocaleString()} Ks</p> : <p className="font-bold text-green-500 text-sm leading-none">ရှင်းပြီး</p>}
                      </div>
                      <div className="ml-4 pl-4 border-l border-white/10">{isExpanded ? <ChevronUp size={20} className="text-rose-400"/> : <ChevronDown size={20} className="text-slate-500"/>}</div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-black/40 border-t border-rose-500/10 space-y-4">
                        {s.address && <p className="text-xs text-slate-300 bg-black/50 p-3 rounded-xl border border-white/5"><span className="text-slate-500 font-bold block mb-1">Address:</span> {s.address}</p>}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
                          {/* 🌟 Permission စစ်ဆေးထားသည် */}
                          <button onClick={() => { setSelectedSupplier(s); setLedgerModalOpen(true); }} className="py-2.5 flex justify-center items-center bg-blue-600/20 text-blue-400 rounded-xl active:bg-blue-600/40 transition-all"><ClipboardList size={20}/></button>
                          {hasPermission('create_purchase') && (
                            <>
                              <button onClick={() => { setSelectedSupplier(s); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); }} disabled={Number(s.totalDebt) <= 0} className={`py-2.5 flex justify-center items-center rounded-xl transition-all ${Number(s.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 active:bg-amber-600/40' : 'bg-gray-800 text-gray-600'}`}><DollarSign size={20}/></button>
                              <button onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone || '', address: s.address || '' }); setSupplierModalOpen(true); }} className="py-2.5 flex justify-center items-center bg-indigo-600/20 text-indigo-400 rounded-xl active:bg-indigo-600/40 transition-all"><Edit3 size={20}/></button>
                              <button onClick={() => handleDeleteSupplier(s.id, s.name, Number(s.totalDebt))} className="py-2.5 flex justify-center items-center bg-rose-600/20 text-rose-400 rounded-xl active:bg-rose-600/40 transition-all"><Trash2 size={20}/></button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Payment History Tab ... (No actions here) */}
        {activeTab === 'history' && (
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
               <thead className="bg-black/40 text-slate-400 border-b border-white/5">
                 <tr><th className="p-4 font-bold uppercase tracking-wider text-xs">Supplier Name</th><th className="p-4 font-bold uppercase tracking-wider text-xs text-center">Payment Count</th><th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Total Paid (Merged)</th><th className="p-4 font-bold uppercase tracking-wider text-xs text-right">Last Payment</th></tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {mergedHistory.map((h, i) => (
                   <tr key={i} className="hover:bg-white/[0.02] transition-colors"><td className="p-4 font-bold text-white text-base">{h.personName}</td><td className="p-4 text-center text-rose-400 font-bold">{h.paymentCount} ကြိမ်</td><td className="p-4 text-right font-black text-green-400 text-base">+{h.totalPaid.toLocaleString()} Ks</td><td className="p-4 text-right text-slate-400">{h.lastPaymentDate}</td></tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleSaveSupplier} className="bg-[#0d1120] border border-rose-500/30 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-rose-400 tracking-wide">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3><button type="button" onClick={() => setSupplierModalOpen(false)} className="text-slate-400 hover:text-white p-1 bg-white/5 rounded-full"><X size={20}/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">အမည် *</label><input required value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm, name: e.target.value})} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm"/></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">ဖုန်းနံပါတ်</label><input type="tel" value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm, phone: e.target.value})} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm"/></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">လိပ်စာ</label><textarea value={supplierForm.address} onChange={e=>setSupplierForm({...supplierForm, address: e.target.value})} className="w-full bg-black/50 border border-rose-500/20 rounded-xl p-3.5 text-white outline-none focus:border-rose-400 text-sm custom-scrollbar" rows="2"></textarea></div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-rose-600 text-white font-black py-3.5 rounded-xl active:scale-95 transition-transform">သိမ်းမည်</button>
          </form>
        </div>
      )}

      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handlePayment} className="bg-[#0d1120] border border-amber-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-amber-400 tracking-wide">ငွေပေးချေမှုမှတ်တမ်း</h3><button type="button" onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-1 bg-white/5 rounded-full"><X size={20}/></button></div>
            <div className="bg-black/40 p-5 rounded-2xl mb-6 text-center border border-white/5 shadow-inner"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payable Balance</p><p className="text-3xl font-black text-rose-400 mt-2">{Number(selectedSupplier.totalDebt).toLocaleString()} <span className="text-sm">Ks</span></p></div>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">ပေးချေမည့် ငွေပမာဏ *</label><input type="number" required max={selectedSupplier.totalDebt + 10} value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full bg-black/50 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-xl font-black outline-none focus:border-amber-400 text-center tracking-wider"/></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">မှတ်ချက်</label><input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm, note: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-amber-400 text-sm"/></div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-amber-600 text-white font-black py-4 rounded-xl active:scale-95 transition-transform">ငွေချေမည်</button>
          </form>
        </div>
      )}

      {/* Ledger Modal & Receipt Modal... (Same as CustomersPage) */}
    </div>
  );
}
