import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Calendar, FileQuestion, Printer, Search, X,
  DollarSign, ShoppingCart, CreditCard, TrendingUp, Package
} from 'lucide-react';

// ─── Print Voucher ───
const doPrint = (record, settings) => {
  const { shopName = 'QuickPOS', phone = '', address = '' } = settings;
  const fmt = n => (Number(n) || 0).toLocaleString();

  const items = record.itemsDetail || [{ name: record.item || 'General Record', quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0, unitName: 'ခု' }];

  const rows = items.map((i, idx) => `
    <tr>
      <td style="padding: 5px 0; border-bottom: 1px dotted #ccc; vertical-align: top;">
        ${idx + 1}. ${i.name}<br>
        <small style="color:#666;">${i.quantity} ${i.unitName || ''} x ${fmt(i.unitPrice)} ${i.itemDiscountAmt > 0 ? `(-${fmt(i.itemDiscountAmt)})` : ''}</small>
      </td>
      <td style="text-align: right; vertical-align: top; padding-top: 5px; font-weight: bold; border-bottom: 1px dotted #ccc;">
        ${fmt((i.unitPrice * (i.quantity || 1)) - (i.itemDiscountAmt || 0))}
      </td>
    </tr>`).join('');

  const subtotal = record.subtotal || record.amount || 0;
  const totalDiscount = (record.itemDiscount || 0) + (record.globalDiscount || 0);
  const totalAmount = record.amount || 0;
  const paidAmount = record.paidAmount !== undefined ? record.paidAmount : totalAmount;
  const remainingDebt = record.remainingDebt || 0;
  const changeAmount = record.changeAmount || 0;

  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<html><head><style>body{font-family:sans-serif; width:80mm; padding:10px; margin:0 auto;}</style></head><body>
    <div style="text-align:center;">
      <h2 style="margin-bottom: 5px;">${shopName}</h2>
      ${phone ? `<p style="margin: 2px 0; font-size: 12px;">Ph: ${phone}</p>` : ''}
      ${address ? `<p style="margin: 2px 0; font-size: 12px;">${address}</p>` : ''}
      <p style="margin-top: 10px; font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 10px;">Date: ${record.date} ${record.time || ''}</p>
    </div>
    <table style="width:100%; border-collapse:collapse; margin-top: 10px; font-size: 14px;">
      <thead><tr style="border-bottom:1px solid #000;"><th style="text-align:left; padding-bottom: 5px;">Item</th><th style="text-align:right; padding-bottom: 5px;">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="border-top:1px dashed #000; margin-top:10px; padding-top: 5px; font-size: 12px; font-weight: bold;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>Subtotal:</span><span>${fmt(subtotal)} Ks</span></div>
      ${totalDiscount > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #d10000;"><span>Discount:</span><span>-${fmt(totalDiscount)} Ks</span></div>` : ''}
    </div>
    <div style="border-top:2px solid #000; margin-top:5px; padding-top: 5px; font-weight:black; font-size:16px; text-align:right;">
      TOTAL: ${fmt(totalAmount)} Ks
    </div>
    <div style="margin-top: 10px; font-size: 12px; font-weight: bold; padding-top: 5px; border-top: 1px solid #ccc;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>Paid (${record.paymentMethod || 'Cash'}):</span><span>${fmt(paidAmount)} Ks</span></div>
      ${remainingDebt > 0 
        ? `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>Credit (အကြွေး):</span><span>${fmt(remainingDebt)} Ks</span></div>` 
        : `<div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>Change:</span><span>${fmt(changeAmount)} Ks</span></div>`
      }
    </div>
    <div style="text-align:center; margin-top:15px; font-size:14px; font-weight: bold;">
      ${remainingDebt > 0 ? '*** CREDIT ***' : '*** PAID ***'}
    </div>
    <div style="text-align:center; margin-top:5px; font-size:12px;">Thank you for your business!</div>
    <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
  w.document.close();
};

export default function RecordsPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [shopSettings, setShopSettings] = useState({ shopName: 'QuickPOS', phone: '', address: '' });
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]); // 🌟 Added to calculate true COGS
  const [filterType, setFilterType] = useState('All');
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const todayISO = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: todayISO, end: todayISO });

  const fmt = (n) => (Number(n) || 0).toLocaleString();

  useEffect(() => {
    if (!tenantId) { setIsLoading(false); return; }
    setIsLoading(true);

    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'pos_settings', tenantId));
        if (snap.exists()) {
          const data = snap.data();
          setShopSettings({
            shopName: data.shopName || profile.shopName || 'QuickPOS',
            phone: data.phone || '', address: data.address || ''
          });
        }
      } catch (err) { console.error(err); }
    };
    fetchSettings();

    // Fetch Products (For exact Cost mapping)
    const qProd = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
    const unsubProd = onSnapshot(qProd, (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Fetch Records
    const qRec = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const unsubRec = onSnapshot(qRec, (snap) => {
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => { unsubProd(); unsubRec(); };
  }, [tenantId, profile]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = p; });
    return map;
  }, [products]);

  const getRecordDateISO = (r) => {
    if (r.date && r.date.includes('-')) return r.date;
    if (r.date && r.date.includes('/')) {
      const parts = r.date.split(',')[0].split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt;
    if (ts) return new Date(ts).toISOString().split('T')[0];
    return null;
  };

  const filteredRecords = useMemo(() => {
    let result = records.filter(r => {
      const iso = getRecordDateISO(r);
      return iso && iso >= dateRange.start && iso <= dateRange.end;
    });
    if (filterType !== 'All') {
      result = result.filter(r => (r.type || '').toLowerCase() === filterType.toLowerCase());
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r =>
        (r.personName || '').toLowerCase().includes(q) ||
        (r.voucherNo || '').toLowerCase().includes(q) ||
        (r.type || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [records, filterType, dateRange, searchTerm]);

  // 🌟 Dashboard နှင့် ကွက်တိတူညီသော အမြတ်တွက်ချက်မှုစနစ် (True Profit Formula)
  const reportStats = useMemo(() => {
    const sum = (arr, fn) => arr.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
    
    const salesRecs = filteredRecords.filter(r => (r.type || '').toLowerCase() === 'sale');
    const expensesRecs = filteredRecords.filter(r => (r.type || '').toLowerCase() === 'expense');

    const totalSales = sum(salesRecs, r => r.amount);
    const totalExpenses = sum(expensesRecs, r => r.amount);

    // COGS (ရောင်းလိုက်ရသော ပစ္စည်းများ၏ အရင်း)
    const totalCOGS = salesRecs.reduce((sum, r) => {
      const items = r.itemsDetail || r.items || [];
      return sum + items.reduce((s, item) => {
        const prod = productMap[item.productId];
        const cost = Number(item.costPrice) || Number(item.cost) || Number(prod?.packageUnits?.[0]?.costPrice) || 0;
        return s + (cost * (Number(item.quantity) || 0));
      }, 0);
    }, 0);

    // True Net Profit (အရောင်း - အရင်း - အသုံးစရိတ်)
    const netProfit = totalSales - totalCOGS - totalExpenses;

    return { totalSales, totalCOGS, totalExpenses, netProfit };
  }, [filteredRecords, productMap]);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-6 pb-10">
      {/* ─── Profit/Loss Report Summary ─── */}
      <div className="bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/15 shadow-xl space-y-6">
        <h3 className="font-black text-2xl flex items-center gap-2">
          <TrendingUp className="text-cyan-500" /> Date-Range Profit Report
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">Start Date</label>
            <input
              type="date" value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-3 text-lg font-bold text-cyan-400 outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase mb-2 block">End Date</label>
            <input
              type="date" value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-3 text-lg font-bold text-cyan-400 outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* 🌟 ရှင်းလင်းစွာ ပြင်ဆင်ထားသော ကိန်းဂဏန်းပြကွက်များ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'အရောင်းစုစုပေါင်း (Revenue)', value: reportStats.totalSales, icon: DollarSign, color: 'text-cyan-400', bg: 'bg-cyan-950/20 border-cyan-500/10' },
            { label: 'ပစ္စည်းအရင်း (Total Cost)', value: reportStats.totalCOGS, icon: Package, color: 'text-rose-400', bg: 'bg-rose-950/20 border-rose-500/10' },
            { label: 'အထွေထွေအသုံးစရိတ် (Expense)', value: reportStats.totalExpenses, icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-950/20 border-amber-500/10' },
            { label: 'အသားတင်အမြတ် (Net Profit)', value: reportStats.netProfit, icon: TrendingUp, color: reportStats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-500', bg: reportStats.netProfit >= 0 ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-red-950/30 border-red-500/30' },
          ].map((stat, i) => (
            <div key={i} className={`p-4 rounded-xl border-2 ${stat.bg} flex items-center justify-between`}>
              <div>
                <p className="text-xs text-slate-400 font-bold">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color}`}>{fmt(stat.value)} Ks</p>
              </div>
              <stat.icon className={`${stat.color} opacity-50`} size={24} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Transaction List Header ─── */}
      <div className="flex flex-col bg-[#0d1120] p-4 sm:p-6 rounded-3xl border border-cyan-500/15 shadow-xl gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-xl sm:text-2xl flex items-center gap-2">
            <FileText className="text-cyan-500" size={24} /> Transactions
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
            <input
              type="text" placeholder="Search by name, voucher..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 border border-cyan-500/20 rounded-xl pl-10 pr-10 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-slate-400 hover:text-white" /></button>}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['All', 'Sale', 'Purchase', 'Expense'].map(type => (
              <button
                key={type} onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  filterType === type ? 'bg-cyan-600 text-white' : 'bg-black/50 text-slate-400 border border-white/5'
                }`}
              >{type}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Transaction List ─── */}
      <div className="space-y-3">
        {isLoading ? (
          [1,2,3].map(i => (
            <div key={i} className="bg-[#0d1120] p-6 rounded-2xl animate-pulse">
              <div className="h-4 bg-slate-700 w-1/3 mb-2 rounded"></div>
              <div className="h-3 bg-slate-700 w-1/2 rounded"></div>
            </div>
          ))
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 bg-[#0d1120] rounded-2xl border border-dashed border-slate-500/20">
            <FileQuestion className="mx-auto mb-3 text-slate-500" size={32} />
            <p className="text-slate-400 font-bold">No transactions found in selected date range.</p>
          </div>
        ) : (
          filteredRecords.map(r => (
            <div
              key={r.id}
              onClick={() => setReceiptModal({ show: true, record: r })}
              className="bg-[#0d1120] p-5 rounded-2xl border border-white/5 hover:border-cyan-500/30 cursor-pointer transition-all flex justify-between items-center gap-4 hover:scale-[1.01]"
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    (r.type||'').toLowerCase() === 'sale' ? 'bg-cyan-500/20 text-cyan-400' :
                    (r.type||'').toLowerCase() === 'expense' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-rose-500/20 text-rose-400'
                  }`}>{r.type}</span>
                  <span className="text-slate-500 text-xs">{r.voucherNo || r.id.slice(0,8)}</span>
                </div>
                <p className="font-bold text-white">{r.personName || r.item || 'Walk-in'}</p>
                <p className="text-slate-400 text-xs flex items-center gap-1 mt-1">
                  <Calendar size={12} /> {r.date || '-'} {r.time || ''}
                </p>
              </div>
              <p className={`font-bold text-xl ${(r.type||'').toLowerCase() === 'sale' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(r.type||'').toLowerCase() === 'sale' ? '+' : '-'}{fmt(r.amount)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* ─── Receipt Modal ─── */}
      {receiptModal.show && receiptModal.record && (
        <div className="fixed inset-0 z-[600] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden" onClick={() => setReceiptModal({show:false, record:null})}>
          <div className="w-full max-w-sm bg-white text-black rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans scale-in-95" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">{shopSettings.shopName}</h2>
              {shopSettings.address && <p className="text-xs text-gray-500 mt-1">{shopSettings.address}</p>}
              {shopSettings.phone && <p className="text-xs text-gray-500">Tel: {shopSettings.phone}</p>}
            </div>
            <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between"><span>Voucher No:</span> <span className="text-gray-900">{receiptModal.record.voucherNo || '-'}</span></div>
              <div className="flex justify-between"><span>Date & Time:</span> <span className="text-gray-900">{receiptModal.record.date} | {receiptModal.record.time || ''}</span></div>
              <div className="flex justify-between"><span>Cashier:</span> <span className="text-gray-900">{receiptModal.record.cashier || 'Admin'}</span></div>
              <div className="flex justify-between"><span>Customer:</span> <span className="text-gray-900">{receiptModal.record.personName || 'Walk-in'}</span></div>
            </div>
            <div className="mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="text-left py-2 font-bold uppercase">Description</th>
                    <th className="text-right py-2 font-bold uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(receiptModal.record.itemsDetail || [{name: receiptModal.record.item || 'Item', quantity: 1, unitPrice: receiptModal.record.amount, itemDiscountAmt: 0, unitName: 'ခု'}]).map((item,i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5">
                        <div className="font-bold text-gray-800">{item.name}</div>
                        <div className="text-gray-500 text-[10px] mt-0.5">
                          {item.quantity} {item.unitName || ''} x {fmt(item.unitPrice)}
                          {item.itemDiscountAmt > 0 && ` (-${fmt(item.itemDiscountAmt)})`}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-800 align-top">
                        {fmt((item.unitPrice * item.quantity) - (item.itemDiscountAmt||0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-dashed border-gray-300 pt-3 text-[11px] font-semibold text-gray-600 space-y-1.5">
               <div className="flex justify-between"><span>Subtotal:</span><span className="text-gray-900">{fmt(receiptModal.record.subtotal || receiptModal.record.amount || 0)} Ks</span></div>
               {((receiptModal.record.itemDiscount || 0) > 0 || (receiptModal.record.globalDiscount || 0) > 0) && (
                  <div className="flex justify-between text-red-500"><span>Discount:</span><span>-{fmt((receiptModal.record.itemDiscount || 0) + (receiptModal.record.globalDiscount || 0))} Ks</span></div>
               )}
            </div>
            <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between text-lg font-black text-gray-900">
              <span>GRAND TOTAL</span><span>{fmt(receiptModal.record.amount || 0)} Ks</span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mt-4 space-y-1.5 text-xs font-semibold text-gray-600 border border-gray-200">
               <div className="flex justify-between"><span>Paid ({receiptModal.record.paymentMethod || 'Cash'}):</span><span className="text-gray-900">{fmt(receiptModal.record.paidAmount !== undefined ? receiptModal.record.paidAmount : receiptModal.record.amount)} Ks</span></div>
               {(receiptModal.record.remainingDebt || 0) > 0 ? (
                 <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5"><span>Credit Balance (အကြွေး):</span><span>{fmt(receiptModal.record.remainingDebt)} Ks</span></div>
               ) : (
                 <div className="flex justify-between text-green-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5"><span>Change (ပြန်အမ်းငွေ):</span><span>{fmt(receiptModal.record.changeAmount || 0)} Ks</span></div>
               )}
            </div>
            <div className="text-center mt-6 flex flex-col items-center gap-2">
              <span className={`font-black tracking-widest border-2 px-4 py-1 rounded-sm text-sm ${(receiptModal.record.remainingDebt || 0) > 0 ? 'text-red-500 border-red-500' : 'text-green-500 border-green-500'}`}>
                {(receiptModal.record.remainingDebt || 0) > 0 ? 'CREDIT' : 'PAID'}
              </span>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">Thank you for your business!</p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button onClick={() => doPrint(receiptModal.record, shopSettings)} className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-cyan-600/30">
                <Printer size={18}/> Print Receipt
              </button>
              <button onClick={() => setReceiptModal({show:false, record:null})} className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors active:scale-95">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
