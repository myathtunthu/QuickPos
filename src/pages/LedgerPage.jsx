import React, { useState, useMemo, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, doc, writeBatch, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, User, CreditCard, ArrowUpRight, ArrowDownRight, FileText, Banknote, Receipt, Trash2, X, AlertTriangle } from 'lucide-react';

export default function LedgerPage({ records = [] }) {
  const { userData } = useAuth();
  const todayISO = new Date().toISOString().split('T')[0];
  const fmt = n => (Number(n) || 0).toLocaleString();
  const submitLock = useRef(false);

  const [ledSearch, setLedSearch] = useState('');
  const [ledFilter, setLedFilter] = useState('All');
  
  const [payModal, setPayModal] = useState({ show: false, name: '', debt: 0, amt: '', date: todayISO });
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [historyModal, setHistoryModal] = useState({ show: false, name: '' });
  const [confirmDel, setConfirmDel] = useState(null);

  const debtors = useMemo(() => {
    const m = {};
    records.forEach(r => {
      if (r.type === 'Sale' && (Number(r.remainingDebt) || 0) > 0) {
        m[r.personName || 'Unknown'] = (m[r.personName || 'Unknown'] || 0) + Number(r.remainingDebt);
      }
    });
    return Object.entries(m).map(([n, a]) => ({ n, a })).filter(d => d.a > 0).sort((a, b) => b.a - a.a);
  }, [records]);

  const filteredRecs = useMemo(() => records.filter(r => {
    const q = ledSearch.toLowerCase();
    const match = ((r.personName || '') + (r.item || '') + (r.voucherNo || '')).toLowerCase().includes(q);
    return match && (ledFilter === 'All' || r.type === ledFilter);
  }), [records, ledSearch, ledFilter]);

  const histRecords = useMemo(() => {
    if (!historyModal.show) return [];
    let histBal = 0;
    return records.filter(r => (r.type === 'Sale' || r.type === 'Payment') && r.personName === historyModal.name)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(r => { 
        histBal += r.type === 'Sale' ? (Number(r.amount) || 0) : -(Number(r.amount) || 0); 
        return { ...r, runningBal: histBal }; 
      }).reverse();
  }, [records, historyModal.show, historyModal.name]);

  const submitPayment = async () => {
    if (submitLock.current) return;
    if (!payModal.amt || Number(payModal.amt) <= 0) return alert("ပမာဏ မှန်ကန်စွာ ထည့်ပါ။");
    
    submitLock.current = true;
    try {
      let remainingToPay = Number(payModal.amt);
      const batch = writeBatch(db);
      
      const payRef = doc(collection(db, 'pos_records'));
      batch.set(payRef, {
        type: 'Payment',
        tenantId: userData.tenantId,
        personName: payModal.name,
        amount: remainingToPay,
        date: payModal.date,
        item: 'ကြွေးဆပ် (Received Payment)',
        createdAt: Date.now()
      });

      const q = query(collection(db, 'pos_records'), 
        where('tenantId', '==', userData.tenantId), 
        where('personName', '==', payModal.name), 
        where('type', '==', 'Sale')
      );
      const snap = await getDocs(q);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .filter(s => (Number(s.remainingDebt) || 0) > 0)
                        .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
      
      for (let s of sales) {
        if (remainingToPay <= 0) break;
        const currentDebt = Number(s.remainingDebt) || 0;
        const deduct = Math.min(remainingToPay, currentDebt);
        batch.update(doc(db, 'pos_records', s.id), { remainingDebt: currentDebt - deduct });
        remainingToPay -= deduct;
      }

      await batch.commit();
      alert("အကြွေးဆပ် မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။");
      setPayModal({ show: false, name: '', debt: 0, amt: '', date: todayISO });
    } catch (error) { alert("Error processing payment."); }
    submitLock.current = false;
  };

  const doDelete = async () => {
    if (!confirmDel || submitLock.current) return;
    submitLock.current = true;
    try {
      await deleteDoc(doc(db, 'pos_records', confirmDel.id));
      setConfirmDel(null);
    } catch (error) { alert("Error deleting record"); }
    submitLock.current = false;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className="relative flex-1">
          <Search size={24} className="absolute left-5 top-5 text-slate-500"/>
          <input value={ledSearch} onChange={e => setLedSearch(e.target.value)} placeholder="နာမည် သို့မဟုတ် ဘောင်ချာနံပါတ် ရှာရန်..." className="w-full pl-14 pr-5 py-5 bg-gray-900 border-2 border-cyan-500/15 rounded-2xl text-lg font-bold text-slate-200 outline-none focus:border-cyan-500/40 transition-all shadow-xl" />
        </div>
        <button onClick={() => setLedFilter(ledFilter === 'Debtors' ? 'All' : 'Debtors')} className={`px-6 py-5 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${ledFilter === 'Debtors' ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-gray-900 border-cyan-500/15 text-slate-400'}`}>
          <Filter size={24}/> {ledFilter === 'Debtors' ? 'All Records' : 'Debtors Only'}
        </button>
      </div>

      {ledFilter === 'Debtors' ? (
        <div className="space-y-5">
          {debtors.map(d => (
            <div key={d.n} className="bg-gray-900 p-7 rounded-3xl border-2 border-rose-500/15 flex flex-col sm:flex-row justify-between items-center gap-5 shadow-lg">
              <div>
                <p className="font-black text-rose-100 text-3xl cursor-pointer hover:text-cyan-400" onClick={() => setHistoryModal({show: true, name: d.n})}>{d.n}</p>
                <button onClick={() => setPayModal({show: true, name: d.n, debt: d.a, amt: '', date: todayISO})} className="mt-4 text-blue-400 font-black px-5 py-3 rounded-xl border-2 border-blue-500/15 flex items-center gap-3 active:scale-95">
                  <CreditCard size={20}/> အကြွေးဆပ်မည်
                </button>
              </div>
              <p className="text-4xl font-black text-rose-500">{fmt(d.a)} Ks</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredRecs.map(r => (
            <div key={r.id} className="bg-gray-900 p-6 rounded-3xl border-2 border-white/5 flex gap-5 items-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${r.type==='Sale'?'bg-cyan-500/10 text-cyan-400':'bg-orange-500/10 text-orange-400'}`}>
                {r.type==='Sale'?<ArrowUpRight size={26}/>:<ArrowDownRight size={26}/>}
              </div>
              <div className="flex-1">
                <p className="font-black text-2xl">{r.personName || '−'}</p>
                <p className="text-lg text-slate-400">{r.item || '−'}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-3xl">{r.type==='Sale'?'+':'-'}{fmt(r.amount)}</p>
                <button onClick={() => setConfirmDel(r)} className="text-rose-500 mt-2"><Trash2 size={20}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pay Modal */}
      {payModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-8 border-2 border-cyan-500/20">
            <h3 className="font-black text-white text-2xl mb-6">Receive Payment</h3>
            <input type="number" autoFocus value={payModal.amt} onChange={e => setPayModal(p => ({...p, amt: e.target.value}))} placeholder="ဆပ်မည့် ငွေပမာဏ" className="w-full bg-black/50 border-2 border-cyan-500/15 rounded-xl px-5 py-5 text-3xl font-black text-center text-cyan-300 mb-6"/>
            <button onClick={submitPayment} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-xl text-2xl active:scale-95">✓ ဆပ်မည်</button>
          </div>
        </div>
      )}
    </div>
  );
}
