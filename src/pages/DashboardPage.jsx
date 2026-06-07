import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  Plus,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getTimeValue(record) {
  const ts = record?.createdAt || record?.timestamp;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  if (record?.date) {
    const parsed = new Date(record.date).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function getPastISO(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRecordDateISO(record) {
  if (record?.date && String(record.date).includes('-')) return String(record.date).slice(0, 10);
  const time = getTimeValue(record);
  const d = time ? new Date(time) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRecordType(record) {
  return String(record?.type || '').toLowerCase();
}

function getRecordAmount(record) {
  return toNumber(record?.amount ?? record?.total ?? record?.grandTotal ?? 0);
}

function getRecordPaid(record) {
  return toNumber(record?.paidAmount ?? record?.paid ?? 0);
}

function getRecordDebt(record) {
  return toNumber(record?.remainingDebt ?? record?.creditBalance ?? 0);
}

function getRecordItems(record) {
  if (Array.isArray(record?.itemsDetail)) return record.itemsDetail;
  if (Array.isArray(record?.items)) return record.items;
  if (record?.item && record.item !== 'Multiple') return [{ name: record.item, quantity: 1, price: getRecordAmount(record), costPrice: record.costPrice || 0 }];
  return [];
}

function getProductName(product) {
  return product?.name || product?.productName || product?.itemName || 'Unnamed Product';
}

function getProductStock(product) {
  return toNumber(product?.stockBase ?? product?.stock ?? product?.qty ?? 0);
}

function getProductCost(product) {
  return toNumber(product?.costPrice ?? product?.packageUnits?.[0]?.costPrice ?? 0);
}

const colors = {
  cyan: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'bg-cyan-500/20' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'bg-emerald-500/20' },
  rose: { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20', glow: 'bg-rose-500/20' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'bg-amber-500/20' },
  violet: { text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'bg-violet-500/20' },
  blue: { text: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: 'bg-blue-500/20' },
};

function Panel({ children, className = '' }) {
  return (
    <motion.section
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1120]/95 shadow-xl shadow-black/20 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function EmptyMini({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 py-6 text-center text-sm font-bold text-slate-500">{text}</div>;
}


function MiniLegend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] font-black text-slate-400">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ComparisonBars({ rows, fmt }) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const width = Math.max((Math.abs(row.value) / max) * 100, row.value ? 8 : 2);
        return (
          <div key={row.label} className="rounded-2xl border border-white/5 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black">
              <span className="text-slate-300">{row.label}</span>
              <span className={row.text}>{fmt(row.value)} Ks</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { profile, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const common = where('tenantId', '==', tenantId);

    const unsubRecords = onSnapshot(
      query(collection(db, 'pos_records'), common, limit(800)),
      (snap) => {
        setRecords(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubProducts = onSnapshot(query(collection(db, 'pos_products'), common, limit(800)), (snap) => setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
    const unsubCustomers = onSnapshot(query(collection(db, 'pos_customers'), common, limit(400)), (snap) => setCustomers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
    const unsubSuppliers = onSnapshot(query(collection(db, 'pos_suppliers'), common, limit(400)), (snap) => setSuppliers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));

    return () => {
      unsubRecords();
      unsubProducts();
      unsubCustomers();
      unsubSuppliers();
    };
  }, [tenantId]);

  if (profile && profile.role !== 'admin' && profile.role !== 'owner' && !hasPermission('view_reports')) {
    const permissions = profile.permissions || [];
    if (permissions.includes('create_sale')) return <Navigate to="/entry" replace />;
    if (permissions.includes('view_inventory')) return <Navigate to="/inventory" replace />;
    if (permissions.includes('accept_payment')) return <Navigate to="/customers" replace />;
    return <Navigate to="/entry" replace />;
  }

  const fmt = (num) => toNumber(num).toLocaleString();

  const filteredRecords = useMemo(() => {
    const today = getPastISO(0);
    const weekStart = getPastISO(6);
    const monthStart = getPastISO(29);
    const keyword = searchTerm.trim().toLowerCase();

    return records
      .filter((record) => {
        const iso = getRecordDateISO(record);
        if (dateRange === 'today') return iso === today;
        if (dateRange === 'week') return iso >= weekStart && iso <= today;
        if (dateRange === 'month') return iso >= monthStart && iso <= today;
        return true;
      })
      .filter((record) => {
        if (!keyword) return true;
        return [record.personName, record.voucherNo, record.invoiceNo, record.type, record.item, record.paymentType, record.paymentMethod]
          .some((value) => String(value || '').toLowerCase().includes(keyword));
      })
      .sort((a, b) => getTimeValue(b) - getTimeValue(a));
  }, [records, dateRange, searchTerm]);

  const saleRecords = useMemo(() => filteredRecords.filter((r) => getRecordType(r) === 'sale'), [filteredRecords]);
  const purchaseRecords = useMemo(() => filteredRecords.filter((r) => getRecordType(r) === 'purchase'), [filteredRecords]);
  const expenseRecords = useMemo(() => filteredRecords.filter((r) => getRecordType(r) === 'expense'), [filteredRecords]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      map[product.id] = product;
      if (product.name) map[product.name] = product;
    });
    return map;
  }, [products]);

  const analytics = useMemo(() => {
    let revenue = 0;
    let expenses = 0;
    let costOfGoods = 0;
    let cashIn = 0;
    let cashOut = 0;
    let customerCredit = 0;
    const productCounter = {};
    const productRevenueCounter = {};
    const productProfitCounter = {};

    saleRecords.forEach((record) => {
      const amount = getRecordAmount(record);
      revenue += amount;
      cashIn += getRecordPaid(record) || Math.max(0, amount - getRecordDebt(record));
      customerCredit += getRecordDebt(record);

      const items = getRecordItems(record);
      if (items.length === 0) {
        costOfGoods += toNumber(record.costOfGoods || 0);
        return;
      }

      items.forEach((item) => {
        const product = productMap[item.productId] || productMap[item.name] || {};
        const name = item.name || getProductName(product);
        const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
        const price = toNumber(item.unitPrice ?? item.price ?? amount);
        const cost = toNumber(item.costPrice ?? item.cost ?? getProductCost(product));
        const discount = toNumber(item.itemDiscountAmt ?? item.discount ?? 0);
        const itemRevenue = Math.max(0, price * qty - discount);
        const itemCost = cost * qty;
        costOfGoods += itemCost;
        productCounter[name] = (productCounter[name] || 0) + qty;
        productRevenueCounter[name] = (productRevenueCounter[name] || 0) + itemRevenue;
        productProfitCounter[name] = (productProfitCounter[name] || 0) + (itemRevenue - itemCost);
      });
    });

    purchaseRecords.forEach((record) => {
      cashOut += getRecordPaid(record) || getRecordAmount(record);
    });

    expenseRecords.forEach((record) => {
      const amount = getRecordAmount(record);
      expenses += amount;
      cashOut += getRecordPaid(record) || amount;
    });

    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - expenses;
    const cashFlow = cashIn - cashOut;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      expenses,
      costOfGoods,
      grossProfit,
      netProfit,
      cashIn,
      cashOut,
      cashFlow,
      customerCredit,
      margin,
      orders: saleRecords.length,
      averageOrder: saleRecords.length ? revenue / saleRecords.length : 0,
      topProducts: Object.entries(productCounter)
        .map(([name, qty]) => ({ name, qty, revenue: productRevenueCounter[name] || 0, profit: productProfitCounter[name] || 0 }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5),
    };
  }, [saleRecords, purchaseRecords, expenseRecords, productMap]);

  const inventoryStats = useMemo(() => {
    let inventoryValue = 0;
    const lowStock = products
      .map((product) => {
        const stock = getProductStock(product);
        const minStock = toNumber(product.minStock ?? product.minStockAlert ?? 5);
        const cost = getProductCost(product);
        inventoryValue += stock * cost;
        return { id: product.id, name: getProductName(product), stock, minStock, category: product.category || t('general', 'General') };
      })
      .filter((product) => product.stock <= product.minStock)
      .sort((a, b) => a.stock - b.stock);

    return {
      inventoryValue,
      lowStock,
      lowStockCount: lowStock.length,
      outOfStock: lowStock.filter((product) => product.stock <= 0).length,
      totalProducts: products.length,
    };
  }, [products, t]);

  const supplierDebt = useMemo(() => suppliers.reduce((sum, supplier) => sum + toNumber(supplier.debt ?? supplier.balance ?? supplier.payable ?? 0), 0), [suppliers]);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const iso = getPastISO(i);
      const day = new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
      const dayRecords = records.filter((record) => getRecordDateISO(record) === iso);
      const daySales = dayRecords.filter((record) => getRecordType(record) === 'sale');
      const dayExpenses = dayRecords.filter((record) => getRecordType(record) === 'expense');
      const sales = daySales.reduce((sum, record) => sum + getRecordAmount(record), 0);
      const expenses = dayExpenses.reduce((sum, record) => sum + getRecordAmount(record), 0);
      let cost = 0;
      daySales.forEach((record) => {
        getRecordItems(record).forEach((item) => {
          const product = productMap[item.productId] || productMap[item.name] || {};
          cost += toNumber(item.costPrice ?? item.cost ?? getProductCost(product)) * (toNumber(item.quantity ?? item.qty ?? 1) || 1);
        });
      });
      days.push({ day, sales, profit: sales - cost - expenses, expenses });
    }
    return days;
  }, [records, productMap]);

  const alerts = useMemo(() => {
    const list = [];
    if (inventoryStats.outOfStock > 0) list.push({ tone: 'rose', title: t('alertOutOfStock', 'Out of stock'), body: `${inventoryStats.outOfStock} ${t('productsNeedRestock', 'products need restock')}` });
    if (inventoryStats.lowStockCount > 0) list.push({ tone: 'amber', title: t('alertLowStock', 'Low stock'), body: `${inventoryStats.lowStockCount} ${t('productsBelowMinimum', 'products below minimum')}` });
    if (analytics.customerCredit > 0) list.push({ tone: 'amber', title: t('alertCustomerCredit', 'Customer credit'), body: `${fmt(analytics.customerCredit)} Ks ${t('unpaidBalance', 'unpaid balance')}` });
    if (analytics.cashFlow < 0) list.push({ tone: 'rose', title: t('alertCashFlow', 'Cash flow warning'), body: `${fmt(Math.abs(analytics.cashFlow))} Ks ${t('cashFlowNegative', 'negative cash flow')}` });
    if (list.length === 0) list.push({ tone: 'emerald', title: t('alertAllGood', 'All good'), body: t('alertAllGoodBody', 'No critical alerts for this period.') });
    return list.slice(0, 4);
  }, [inventoryStats, analytics, t]);

  const recentTransactions = useMemo(() => [...records].sort((a, b) => getTimeValue(b) - getTimeValue(a)).slice(0, 6), [records]);

  const kpiCards = [
    { title: t('todaySales', 'Today Sales'), value: analytics.revenue, suffix: 'Ks', icon: DollarSign, color: 'cyan', note: `${analytics.orders} ${t('orders', 'orders')}`, bad: false },
    { title: t('todayProfit', 'Today Profit'), value: analytics.netProfit, suffix: 'Ks', icon: TrendingUp, color: analytics.netProfit >= 0 ? 'emerald' : 'rose', note: `${analytics.margin.toFixed(1)}% ${t('margin', 'margin')}`, bad: analytics.netProfit < 0 },
    { title: t('stockValue', 'Stock Value'), value: inventoryStats.inventoryValue, suffix: 'Ks', icon: Package, color: 'violet', note: `${inventoryStats.totalProducts} ${t('products', 'products')}`, bad: false },
    { title: t('customerCredit', 'Customer Credit'), value: analytics.customerCredit, suffix: 'Ks', icon: CreditCard, color: analytics.customerCredit > 0 ? 'amber' : 'emerald', note: t('unpaidSaleBalance', 'Unpaid sale balance'), bad: analytics.customerCredit > 0 },
  ];

  const secondaryCards = [
    { title: t('expenses', 'Expenses'), value: analytics.expenses, suffix: 'Ks', icon: TrendingDown, color: 'rose', note: t('operationalCosts', 'Operational costs'), bad: analytics.expenses > analytics.revenue && analytics.expenses > 0 },
    { title: t('cashFlow', 'Cash Flow'), value: analytics.cashFlow, suffix: 'Ks', icon: Wallet, color: analytics.cashFlow >= 0 ? 'blue' : 'rose', note: `${t('cashIn', 'In')} ${fmt(analytics.cashIn)} • ${t('cashOut', 'Out')} ${fmt(analytics.cashOut)}`, bad: analytics.cashFlow < 0 },
    { title: t('supplierCredit', 'Supplier Credit'), value: supplierDebt, suffix: 'Ks', icon: FileText, color: supplierDebt > 0 ? 'amber' : 'emerald', note: t('unpaidPurchaseBalance', 'Unpaid purchase balance'), bad: supplierDebt > 0 },
    { title: t('lowStock', 'Low Stock'), value: inventoryStats.lowStockCount, suffix: '', icon: AlertTriangle, color: inventoryStats.lowStockCount > 0 ? 'rose' : 'emerald', note: `${inventoryStats.outOfStock} ${t('outOfStock', 'out of stock')}`, bad: inventoryStats.lowStockCount > 0 },
  ];


  const financialRows = [
    { label: t('revenue', 'Revenue'), value: analytics.revenue, text: 'text-cyan-300', bar: 'bg-gradient-to-r from-cyan-600 to-cyan-300' },
    { label: t('expenses', 'Expenses'), value: analytics.expenses, text: 'text-rose-300', bar: 'bg-gradient-to-r from-rose-600 to-rose-300' },
    { label: t('grossProfit', 'Gross Profit'), value: analytics.grossProfit, text: analytics.grossProfit >= 0 ? 'text-emerald-300' : 'text-rose-300', bar: analytics.grossProfit >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-300' : 'bg-gradient-to-r from-rose-600 to-rose-300' },
    { label: t('netProfit', 'Net Profit'), value: analytics.netProfit, text: analytics.netProfit >= 0 ? 'text-violet-300' : 'text-rose-300', bar: analytics.netProfit >= 0 ? 'bg-gradient-to-r from-violet-600 to-violet-300' : 'bg-gradient-to-r from-rose-600 to-rose-300' },
  ];

  const todaySnapshot = [
    { label: t('revenue', 'Revenue'), value: analytics.revenue, tone: 'text-cyan-300' },
    { label: t('grossProfit', 'Gross Profit'), value: analytics.grossProfit, tone: analytics.grossProfit >= 0 ? 'text-emerald-300' : 'text-rose-300' },
    { label: t('expenses', 'Expenses'), value: analytics.expenses, tone: 'text-rose-300' },
    { label: t('netProfit', 'Net Profit'), value: analytics.netProfit, tone: analytics.netProfit >= 0 ? 'text-violet-300' : 'text-rose-300' },
  ];

  function KpiCard({ card, compact = false }) {
    const Icon = card.icon;
    const tone = colors[card.color] || colors.cyan;
    return (
      <Panel className={`p-4 sm:p-5 ${tone.border}`}>
        <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl ${tone.glow}`} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500">{card.title}</p>
            <h3 className={`${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} mt-2 font-black leading-tight ${tone.text}`}>{fmt(card.value)} {card.suffix}</h3>
            <p className="mt-3 truncate text-xs font-bold text-slate-500">{card.note}</p>
          </div>
          <div className={`rounded-2xl p-3 ${tone.bg} ${tone.text}`}><Icon size={compact ? 20 : 24} /></div>
        </div>
      </Panel>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-white">
        <div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-cyan-400 font-black animate-pulse">{t('loadingDashboard', 'Loading dashboard...')}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

      <motion.div initial="hidden" animate="visible" transition={{ staggerChildren: 0.06 }} className="relative z-10 mx-auto max-w-7xl space-y-5 sm:space-y-6 pb-6">
        <Panel className="p-5 sm:p-7 border-cyan-500/15">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="rounded-3xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-cyan-300 shrink-0"><Zap size={28} /></div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{t('businessCommandCenter', 'Business command center')}</p>
                <h1 className="mt-2 text-2xl sm:text-4xl font-black leading-tight">{t('nexposDashboard', 'NexPOS Dashboard')}</h1>
                <p className="mt-2 text-sm text-slate-400 font-bold truncate">{profile?.businessName || profile?.shopName || profile?.email || t('yourBusiness', 'Your business')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 xl:w-auto">
              <div className="relative sm:w-72">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('dashboardSearchPlaceholder', 'Search voucher/customer...')}
                  className="w-full rounded-2xl border border-cyan-500/15 bg-black/35 py-3 pl-11 pr-4 text-[16px] text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div className="grid grid-cols-3 rounded-2xl border border-cyan-500/15 bg-black/25 p-1">
                {['today', 'week', 'month'].map((range) => (
                  <button key={range} type="button" onClick={() => setDateRange(range)} className={`rounded-xl px-4 py-2 text-xs font-black transition ${dateRange === range ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}>
                    {t(range, range)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiCards.map((card) => <KpiCard key={card.title} card={card} />)}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Panel className="p-5 xl:col-span-2 border-cyan-500/10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-cyan-300">{t('todayBusinessSnapshot', 'Today Business Snapshot')}</p>
                <h2 className="mt-1 text-xl sm:text-2xl font-black">{t('ownerSummary', 'Sales, costs and net result')}</h2>
              </div>
              <BarChart3 className="text-cyan-300" size={28} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {todaySnapshot.map((item) => (
                <div key={item.label} className="rounded-2xl bg-black/25 border border-white/5 p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
                  <p className={`mt-2 text-xl sm:text-2xl font-black ${item.tone}`}>{fmt(item.value)} Ks</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5 border-amber-500/10">
            <h2 className="mb-4 flex items-center gap-2 font-black"><AlertTriangle size={18} className="text-amber-300" /> {t('alertCenter', 'Alert Center')}</h2>
            <div className="space-y-3">
              {alerts.map((alert) => {
                const tone = colors[alert.tone] || colors.cyan;
                return <div key={alert.title} className={`rounded-2xl border ${tone.border} ${tone.bg} p-3`}><p className={`font-black text-sm ${tone.text}`}>{alert.title}</p><p className="mt-1 text-xs text-slate-400 font-bold">{alert.body}</p></div>;
              })}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {secondaryCards.map((card) => <KpiCard key={card.title} card={card} compact />)}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Panel className="xl:col-span-2 p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black flex items-center gap-2"><TrendingUp size={18} className="text-cyan-300" /> {t('salesProfitTrend', 'Sales & Profit Trend')}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{t('last7Days', 'Last 7 days')}</p>
              </div>
              <MiniLegend items={[
                { label: t('revenue', 'Revenue'), dot: 'bg-cyan-400' },
                { label: t('profit', 'Profit'), dot: 'bg-emerald-400' },
                { label: t('expenses', 'Expenses'), dot: 'bg-rose-400' },
              ]} />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                    <linearGradient id="profitColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(value) => Number(value) >= 1000000 ? `${Math.round(Number(value) / 1000000)}M` : Number(value) >= 1000 ? `${Math.round(Number(value) / 1000)}K` : value} />
                  <Tooltip contentStyle={{ background: '#060816', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 14 }} formatter={(value, name) => [`${fmt(value)} Ks`, t(String(name).toLowerCase(), name)]} />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke="#06b6d4" strokeWidth={3} fill="url(#salesColor)" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} fill="url(#profitColor)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#expenseColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-5">
              <h2 className="font-black flex items-center gap-2"><BarChart3 size={18} className="text-violet-300" /> {t('revenueVsExpense', 'Revenue vs Expense')}</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">{t('financeComparisonHint', 'Compare money in, costs and profit without clipped chart labels.')}</p>
            </div>
            <ComparisonBars rows={financialRows} fmt={fmt} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Panel className="p-5">
            <h2 className="font-black mb-5">🏆 {t('topSellingProducts', 'Top Selling Products')}</h2>
            {analytics.topProducts.length === 0 ? <EmptyMini text={t('noProductsSold', 'No products sold yet')} /> : (
              <div className="space-y-4">
                {analytics.topProducts.map((product, index) => {
                  const max = analytics.topProducts[0]?.qty || 1;
                  const width = Math.max((product.qty / max) * 100, 8);
                  return (
                    <div key={product.name} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <div className="flex justify-between gap-3 text-sm font-black mb-2"><span className="truncate">{index + 1}. {product.name}</span><span className="text-cyan-300">{product.qty}</span></div>
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500"><span>{t('revenue', 'Revenue')}: {fmt(product.revenue)} Ks</span><span>{t('profit', 'Profit')}: {fmt(product.profit)} Ks</span></div>
                      <div className="h-2.5 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 rounded-full" style={{ width: `${width}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="p-5 border-rose-500/10">
            <h2 className="font-black mb-5 flex items-center gap-2"><AlertTriangle size={18} className="text-rose-300" /> {t('lowStockCenter', 'Low Stock Center')}</h2>
            {inventoryStats.lowStock.length === 0 ? <EmptyMini text={t('allProductsHealthy', 'All products are healthy')} /> : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {inventoryStats.lowStock.slice(0, 8).map((product) => <div key={product.id} className="flex items-center justify-between rounded-2xl bg-black/25 border border-white/5 p-3"><div className="min-w-0"><p className="font-bold text-sm truncate">{product.name}</p><p className="text-[10px] text-slate-500">{product.category}</p></div><span className={`px-3 py-1 rounded-full text-xs font-black ${product.stock <= 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>{product.stock}</span></div>)}
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <h2 className="font-black mb-5 flex items-center gap-2"><Zap size={18} className="text-cyan-300" /> {t('quickActions', 'Quick Actions')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/entry" className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-center text-cyan-300 font-black hover:bg-cyan-500/20 active:scale-95"><ShoppingCart className="mx-auto mb-2" />{t('newSale', 'New Sale')}</Link>
              <Link to="/entry" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-emerald-300 font-black hover:bg-emerald-500/20 active:scale-95"><Plus className="mx-auto mb-2" />{t('newPurchase', 'Purchase')}</Link>
              <Link to="/inventory" className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-center text-violet-300 font-black hover:bg-violet-500/20 active:scale-95"><Package className="mx-auto mb-2" />{t('addProduct', 'Product')}</Link>
              <Link to="/records" className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-center text-blue-300 font-black hover:bg-blue-500/20 active:scale-95"><FileText className="mx-auto mb-2" />{t('records', 'Records')}</Link>
            </div>
          </Panel>
        </div>

        <Panel className="p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-5"><h2 className="font-black flex items-center gap-2"><ShoppingCart size={18} className="text-blue-300" /> {t('recentTransactions', 'Recent Transactions')}</h2><span className="text-xs text-slate-500 font-bold">{recentTransactions.length}</span></div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? <EmptyMini text={t('noTransactions', 'No transactions recorded')} /> : recentTransactions.map((transaction) => {
              const type = getRecordType(transaction);
              const isExpense = type === 'expense';
              const tone = type === 'sale' ? 'cyan' : isExpense ? 'rose' : 'emerald';
              const c = colors[tone];
              return (
                <Link to="/records" key={transaction.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/25 p-3 hover:border-cyan-500/20">
                  <div className="min-w-0"><p className="font-black truncate">{transaction.voucherNo || transaction.invoiceNo || transaction.personName || transaction.item || '-'}</p><p className="mt-1 text-xs text-slate-500 font-bold">{getRecordDateISO(transaction)} • {transaction.paymentType || transaction.paymentMethod || '-'}</p></div>
                  <div className="text-right shrink-0"><span className={`rounded-xl px-2 py-1 text-[10px] font-black uppercase ${c.bg} ${c.text}`}>{t(type, type || '-')}</span><p className={`mt-2 font-black ${isExpense ? 'text-rose-300' : 'text-emerald-300'}`}>{isExpense ? '-' : '+'}{fmt(getRecordAmount(transaction))} Ks</p></div>
                </Link>
              );
            })}
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
