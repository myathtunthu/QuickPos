import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { FileText, Printer, X, Filter, Calendar } from 'lucide-react';

// ─── Professional Print Voucher (Entry Page ပုံစံအတိုင်း) ───
const doPrint = (record, shopName = 'CyberPOS') => {
  const fmt = n => (Number(n) || 0).toLocaleString();
  const items = record.itemsDetail || [{ name: record.item || 'General Record', quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0 }];
  
  const rows = items.map((i, idx) => `
    <tr>
      <td style="padding: 5px 0; border-bottom: 1px dotted #ccc;">
        ${idx + 1}. ${i.name}<br>
        <small style="color:#666;">${i.quantity || 1} x ${fmt(i.unitPrice)}</small>
      </td>
      <td style="text-align: right; vertical-align: top; padding-top: 5px; font-weight: bold; border-bottom: 1px dotted #ccc;">
        ${fmt((i.unitPrice * (i.quantity || 1)) - (i.itemDiscountAmt || 0))}
      </td>
    </tr>`).join('');

  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<html><head><style>body{font-family:monospace; width:80mm; padding:10px;}</style></head><body>
    <div style="text-align:center;"><h2>${shopName}</h2><p>${record.date}</p></div>
    <table style="width:100%; border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid #000;"><th style="text-align:left;">Item</th><th style="text-align:right;">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="border-top:2px solid #000; margin-top:10px; font-weight:bold; font-size:18px; text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
    <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
  w.document.close();
};

export default function RecordsPage() {
  const { userData } = useAuth();
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const fmt = n => (Number(n) || 0).toLocaleString();

  useEffect(() => {
    if (!userData?.tenantId) return;
    const q = query(collection(db, 'pos_records'), where('tenantId', '==', userData.tenantId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userData]);

  const filteredRecords = filterType === 'All' ? records : records.filter(r => r.type === filterType);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-10">
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/15 shadow-xl gap-5">
        <h3 className="font-black text-2xl flex items-center gap-3"><FileText className="text-cyan-500"/> Transactions History</h3>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {['All', 'Sale', 'Purchase', 'Expense'].map(type => (
            <button key={type} onClick={() => setFilterType(type)} className={`px-5 py-3 rounded-xl text-sm font-black transition-all ${filterType === type ? 'bg-cyan-600 text-white' : 'bg-black/50 text-slate-400 border border-white/5'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* RECORD LIST */}
      <div className="space-y-4">
        {filteredRecords.length === 0 && <p className="text-center text-slate-500 text-xl py-14 font-bold">မှတ်တမ်းများ မရှိသေးပါ။</p>}
        {filteredRecords.map(r => (
          <div key={r.id} onClick={() => setReceiptModal({ show: true, record: r })} className="bg-[#0d1120] p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 cursor-pointer transition-all flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${r.type === 'Sale' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>{r.type}</span>
                <span className="text-slate-400 text-xs font-mono">{r.voucherNo || r.id.slice(0,8)}</span>
              </div>
              <p className="font-bold text-lg text-slate-200">{r.personName || r.item || 'Walk-in'}</p>
              <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">{r.date}</p>
            </div>
            <p className={`font-black text-2xl ${r.type === 'Sale' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {r.type === 'Sale' ? '+' : '-'}{fmt(r.amount)}
            </p>
          </div>
        ))}
      </div>

      {/* PROFESSIONAL RECEIPT MODAL (EntryPage ပုံစံအတိုင်း အစအဆုံး ပြင်ဆင်ထားသည်) */}
      {receiptModal.show && receiptModal.record && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-[#080c14]/95 backdrop-blur-sm" onClick={() => setReceiptModal({show:false, record:null})}>
          <div className="bg-white text-black w-full max-w-sm p-6 shadow-2xl rounded-lg font-mono text-sm" onClick={e => e.stopPropagation()} style={{backgroundImage:'repeating-linear-gradient(transparent,transparent 28px,#f0f0f0 28px,#f0f0f0 29px)'}}>
            <div className="text-center mb-5 border-b-2 border-dashed border-gray-400 pb-5 pt-2">
              <h2 className="text-2xl font-black uppercase tracking-widest">CyberPOS</h2>
              <p className="text-xs font-bold mt-2">{receiptModal.record.type === 'Sale' ? 'SALE RECEIPT' : 'RECORD VOUCHER'}</p>
              <p className="text-[10px] mt-1">NO: {receiptModal.record.voucherNo || '-'}</p>
              <p className="text-[10px]">{receiptModal.record.date}</p>
            </div>
            
            <table className="w-full text-xs mb-4">
              <thead><tr className="border-b border-gray-300"><th className="text-left py-2">Item</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {(receiptModal.record.itemsDetail || [{name: receiptModal.record.item || 'Item', quantity: 1, unitPrice: receiptModal.record.amount, itemDiscountAmt: 0}]).map((it, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{it.name}<br/><span className="text-[10px] text-gray-500">{it.quantity || 1} x {fmt(it.unitPrice)}</span></td>
                    <td className="text-right align-top py-2 font-bold">{fmt((it.unitPrice * (it.quantity || 1)) - (it.itemDiscountAmt || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {(receiptModal.record.discount > 0) && (
              <div className="flex justify-between text-rose-600 font-bold mb-2"><span>Discount:</span><span>-{fmt(receiptModal.record.discount)}</span></div>
            )}
            
            <div className="flex justify-between font-black text-xl pt-3 border-t-2 border-gray-800">
              <span>TOTAL</span><span>{fmt(receiptModal.record.amount)} Ks</span>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => doPrint(receiptModal.record)} className="flex-1 py-3 bg-cyan-600 text-white rounded font-black">Print</button>
              <button onClick={() => setReceiptModal({show:false, record:null})} className="flex-1 py-3 bg-gray-200 rounded font-black">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
