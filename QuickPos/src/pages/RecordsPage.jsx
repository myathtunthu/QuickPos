import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { FileText, Printer, X, Filter, Calendar } from 'lucide-react';

// ─── Professional Print Voucher (Entry Page နှင့် အတူတူပင်) ───
const doPrint = (record, shopName = 'CyberPOS') => {
  const items = record.itemsDetail || [{ name: record.item, quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0 }];
  const fmt = n => (Number(n) || 0).toLocaleString();
  const qrText = `Voucher:${record.voucherNo || '-'}\nDate:${record.date}\nTotal:${record.amount} Ks`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrText)}`;
  
  const rows = items.map((i, idx) => {
    const disc = i.itemDiscountAmt > 0 ? `<br><small style="font-size:10px; color:#555;">(-${fmt(i.itemDiscountAmt)} Disc)</small>` : '';
    return `
      <tr>
        <td style="padding: 4px 0;">${idx+1}. ${i.name}${disc}</td>
        <td align="center">${i.quantity}</td>
        <td align="right">${fmt((i.unitPrice * i.quantity) - (i.itemDiscountAmt || 0))}</td>
      </tr>`;
  }).join('');
  
  const now = new Date(); 
  const timeStr = now.toLocaleTimeString('en-GB');

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Receipt</title>
      <style>
        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 100%; max-width: 300px; margin: 0 auto; padding: 10px; color: #000; }
        .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .shop-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
        .info { font-size: 11px; margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { border-bottom: 1px solid #000; padding-bottom: 5px; text-align: left; }
        th:nth-child(2) { text-align: center; }
        th:nth-child(3) { text-align: right; }
        td { font-size: 12px; vertical-align: top; border-bottom: 1px dotted #ccc; }
        .totals { border-top: 1px solid #000; padding-top: 8px; margin-top: 10px; text-align: right; font-size: 13px; }
        .grand-total { font-size: 16px; font-weight: bold; margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
        .qr { text-align: center; margin: 15px 0; }
        .footer { text-align: center; font-size: 11px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
        @media print { body { width: 100%; margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="shop-name">${shopName}</div>
        <div class="info">${record.type === 'Sale' ? 'SALE RECEIPT' : (record.type === 'Purchase' ? 'PURCHASE VOUCHER' : 'EXPENSE')}</div>
        <div class="info">Voucher No: <strong>${record.voucherNo || '-'}</strong></div>
        <div class="info">Date: ${record.date || ''} ${timeStr}</div>
        <div class="info">${record.type === 'Sale' ? 'Customer' : 'Supplier'}: ${record.personName || 'Walk-in'}</div>
      </div>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        ${record.discount > 0 ? `<div>Discount: -${fmt(record.discount)} Ks</div>` : ''}
        <div class="grand-total">TOTAL: ${fmt(record.amount)} Ks</div>
        <div style="margin-top:5px; font-size:11px;">Payment: ${record.paymentType === 'Credit' ? 'Credit' : 'Cash'}</div>
      </div>
      <div class="qr"><img src="${qrSrc}" width="80" height="80" alt="QR"/></div>
      <div class="footer"><strong>Thank You!</strong><br>Please come again</div>
    </body>
    </html>
  `;

  let printFrame = document.getElementById('print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
  }
  const docToPrint = printFrame.contentWindow.document;
  docToPrint.open(); docToPrint.write(printContent); docToPrint.close();
  setTimeout(() => { printFrame.contentWindow.focus(); printFrame.contentWindow.print(); }, 500);
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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecords(data);
    });
    return () => unsubscribe();
  }, [userData]);

  const filteredRecords = filterType === 'All' ? records : records.filter(r => r.type === filterType);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-10">
      
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-[#0d1120] p-6 rounded-3xl border-2 border-cyan-500/15 shadow-xl gap-5">
        <h3 className="font-black text-2xl flex items-center gap-3"><FileText className="text-cyan-500"/> Transactions History</h3>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {['All', 'Sale', 'Purchase', 'Expense'].map(type => (
            <button key={type} onClick={() => setFilterType(type)} className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-sm sm:text-base font-black whitespace-nowrap transition-all ${filterType === type ? 'bg-cyan-600 text-white' : 'bg-black/50 text-slate-400 border border-white/5 hover:border-cyan-500/30'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* RECORD LIST */}
      <div className="space-y-4">
        {filteredRecords.length === 0 && <p className="text-center text-slate-500 text-xl py-14 font-bold">မှတ်တမ်းများ မရှိသေးပါ။</p>}
        {filteredRecords.map(r => (
          <div key={r.id} onClick={() => setReceiptModal({ show: true, record: r })} className="bg-[#0d1120] p-5 sm:p-6 rounded-2xl border-2 border-white/5 hover:border-cyan-500/30 cursor-pointer transition-all flex justify-between items-center gap-4 group">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${r.type === 'Sale' ? 'bg-cyan-500/20 text-cyan-400' : r.type === 'Purchase' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{r.type}</span>
                <span className="text-slate-400 text-sm font-mono">{r.voucherNo || r.id.slice(0,8)}</span>
              </div>
              <p className="font-bold text-slate-200 text-lg">{r.personName || r.item || 'Walk-in'}</p>
              <p className="text-slate-500 text-sm flex items-center gap-2 mt-1"><Calendar size={14}/> {r.date}</p>
            </div>
            <div className="text-right">
              <p className={`font-black text-xl sm:text-2xl ${r.type === 'Sale' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {r.type === 'Sale' ? '+' : '-'}{fmt(r.amount)} Ks
              </p>
              <p className="text-slate-500 text-sm font-bold mt-1">{r.paymentType || 'Cash'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* RECEIPT MODAL */}
      {receiptModal.show && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-[#080c14]/95 backdrop-blur-sm animate-fade-in" onClick={() => setReceiptModal({show:false,record:null})}>
          <div className="bg-white text-black w-full max-w-sm p-6 sm:p-8 shadow-2xl relative font-mono text-sm sm:text-base rounded-lg border-t-8 border-cyan-600" onClick={e => e.stopPropagation()} style={{backgroundImage:'repeating-linear-gradient(transparent,transparent 28px,#f0f0f0 28px,#f0f0f0 29px)',backgroundSize:'100% 29px'}}>
            <div className="text-center mb-5 border-b-2 border-dashed border-gray-400 pb-5 pt-2">
              <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">CyberPOS</h2>
              <p className="text-sm text-gray-500 mt-2 font-bold">{receiptModal.record?.type === 'Sale' ? 'SALE RECEIPT' : (receiptModal.record?.type === 'Purchase' ? 'PURCHASE VOUCHER' : 'EXPENSE RECORD')}</p>
              <p className="text-xs text-gray-500 mt-1 font-bold">NO: {receiptModal.record?.voucherNo || '-'}</p>
              <p className="text-xs text-gray-500 mt-1">{receiptModal.record?.date}</p>
            </div>
            
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between"><span className="font-bold text-gray-600">{receiptModal.record?.type === 'Sale' ? 'Cust:' : 'Name:'}</span><span className="font-bold">{receiptModal.record?.personName || receiptModal.record?.item || 'Walk-in'}</span></div>
              <div className="flex justify-between"><span className="font-bold text-gray-600">Pay:</span><span className="font-bold">{receiptModal.record?.paymentType || 'Cash'}</span></div>
            </div>
            
            {receiptModal.record?.itemsDetail?.length > 0 && (
              <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-4 mb-5 space-y-3">
                {receiptModal.record.itemsDetail.map((it,i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div className="pr-4">
                      <span className="font-bold text-gray-800">{it.name} <span className="text-gray-500 text-xs">×{it.quantity}</span></span>
                      {it.itemDiscountAmt > 0 && <span className="block text-xs text-rose-500 mt-0.5">(-{fmt(it.itemDiscountAmt)} Disc)</span>}
                    </div>
                    <span className="font-bold">{fmt((it.unitPrice*it.quantity)-(it.itemDiscountAmt||0))}</span>
                  </div>
                ))}
              </div>
            )}
            
            {(receiptModal.record?.discount || 0) > 0 && (
              <div className="flex justify-between mb-2 text-rose-600 font-bold"><span>Total Discount:</span><span>-{fmt(receiptModal.record.discount)}</span></div>
            )}
            
            <div className="flex justify-between font-black text-xl mb-8 pt-3 border-t-2 border-gray-800 text-gray-900">
              <span>TOTAL</span><span>{fmt(receiptModal.record?.amount)}</span>
            </div>
            
            <div className="flex gap-3 mt-4">
              <button onClick={() => doPrint(receiptModal.record)} className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black text-base flex justify-center items-center gap-2 transition-all shadow-lg shadow-cyan-600/30">
                <Printer size={20}/> Print
              </button>
              <button onClick={() => setReceiptModal({show:false,record:null})} className="py-4 px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-black text-base transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
