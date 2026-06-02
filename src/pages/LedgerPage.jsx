import React, { useState, useMemo, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, doc, writeBatch, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, User, CreditCard, ArrowUpRight, ArrowDownRight, Printer, Receipt, Trash2, X, AlertTriangle } from 'lucide-react';

// ─── Professional Print Voucher (EntryPage ပုံစံအတိုင်း) ────────────────
const doPrint = (record) => {
  const fmt = n => (Number(n) || 0).toLocaleString();
  const items = record.itemsDetail || [{ name: record.item, quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0 }];
  const rows = items.map((i, idx) => `
    <tr>
      <td style="padding: 5px 0; font-size: 12px; border-bottom: 1px dotted #ccc;">
        ${idx + 1}. ${i.name}<br>
        <small style="color:#666;">${i.quantity} x ${fmt(i.unitPrice)}</small>
      </td>
      <td style="text-align: right; vertical-align: top; padding-top: 5px; font-weight: bold; border-bottom: 1px dotted #ccc;">
        ${fmt((i.unitPrice * i.quantity) - (i.itemDiscountAmt || 0))}
      </td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<html><head><style>body{font-family:sans-serif; width:80mm; padding: 10px;}</style></head><body>
    <div style="text-align:center;"><h2>MTT POS</h2><p>${record.date || ''}</p></div>
    <table style="width:100%; border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid #000;"><th style="text-align:left;">Item</th><th style="text-align:right;">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="border-top:2px solid #000; margin-top:10px; font-weight:bold; font-size:18px; text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
    <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
  w.document.close();
};

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
      batch.set(doc(collection(db, 'pos_records')), {
        type: 'Payment', tenantId: userData.tenantId, personName: payModal.name,
        amount: remainingToPay, date: payModal.date, item: 'ကြွေးဆပ် (Received Payment)', createdAt: Date.now()
      });

      const q = query(collection(db, 'pos_records'), where('tenantId', '==', userData.tenantId), where('personName', '==', payModal.name), where('type', '==', 'Sale'));
      const snap = await getDocs(q);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (Number(s.remainingDebt) || 0) > 0).sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
      
      for (let s of sales) {
        if (remainingToPay <= 0) break;
        const deduct = Math.min(remainingToPay, Number(s.remainingDebt) || 0);
        batch.update(doc(db, 'pos_records', s.id), { remainingDebt: (Number(s.remainingDebt) || 0) - deduct });
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
    try { await deleteDoc(doc(db, 'pos_records', confirmDel.id)); setConfirmDel(null); } 
    catch (error) { alert("Error deleting record"); }
    submitLock.current = false;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <input value={ledSearch} onChange={e => setLedSearch(e.target.value)} placeholder="ရှာရန်..." className="flex-1 p-4 bg-gray-900 rounded-2xl border border-cyan-500/20 outline-none" />
        <button onClick={() => setLedFilter(ledFilter === 'Debtors' ? 'All' : 'Debtors')} className={`px-6 py-4 rounded-2xl font-bold ${ledFilter === 'Debtors' ? 'bg-cyan-600' : 'bg-gray-900'}`}>
          {ledFilter === 'Debtors' ? 'All Records' : 'Debtors Only'}
        </button>
      </div>

      {ledFilter === 'Debtors' ? (
        <div className="space-y-4">
          {debtors.map(d => (
            <div key={d.n} className="bg-gray-900 p-6 rounded-3xl flex justify-between items-center border border-rose-500/20">
              <div>
                <p className="font-black text-2xl cursor-pointer hover:text-cyan-400" onClick={() => setHistoryModal({show: true, name: d.n})}>{d.n}</p>
                <button onClick={() => setPayModal({show: true, name: d.n, debt: d.a, amt: '', date: todayISO})} className="mt-2 text-blue-400 font-bold">အကြွေးဆပ်မည်</button>
              </div>
              <p className="text-3xl font-black text-rose-500">{fmt(d.a)} Ks</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecs.map(r => (
            <div key={r.id} className="bg-gray-900 p-6 rounded-3xl flex items-center justify-between">
              <div>
                <p className="font-bold text-xl">{r.personName || '−'}</p>
                <p className="text-slate-400">{r.item || '−'}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-2xl">{r.type==='Sale'||r.type==='Payment' ? '+' : '-'}{fmt(r.amount)}</p>
                <div className="flex gap-2 justify-end mt-2">
                  {['Sale','Purchase','Payment'].includes(r.type) && <button onClick={() => setReceiptModal({show: true, record: r})}><Receipt/></button>}
                  <button onClick={() => setConfirmDel(r)}><Trash2 className="text-rose-500"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Professional Receipt Modal */}
      {receiptModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white text-black rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
             <div className="text-center mb-4 border-b pb-2"><h2 className="text-xl font-black">MTT POS</h2><p className="text-xs">{receiptModal.record.date}</p></div>
             <table className="w-full text-xs">
               <thead><tr><th className="text-left py-2">Item</th><th className="text-right">Amt</th></tr></thead>
               <tbody>
                 {(receiptModal.record.itemsDetail || [{name: receiptModal.record.item, quantity: 1, unitPrice: receiptModal.record.amount, itemDiscountAmt: 0}]).map((it, i) => (
                   <tr key={i}><td className="py-2">{it.name}<br/>{it.quantity} x {fmt(it.unitPrice)}</td><td className="text-right align-top">{fmt(it.unitPrice * it.quantity - (it.itemDiscountAmt||0))}</td></tr>
                 ))}
               </tbody>
             </table>
             <div className="border-t pt-2 text-right font-black text-lg">TOTAL: {fmt(receiptModal.record.amount)} Ks</div>
             <div className="flex gap-2 mt-6"><button onClick={() => doPrint(receiptModal.record)} className="flex-1 py-2 bg-cyan-600 text-white rounded">Print</button><button onClick={() => setReceiptModal({show: false, record: null})} className="flex-1 py-2 bg-gray-200 rounded">Close</button></div>
          </div>
        </div>
      )}
      
      {/* Pay Modal */}
      {payModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-8 border-2 border-cyan-500/20">
            <h3 className="font-black text-white text-2xl mb-6">Receive Payment</h3>
            <input type="number" autoFocus value={payModal.amt} onChange={e => setPayModal(p => ({...p, amt: e.target.value}))} className="w-full bg-black/50 border-2 border-cyan-500/15 rounded-xl px-5 py-5 text-3xl font-black text-center text-cyan-300 mb-6"/>
            <button onClick={submitPayment} className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-xl text-2xl active:scale-95">✓ ဆပ်မည်</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDel && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0d1120] p-8 rounded-3xl text-center max-w-sm w-full">
            <h3 className="text-2xl font-black text-white mb-4">ဖျက်ရန် သေချာပါသလား?</h3>
            <div className="flex gap-4"><button onClick={() => setConfirmDel(null)} className="flex-1 py-4 bg-slate-800 rounded-xl">Cancel</button><button onClick={doDelete} className="flex-1 py-4 bg-rose-600 rounded-xl">Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
