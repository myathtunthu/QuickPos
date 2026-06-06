import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  Calendar,
  CreditCard,
  Download,
  Package,
  PieChart,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const todayISO = () => new Date().toISOString().split('T')[0];

const startOfMonthISO = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const fmt = (n) => (Number(n) || 0).toLocaleString();

const typeOf = (record) => (record?.type || '').toLowerCase();

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

const getItemCost = (item, productMap) => {
  const product = productMap[item.productId] || productMap[item.id] || productMap[item.product];
  return (
    Number(item.costPrice) ||
    Number(item.cost) ||
    Number(product?.costPrice) ||
    Number(product?.packageUnits?.[0]?.costPrice) ||
    0
  );
};

const SectionCard = ({ title, subtitle, icon: Icon, children, action }) => (
  <section className="bg-[#0d1120] rounded-3xl border border-cyan-500/15 shadow-xl p-4 sm:p-6 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
            <Icon size={22} />
          </div>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, note, icon: Icon, tone = 'cyan' }) => {
  const tones = {
    cyan: 'bg-cyan-950/20 border-cyan-500/15 text-cyan-300',
    emerald: 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300',
    rose: 'bg-rose-950/20 border-rose-500/20 text-rose-300',
    amber: 'bg-amber-950/20 border-amber-500/20 text-amber-300',
    violet: 'bg-violet-950/20 border-violet-500/20 text-violet-300',
    slate: 'bg-slate-900/40 border-white/10 text-slate-300',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.cyan}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider font-black text-slate-500">{label}</p>
          <p className="text-xl sm:text-2xl font-black mt-1">{value}</p>
          {note && <p className="text-[11px] text-slate-500 font-semibold mt-1">{note}</p>}
        </div>
        {Icon && <Icon size={24} className="opacity-70" />}
      </div>
    </div>
  );
};

export default function ReportsPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: startOfMonthISO(), end: todayISO() });

  useEffect(() => {
    if (!tenantId) {
      setRecords([]);
      setProducts([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);

    const recordQuery = query(
      collection(db, 'pos_records'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );

    const productQuery = query(
      collection(db, 'pos_products'),
      where('tenantId', '==', tenantId),
      limit(1000)
    );

    const unsubRecords = onSnapshot(
      recordQuery,
      (snap) => {
        setRecords(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setIsLoading(false);
      },
      (error) => {
        console.error('Reports records load failed:', error);
        setIsLoading(false);
      }
    );

    const unsubProducts = onSnapshot(
      productQuery,
      (snap) => setProducts(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
      (error) => console.error('Reports products load failed:', error)
    );

    return () => {
      unsubRecords();
      unsubProducts();
    };
  }, [tenantId]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      map[product.id] = product;
    });
    return map;
  }, [products]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const iso = toISODate(record);
      return iso && iso >= dateRange.start && iso <= dateRange.end;
    });
  }, [records, dateRange]);

  const analytics = useMemo(() => {
    const initial = {
      revenue: 0,
      purchases: 0,
      expenses: 0,
      cogs: 0,
      grossProfit: 0,
      netProfit: 0,
      saleCount: 0,
      purchaseCount: 0,
      expenseCount: 0,
      cashIn: 0,
      cashOut: 0,
      outstandingCredit: 0,
      topProducts: {},
      expenseCategories: {},
      daily: {},
      paymentMethods: {},
    };

    filteredRecords.forEach((record) => {
      const kind = typeOf(record);
      const amount = Number(record.amount) || 0;
      const paid = record.paidAmount !== undefined ? Number(record.paidAmount) || 0 : amount;
      const debt = Number(record.remainingDebt) || 0;
      const iso = toISODate(record) || 'Unknown';
      const daily = initial.daily[iso] || { date: iso, sales: 0, purchases: 0, expenses: 0, profit: 0 };
      const method = record.paymentMethod || (kind === 'expense' ? 'Expense' : 'Unknown');

      if (kind === 'sale') {
        const items = record.itemsDetail || record.items || [];
        const cogs = items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const unitCost = getItemCost(item, productMap);
          const itemName = item.name || item.productName || 'Unknown Product';
          const itemRevenue = (Number(item.unitPrice) || 0) * qty - (Number(item.itemDiscountAmt) || 0);

          initial.topProducts[itemName] = initial.topProducts[itemName] || { name: itemName, qty: 0, revenue: 0 };
          initial.topProducts[itemName].qty += qty;
          initial.topProducts[itemName].revenue += itemRevenue;

          return sum + unitCost * qty;
        }, 0);

        initial.saleCount += 1;
        initial.revenue += amount;
        initial.cogs += cogs;
        initial.cashIn += paid;
        initial.outstandingCredit += debt;
        initial.paymentMethods[method] = (initial.paymentMethods[method] || 0) + paid;

        daily.sales += amount;
        daily.profit += amount - cogs;
      }

      if (kind === 'purchase') {
        initial.purchaseCount += 1;
        initial.purchases += amount;
        initial.cashOut += paid;
        initial.outstandingCredit += debt;
        daily.purchases += amount;
      }

      if (kind === 'expense') {
        const category = record.category || record.item || 'General Expense';
        initial.expenseCount += 1;
        initial.expenses += amount;
        initial.cashOut += amount;
        initial.expenseCategories[category] = (initial.expenseCategories[category] || 0) + amount;
        daily.expenses += amount;
        daily.profit -= amount;
      }

      initial.daily[iso] = daily;
    });

    initial.grossProfit = initial.revenue - initial.cogs;
    initial.netProfit = initial.grossProfit - initial.expenses;

    return {
      ...initial,
      topProducts: Object.values(initial.topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      expenseCategories: Object.entries(initial.expenseCategories)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8),
      daily: Object.values(initial.daily).sort((a, b) => a.date.localeCompare(b.date)),
      paymentMethods: Object.entries(initial.paymentMethods)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [filteredRecords, productMap]);

  const exportCsv = () => {
    const lines = [
      ['Metric', 'Value'],
      ['Revenue', analytics.revenue],
      ['COGS', analytics.cogs],
      ['Gross Profit', analytics.grossProfit],
      ['Expenses', analytics.expenses],
      ['Net Profit', analytics.netProfit],
      ['Purchases', analytics.purchases],
      ['Cash In', analytics.cashIn],
      ['Cash Out', analytics.cashOut],
      ['Outstanding Credit', analytics.outstandingCredit],
      [],
      ['Date', 'Sales', 'Purchases', 'Expenses', 'Profit'],
      ...analytics.daily.map((row) => [row.date, row.sales, row.purchases, row.expenses, row.profit]),
    ];

    const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickpos-report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 text-white max-w-7xl mx-auto space-y-6 pb-10">
      <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-[#0d1120] to-cyan-950/20 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider mb-3">
              <BarChart3 size={14} /> Business Analytics
            </div>
            <h1 className="text-2xl sm:text-4xl font-black">Reports Dashboard</h1>
            <p className="text-slate-400 font-semibold mt-2 max-w-2xl">
              Records Page က voucher history ကြည့်ရန်ဖြစ်ပြီး ဒီ Reports Page က အမြတ်၊ cash flow၊ top products၊ expense analysis တွေကို စီးပွားရေးဆုံးဖြတ်ချက်အတွက် သီးသန့်ပြထားတာပါ။
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 min-w-0 lg:min-w-[560px]">
            <label className="space-y-1">
              <span className="text-xs font-black text-slate-500 uppercase flex items-center gap-1"><Calendar size={13} /> Start</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-[16px] font-bold text-cyan-200 outline-none focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black text-slate-500 uppercase flex items-center gap-1"><Calendar size={13} /> End</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-[16px] font-bold text-cyan-200 outline-none focus:border-cyan-400"
              />
            </label>
            <button
              type="button"
              onClick={exportCsv}
              className="self-end px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Download size={18} /> CSV
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-[#0d1120] border border-cyan-500/15 rounded-3xl p-8 text-center text-slate-400 font-bold flex items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-cyan-400" /> Loading reports...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Revenue" value={`${fmt(analytics.revenue)} Ks`} note={`${analytics.saleCount} sales`} icon={ShoppingCart} tone="cyan" />
            <MetricCard label="Gross Profit" value={`${fmt(analytics.grossProfit)} Ks`} note={`Revenue - COGS (${fmt(analytics.cogs)} Ks)`} icon={TrendingUp} tone="emerald" />
            <MetricCard label="Net Profit" value={`${fmt(analytics.netProfit)} Ks`} note="Gross Profit - Expenses" icon={analytics.netProfit >= 0 ? TrendingUp : TrendingDown} tone={analytics.netProfit >= 0 ? 'emerald' : 'rose'} />
            <MetricCard label="Cash Balance" value={`${fmt(analytics.cashIn - analytics.cashOut)} Ks`} note={`In ${fmt(analytics.cashIn)} / Out ${fmt(analytics.cashOut)}`} icon={Wallet} tone="violet" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Purchases" value={`${fmt(analytics.purchases)} Ks`} note={`${analytics.purchaseCount} purchase records`} icon={Package} tone="amber" />
            <MetricCard label="Expenses" value={`${fmt(analytics.expenses)} Ks`} note={`${analytics.expenseCount} expense records`} icon={CreditCard} tone="rose" />
            <MetricCard label="COGS" value={`${fmt(analytics.cogs)} Ks`} note="Sold products cost" icon={ReceiptText} tone="slate" />
            <MetricCard label="Credit Outstanding" value={`${fmt(analytics.outstandingCredit)} Ks`} note="Unpaid sales/purchases balance" icon={PieChart} tone="amber" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SectionCard title="Daily Business Breakdown" subtitle="နေ့စဉ် အရောင်း/အဝယ်/စရိတ်/အမြတ်" icon={BarChart3}>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-white/10">
                      <th className="py-3 font-black">Date</th>
                      <th className="py-3 font-black text-right">Sales</th>
                      <th className="py-3 font-black text-right">Purchases</th>
                      <th className="py-3 font-black text-right">Expenses</th>
                      <th className="py-3 font-black text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.daily.length === 0 ? (
                      <tr><td colSpan="5" className="py-8 text-center text-slate-500 font-bold">No report data</td></tr>
                    ) : analytics.daily.map((row) => (
                      <tr key={row.date} className="border-b border-white/5 last:border-0">
                        <td className="py-3 font-bold text-white">{row.date}</td>
                        <td className="py-3 text-right text-cyan-300 font-bold">{fmt(row.sales)}</td>
                        <td className="py-3 text-right text-amber-300 font-bold">{fmt(row.purchases)}</td>
                        <td className="py-3 text-right text-rose-300 font-bold">{fmt(row.expenses)}</td>
                        <td className={`py-3 text-right font-black ${row.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmt(row.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Top Selling Products" subtitle="Revenue အများဆုံး product များ" icon={Package}>
              <div className="space-y-3">
                {analytics.topProducts.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 font-bold">No sold products</div>
                ) : analytics.topProducts.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-black/20 border border-white/5 p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center font-black">{index + 1}</div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 font-bold">Qty: {fmt(item.qty)}</p>
                      </div>
                    </div>
                    <p className="font-black text-emerald-300 whitespace-nowrap">{fmt(item.revenue)} Ks</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Expense Categories" subtitle="စရိတ်အမျိုးအစားအလိုက် ခွဲခြမ်းစိတ်ဖြာမှု" icon={CreditCard}>
              <div className="space-y-3">
                {analytics.expenseCategories.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 font-bold">No expenses</div>
                ) : analytics.expenseCategories.map((item) => (
                  <div key={item.name} className="rounded-2xl bg-black/20 border border-white/5 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="font-black text-white truncate">{item.name}</p>
                      <p className="font-black text-rose-300 whitespace-nowrap">{fmt(item.amount)} Ks</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-rose-400 rounded-full"
                        style={{ width: `${Math.min(100, analytics.expenses ? (item.amount / analytics.expenses) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Payment Method Cash-In" subtitle="ငွေလက်ခံနည်းအလိုက် cash-in" icon={Wallet}>
              <div className="space-y-3">
                {analytics.paymentMethods.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 font-bold">No payment data</div>
                ) : analytics.paymentMethods.map((item) => (
                  <div key={item.name} className="flex justify-between items-center rounded-2xl bg-black/20 border border-white/5 p-4">
                    <span className="font-black text-white">{item.name}</span>
                    <span className="font-black text-cyan-300">{fmt(item.amount)} Ks</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
