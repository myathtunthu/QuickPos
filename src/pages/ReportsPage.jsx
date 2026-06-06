import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Download,
  PackageX,
  PieChart,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { exportToCSV } from '../utils/exportCSV';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getRecordType = (record) => String(record?.type || '').toLowerCase();
const getAmount = (record) => toNumber(record?.amount ?? record?.total ?? record?.grandTotal ?? 0);
const getPaid = (record) => toNumber(record?.paidAmount ?? record?.paid ?? (getRecordType(record) === 'sale' ? getAmount(record) : 0));
const getDebt = (record) => toNumber(record?.remainingDebt ?? record?.creditBalance ?? 0);

function getTimeValue(record) {
  const ts = record?.createdAt ?? record?.timestamp;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  if (record?.date) {
    const parsed = new Date(record.date).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function getISODate(record) {
  if (record?.date && String(record.date).includes('-')) return String(record.date).slice(0, 10);
  if (record?.date && String(record.date).includes('/')) {
    const parts = String(record.date).split(',')[0].split('/');
    if (parts.length === 3) return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  const time = getTimeValue(record);
  if (!time) return '';
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getItems(record) {
  if (Array.isArray(record?.itemsDetail)) return record.itemsDetail;
  if (Array.isArray(record?.items)) return record.items;
  if (record?.item && record.item !== 'Multiple') {
    return [{ name: record.item, quantity: 1, unitPrice: getAmount(record), costPrice: 0 }];
  }
  return [];
}

function getItemRevenue(item) {
  const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
  const unitPrice = toNumber(item.unitPrice ?? item.price ?? item.salePrice ?? 0);
  const discount = toNumber(item.itemDiscountAmt ?? item.discount ?? 0);
  return Math.max(0, unitPrice * qty - discount);
}

function getItemCost(item) {
  const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
  return toNumber(item.costPrice ?? item.cost ?? item.purchasePrice ?? 0) * qty;
}

function translate(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

export default function ReportsPage({ records = [] }) {
  const { t } = useLanguage();
  const todayISO = new Date().toISOString().split('T')[0];
  const [repStart, setRepStart] = useState(todayISO);
  const [repEnd, setRepEnd] = useState(todayISO);

  const fmt = (n) => toNumber(n).toLocaleString();

  const report = useMemo(() => {
    const safeStart = repStart <= repEnd ? repStart : repEnd;
    const safeEnd = repStart <= repEnd ? repEnd : repStart;
    const filtered = records
      .filter((record) => {
        const iso = getISODate(record);
        return iso && iso >= safeStart && iso <= safeEnd;
      })
      .sort((a, b) => getTimeValue(b) - getTimeValue(a));

    const dailyMap = new Map();
    const productMap = new Map();
    const expenseMap = new Map();

    const totals = {
      sales: 0,
      purchases: 0,
      expenses: 0,
      cogs: 0,
      grossProfit: 0,
      netProfit: 0,
      cashIn: 0,
      cashOut: 0,
      creditSales: 0,
      creditPurchases: 0,
      saleCount: 0,
      purchaseCount: 0,
      expenseCount: 0,
    };

    filtered.forEach((record) => {
      const type = getRecordType(record);
      const amount = getAmount(record);
      const day = getISODate(record);
      const daily = dailyMap.get(day) || { date: day, sales: 0, purchases: 0, expenses: 0, profit: 0 };

      if (type === 'sale') {
        totals.sales += amount;
        totals.cashIn += getPaid(record);
        totals.creditSales += getDebt(record);
        totals.saleCount += 1;
        daily.sales += amount;

        let recordCost = 0;
        const items = getItems(record);
        items.forEach((item) => {
          const name = item.name || item.productName || 'Unknown Product';
          const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
          const revenue = getItemRevenue(item);
          const cost = getItemCost(item);
          recordCost += cost;
          const prev = productMap.get(name) || { name, qty: 0, revenue: 0, profit: 0 };
          productMap.set(name, {
            name,
            qty: prev.qty + qty,
            revenue: prev.revenue + revenue,
            profit: prev.profit + (revenue - cost),
          });
        });
        totals.cogs += recordCost;
        daily.profit += amount - recordCost;
      }

      if (type === 'purchase') {
        totals.purchases += amount;
        totals.cashOut += getPaid(record) || amount;
        totals.creditPurchases += getDebt(record);
        totals.purchaseCount += 1;
        daily.purchases += amount;
      }

      if (type === 'expense') {
        const category = record.category || record.item || record.expenseType || 'General';
        totals.expenses += amount;
        totals.cashOut += getPaid(record) || amount;
        totals.expenseCount += 1;
        daily.expenses += amount;
        daily.profit -= amount;
        expenseMap.set(category, (expenseMap.get(category) || 0) + amount);
      }

      dailyMap.set(day, daily);
    });

    totals.grossProfit = totals.sales - totals.cogs;
    totals.netProfit = totals.grossProfit - totals.expenses;
    totals.margin = totals.sales > 0 ? (totals.netProfit / totals.sales) * 100 : 0;
    totals.cashBalance = totals.cashIn - totals.cashOut;
    totals.avgSale = totals.saleCount > 0 ? totals.sales / totals.saleCount : 0;

    return {
      totals,
      filtered,
      dailyRows: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      topProducts: [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      topExpenses: [...expenseMap.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10),
      safeStart,
      safeEnd,
    };
  }, [records, repStart, repEnd]);

  const exportReport = () => {
    const rows = report.dailyRows.map((row) => ({
      Date: row.date,
      Sales: row.sales,
      Purchases: row.purchases,
      Expenses: row.expenses,
      Profit: row.profit,
    }));
    rows.push(
      { Date: 'TOTAL_SALES', Sales: report.totals.sales, Purchases: '', Expenses: '', Profit: '' },
      { Date: 'COGS', Sales: report.totals.cogs, Purchases: '', Expenses: '', Profit: '' },
      { Date: 'GROSS_PROFIT', Sales: report.totals.grossProfit, Purchases: '', Expenses: '', Profit: '' },
      { Date: 'NET_PROFIT', Sales: report.totals.netProfit, Purchases: '', Expenses: '', Profit: '' },
      { Date: 'CASH_BALANCE', Sales: report.totals.cashBalance, Purchases: '', Expenses: '', Profit: '' }
    );
    exportToCSV(rows, `profit-report-${report.safeStart}-to-${report.safeEnd}`);
  };

  const cardClass = 'bg-[#0d1120] border border-white/10 rounded-3xl p-5 shadow-xl shadow-black/20';
  const toneClass = {
    cyan: { glow: 'bg-cyan-500/10', text: 'text-cyan-400', icon: 'bg-cyan-500/10 text-cyan-400' },
    amber: { glow: 'bg-amber-500/10', text: 'text-amber-400', icon: 'bg-amber-500/10 text-amber-400' },
    emerald: { glow: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'bg-emerald-500/10 text-emerald-400' },
    rose: { glow: 'bg-rose-500/10', text: 'text-rose-400', icon: 'bg-rose-500/10 text-rose-400' },
    blue: { glow: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500/10 text-blue-400' },
  };
  const StatCard = ({ icon: Icon, label, value, sub, tone = 'cyan' }) => {
    const colors = toneClass[tone] || toneClass.cyan;
    return (
      <div className={`${cardClass} relative overflow-hidden`}>
        <div className={`absolute -right-10 -top-10 w-28 h-28 rounded-full blur-3xl ${colors.glow}`} />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
            <p className={`mt-2 text-2xl font-black ${colors.text}`}>{fmt(value)} Ks</p>
            {sub && <p className="mt-2 text-xs text-slate-500 font-bold">{sub}</p>}
          </div>
          <div className={`p-3 rounded-2xl ${colors.icon}`}><Icon size={22} /></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#060816] text-white p-4 sm:p-6 pb-24 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-cyan-400 font-black uppercase tracking-[0.25em]">NexPOS Analytics</p>
          <h1 className="text-3xl sm:text-4xl font-black mt-2 flex items-center gap-3">
            <PieChart className="text-cyan-400" /> {translate(t, 'reports', 'Reports')}
          </h1>
          <p className="text-sm text-slate-400 mt-2">Profit, cash flow, purchases, expenses, and product performance.</p>
        </div>
        <button type="button" onClick={exportReport} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-black hover:bg-cyan-500/20 active:scale-95">
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className={`${cardClass} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
        <div>
          <label className="text-xs font-black text-slate-500 uppercase mb-2 block">{translate(t, 'startDate', 'Start Date')}</label>
          <input type="date" value={repStart} onChange={(e) => setRepStart(e.target.value)} className="w-full text-[16px] bg-black/40 border border-cyan-500/20 rounded-2xl px-4 py-3 text-cyan-300 font-black outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="text-xs font-black text-slate-500 uppercase mb-2 block">{translate(t, 'endDate', 'End Date')}</label>
          <input type="date" value={repEnd} onChange={(e) => setRepEnd(e.target.value)} className="w-full text-[16px] bg-black/40 border border-cyan-500/20 rounded-2xl px-4 py-3 text-cyan-300 font-black outline-none focus:border-cyan-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Receipt} label="Total Sales" value={report.totals.sales} sub={`${report.totals.saleCount} sale vouchers`} tone="cyan" />
        <StatCard icon={PackageX} label="COGS" value={report.totals.cogs} sub="Cost of goods sold" tone="amber" />
        <StatCard icon={TrendingUp} label="Net Profit" value={report.totals.netProfit} sub={`${report.totals.margin.toFixed(1)}% margin`} tone={report.totals.netProfit >= 0 ? 'emerald' : 'rose'} />
        <StatCard icon={Wallet} label="Cash Balance" value={report.totals.cashBalance} sub={`In ${fmt(report.totals.cashIn)} • Out ${fmt(report.totals.cashOut)}`} tone={report.totals.cashBalance >= 0 ? 'blue' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardClass} lg:col-span-2`}>
          <h2 className="font-black mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-cyan-400" /> Daily Breakdown</h2>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm whitespace-nowrap">
              <thead><tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/10"><th className="py-3 pr-4">Date</th><th className="p-3 text-right">Sales</th><th className="p-3 text-right">Purchases</th><th className="p-3 text-right">Expenses</th><th className="p-3 text-right">Profit</th></tr></thead>
              <tbody>
                {report.dailyRows.length === 0 ? (
                  <tr><td colSpan="5" className="py-10 text-center text-slate-500">No report data for selected date range.</td></tr>
                ) : report.dailyRows.map((row) => (
                  <tr key={row.date} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 pr-4 font-bold text-slate-300">{row.date}</td>
                    <td className="p-3 text-right text-cyan-300 font-black">{fmt(row.sales)}</td>
                    <td className="p-3 text-right text-blue-300 font-black">{fmt(row.purchases)}</td>
                    <td className="p-3 text-right text-amber-300 font-black">{fmt(row.expenses)}</td>
                    <td className={`p-3 text-right font-black ${row.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmt(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${cardClass}`}>
          <h2 className="font-black mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400" /> Accounting Check</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3 bg-black/25 rounded-2xl p-3"><span className="text-slate-400">Gross Profit</span><span className="font-black text-emerald-300">{fmt(report.totals.grossProfit)} Ks</span></div>
            <div className="flex justify-between gap-3 bg-black/25 rounded-2xl p-3"><span className="text-slate-400">Expenses</span><span className="font-black text-amber-300">{fmt(report.totals.expenses)} Ks</span></div>
            <div className="flex justify-between gap-3 bg-black/25 rounded-2xl p-3"><span className="text-slate-400">Customer Credit</span><span className="font-black text-rose-300">{fmt(report.totals.creditSales)} Ks</span></div>
            <div className="flex justify-between gap-3 bg-black/25 rounded-2xl p-3"><span className="text-slate-400">Supplier Credit</span><span className="font-black text-blue-300">{fmt(report.totals.creditPurchases)} Ks</span></div>
            <p className="text-xs leading-5 text-slate-500 pt-2">Profit = Sales - COGS - Expenses. Purchase amount is treated as stock capital/cash out, not direct expense.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${cardClass}`}>
          <h2 className="font-black mb-4">Top Products by Revenue</h2>
          <div className="space-y-3">
            {report.topProducts.length === 0 ? <p className="text-slate-500 text-sm">No product sales in this range.</p> : report.topProducts.map((product) => (
              <div key={product.name} className="bg-black/25 border border-white/5 rounded-2xl p-3">
                <div className="flex justify-between gap-3 text-sm font-bold"><span className="truncate">{product.name}</span><span className="text-cyan-300">{fmt(product.revenue)} Ks</span></div>
                <div className="flex justify-between gap-3 text-xs text-slate-500 mt-1"><span>Qty {product.qty}</span><span className={product.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>Profit {fmt(product.profit)} Ks</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass}`}>
          <h2 className="font-black mb-4">Top Expense Categories</h2>
          <div className="space-y-3">
            {report.topExpenses.length === 0 ? <p className="text-slate-500 text-sm">No expenses in this range.</p> : report.topExpenses.map((expense) => (
              <div key={expense.name} className="flex justify-between gap-3 bg-black/25 border border-white/5 rounded-2xl p-3 text-sm font-bold">
                <span className="truncate">{expense.name}</span><span className="text-amber-300">{fmt(expense.amount)} Ks</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
