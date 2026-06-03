import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { Users, Search, Plus, Edit3, Trash2, DollarSign, ClipboardList, X, History, Receipt } from 'lucide-react';

export default function CustomersPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [activeTab, setActiveTab] = useState('book'); // 'book' or 'history'
  const [customers, setCustomers] = useState([]);
  const [allRecords, setAllRecords] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 🌟 Auto-Merge ပြီး/မပြီး မှတ်သားရန် State
  const [autoMergeDone, setAutoMergeDone] = useState(false);

  // Modals State
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });

  // Form States
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // --- Fetch Data ---
  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const custQ = query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId));
      const custSnap = await getDocs(custQ);
      const custData = custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      custData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCustomers(custData);

      const recQ = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId));
      const recSnap = await getDocs(recQ);
      setAllRecords(recSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  // 🌟 --- BACKGROUND AUTO MERGE (ခလုတ်နှိပ်စရာမလိုဘဲ အလိုအလျောက် ပေါင်းပေးခြင်း) --- 🌟
  useEffect(() => {
    if (customers.length > 0 && allRecords.length > 0 && !autoMergeDone) {
      checkAndMergeDuplicates();
    }
  }, [customers, allRecords, autoMergeDone]);

  const checkAndMergeDuplicates = async () => {
    const groups = {};
    let hasDuplicates = false;
    
    // နာမည်၊ ဖုန်း၊ လိပ်စာ တူသူများကို ရှာဖွေ Group ဖွဲ့မည်
    customers.forEach(c => {
      const n = (c.name || '').trim().toLowerCase();
      const p = (c.phone || '').trim();
      const a = (c.address || '').trim().toLowerCase();
      const key = `${n}_${p}_${a}`;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
      if (groups[key].length > 1) hasDuplicates = true;
    });

    // တူတာမရှိရင် ဘာမှလုပ်စရာမလိုပါ
    if (!hasDuplicates) {
      setAutoMergeDone(true);
      return;
    }

    try {
      const batch = writeBatch(db);
      let mergedCount = 0;

      for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
          // အဟောင်းဆုံးအကောင့်ကို မူရင်း (Primary) အဖြစ်ထားမည်
          group.sort((a, b) => (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0));
          
          const primary = group[0];
          let additionalDebt = 0;

          // ကျန်သည့် အကောင့်ပွားများကို ပေါင်းမည်
          for (let i = 1; i < group.length; i++) {
            const duplicate = group[i];
            additionalDebt += (Number(duplicate.totalDebt) || 0);

            // အကောင့်ပွားတွင်ရှိသော အရောင်း/ငွေသွင်းမှတ်တမ်းများကို Primary ထံသို့ ပြောင်းရွှေ့မည်
            const dupRecords = allRecords.filter(r => r.customerId === duplicate.id);
            dupRecords.forEach(rec => {
              batch.update(doc(db, 'pos_records', rec.id), { customerId: primary.id });
            });

            // အကောင့်ပွားကို ဖျက်မည်
            batch.delete(doc(db, 'pos_customers', duplicate.id));
            mergedCount++;
          }

          // Primary အကောင့်သို့ အကြွေးများ စုပေါင်းထည့်မည်
          if (additionalDebt > 0) {
            batch.update(doc(db, 'pos_customers', primary.id), {
              totalDebt: increment(additionalDebt)
            });
          }
        }
      }

      if (mergedCount > 0) {
        await batch.commit();
        fetchData(); // ပေါင်းပြီးတာနဲ့ ဒေတာပြန်ခေါ်မည်
      }
    } catch (error) {
      console.error("Auto merge error:", error);
    } finally {
      setAutoMergeDone(true); // တစ်ခါလုပ်ပြီးပါက နောက်တစ်ခါ ထပ်မလုပ်စေရန်
    }
  };

  // --- Search Filter ---
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const lowerSearch = searchTerm.toLowerCase();
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(lowerSearch) || 
      (c.phone || '').includes(lowerSearch)
    );
  }, [customers, searchTerm]);

  // --- History Merge Logic ---
  const mergedHistory = useMemo(() => {
    const payments = allRecords.filter(r => r.type === 'Customer Payment');
    const merged = {};

    payments.forEach(p => {
      const cId = p.customerId || p.personName;
      if (!merged[cId]) {
        merged[cId] = {
          customerId: p.customerId,
          personName: p.personName,
          totalPaid: 0,
          paymentCount: 0,
          lastPaymentDate: p.date,
          details: []
        };
      }
      merged[cId].totalPaid += Number(p.amount) || 0;
      merged[cId].paymentCount += 1;
      merged[cId].details.push(p);
      
      if (new Date(p.date) > new Date(merged[cId].lastPaymentDate)) {
        merged[cId].lastPaymentDate = p.date;
      }
    });

    let historyArr = Object.values(merged).sort((a, b) => new Date(b.lastPaymentDate) - new Date(a.lastPaymentDate));
    if (searchTerm.trim()) {
      historyArr = historyArr.filter(h => (h.personName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return historyArr;
  }, [allRecords, searchTerm]);

  // --- Save Customer ---
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const nName = customerForm.name.trim();
    const nPhone = customerForm.phone.trim();
    const nAddress = customerForm.address.trim();

    if (!nName) return alert("Customer အမည် ထည့်ပါ");
    setLoading(true);

    try {
      // အသစ်ထည့်မည်ဆိုပါက နာမည်၊ ဖုန်း၊ လိပ်စာ တူသူ ရှိ/မရှိ စစ်ဆေးပြီး ရှိပါက မထည့်တော့ပါ
      if (!editingCustomer) {
        const key = `${nName.toLowerCase()}_${nPhone}_${nAddress.toLowerCase()}`;
        const existing = customers.find(c => {
           const cKey = `${(c.name||'').trim().toLowerCase()}_${(c.phone||'').trim()}_${(c.address||'').trim().toLowerCase()}`;
           return cKey === key;
        });

        if (existing) {
           setCustomerModalOpen(false);
           setLoading(false);
           return; // တူတာရှိနေပြီးဖြစ်၍ ဘာမှမလုပ်ဘဲ ထွက်မည်
        }
      }

      const payload = {
        name: nName, phone: nPhone, address: nAddress,
        tenantId: tenantId, updatedAt: serverTimestamp()
      };

      if (editingCustomer) {
        await setDoc(doc(db, 'pos_customers', editingCustomer.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, 'pos_customers'), { ...payload, totalDebt: 0, createdAt: serverTimestamp() });
      }
      setCustomerModalOpen(false);
      fetchData();
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // --- Delete Customer ---
  const handleDeleteCustomer = async (id, name, debt) => {
    if (debt > 0) return alert(`အမှား: ${name} တွင် ပေးရန်ကျန်ငွေ (${debt.toLocaleString()} Ks) ရှိနေသဖြင့် ဖျက်၍မရပါ။`);
    if (!window.confirm(`${name} ကို ဖျက်ရန် သေချာပါသလား?`)) return;
    try {
      await deleteDoc(doc(db, 'pos_customers', id));
      fetchData();
    } catch (error) { console.error(error); }
  };

  // --- Handle Payment ---
  const handlePayment = async (e) => {
    e.preventDefault();
    const payAmount = Number(paymentForm.amount);
    if (!payAmount || payAmount <= 0) return alert("ငွေပမာဏ မှန်ကန်စွာထည့်ပါ။");
    if (payAmount > selectedCustomer.totalDebt + 10) return alert(`ဆပ်သည့်ငွေသည် ကျန်ရှိသောအကြွေး (${selectedCustomer.totalDebt.toLocaleString()}) ထက် များနေပါသည်။`);

    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'pos_customers', selectedCustomer.id), { totalDebt: increment(-payAmount) });
      
      batch.set(doc(collection(db, 'pos_records')), {
        type: 'Customer Payment', tenantId: tenantId, customerId: selectedCustomer.id, personName: selectedCustomer.name, 
        amount: payAmount, note: paymentForm.note || 'အကြွေးလာဆပ်သည်', date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cashier: profile?.username || profile?.name || 'Admin', createdAt: serverTimestamp()
      });

      await batch.commit();
      setPaymentModalOpen(false);
      fetchData();
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // --- Ledger Calculation ---
  const currentLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    const relevant = allRecords.filter(r => 
      (r.customerId === selectedCustomer.id || r.personName === selectedCustomer.name) &&
      (r.type === 'Customer Payment' || (r.type === 'Sale' && Number(r.remainingDebt) > 0))
    );
    
    relevant.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
      return timeA - timeB;
    });

    let runningBalance = 0;
    const withBalance = relevant.map(r => {
      if (r.type === 'Sale') runningBalance += Number(r.remainingDebt);
      if (r.type === 'Customer Payment') runningBalance -= Number(r.amount);
      return { ...r, runningBalance };
    });

    return withBalance.reverse();
  }, [allRecords, selectedCustomer]);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/15 shadow-xl gap-5 animate-in fade-in">
        <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-2xl border border-white/5 w-full md:w-auto">
          <button onClick={() => setActiveTab('book')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'book' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
            <Users size={18}/> Customer Book
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 ${activeTab === 'history' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
            <History size={18}/> Payment History
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:min-w-[250px]">
            <Search size={20} className="absolute left-4 top-3.5 text-slate-500"/>
            <input type="text" placeholder="အမည် သို့မဟုတ် ဖုန်းဖြင့် ရှာရန်..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400 text-sm"/>
          </div>
          {activeTab === 'book' && (
            <button onClick={() => { setEditingCustomer(null); setCustomerForm({ name: '', phone: '', address: '' }); setCustomerModalOpen(true); }} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-cyan-500 transition-colors active:scale-95 shadow-lg shadow-cyan-900/50">
              <Plus size={20}/> အသစ်ထည့်မည်
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {activeTab === 'book' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#0d1120] p-5 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl"><Users size={24}/></div>
              <div><p className="text-slate-400 text-xs font-bold uppercase">Total Customers</p><p className="text-xl font-black">{customers.length}</p></div>
          </div>
          <div className="bg-[#0d1120] p-5 rounded-2xl border border-amber-500/20 flex items-center gap-4 shadow-lg">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl"><DollarSign size={24}/></div>
              <div><p className="text-slate-400 text-xs font-bold uppercase">Total Pending Debt</p><p className="text-xl font-black text-amber-400">{customers.reduce((sum, c) => sum + (Number(c.totalDebt) || 0), 0).toLocaleString()} Ks</p></div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-[#0d1120] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        
        {/* --- CUSTOMER BOOK TAB --- */}
        {activeTab === 'book' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-slate-400">
                <tr>
                  <th className="p-4 font-bold">Customer Info</th>
                  <th className="p-4 font-bold">Contact</th>
                  <th className="p-4 font-bold text-right">Credit Balance</th>
                  <th className="p-4 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading...</td></tr> : filteredCustomers.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-500">Customer မတွေ့ပါ။</td></tr> : 
                filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-bold text-white text-base">{c.name}</td>
                    <td className="p-4 text-slate-400"><p>{c.phone || '-'}</p><p className="text-xs text-slate-500 truncate max-w-[200px]">{c.address || '-'}</p></td>
                    <td className="p-4 text-right">
                      {Number(c.totalDebt) > 0 ? <span className="font-black text-amber-400 text-base">{Number(c.totalDebt).toLocaleString()} Ks</span> : <span className="font-bold text-green-500 text-sm">ရှင်းပြီး</span>}
                    </td>
                    <td className="p-4 text-center space-x-2">
                      <button onClick={() => { setSelectedCustomer(c); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); }} disabled={Number(c.totalDebt) <= 0} className={`p-2 rounded-lg transition-colors ${Number(c.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 active:scale-95' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`} title="အကြွေးဆပ်မည်"><DollarSign size={18}/></button>
                      <button onClick={() => { setSelectedCustomer(c); setLedgerModalOpen(true); }} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors active:scale-95" title="မှတ်တမ်းကြည့်မည်"><ClipboardList size={18}/></button>
                      <button onClick={() => { setEditingCustomer(c); setCustomerForm({ name: c.name, phone: c.phone || '', address: c.address || '' }); setCustomerModalOpen(true); }} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40 transition-colors active:scale-95" title="ပြင်မည်"><Edit3 size={18}/></button>
                      <button onClick={() => handleDeleteCustomer(c.id, c.name, Number(c.totalDebt))} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40 transition-colors active:scale-95" title="ဖျက်မည်"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- PAYMENT HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-slate-400">
                <tr>
                  <th className="p-4 font-bold">Customer Name</th>
                  <th className="p-4 font-bold text-center">Payment Count</th>
                  <th className="p-4 font-bold text-right">Total Paid (Merged)</th>
                  <th className="p-4 font-bold text-right">Last Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mergedHistory.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-500">ငွေသွင်းမှတ်တမ်း မရှိသေးပါ။</td></tr> :
                mergedHistory.map((h, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-bold text-white text-base">{h.personName}</td>
                    <td className="p-4 text-center text-cyan-400 font-bold">{h.paymentCount} ကြိမ်</td>
                    <td className="p-4 text-right font-black text-green-400 text-base">+{h.totalPaid.toLocaleString()} Ks</td>
                    <td className="p-4 text-right text-slate-400">{h.lastPaymentDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. Add/Edit Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleSaveCustomer} className="bg-[#0d1120] border-2 border-cyan-500/20 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-cyan-400">{editingCustomer ? 'Customer ပြင်ရန်' : 'Customer အသစ်'}</h3>
              <button type="button" onClick={() => setCustomerModalOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1">အမည် *</label><input required value={customerForm.name} onChange={e=>setCustomerForm({...customerForm, name: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-cyan-500 text-sm"/></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1">ဖုန်းနံပါတ်</label><input type="tel" value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm, phone: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-cyan-500 text-sm"/></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1">လိပ်စာ</label><textarea value={customerForm.address} onChange={e=>setCustomerForm({...customerForm, address: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-cyan-500 text-sm custom-scrollbar" rows="2"></textarea></div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-cyan-600 text-white font-black py-4 rounded-xl active:bg-cyan-700">သိမ်းမည်</button>
          </form>
        </div>
      )}

      {/* 2. Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handlePayment} className="bg-[#0d1120] border-2 border-amber-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-amber-400">ငွေသွင်းမှတ်တမ်း</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
            </div>
            <div className="bg-black/40 p-5 rounded-2xl mb-6 text-center border border-white/5">
              <p className="text-xs font-bold text-slate-400 uppercase">Credit Balance</p>
              <p className="text-3xl font-black text-amber-400 mt-2">{Number(selectedCustomer.totalDebt).toLocaleString()} Ks</p>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1">ပေးသွင်းမည့် ငွေပမာဏ *</label><input type="number" required max={selectedCustomer.totalDebt + 10} value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full mt-1 bg-black/50 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-xl font-black outline-none focus:border-amber-400 text-center"/></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1">မှတ်ချက်</label><input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm, note: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-amber-400 text-sm"/></div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-amber-600 text-white font-black py-4 rounded-xl">ငွေသွင်းမည်</button>
          </form>
        </div>
      )}

      {/* 3. Ledger Modal (Clickable Invoices) */}
      {isLedgerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0d1120] border-2 border-blue-500/20 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 pb-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-xl font-black text-blue-400 flex items-center gap-2"><ClipboardList size={20}/> {selectedCustomer.name}</h3>
                <p className="text-xs text-slate-400 mt-1 font-bold">Current Debt: <span className="text-amber-400 text-sm">{Number(selectedCustomer.totalDebt).toLocaleString()} Ks</span></p>
              </div>
              <button onClick={() => setLedgerModalOpen(false)} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 p-6 bg-black/10">
              {currentLedger.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <p className="text-slate-400 font-bold">မှတ်တမ်း မရှိသေးပါ။</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentLedger.map(record => {
                    const isSale = record.type === 'Sale';
                    return (
                      <div 
                        key={record.id} 
                        onClick={() => isSale && setReceiptModal({ show: true, record })}
                        className={`bg-[#12182b] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${isSale ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-[#1a2235]' : 'hover:border-blue-500/30'}`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${!isSale ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                              {!isSale ? 'Payment In' : 'Credit Sale'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">{record.date} {record.time}</span>
                          </div>
                          
                          {isSale ? (
                             <div>
                               <p className="text-sm font-bold text-cyan-300 flex items-center gap-1.5"><Receipt size={14}/> Invoice: {record.voucherNo || '-'}</p>
                               <p className="text-[10px] text-cyan-600/70 mt-0.5 font-bold">ဘောက်ချာကြည့်ရန် နှိပ်ပါ</p>
                             </div>
                          ) : (
                             <p className="text-sm font-bold text-slate-200">{record.note || 'အကြွေးဆပ်ခြင်း'}</p>
                          )}
                          
                          {isSale && <p className="text-[11px] font-bold text-slate-500 mt-1">Total Bill: {Number(record.amount).toLocaleString()} • Paid: {Number(record.paidAmount).toLocaleString()}</p>}
                        </div>
                        <div className="text-left sm:text-right pt-2 sm:pt-0 border-t border-white/5 sm:border-0 mt-2 sm:mt-0">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{!isSale ? 'Amount Received' : 'Debt Added'}</p>
                          {!isSale ? (
                            <p className="text-lg font-black text-green-400 mt-0.5">-{Number(record.amount).toLocaleString()} <span className="text-xs">Ks</span></p>
                          ) : (
                            <p className="text-lg font-black text-amber-400 mt-0.5">+{Number(record.remainingDebt).toLocaleString()} <span className="text-xs">Ks</span></p>
                          )}
                          <p className="text-[10px] text-slate-500 mt-1">Bal: {Number(record.runningBalance).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Clickable Receipt Modal (Print View) */}
      {receiptModal.show && receiptModal.record && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-sm bg-white text-black rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans relative animate-in zoom-in-95">
            <button onClick={() => setReceiptModal({show:false, record:null})} className="absolute top-4 right-4 p-1 bg-gray-200 rounded-full text-gray-600 hover:bg-gray-300"><X size={20}/></button>
            
            <div className="text-center mb-4 mt-2">
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">RECEIPT</h2>
            </div>
            <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between"><span>Voucher No:</span> <span className="text-gray-900">{receiptModal.record.voucherNo}</span></div>
              <div className="flex justify-between"><span>Date:</span> <span className="text-gray-900">{receiptModal.record.date}</span></div>
              <div className="flex justify-between"><span>Customer:</span> <span className="text-gray-900">{receiptModal.record.personName}</span></div>
            </div>
            
            <div className="mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500"><th className="text-left py-2">Item</th><th className="text-right py-2">Amount</th></tr>
                </thead>
                <tbody>
                  {(receiptModal.record.itemsDetail || []).map((item,i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5"><div className="font-bold text-gray-800">{item.name}</div><div className="text-gray-500 text-[10px] mt-0.5">{item.quantity} x {Number(item.unitPrice).toLocaleString()}</div></td>
                      <td className="py-2.5 text-right font-bold text-gray-800 align-top">{Number((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-300 pt-3 mt-3 space-y-1 text-xs">
               <div className="flex justify-between text-gray-600"><span>Total Bill:</span><span>{Number(receiptModal.record.amount).toLocaleString()} Ks</span></div>
               <div className="flex justify-between text-gray-600"><span>Paid:</span><span>{Number(receiptModal.record.paidAmount).toLocaleString()} Ks</span></div>
               <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                 <span>Credit (အကြွေးကျန်):</span><span>{Number(receiptModal.record.remainingDebt).toLocaleString()} Ks</span>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
