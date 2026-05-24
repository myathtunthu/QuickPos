import React, { useState, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, doc, deleteDoc, addDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, User, CreditCard, ArrowUpRight, ArrowDownRight, FileText, Banknote, Receipt, Trash2, X, AlertTriangle } from 'lucide-react';

// ─── Professional Print Voucher ─────────────────────────────────────
const doPrint = (record, shopName = 'MTT POS') => {
  const items = record.itemsDetail || [{ name: record.item, quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0 }];
  const fmt = n => (Number(n) || 0).toLocaleString();
  const qrText = `Date:${record.date}\nTotal:${record.amount} Ks`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrText)}`;
  const rows = items.map((i, idx) => {
    const disc = i.itemDiscountAmt > 0 ? `<br><small style="color:#888;">(-${fmt(i.itemDiscountAmt)} Disc)</small>` : '';
    return `<tr><td style="font-size:13px;">${idx+1}. ${i.name}${disc}</td><td align="center">${i.quantity}</td><td align="right">${fmt((i.unitPrice * i.quantity) - (i.itemDiscountAmt || 0))}</td></tr>`;
  }).join('');
  const now = new Date(); const timeStr = now.toLocaleTimeString('en-GB');
  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
  <style>body{font-family:'Courier New',monospace;font-size:13px;width:340px;margin:10px auto;padding:15px;border:1px dashed #000;background:#fff;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;}.shop-name{font-size:18px;font-weight:bold;}.info{font-size:12px;color:#555;margin:2px 0;}table{width:100%;border-collapse:collapse;}th,td{padding:6px 0;border-bottom:1px dotted #ccc;font-size:13px;}th{border-bottom:1px solid #000;}.total-row{font-weight:bold;font-size:16px;border-top:1px solid #000;padding-top:8px;}.footer{text-align:center;margin-top:15px;font-size:11px;color:#555;}.qr{text-align:center;margin:10px 0;}</style></head><body>
  <div class="header"><div class="shop-name">${shopName}</div><div class="info">📅 ${record.date || ''} ${timeStr}</div></div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead><tbody>${rows}</tbody></table>
  ${record.discount > 0 ? `<div style="text-align:right;font-size:13px;margin:5px 0;">Global Disc: -${fmt(record.discount)} Ks</div>` : ''}
  <div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
  <div class="info" style="text-align:right;margin-top:2px;">${record.paymentType === 'Credit' ? '💳 Credit' : '💵 Cash'}</div>
  <div class="qr"><img src="${qrSrc}" width="100" height="100" alt="QR"/></div>
  <div class="footer">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>Thank you for your purchase</div>
  <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
  w.document.close();
};

export default function LedgerPage({ records = [] }) {
  const { userData } = useAuth();
  const todayISO = new Date().toISOString().split('T')[0];
  const fmt = n => (Number(n) || 0).toLocaleString();

  const [ledSearch, setLedSearch] = useState('');
  const [ledFilter, setLedFilter] = useState('All');
  
  const [payModal, setPayModal] = useState({ show: false, name: '', debt: 0, amt: '', date: todayISO });
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [historyModal, setHistoryModal] = useState({ show: false, name: '' });
  const [confirmDel, setConfirmDel] = useState(null);

  // အကြွေးကျန်သူများ စာရင်း တွက်ချက်ခြင်း
  const debtors = useMemo(() => {
    const m = {};
    records.forEach(r => {
      if (r.type === 'Sale' && r.paymentType === 'Credit') {
        const debt = Number(r.remainingDebt) || 0;
        if (debt > 0) m[r.personName || 'Unknown'] = (m[r.personName || 'Unknown'] || 0) + debt;
      }
    });
    return Object.entries(m).map(([n, a]) => ({ n, a })).sort((a, b) => b.a - a.a);
  }, [records]);

  // မှတ်တမ်းများ ရှာဖွေခြင်း
  const filteredRecs = useMemo(() => records.filter(r => {
    const q = ledSearch.toLowerCase();
    const match = ((r.personName || '') + (r.item || '') + (r.invoiceNo || '')).toLowerCase().includes(q);
    return match && (ledFilter === 'All' || r.type === ledFilter);
  }), [records, ledSearch, ledFilter]);

  // သီးသန့် History တွက်ချက်ခြင်း
  let histBal = 0;
  const histRecords = records.filter(r => (r.type === 'Sale' || r.type === 'Payment') && r.personName === historyModal.name)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(r => { 
      histBal += r.type === 'Sale' ? (Number(r.amount) || 0) : -(Number(r.amount) || 0); 
      return { ...r, runningBal: histBal }; 
    }).reverse();

  // အကြွေးဆပ်ခြင်း (Receive Payment)
  const submitPayment = async () => {
    if (!payModal.amt || Number(payModal.amt) <= 0) return alert("ပမာဏ မှန်ကန်စွာ ထည့်ပါ။");
    try {
      let remainingToPay = Number(payModal.amt);
      const batch = writeBatch(db);
      
      // မှတ်တမ်းသစ်တစ်ခု အရင်ထည့်မည် (Payment Record)
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

      // ထိုသူ၏ အကြွေးကျန်နေသော Sale များကို ဆွဲထုတ်ပြီး နှုတ်ပေးမည်
      const q = query(collection(db, 'pos_records'), 
        where('tenantId', '==', userData.tenantId), 
        where('personName', '==', payModal.name), 
        where('type', '==', 'Sale')
      );
      const snap = await getDocs(q);
      const sales = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (Number(s.remainingDebt) || 0) > 0).sort((a,b) => a.createdAt - b.createdAt);
      
      for (let s of sales) {
        if (remainingToPay <= 0) break;
        const currentDebt = Number(s.remainingDebt) || 0;
        let deduct = 0;
        if (remainingToPay >= currentDebt) {
          deduct = currentDebt;
          remainingToPay -= currentDebt;
        } else {
          deduct = remainingToPay;
          remainingToPay = 0;
        }
        const sRef = doc(db, 'pos_records', s.id);
        batch.update(sRef, { remainingDebt: currentDebt - deduct });
      }

      await batch.commit();
      alert("အကြွေးဆပ် မှတ်တမ်း သိမ်းဆည်းပြီးပါပြီ။");
      setPayModal({ show: false, name: '', debt: 0, amt: '', date: todayISO });
    } catch (error) {
      alert("Error processing payment.");
    }
  };

  // မှတ်တမ်း ဖျက်ခြင်း
  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteDoc(doc(db, 'pos_records', confirmDel.id));
      setConfirmDel(null);
    } catch (error) {
      alert("Error deleting record");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      
      {/* ─── SEARCH & FILTER ─── */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        <div className="relative flex-1">
          <Search size={24} className="absolute left-5 top-4 sm:top-5 text-slate-500"/>
          <input 
            value={ledSearch} 
            onChange={e => setLedSearch(e.target.value)} 
            placeholder="နာမည် သို့မဟုတ် ဘောင်ချာနံပါတ် ရှာရန်..." 
            className="w-full pl-14 pr-5 py-4 sm:py-5 bg-gray-900 border-2 border-cyan-500/15 rounded-2xl text-lg sm:text-xl font-bold text-slate-200 outline-none focus:border-cyan-500/40 placeholder-slate-600 transition-all shadow-xl" 
          />
        </div>
        <button 
          onClick={() => setLedFilter(ledFilter === 'Debtors' ? 'All' : 'Debtors')} 
          className={`px-6 py-4 sm:py-5 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${ledFilter === 'Debtors' ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-gray-900 border-cyan-500/15 text-slate-400 hover:text-cyan-400'}`}
        >
          <Filter size={24}/> {ledFilter === 'Debtors' ? 'All Records' : 'Debtors Only'}
        </button>
      </div>

      {/* ─── DEBTORS VIEW (အကြွေးကျန်သူများ) ─── */}
      {ledFilter === 'Debtors' ? (
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest px-2 mb-2">Debtors (အကြွေးကျန်သူများ)</p>
          {debtors.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-bold text-xl">အကြွေးကျန်သူ မရှိပါ။</div>
          ) : debtors.map(d => (
            <div key={d.n} className="bg-gray-900 p-5 sm:p-7 rounded-3xl border-2 border-rose-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:border-rose-500/30 transition-all shadow-lg">
              <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                <div className="bg-rose-500/10 p-4 sm:p-5 rounded-2xl text-rose-400 hidden sm:block"><User size={34}/></div>
                <div>
                  <p className="font-black text-rose-100 text-2xl sm:text-3xl cursor-pointer hover:text-cyan-400" onClick={() => setHistoryModal({show: true, name: d.n})}>
                    {d.n}
                  </p>
                  <button onClick={() => setPayModal({show: true, name: d.n, debt: d.a, amt: '', date: todayISO})} className="mt-4 text-sm sm:text-base font-black text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-5 py-3 rounded-xl border-2 border-blue-500/15 flex items-center gap-3 active:scale-95 transition-colors">
                    <CreditCard size={20}/> အကြွေးဆပ်မည်
                  </button>
                </div>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-white/5">
                <p className="text-3xl sm:text-4xl font-black text-rose-500">{fmt(d.a)} Ks</p>
                <p className="text-xs sm:text-sm text-rose-700 font-black uppercase mt-1 sm:mt-2">Outstanding (ကျန်ငွေ)</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── ALL RECORDS VIEW (မှတ်တမ်းအားလုံး) ─── */
        <div className="space-y-4 sm:space-y-5 animate-fade-in">
          {filteredRecs.length === 0 && <div className="text-center py-20 text-slate-500 font-bold text-xl">မှတ်တမ်း မရှိပါ။</div>}
          {filteredRecs.map(r => (
            <div key={r.id} className="bg-gray-900 p-5 sm:p-6 rounded-3xl border-2 border-white/5 hover:border-cyan-500/20 transition-all shadow-lg group">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${r.type==='Sale'?'bg-cyan-500/10 text-cyan-400':r.type==='Purchase'?'bg-blue-500/10 text-blue-400':r.type==='Expense'?'bg-amber-500/10 text-amber-400':'bg-emerald-500/10 text-emerald-400'}`}>
                  {r.type==='Sale'?<ArrowUpRight size={26}/>:r.type==='Purchase'?<ArrowDownRight size={26}/>:r.type==='Expense'?<FileText size={26}/>:<Banknote size={26}/>}
                </div>
                
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex gap-3 items-center flex-wrap">
                    <p className="font-black text-white text-xl sm:text-2xl">{r.personName || '−'}</p>
                    {r.invoiceNo && <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded-lg border border-cyan-500/20">{r.invoiceNo}</span>}
                  </div>
                  <p className="text-base sm:text-lg text-slate-400 font-bold mt-2 truncate">{r.item || '−'}</p>
                  <p className="text-xs sm:text-sm text-slate-500 font-mono mt-1.5">{r.date || '−'}</p>
                </div>
                
                <div className="text-left sm:text-right flex-shrink-0 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-white/5 mt-2 sm:mt-0">
                  <p className={`font-black text-2xl sm:text-3xl ${r.type==='Purchase'||r.type==='Expense'?'text-orange-400':'text-cyan-400'}`}>
                    {r.type==='Purchase'||r.type==='Expense'?'−':'+'}{fmt(r.amount)}
                  </p>
                  {(Number(r.remainingDebt)||0) > 0 && (
                    <span className="text-sm font-black text-rose-400 bg-rose-500/10 px-4 py-1.5 rounded-lg inline-block sm:block mt-2 sm:mt-3 border border-rose-500/20">
                      ကျန်: {fmt(r.remainingDebt)}
                    </span>
                  )}
                  
                  <div className="flex gap-3 justify-start sm:justify-end mt-4">
                    {['Sale','Purchase','Payment'].includes(r.type) && (
                      <button onClick={() => setReceiptModal({show: true, record: r})} className="p-3 text-cyan-500 hover:text-white hover:bg-cyan-500 transition-colors rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                        <Receipt size={20}/>
                      </button>
                    )}
                    <button onClick={() => setConfirmDel(r)} className="p-3 text-rose-500 hover:text-white hover:bg-rose-500 transition-colors rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                </div>
                
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODALS ─── */}
      
      {/* 1. Receive Payment Modal */}
      {payModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-6 sm:p-8 border-2 border-cyan-500/20 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-white text-2xl">Receive Payment</h3>
              <button onClick={() => setPayModal({show: false, name: '', debt: 0, amt: '', date: todayISO})} className="text-slate-400 hover:text-rose-400"><X size={30}/></button>
            </div>
            <div className="bg-rose-950/30 border-2 border-rose-500/15 p-6 rounded-2xl text-center mb-6">
              <p className="text-base text-rose-400 font-bold uppercase">{payModal.name}</p>
              <p className="text-4xl sm:text-5xl font-black text-rose-300 mt-2">{fmt(payModal.debt)} <span className="text-xl font-normal opacity-40">Ks</span></p>
            </div>
            <input type="date" value={payModal.date} onChange={e => setPayModal(p => ({...p, date: e.target.value}))} className="w-full bg-black/50 border-2 border-cyan-500/15 rounded-xl px-5 py-4 text-lg font-bold text-cyan-300 outline-none mb-4 focus:border-cyan-400"/>
            <input type="number" autoFocus value={payModal.amt} onChange={e => setPayModal(p => ({...p, amt: e.target.value}))} placeholder="ဆပ်မည့် ငွေပမာဏ" className="w-full bg-black/50 border-2 border-cyan-500/15 rounded-xl px-5 py-5 text-3xl font-black text-center text-cyan-300 outline-none mb-6 placeholder-slate-600 focus:border-cyan-400"/>
            <button onClick={submitPayment} className="w-full py-5 sm:py-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-xl text-xl sm:text-2xl active:scale-95 transition-all shadow-lg shadow-cyan-500/20">
              ✓ ဆပ်မည် (Confirm)
            </button>
          </div>
        </div>
      )}

      {/* 2. Receipt Modal */}
      {receiptModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#080c14]/95 backdrop-blur-sm">
          <div className="bg-white text-black w-full max-w-md p-6 sm:p-8 shadow-2xl relative font-mono text-base sm:text-lg animate-fade-in" style={{backgroundImage:'repeating-linear-gradient(transparent,transparent 28px,#f0f0f0 28px,#f0f0f0 29px)',backgroundSize:'100% 29px'}}>
            <button onClick={() => setReceiptModal({show: false, record: null})} className="absolute -top-12 right-0 text-white p-2 bg-rose-500 rounded-full hover:bg-rose-600"><X size={24}/></button>
            <div className="text-center mb-5 border-b-2 border-dashed border-gray-400 pb-5 pt-4">
              <h2 className="text-2xl font-black uppercase">MTT POS</h2>
              <p className="text-sm sm:text-base text-gray-500 mt-2">{receiptModal.record?.date}</p>
            </div>
            <div className="space-y-2 mb-5">
              <div className="flex justify-between"><span className="font-bold">Type:</span><span>{receiptModal.record?.type}</span></div>
              <div className="flex justify-between"><span className="font-bold">Name:</span><span>{receiptModal.record?.personName}</span></div>
            </div>
            {receiptModal.record?.itemsDetail?.length > 0 ? (
              <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-4 mb-5 space-y-3">
                {receiptModal.record.itemsDetail.map((it, i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div>
                      <span>{it.name} <span className="text-gray-500">×{it.quantity}</span></span>
                      {it.itemDiscountAmt > 0 && <span className="block text-sm text-gray-500">(-{fmt(it.itemDiscountAmt)} Disc)</span>}
                    </div>
                    <span>{fmt((it.unitPrice*it.quantity)-(it.itemDiscountAmt||0))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-5 pb-4 border-b-2 border-dashed border-gray-300">
                <div className="flex justify-between"><span className="font-bold">Item:</span><span className="text-right">{receiptModal.record?.item}</span></div>
              </div>
            )}
            {(receiptModal.record?.discount || 0) > 0 && (
              <div className="flex justify-between mb-2 text-gray-600"><span>Global Disc:</span><span>-{fmt(receiptModal.record.discount)}</span></div>
            )}
            <div className="flex justify-between font-black text-xl sm:text-2xl mb-6 pt-3 border-t-2 border-gray-300">
              <span>TOTAL</span><span>{fmt(receiptModal.record?.amount)} Ks</span>
            </div>
            <div className="flex gap-3 sm:gap-4">
              <button onClick={() => doPrint(receiptModal.record)} className="flex-1 py-3 sm:py-4 bg-gray-900 text-white rounded-xl font-black text-base sm:text-lg active:scale-95">🖨 Print</button>
              <button onClick={() => setReceiptModal({show: false, record: null})} className="flex-1 py-3 sm:py-4 bg-gray-200 text-gray-700 rounded-xl font-black text-base sm:text-lg active:scale-95">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. History Modal (အကြွေးကျန်သူ၏ မှတ်တမ်းအသေးစိတ်) */}
      {historyModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-6 sm:p-8 border-2 border-cyan-500/20 max-h-[85vh] flex flex-col animate-fade-in shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-white text-xl sm:text-2xl flex items-center gap-3">📜 {historyModal.name}</h3>
              <button onClick={() => setHistoryModal({show: false, name: ''})} className="text-slate-400 hover:text-rose-400"><X size={30}/></button>
            </div>
            <div className="overflow-y-auto space-y-4 flex-1 pr-2">
              {histRecords.map(r => (
                <div key={r.id} className="bg-black/50 p-4 sm:p-5 rounded-2xl border-2 border-cyan-500/10">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs sm:text-sm font-black px-3 py-1.5 rounded uppercase ${r.type === 'Sale' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {r.type === 'Sale' ? 'Credit (အကြွေးဝယ်)' : 'Payment (ငွေဆပ်)'}
                    </span>
                    <span className="text-xs sm:text-sm text-slate-500">{(r.date || '').split(',')[0]}</span>
                  </div>
                  <div className="flex justify-between items-end mb-3">
                    <p className="text-sm sm:text-base text-slate-300 font-bold truncate max-w-[150px] sm:max-w-[180px]">{r.item || 'Multiple Items'}</p>
                    <p className={`text-xl sm:text-2xl font-black ${r.type === 'Sale' ? 'text-rose-400' : 'text-emerald-400'}`}>{fmt(r.amount)}</p>
                  </div>
                  <div className="border-t-2 border-white/5 pt-3 text-right">
                    <p className="text-xs sm:text-sm text-slate-500">Remaining Balance: <span className="font-black text-slate-300">{fmt(r.runningBal)} Ks</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1120] p-8 sm:p-10 rounded-3xl border-2 border-rose-500/30 text-center max-w-sm w-full shadow-2xl animate-fade-in">
            <AlertTriangle size={56} className="mx-auto text-rose-500 mb-6"/>
            <h3 className="text-2xl font-black text-white mb-4">ဖျက်ရန် သေချာပါသလား?</h3>
            <p className="text-base text-slate-400 mb-8">ဖျက်လိုက်သော မှတ်တမ်းများကို ပြန်လည်ရယူ၍ မရနိုင်ပါ။</p>
            <div className="flex gap-4 sm:gap-5">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-4 sm:py-5 bg-slate-800 rounded-xl font-black text-lg text-white hover:bg-slate-700">Cancel</button>
              <button onClick={doDelete} className="flex-1 py-4 sm:py-5 bg-rose-600 rounded-xl font-black text-lg text-white hover:bg-rose-500">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
