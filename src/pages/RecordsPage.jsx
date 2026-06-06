import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  FileText,
  Printer,
  Receipt,
  Search,
  X,
} from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => (Number(n) || 0).toLocaleString();

const todayISO = () => new Date().toISOString().split('T')[0];

const recordType = (record) => (record?.type || '').toLowerCase();

const toISODate = (record) => {
  if (record?.date && /^\d{4}-\d{2}-\d{2}/.test(record.date)) return record.date.slice(0, 10);

  if (record?.date && record.date.includes('/')) {
    const parts = record.date.split(',')[0].trim().split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map((p) => String(p).padStart(2, '0'));
      return `${year}-${month}-${day}`;
    }
  }

  const rawTs = record?.createdAt?.seconds
    ? record.createdAt.seconds * 1000
    : record?.timestamp?.seconds
      ? record.timestamp.seconds * 1000
      : record?.createdAt || record?.timestamp;

  if (!rawTs) return '';
  const d = new Date(rawTs);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const typeStyle = (type) => {
  const kind = String(type || '').toLowerCase();
  if (kind === 'sale') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';
  if (kind === 'purchase') return 'bg-blue-500/15 text-blue-300 border-blue-500/20';
  if (kind === 'expense') return 'bg-rose-500/15 text-rose-300 border-rose-500/20';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/20';
};

const doPrint = (record, settings) => {
  const { shopName = 'QuickPOS', phone = '', address = '' } = settings;
  const items = record.itemsDetail || record.items || [
    { name: record.item || 'General Record', quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0, unitName: 'ခု' },
  ];

  const rows = items.map((item, index) => `
    <tr>
      <td style="padding: 6px 0; border-bottom: 1px dotted #ddd; vertical-align: top;">
        ${index + 1}. ${item.name || item.productName || 'Item'}<br />
        <small style="color:#666;">${fmt(item.quantity || 1)} ${item.unitName || ''} x ${fmt(item.unitPrice || item.price || 0)}${Number(item.itemDiscountAmt || 0) > 0 ? ` (-${fmt(item.itemDiscountAmt)})` : ''}</small>
      </td>
      <td style="text-align:right; padding:6px 0; border-bottom: 1px dotted #ddd; vertical-align: top; font-weight:700;">
        ${fmt(((Number(item.unitPrice || item.price) || 0) * (Number(item.quantity) || 1)) - (Number(item.itemDiscountAmt) || 0))}
      </td>
    </tr>`).join('');

  const subtotal = Number(record.subtotal) || Number(record.amount) || 0;
  const discount = (Number(record.itemDiscount) || 0) + (Number(record.globalDiscount) || 0);
  const paidAmount = record.paidAmount !== undefined ? Number(record.paidAmount) || 0 : Number(record.amount) || 0;
  const remainingDebt = Number(record.remainingDebt) || 0;
  const changeAmount = Number(record.changeAmount) || 0;

  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${record.voucherNo || 'Receipt'}</title>
        <style>
          body { font-family: Arial, sans-serif; width: 80mm; padding: 10px; margin: 0 auto; color: #111; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .line { border-top: 1px dashed #111; margin: 10px 0; }
          .row { display:flex; justify-content:space-between; gap:10px; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div style="text-align:center;">
          <h2 style="margin:0 0 4px;">${shopName}</h2>
          ${phone ? `<div style="font-size:12px;">Ph: ${phone}</div>` : ''}
          ${address ? `<div style="font-size:12px;">${address}</div>` : ''}
        </div>
        <div class="line"></div>
        <div style="font-size:12px; font-weight:700;">
          <div class="row"><span>Voucher:</span><span>${record.voucherNo || record.id || '-'}</span></div>
          <div class="row"><span>Type:</span><span>${record.type || '-'}</span></div>
          <div class="row"><span>Date:</span><span>${record.date || '-'} ${record.time || ''}</span></div>
          <div class="row"><span>Name:</span><span>${record.personName || record.item || 'Walk-in'}</span></div>
        </div>
        <div class="line"></div>
        <table><tbody>${rows}</tbody></table>
        <div class="line"></div>
        <div style="font-size:12px; font-weight:700;">
          <div class="row"><span>Subtotal:</span><span>${fmt(subtotal)} Ks</span></div>
          ${discount > 0 ? `<div class="row"><span>Discount:</span><span>-${fmt(discount)} Ks</span></div>` : ''}
          <div class="row" style="font-size:16px; border-top:2px solid #111; padding-top:6px;"><span>TOTAL:</span><span>${fmt(record.amount)} Ks</span></div>
          <div class="row"><span>Paid (${record.paymentMethod || 'Cash'}):</span><span>${fmt(paidAmount)} Ks</span></div>
          ${remainingDebt > 0 ? `<div class="row"><span>Credit:</span><span>${fmt(remainingDebt)} Ks</span></div>` : `<div class="row"><span>Change:</span><span>${fmt(changeAmount)} Ks</span></div>`}
        </div>
        <div style="text-align:center; margin-top:14px; font-weight:900;">${remainingDebt > 0 ? '*** CREDIT ***' : '*** PAID ***'}</div>
        <div style="text-align:center; margin-top:6px; font-size:12px;">Thank you for your business!</div>
        <script>window.onload = () => { window.print(); window.close(); };</script>
      </body>
    </html>`);
  printWindow.document.close();
};

export default function RecordsPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [shopSettings, setShopSettings] = useState({ shopName: 'QuickPOS', phone: '', address: '' });
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: todayISO(), end: todayISO() });
  const [expandedId, setExpandedId] = useState(null);
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });

  useEffect(() => {
    if (!tenantId) {
      setRecords([]);
      setIsLoading(false);
      return undefined;
    }

    let ignore = false;
    setIsLoading(true);

    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'pos_settings', tenantId));
        if (!ignore && snap.exists()) {
          const data = snap.data();
          setShopSettings({
            shopName: data.shopName || profile?.shopName || 'QuickPOS',
            phone: data.phone || '',
            address: data.address || '',
          });
        }
      } catch (error) {
        console.error('Records settings load failed:', error);
      }
    };

    loadSettings();

    const recordsQuery = query(
      collection(db, 'pos_records'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(300)
    );

    const unsub = onSnapshot(
      recordsQuery,
      (snap) => {
        if (ignore) return;
        setRecords(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setIsLoading(false);
      },
      (error) => {
        console.error('Records load failed:', error);
        setIsLoading(false);
      }
    );

    return () => {
      ignore = true;
      unsub();
    };
  }, [tenantId, profile?.shopName]);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const iso = toISODate(record);
      if (!iso || iso < dateRange.start || iso > dateRange.end) return false;

      if (filterType !== 'All' && recordType(record) !== filterType.toLowerCase()) return false;

      if (!q) return true;

      return [
        record.voucherNo,
        record.personName,
        record.customerName,
        record.supplierName,
        record.item,
        record.type,
        record.cashier,
        record.paymentMethod,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [records, dateRange, filterType, searchTerm]);

  const quickTotals = useMemo(() => {
    return filteredRecords.reduce(
      (totals, record) => {
        const kind = recordType(record);
        const amount = Number(record.amount) || 0;
        if (kind === 'sale') totals.sales += amount;
        if (kind === 'purchase') totals.purchases += amount;
        if (kind === 'expense') totals.expenses += amount;
        totals.count += 1;
        return totals;
      },
      { sales: 0, purchases: 0, expenses: 0, count: 0 }
    );
  }, [filteredRecords]);

  return (
    <div className="p-4 sm:p-6 text-white max-w-6xl mx-auto space-y-5 pb-10">
      <div className="bg-[#0d1120] rounded-3xl border border-cyan-500/15 shadow-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black uppercase tracking-wider mb-3">
              <Receipt size={14} /> Transaction History
            </div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3">
              <FileText className="text-cyan-400" /> Records
            </h1>
            <p className="text-slate-500 font-semibold mt-1">
              Voucher ပြန်ကြည့်၊ ရှာ၊ print ထုတ်ရန် သီးသန့် page ဖြစ်ပါတယ်။ အမြတ်/စီးပွားရေး report တွက်ချက်မှုကို Reports Page မှာ သီးသန့်ထားပါတယ်။
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center min-w-0 lg:min-w-[420px]">
            <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/20 p-3">
              <p className="text-[10px] text-slate-500 font-black uppercase">Sales</p>
              <p className="text-sm sm:text-lg text-emerald-300 font-black">{fmt(quickTotals.sales)}</p>
            </div>
            <div className="rounded-2xl bg-blue-950/20 border border-blue-500/20 p-3">
              <p className="text-[10px] text-slate-500 font-black uppercase">Purchases</p>
              <p className="text-sm sm:text-lg text-blue-300 font-black">{fmt(quickTotals.purchases)}</p>
            </div>
            <div className="rounded-2xl bg-rose-950/20 border border-rose-500/20 p-3">
              <p className="text-[10px] text-slate-500 font-black uppercase">Expenses</p>
              <p className="text-sm sm:text-lg text-rose-300 font-black">{fmt(quickTotals.expenses)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr] gap-3">
          <label className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase flex items-center gap-1"><Calendar size={13} /> Start Date</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-[16px] font-bold text-cyan-200 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase flex items-center gap-1"><Calendar size={13} /> End Date</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-[16px] font-bold text-cyan-200 outline-none focus:border-cyan-400"
            />
          </label>
          <div className="relative self-end">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              inputMode="search"
              placeholder="Voucher, customer, supplier, cashier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl pl-11 pr-11 py-3 text-[16px] font-bold text-white outline-none focus:border-cyan-400"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
          {['All', 'Sale', 'Purchase', 'Expense'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap border transition-all ${
                filterType === type
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-900/20'
                  : 'bg-black/30 text-slate-400 border-white/5 hover:text-white hover:border-cyan-500/20'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#0d1120] p-5 rounded-2xl border border-white/5 animate-pulse">
              <div className="h-4 bg-slate-800 w-1/3 rounded mb-3" />
              <div className="h-3 bg-slate-800 w-1/2 rounded" />
            </div>
          ))
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-14 bg-[#0d1120] rounded-3xl border border-dashed border-slate-500/20">
            <FileQuestion className="mx-auto mb-3 text-slate-500" size={36} />
            <p className="text-slate-400 font-black">No transactions found.</p>
            <p className="text-slate-600 text-sm font-semibold mt-1">Date/filter/search ကိုပြန်စစ်ပါ။</p>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const kind = recordType(record);
            const isExpanded = expandedId === record.id;
            const amountSign = kind === 'sale' ? '+' : '-';
            const amountColor = kind === 'sale' ? 'text-emerald-300' : kind === 'purchase' ? 'text-blue-300' : 'text-rose-300';
            const items = record.itemsDetail || record.items || [];

            return (
              <article key={record.id} className="bg-[#0d1120] rounded-2xl border border-white/5 overflow-hidden hover:border-cyan-500/20 transition-all">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 active:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${typeStyle(record.type)}`}>{record.type || 'Record'}</span>
                      <span className="text-slate-500 text-xs font-bold">{record.voucherNo || record.id?.slice(0, 8)}</span>
                      <span className="text-slate-600 text-xs">•</span>
                      <span className="text-slate-500 text-xs font-bold">{record.paymentMethod || 'Cash'}</span>
                    </div>
                    <p className="font-black text-white truncate">{record.personName || record.customerName || record.supplierName || record.item || 'Walk-in'}</p>
                    <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mt-1">
                      <Calendar size={12} /> {record.date || toISODate(record) || '-'} {record.time || ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      <p className={`font-black text-lg sm:text-xl ${amountColor}`}>{amountSign}{fmt(record.amount)}</p>
                      {(Number(record.remainingDebt) || 0) > 0 && <p className="text-[10px] text-amber-300 font-black">Credit {fmt(record.remainingDebt)}</p>}
                    </div>
                    {isExpanded ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/5 px-4 sm:px-5 pb-5 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-sm">
                      <div className="rounded-xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase">Cashier</p>
                        <p className="font-bold text-white truncate">{record.cashier || 'Admin'}</p>
                      </div>
                      <div className="rounded-xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase">Subtotal</p>
                        <p className="font-bold text-white">{fmt(record.subtotal || record.amount)}</p>
                      </div>
                      <div className="rounded-xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase">Paid</p>
                        <p className="font-bold text-white">{fmt(record.paidAmount !== undefined ? record.paidAmount : record.amount)}</p>
                      </div>
                      <div className="rounded-xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase">Balance</p>
                        <p className="font-bold text-white">{fmt(record.remainingDebt || 0)}</p>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="rounded-2xl bg-black/20 border border-white/5 overflow-hidden">
                        <div className="px-4 py-3 text-xs font-black text-slate-500 uppercase border-b border-white/5">Items</div>
                        <div className="divide-y divide-white/5">
                          {items.map((item, index) => (
                            <div key={`${record.id}-${index}`} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">{item.name || item.productName || 'Item'}</p>
                                <p className="text-xs text-slate-500">{fmt(item.quantity || 1)} {item.unitName || ''} × {fmt(item.unitPrice || item.price || 0)}</p>
                              </div>
                              <p className="font-black text-slate-200 whitespace-nowrap">{fmt(((Number(item.unitPrice || item.price) || 0) * (Number(item.quantity) || 1)) - (Number(item.itemDiscountAmt) || 0))}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptModal({ show: true, record })}
                        className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Receipt size={18} /> View Receipt
                      </button>
                      <button
                        type="button"
                        onClick={() => doPrint(record, shopSettings)}
                        className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Printer size={18} /> Print
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {receiptModal.show && receiptModal.record && (
        <div className="fixed inset-0 z-[600] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setReceiptModal({ show: false, record: null })}>
          <div className="w-full max-w-sm bg-white text-black rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">{shopSettings.shopName}</h2>
              {shopSettings.address && <p className="text-xs text-gray-500 mt-1">{shopSettings.address}</p>}
              {shopSettings.phone && <p className="text-xs text-gray-500">Tel: {shopSettings.phone}</p>}
            </div>

            <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between"><span>Voucher:</span><span className="text-gray-900">{receiptModal.record.voucherNo || receiptModal.record.id}</span></div>
              <div className="flex justify-between"><span>Type:</span><span className="text-gray-900">{receiptModal.record.type || '-'}</span></div>
              <div className="flex justify-between"><span>Date:</span><span className="text-gray-900">{receiptModal.record.date || toISODate(receiptModal.record)} {receiptModal.record.time || ''}</span></div>
              <div className="flex justify-between"><span>Name:</span><span className="text-gray-900">{receiptModal.record.personName || receiptModal.record.item || 'Walk-in'}</span></div>
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
                  {(receiptModal.record.itemsDetail || receiptModal.record.items || [{ name: receiptModal.record.item || 'Item', quantity: 1, unitPrice: receiptModal.record.amount, itemDiscountAmt: 0, unitName: 'ခု' }]).map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5">
                        <div className="font-bold text-gray-800">{item.name || item.productName || 'Item'}</div>
                        <div className="text-gray-500 text-[10px] mt-0.5">
                          {fmt(item.quantity || 1)} {item.unitName || ''} x {fmt(item.unitPrice || item.price || 0)}
                          {Number(item.itemDiscountAmt || 0) > 0 && ` (-${fmt(item.itemDiscountAmt)})`}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-800 align-top">
                        {fmt(((Number(item.unitPrice || item.price) || 0) * (Number(item.quantity) || 1)) - (Number(item.itemDiscountAmt) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-dashed border-gray-300 pt-3 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between"><span>Subtotal:</span><span className="text-gray-900">{fmt(receiptModal.record.subtotal || receiptModal.record.amount || 0)} Ks</span></div>
              {((Number(receiptModal.record.itemDiscount) || 0) > 0 || (Number(receiptModal.record.globalDiscount) || 0) > 0) && (
                <div className="flex justify-between text-red-500"><span>Discount:</span><span>-{fmt((Number(receiptModal.record.itemDiscount) || 0) + (Number(receiptModal.record.globalDiscount) || 0))} Ks</span></div>
              )}
            </div>

            <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between text-lg font-black text-gray-900">
              <span>GRAND TOTAL</span><span>{fmt(receiptModal.record.amount || 0)} Ks</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mt-4 space-y-1.5 text-xs font-semibold text-gray-600 border border-gray-200">
              <div className="flex justify-between"><span>Paid ({receiptModal.record.paymentMethod || 'Cash'}):</span><span className="text-gray-900">{fmt(receiptModal.record.paidAmount !== undefined ? receiptModal.record.paidAmount : receiptModal.record.amount)} Ks</span></div>
              {(Number(receiptModal.record.remainingDebt) || 0) > 0 ? (
                <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5"><span>Credit Balance:</span><span>{fmt(receiptModal.record.remainingDebt)} Ks</span></div>
              ) : (
                <div className="flex justify-between text-green-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5"><span>Change:</span><span>{fmt(receiptModal.record.changeAmount || 0)} Ks</span></div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button onClick={() => doPrint(receiptModal.record, shopSettings)} className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Printer size={18} /> Print Receipt
              </button>
              <button onClick={() => setReceiptModal({ show: false, record: null })} className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
