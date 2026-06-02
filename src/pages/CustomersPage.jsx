import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, writeBatch, serverTimestamp, increment, orderBy, or } from 'firebase/firestore'; // 🌟 Added 'or' for better ledger query
import { useAuth } from '../context/AuthContext';
import { Users, Search, Plus, Edit3, Trash2, DollarSign, ClipboardList, X, Save, Phone } from 'lucide-react'; // 🌟 Added Phone icon

export default function CustomersPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [customers, setCustomers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);

  // Form States
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // --- Fetch Customers ---
  const fetchCustomers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by name
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [tenantId]);

  // --- Filter ---
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const lowerSearch = searchTerm.toLowerCase();
    return customers.filter(c => 
      (c.name || '').toLowerCase().includes(lowerSearch) || 
      (c.phone || '').includes(lowerSearch)
    );
  }, [customers, searchTerm]);

  // --- Save Customer (Add / Edit) ---
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim()) return alert("Customer အမည် ထည့်ပါ");
    
    setLoading(true);
    try {
      const payload = {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim(),
        tenantId: tenantId,
        updatedAt: serverTimestamp()
      };

      if (editingCustomer) {
        await setDoc(doc(db, 'pos_customers', editingCustomer.id), payload, { merge: true });
        alert("Customer အချက်အလက် ပြင်ဆင်ပြီးပါပြီ။");
      } else {
        await addDoc(collection(db, 'pos_customers'), {
          ...payload,
          totalDebt: 0, 
          createdAt: serverTimestamp()
        });
        alert("Customer အသစ် ထည့်သွင်းပြီးပါပြီ။");
      }
      setCustomerModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error(error);
      alert("Error saving customer.");
    }
    setLoading(false);
  };

  // --- Delete Customer ---
  const handleDeleteCustomer = async (id, name, debt) => {
    if (debt > 0) {
      return alert(`အမှား: ${name} တွင် ပေးရန်ကျန်ငွေ (${debt.toLocaleString()} Ks) ရှိနေသဖြင့် ဖျက်၍မရပါ။`);
    }
    if (!window.confirm(`${name} ကို ဖျက်ရန် သေချာပါသလား?`)) return;

    try {
      await deleteDoc(doc(db, 'pos_customers', id));
      fetchCustomers();
    } catch (error) {
      console.error(error);
      alert("Error deleting customer.");
    }
  };

  // --- Handle Payment (အကြွေးဆပ်ခြင်း) ---
  const handlePayment = async (e) => {
    e.preventDefault();
    const payAmount = Number(paymentForm.amount);
    if (!payAmount || payAmount <= 0) return alert("ငွေပမာဏ မှန်ကန်စွာထည့်ပါ။");
    
    // 🌟 Error ကင်းစေရန် အနည်းငယ် ပိုဆပ်ခွင့်ပြုလိုက်သည် (Rounding error များအတွက်)
    if (payAmount > selectedCustomer.totalDebt + 10) return alert(`ဆပ်သည့်ငွေသည် ကျန်ရှိသောအကြွေး (${selectedCustomer.totalDebt.toLocaleString()}) ထက် များနေပါသည်။`);

    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const customerRef = doc(db, 'pos_customers', selectedCustomer.id);
      batch.update(customerRef, {
        totalDebt: increment(-payAmount)
      });

      const recordRef = doc(collection(db, 'pos_records'));
      batch.set(recordRef, {
        type: 'Customer Payment',
        tenantId: tenantId,
        customerId: selectedCustomer.id,
        personName: selectedCustomer.name, // 🌟 Legacy data အတွက် နာမည်ပါ သိမ်းပေးမည်
        amount: payAmount,
        note: paymentForm.note || 'အကြွေးလာဆပ်သည်',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cashier: profile?.username || profile?.name || 'Admin',
        createdAt: serverTimestamp()
      });

      await batch.commit();
      alert("ငွေသွင်းမှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။");
      setPaymentModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error(error);
      alert("Error saving payment.");
    }
    setLoading(false);
  };

  // --- View Ledger (မှတ်တမ်းကြည့်ခြင်း) ---
  const viewLedger = async (customer) => {
    setSelectedCustomer(customer);
    setLedgerModalOpen(true);
    setLedgers([]); 
    
    try {
      // 🌟 FIXED: Data အဟောင်းရော အသစ်ပါ ပေါ်စေရန် customerId သို့မဟုတ် personName ဖြင့် ရှာမည်
      const q = query(
        collection(db, 'pos_records'), 
        where('tenantId', '==', tenantId),
        or(
          where('customerId', '==', customer.id),
          where('personName', '==', customer.name)
        ),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      
      // Filter out transactions that don't involve debt/payment
      const allRecords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const relevantLedgers = allRecords.filter(r => 
        r.type === 'Customer Payment' || 
        (r.type === 'Sale' && r.remainingDebt > 0) // ပြေစာပြတ်မဟုတ်သော အကြွေးကျန်သည့် Sale မှတ်တမ်းများသာ
      );
      
      setLedgers(relevantLedgers);
    } catch (error) {
      console.error("Error fetching ledger:", error);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', address: '' });
    setCustomerModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingCustomer(c);
    setCustomerForm({ name: c.name, phone: c.phone || '', address: c.address || '' });
    setCustomerModalOpen(true);
  };

  const openPaymentModal = (c) => {
    setSelectedCustomer(c);
    setPaymentForm({ amount: '', note: '' });
    setPaymentModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/15 shadow-xl gap-5 animate-in fade-in">
        <div className="text-center md:text-left w-full md:w-auto">
          <h3 className="font-black text-2xl flex items-center justify-center md:justify-start gap-3"><Users className="text-cyan-500"/> Customers</h3>
          <p className="text-slate-400 text-sm mt-1">ဖောက်သည်စာရင်းနှင့် အကြွေးမှတ်တမ်းများ</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:min-w-[250px]">
            <Search size={20} className="absolute left-4 top-3.5 text-slate-500"/>
            <input type="text" placeholder="အမည် သို့မဟုတ် ဖုန်းဖြင့် ရှာရန်..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400 text-sm"/>
          </div>
          <button onClick={openAddModal} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-cyan-500 transition-colors active:scale-95 shadow-lg shadow-cyan-900/50">
            <Plus size={20}/> အသစ်ထည့်မည်
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         <div className="bg-[#0d1120] p-5 rounded-2xl border border-white/5 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl"><Users size={24}/></div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Total Customers</p>
              <p className="text-xl font-black">{customers.length}</p>
            </div>
         </div>
         <div className="bg-[#0d1120] p-5 rounded-2xl border border-amber-500/20 flex items-center gap-4 shadow-lg">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl"><DollarSign size={24}/></div>
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase">Total Pending Debt</p>
              <p className="text-xl font-black text-amber-400">
                {customers.reduce((sum, c) => sum + (Number(c.totalDebt) || 0), 0).toLocaleString()} Ks
              </p>
            </div>
         </div>
      </div>

      {/* 🌟 Mobile Responsive Card View / Table View */}
      <div className="bg-[#0d1120] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        
        {/* Desktop Table View (Hidden on small screens) */}
        <div className="hidden md:block overflow-x-auto">
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
              {loading && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading customers...</td></tr>}
              {!loading && filteredCustomers.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">Customer မတွေ့ပါ။</td></tr>}
              
              {filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-white text-base">{c.name}</p>
                  </td>
                  <td className="p-4 text-slate-400">
                    <p>{c.phone || '-'}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{c.address || '-'}</p>
                  </td>
                  <td className="p-4 text-right">
                    {Number(c.totalDebt) > 0 ? (
                       <span className="font-black text-amber-400 text-base">{Number(c.totalDebt).toLocaleString()} Ks</span>
                    ) : (
                       <span className="font-bold text-green-500 text-sm">ရှင်းပြီး</span>
                    )}
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button onClick={() => openPaymentModal(c)} disabled={Number(c.totalDebt) <= 0} className={`p-2 rounded-lg transition-colors ${Number(c.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 active:scale-95' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`} title="အကြွေးဆပ်မည်"><DollarSign size={18}/></button>
                    <button onClick={() => viewLedger(c)} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition-colors active:scale-95" title="မှတ်တမ်းကြည့်မည်"><ClipboardList size={18}/></button>
                    <button onClick={() => openEditModal(c)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/40 transition-colors active:scale-95" title="ပြင်မည်"><Edit3 size={18}/></button>
                    <button onClick={() => handleDeleteCustomer(c.id, c.name, Number(c.totalDebt))} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg hover:bg-rose-600/40 transition-colors active:scale-95" title="ဖျက်မည်"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (Visible only on small screens) */}
        <div className="block md:hidden p-4 space-y-4">
          {loading && <p className="text-center text-slate-500 py-4">Loading customers...</p>}
          {!loading && filteredCustomers.length === 0 && <p className="text-center text-slate-500 py-4">Customer မတွေ့ပါ။</p>}
          
          {filteredCustomers.map(c => (
            <div key={c.id} className="bg-black/30 border border-white/5 p-4 rounded-2xl flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-lg">{c.name}</h4>
                  {c.phone && <p className="text-slate-400 text-xs mt-1 flex items-center gap-1"><Phone size={12}/> {c.phone}</p>}
                  {c.address && <p className="text-slate-500 text-[10px] mt-1 line-clamp-1">{c.address}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Balance</p>
                  {Number(c.totalDebt) > 0 ? (
                    <p className="font-black text-amber-400 text-lg leading-tight">{Number(c.totalDebt).toLocaleString()} <span className="text-xs">Ks</span></p>
                  ) : (
                    <p className="font-bold text-green-500 text-sm mt-1">ရှင်းပြီး</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/5">
                <button onClick={() => openPaymentModal(c)} disabled={Number(c.totalDebt) <= 0} className={`py-2 flex justify-center items-center rounded-xl transition-all ${Number(c.totalDebt) > 0 ? 'bg-amber-600/20 text-amber-400 active:bg-amber-600/40' : 'bg-gray-800 text-gray-600'}`}>
                  <DollarSign size={20}/>
                </button>
                <button onClick={() => viewLedger(c)} className="py-2 flex justify-center items-center bg-blue-600/20 text-blue-400 rounded-xl active:bg-blue-600/40 transition-all">
                  <ClipboardList size={20}/>
                </button>
                <button onClick={() => openEditModal(c)} className="py-2 flex justify-center items-center bg-indigo-600/20 text-indigo-400 rounded-xl active:bg-indigo-600/40 transition-all">
                  <Edit3 size={20}/>
                </button>
                <button onClick={() => handleDeleteCustomer(c.id, c.name, Number(c.totalDebt))} className="py-2 flex justify-center items-center bg-rose-600/20 text-rose-400 rounded-xl active:bg-rose-600/40 transition-all">
                  <Trash2 size={20}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. Add/Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handleSaveCustomer} className="bg-[#0d1120] border-t-2 sm:border-2 border-cyan-500/20 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-cyan-400">{editingCustomer ? 'Customer ပြင်ရန်' : 'Customer အသစ်'}</h3>
              <button type="button" onClick={() => setCustomerModalOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">အမည် *</label>
                <input required value={customerForm.name} onChange={e=>setCustomerForm({...customerForm, name: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-cyan-500 text-sm" placeholder="e.g. U Ba"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">ဖုန်းနံပါတ် (Optional)</label>
                <input type="tel" value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm, phone: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-cyan-500 text-sm" placeholder="09..."/>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">လိပ်စာ (Optional)</label>
                <textarea value={customerForm.address} onChange={e=>setCustomerForm({...customerForm, address: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-cyan-500 text-sm custom-scrollbar" rows="2" placeholder="လိပ်စာ..."></textarea>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-cyan-600 text-white font-black py-4 rounded-xl active:bg-cyan-700 transition-colors flex justify-center items-center gap-2 shadow-lg shadow-cyan-900/50">
              <Save size={20}/> {loading ? 'Saving...' : 'သိမ်းမည်'}
            </button>
          </form>
        </div>
      )}

      {/* 2. Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={handlePayment} className="bg-[#0d1120] border-t-2 sm:border-2 border-amber-500/30 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-amber-400">ငွေသွင်းမှတ်တမ်း</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={24}/></button>
            </div>
            <div className="bg-black/40 p-5 rounded-2xl mb-6 text-center border border-white/5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Credit Balance</p>
              <p className="text-3xl font-black text-amber-400 mt-2">{Number(selectedCustomer.totalDebt).toLocaleString()} <span className="text-sm">Ks</span></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">ပေးသွင်းမည့် ငွေပမာဏ *</label>
                <input type="number" required max={selectedCustomer.totalDebt + 10} value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full mt-1 bg-black/50 border border-amber-500/30 rounded-xl p-4 text-amber-400 text-xl font-black outline-none focus:border-amber-400 text-center tracking-wider" placeholder="0"/>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1">မှတ်ချက် (Optional)</label>
                <input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm, note: e.target.value})} className="w-full mt-1 bg-black/50 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-amber-400 text-sm" placeholder="ဥပမာ - KBZ Pay ဖြင့်လွှဲသည်"/>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-8 bg-amber-600 text-white font-black py-4 rounded-xl active:bg-amber-700 transition-colors shadow-lg shadow-amber-900/50">
              {loading ? 'Processing...' : 'ငွေသွင်းမည်'}
            </button>
          </form>
        </div>
      )}

      {/* 3. Ledger Modal */}
      {isLedgerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0d1120] border-t-2 sm:border-2 border-blue-500/20 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 overflow-hidden">
            <div className="p-5 sm:p-6 pb-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-blue-400 flex items-center gap-2"><ClipboardList size={20}/> {selectedCustomer.name}</h3>
                <p className="text-xs text-slate-400 mt-1 font-bold">Current Debt: <span className="text-amber-400 text-sm">{Number(selectedCustomer.totalDebt).toLocaleString()} Ks</span></p>
              </div>
              <button onClick={() => setLedgerModalOpen(false)} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 bg-black/10">
              {ledgers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <ClipboardList size={48} className="text-slate-500 mb-3"/>
                  <p className="text-center text-slate-400 font-bold">မှတ်တမ်း မရှိသေးပါ။</p>
                  <p className="text-center text-xs text-slate-500 mt-1">အကြွေးယူထားခြင်း (သို့) ငွေဆပ်ထားခြင်း မှတ်တမ်းများ ဤနေရာတွင် ပေါ်ပါမည်။</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ledgers.map(record => (
                    <div key={record.id} className="bg-[#12182b] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-blue-500/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${record.type === 'Customer Payment' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {record.type === 'Customer Payment' ? 'Payment In' : 'Credit Sale'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">{record.date} {record.time}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-200">{record.type === 'Sale' ? `Invoice: ${record.voucherNo || '-'}` : (record.note || 'အကြွေးဆပ်ခြင်း')}</p>
                        {record.type === 'Sale' && <p className="text-[11px] font-bold text-slate-500 mt-1">Total Bill: {Number(record.amount).toLocaleString()} • Paid: {Number(record.paidAmount).toLocaleString()}</p>}
                      </div>
                      <div className="text-left sm:text-right pt-2 sm:pt-0 border-t border-white/5 sm:border-0 mt-2 sm:mt-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{record.type === 'Customer Payment' ? 'Amount Received' : 'Debt Added'}</p>
                        {record.type === 'Customer Payment' ? (
                          <p className="text-lg font-black text-green-400 mt-0.5">-{Number(record.amount).toLocaleString()} <span className="text-xs">Ks</span></p>
                        ) : (
                          <p className="text-lg font-black text-amber-400 mt-0.5">+{Number(record.remainingDebt).toLocaleString()} <span className="text-xs">Ks</span></p>
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
