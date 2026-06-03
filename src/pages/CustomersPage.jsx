import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import {
  collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc,
  writeBatch, serverTimestamp, increment, getDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  Users, Search, Plus, Edit3, Trash2, DollarSign, ClipboardList,
  X, Save, Phone, Printer, ArrowRightLeft
} from 'lucide-react';

// ---------- Receipt Modal (for viewing voucher from history) ----------
const ReceiptModal = ({ record, shopSettings, onClose }) => {
  const fmt = n => (Number(n) || 0).toLocaleString();
  const items = record.itemsDetail || [{ name: record.item || 'Item', quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0, unitName: 'ခု' }];

  const doPrint = () => {
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><head><style>body{font-family:sans-serif;width:80mm;padding:10px;margin:0 auto;}</style></head><body>
      <div style="text-align:center;">
        <h2>${shopSettings.shopName}</h2>
        <p>${shopSettings.address || ''}</p>
        <p>Tel: ${shopSettings.phone || ''}</p>
        <hr>
      </div>
      <table width="100%">
        ${items.map((item,i) => `<tr>
          <td>${item.name} ${item.quantity}${item.unitName} x ${fmt(item.unitPrice)}</td>
          <td align="right">${fmt(item.unitPrice * item.quantity - (item.itemDiscountAmt||0))}</td>
        </tr>`).join('')}
      </table>
      <hr>
      <div><b>TOTAL:</b> ${fmt(record.amount)} Ks</div>
      <div>Paid (${record.paymentMethod}): ${fmt(record.paidAmount)} Ks</div>
      ${record.remainingDebt > 0 ? `<div>Credit: ${fmt(record.remainingDebt)} Ks</div>` : ''}
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-black rounded-xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="text-center border-b pb-2 mb-3">
          <h3 className="font-bold">{shopSettings.shopName}</h3>
          <p className="text-xs">{record.voucherNo || record.id?.slice(-8)}</p>
          <p className="text-xs">{record.date} {record.time}</p>
        </div>
        <table className="w-full text-xs mb-3">
          {items.map((item, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">{item.name} x{item.quantity} {item.unitName}</td>
              <td className="text-right">{fmt(item.unitPrice * item.quantity - (item.itemDiscountAmt||0))}</td>
            </tr>
          ))}
        </table>
        <div className="text-xs space-y-1">
          <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(record.subtotal || record.amount)} Ks</span></div>
          {(record.itemDiscount || record.globalDiscount) > 0 && <div className="flex justify-between text-red-500"><span>Discount:</span><span>-{fmt((record.itemDiscount||0)+(record.globalDiscount||0))} Ks</span></div>}
          <div className="flex justify-between font-bold border-t pt-1"><span>TOTAL:</span><span>{fmt(record.amount)} Ks</span></div>
          <div className="flex justify-between"><span>Paid ({record.paymentMethod}):</span><span>{fmt(record.paidAmount||0)} Ks</span></div>
          {record.remainingDebt > 0 && <div className="flex justify-between text-red-600"><span>Credit:</span><span>{fmt(record.remainingDebt)} Ks</span></div>}
        </div>
        <button onClick={doPrint} className="w-full mt-4 bg-cyan-600 text-white py-2 rounded-lg flex items-center justify-center gap-1"><Printer size={16}/> Print</button>
        <button onClick={onClose} className="w-full mt-2 bg-gray-200 py-2 rounded-lg">Close</button>
      </div>
    </div>
  );
};

// ---------- Merge Modal ----------
const MergeModal = ({ customers, onClose, onMerge }) => {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');

  const handleMerge = () => {
    if (!fromId || !toId || fromId === toId) return;
    onMerge(fromId, toId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1120] border border-cyan-500/20 rounded-2xl p-5 w-full max-w-sm">
        <h3 className="text-lg font-bold text-cyan-400 mb-4">Merge Customers</h3>
        <label className="text-xs text-slate-400">From (delete after merge)</label>
        <select className="w-full bg-black border border-white/10 rounded-lg p-2 text-white mt-1 mb-3" onChange={e => setFromId(e.target.value)} value={fromId}>
          <option value="">-- Select --</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="text-xs text-slate-400">To (keep this customer)</label>
        <select className="w-full bg-black border border-white/10 rounded-lg p-2 text-white mt-1 mb-3" onChange={e => setToId(e.target.value)} value={toId}>
          <option value="">-- Select --</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={handleMerge} className="flex-1 bg-cyan-600 py-2 rounded-lg font-bold">Merge</button>
          <button onClick={onClose} className="flex-1 bg-slate-700 py-2 rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ---------- Main Page ----------
export default function CustomersPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  // Tab state: 'customers' or 'history'
  const [tab, setTab] = useState('customers');

  const [customers, setCustomers] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isLedgerModalOpen, setLedgerModalOpen] = useState(false);
  const [isMergeModalOpen, setMergeModalOpen] = useState(false);

  // Form states
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Receipt view
  const [receiptRecord, setReceiptRecord] = useState(null);

  // Shop settings for receipt
  const [shopSettings, setShopSettings] = useState({ shopName: 'QuickPOS', phone: '', address: '' });

  // Fetch shop settings
  useEffect(() => {
    if (!tenantId) return;
    getDoc(doc(db, 'pos_settings', tenantId)).then(snap => {
      if (snap.exists()) setShopSettings(snap.data());
    }).catch(() => {});
  }, [tenantId]);

  // Fetch customers
  const fetchCustomers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCustomers(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [tenantId]);

  // Filter
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const s = searchTerm.toLowerCase();
    return customers.filter(c => (c.name||'').toLowerCase().includes(s) || (c.phone||'').includes(s));
  }, [customers, searchTerm]);

  // Save customer
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name.trim()) return alert("Name required");
    setLoading(true);
    try {
      const payload = {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim(),
        tenantId,
        updatedAt: serverTimestamp()
      };
      if (editingCustomer) {
        await setDoc(doc(db, 'pos_customers', editingCustomer.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, 'pos_customers'), { ...payload, totalDebt: 0, createdAt: serverTimestamp() });
      }
      setCustomerModalOpen(false);
      fetchCustomers();
    } catch (err) { console.error(err); alert("Error saving customer"); }
    setLoading(false);
  };

  // Delete
  const handleDeleteCustomer = async (id, name, debt) => {
    if (debt > 0) return alert(`Cannot delete ${name} with outstanding debt`);
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'pos_customers', id));
      fetchCustomers();
    } catch (err) { console.error(err); }
  };

  // Payment
  const handlePayment = async (e) => {
    e.preventDefault();
    const pay = Number(paymentForm.amount);
    if (!pay || pay <= 0) return alert("Enter valid amount");
    if (pay > selectedCustomer.totalDebt + 10) return alert("Exceeds balance");
    setLoading(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'pos_customers', selectedCustomer.id), { totalDebt: increment(-pay) });
      const ref = doc(collection(db, 'pos_records'));
      batch.set(ref, {
        type: 'Customer Payment',
        tenantId,
        customerId: selectedCustomer.id,
        personName: selectedCustomer.name,
        amount: pay,
        note: paymentForm.note || 'အကြွေးလာဆပ်သည်',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        cashier: profile?.username || 'Admin',
        createdAt: serverTimestamp()
      });
      await batch.commit();
      setPaymentModalOpen(false);
      fetchCustomers();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // View Ledger (with receipt click)
  const viewLedger = async (customer) => {
    setSelectedCustomer(customer);
    setLedgerModalOpen(true);
    setLedgers([]);
    try {
      const q = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const rel = all.filter(r =>
        (r.customerId === customer.id || r.personName === customer.name) &&
        (r.type === 'Customer Payment' || (r.type === 'Sale' && r.remainingDebt > 0))
      );
      rel.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setLedgers(rel);
    } catch (err) { console.error(err); }
  };

  // Merge customers
  const handleMerge = async (fromId, toId) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      // Fetch all records of from customer and update customerId to toId, and personName to toCustomer name
      const toCustomer = customers.find(c => c.id === toId);
      const fromCustomer = customers.find(c => c.id === fromId);
      if (!toCustomer || !fromCustomer) return;

      // Update records
      const snap = await getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', tenantId)));
      snap.forEach(docSnap => {
        const rec = docSnap.data();
        if (rec.customerId === fromId || rec.personName === fromCustomer.name) {
          batch.update(docSnap.ref, { customerId: toId, personName: toCustomer.name });
        }
      });

      // Transfer debt
      const fromDebt = Number(fromCustomer.totalDebt) || 0;
      const toDebt = Number(toCustomer.totalDebt) || 0;
      batch.update(doc(db, 'pos_customers', toId), { totalDebt: increment(fromDebt) });
      batch.delete(doc(db, 'pos_customers', fromId));
      await batch.commit();
      fetchCustomers();
    } catch (err) { console.error(err); alert("Merge failed"); }
    setLoading(false);
  };

  // Open modals
  const openAddModal = () => { setEditingCustomer(null); setCustomerForm({ name: '', phone: '', address: '' }); setCustomerModalOpen(true); };
  const openEditModal = (c) => { setEditingCustomer(c); setCustomerForm({ name: c.name, phone: c.phone||'', address: c.address||'' }); setCustomerModalOpen(true); };
  const openPaymentModal = (c) => { setSelectedCustomer(c); setPaymentForm({ amount: '', note: '' }); setPaymentModalOpen(true); };

  // History view (all customer-related transactions)
  const [historyRecords, setHistoryRecords] = useState([]);
  const fetchHistory = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const rel = all.filter(r => r.type === 'Customer Payment' || (r.type === 'Sale' && r.customerId) || r.personName);
      rel.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setHistoryRecords(rel);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab, tenantId]);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-20">
      {/* Tabs */}
      <div className="flex gap-2 bg-[#0d1120] p-1.5 rounded-xl">
        <button onClick={() => setTab('customers')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === 'customers' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Customer Book</button>
        <button onClick={() => setTab('history')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === 'history' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Transaction History</button>
      </div>

      {tab === 'customers' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/15 gap-5">
            <h3 className="font-black text-2xl flex items-center gap-3"><Users className="text-cyan-500"/> Customers</h3>
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={20} className="absolute left-4 top-3.5 text-slate-500"/>
                <input type="text" placeholder="Search by name or phone..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-500/20 rounded-xl outline-none focus:border-cyan-400 text-sm"/>
              </div>
              <button onClick={openAddModal} className="bg-cyan-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={20}/> Add</button>
              <button onClick={() => setMergeModalOpen(true)} className="bg-indigo-600/20 text-indigo-400 px-4 py-3 rounded-xl font-bold flex items-center gap-2 border border-indigo-500/20"><ArrowRightLeft size={18}/> Merge</button>
            </div>
          </div>

          {/* Customer list (same table/cards as before) */}
          <div className="bg-[#0d1120] rounded-3xl border border-white/5 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-slate-400">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4 text-right">Credit Balance</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="p-4 font-bold">{c.name}</td>
                      <td className="p-4 text-slate-400">{c.phone || '-'}</td>
                      <td className="p-4 text-right">
                        {Number(c.totalDebt) > 0 ? <span className="font-black text-amber-400">{Number(c.totalDebt).toLocaleString()} Ks</span> : <span className="text-green-500">Settled</span>}
                      </td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => openPaymentModal(c)} disabled={Number(c.totalDebt)<=0} className={`p-2 rounded-lg ${Number(c.totalDebt)>0 ? 'bg-amber-600/20 text-amber-400' : 'bg-gray-800 text-gray-600'}`}><DollarSign size={18}/></button>
                        <button onClick={() => viewLedger(c)} className="p-2 bg-blue-600/20 text-blue-400 rounded-lg"><ClipboardList size={18}/></button>
                        <button onClick={() => openEditModal(c)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg"><Edit3 size={18}/></button>
                        <button onClick={() => handleDeleteCustomer(c.id, c.name, Number(c.totalDebt))} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards (similar structure) */}
            <div className="block md:hidden p-4 space-y-4">
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-black/30 p-4 rounded-2xl">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-bold text-lg">{c.name}</p>
                      {c.phone && <p className="text-xs text-slate-400"><Phone size={12} className="inline"/> {c.phone}</p>}
                    </div>
                    <div>
                      {Number(c.totalDebt) > 0 ? <p className="font-black text-amber-400">{Number(c.totalDebt).toLocaleString()} Ks</p> : <p className="text-green-500 text-sm">Settled</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/5">
                    <button onClick={() => openPaymentModal(c)} disabled={Number(c.totalDebt)<=0} className="p-2 rounded-lg bg-amber-600/20 text-amber-400 disabled:bg-gray-800 disabled:text-gray-600"><DollarSign size={18}/></button>
                    <button onClick={() => viewLedger(c)} className="p-2 rounded-lg bg-blue-600/20 text-blue-400"><ClipboardList size={18}/></button>
                    <button onClick={() => openEditModal(c)} className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400"><Edit3 size={18}/></button>
                    <button onClick={() => handleDeleteCustomer(c.id, c.name, Number(c.totalDebt))} className="p-2 rounded-lg bg-rose-600/20 text-rose-400"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Transaction History View */
        <div className="bg-[#0d1120] rounded-3xl border border-white/5 p-4">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ClipboardList className="text-cyan-400"/> Recent Customer Transactions</h3>
          {loading ? <p className="text-center text-slate-400 py-4">Loading...</p> : historyRecords.length === 0 ? <p className="text-center text-slate-500 py-4">No records found.</p> : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
              {historyRecords.map(rec => (
                <div key={rec.id} className="bg-black/30 p-3 rounded-xl flex justify-between items-center cursor-pointer hover:border-cyan-500/30 border border-white/5" onClick={() => setReceiptRecord(rec)}>
                  <div>
                    <p className="font-bold">{rec.personName || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{rec.type} | {rec.voucherNo || rec.id.slice(-8)}</p>
                    <p className="text-xs text-slate-500">{rec.date} {rec.time}</p>
                  </div>
                  <div className="text-right">
                    {rec.type === 'Customer Payment' ? (
                      <p className="text-green-400 font-bold">-{Number(rec.amount).toLocaleString()} Ks</p>
                    ) : (
                      <p className="text-amber-400 font-bold">+{Number(rec.remainingDebt || 0).toLocaleString()} Ks</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {/* Customer Form Modal (same as before) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleSaveCustomer} className="bg-[#0d1120] border-t-2 sm:border-2 border-cyan-500/20 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-cyan-400">{editingCustomer ? 'Edit Customer' : 'New Customer'}</h3>
              <button type="button" onClick={() => setCustomerModalOpen(false)} className="text-slate-400"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <input required value={customerForm.name} onChange={e=>setCustomerForm({...customerForm, name: e.target.value})} placeholder="Name *" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white"/>
              <input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm, phone: e.target.value})} placeholder="Phone" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white"/>
              <textarea value={customerForm.address} onChange={e=>setCustomerForm({...customerForm, address: e.target.value})} placeholder="Address" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white" rows="2"/>
            </div>
            <button type="submit" className="w-full mt-6 bg-cyan-600 py-3 rounded-xl font-bold"><Save size={18} className="inline mr-2"/>Save</button>
          </form>
        </div>
      )}

      {/* Payment Modal (same) */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
          <form onSubmit={handlePayment} className="bg-[#0d1120] border-t-2 sm:border-2 border-amber-500/30 rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-amber-400">Payment</h3>
              <button type="button" onClick={() => setPaymentModalOpen(false)}><X size={24}/></button>
            </div>
            <div className="bg-black/40 p-4 rounded-xl text-center mb-4">
              <p className="text-sm text-slate-400">Balance: <span className="text-amber-400 font-bold">{Number(selectedCustomer.totalDebt).toLocaleString()} Ks</span></p>
            </div>
            <input type="number" required value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value})} placeholder="Amount *" className="w-full bg-black/50 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-xl font-bold text-center"/>
            <input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm, note: e.target.value})} placeholder="Note" className="w-full mt-3 bg-black/50 border border-white/10 rounded-xl p-3 text-white"/>
            <button type="submit" className="w-full mt-5 bg-amber-600 py-3 rounded-xl font-bold">Submit Payment</button>
          </form>
        </div>
      )}

      {/* Ledger Modal with clickable invoices */}
      {isLedgerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLedgerModalOpen(false)}>
          <div className="bg-[#0d1120] border-t-2 sm:border-2 border-blue-500/20 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-lg font-bold text-blue-400">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-400">Current Debt: <span className="text-amber-400">{Number(selectedCustomer.totalDebt).toLocaleString()} Ks</span></p>
              </div>
              <button onClick={() => setLedgerModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {ledgers.length === 0 ? <p className="text-center text-slate-500 py-8">No records</p> : ledgers.map(rec => (
                <div key={rec.id} className="bg-black/30 p-3 rounded-xl flex justify-between items-center cursor-pointer hover:border-cyan-500/30 border border-white/5"
                  onClick={() => { setReceiptRecord(rec); }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${rec.type === 'Customer Payment' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>{rec.type}</span>
                      <span className="text-xs text-slate-500">{rec.voucherNo || rec.id.slice(-8)}</span>
                    </div>
                    <p className="text-sm mt-1">{rec.note || (rec.type === 'Sale' ? `Invoice: ${rec.voucherNo}` : 'Payment')}</p>
                    <p className="text-xs text-slate-500">{rec.date} {rec.time}</p>
                  </div>
                  <div className="text-right">
                    {rec.type === 'Customer Payment' ? (
                      <p className="text-green-400 font-bold">-{Number(rec.amount).toLocaleString()} Ks</p>
                    ) : (
                      <p className="text-amber-400 font-bold">+{Number(rec.remainingDebt || 0).toLocaleString()} Ks</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {isMergeModalOpen && (
        <MergeModal customers={customers} onClose={() => setMergeModalOpen(false)} onMerge={handleMerge} />
      )}

      {/* Receipt Modal (voucher view) */}
      {receiptRecord && (
        <ReceiptModal record={receiptRecord} shopSettings={shopSettings} onClose={() => setReceiptRecord(null)} />
      )}
    </div>
  );
}
