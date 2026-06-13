import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  FileText,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
  const ts = record?.createdAt;
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

function isRecordInRange(record, range) {
  const iso = getRecordDateISO(record);
  if (range === '30d') return iso >= getPastISO(29);
  if (range === '7d') return iso >= getPastISO(6);
  return iso === getPastISO(0);
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
  if (record?.item && record.item !== 'Multiple') {
    return [{ name: record.item, quantity: 1, price: getRecordAmount(record), costPrice: 0 }];
  }
  return [];
}

function getProductName(product) {
  return product?.name || product?.productName || product?.itemName || 'Unnamed Product';
}

function getProductStock(product) {
  return toNumber(product?.stockBase ?? product?.stock ?? product?.qty ?? 0);
}

function getProductCost(product) {
  const firstUnit = Array.isArray(product?.packageUnits) ? product.packageUnits[0] : null;
  return toNumber(product?.costPrice ?? product?.purchasePrice ?? product?.buyPrice ?? firstUnit?.costPrice ?? 0);
}

const TEXT = {
  mm: {
    dashboard: 'ဒက်ရှ်ဘုတ်',
    today: 'ယနေ့',
    last7: '၇ ရက်',
    last30: '၃၀ ရက်',
    todaySales: 'ယနေ့ အရောင်း',
    todayProfit: 'ယနေ့ အမြတ်',
    customerDebt: 'Customer ကြွေး',
    supplierPayable: 'Supplier ပေးရန်',
    orders: 'အော်ဒါ',
    products: 'ပစ္စည်း',
    customers: 'Customer',
    lowStockCount: 'လက်ကျန်နည်း',
    sales7d: '၇ ရက် Graph',
    salesProfitChart: 'အရောင်း / အမြတ် Graph',
    transactionMix: 'Transaction Pie',
    noPie: 'Pie chart အတွက် data မရှိသေးပါ။',
    finance: 'ငွေကြေးအကျဉ်း',
    topProducts: 'ရောင်းအားကောင်း',
    lowStock: 'လက်ကျန်နည်းသောပစ္စည်းများ',
    recent: 'နောက်ဆုံး Transaction',
    cashIn: 'ဝင်ငွေ',
    cashOut: 'ထွက်ငွေ',
    netProfit: 'အမြတ်',
    qty: 'အရေအတွက်',
    left: 'ကျန်',
    sale: 'အရောင်း',
    purchase: 'အဝယ်',
    expense: 'အသုံးစရိတ်',
    noProducts: 'ရောင်းအားဒေတာ မရှိသေးပါ။',
    noLowStock: 'လက်ကျန် အခြေအနေကောင်းသည်။',
    noTransactions: 'Transaction မရှိသေးပါ။',
    noChart: 'အရောင်းဒေတာ မရှိသေးပါ။',
    refresh: 'Refresh',
    loading: 'Dashboard data ဖတ်နေသည်...',
    unableToRead: 'Dashboard data မဖတ်နိုင်ပါ။',
    viewAll: 'အားလုံးကြည့်',
  },
  en: {
    dashboard: 'Dashboard',
    today: 'Today',
    last7: '7 Days',
    last30: '30 Days',
    todaySales: 'Today Sales',
    todayProfit: 'Today Profit',
    customerDebt: 'Customer Debt',
    supplierPayable: 'Supplier Payable',
    orders: 'Orders',
    products: 'Products',
    customers: 'Customers',
    lowStockCount: 'Low Stock',
    sales7d: '7-Day Graph',
    salesProfitChart: 'Sales / Profit Graph',
    transactionMix: 'Transaction Pie',
    noPie: 'No data for pie chart yet.',
    finance: 'Finance',
    topProducts: 'Top Products',
    lowStock: 'Low Stock Items',
    recent: 'Recent Transactions',
    cashIn: 'Cash In',
    cashOut: 'Cash Out',
    netProfit: 'Profit',
    qty: 'Qty',
    left: 'left',
    sale: 'Sale',
    purchase: 'Purchase',
    expense: 'Expense',
    noProducts: 'No product sales yet.',
    noLowStock: 'Stock is healthy.',
    noTransactions: 'No transactions yet.',
    noChart: 'No sales data yet.',
    refresh: 'Refresh',
    loading: 'Loading dashboard data...',
    unableToRead: 'Unable to read dashboard data.',
    viewAll: 'View all',
  },
  zh: {
    dashboard: '仪表盘',
    today: '今天',
    last7: '7天',
    last30: '30天',
    todaySales: '今日销售',
    todayProfit: '今日利润',
    customerDebt: '客户欠款',
    supplierPayable: '供应商应付',
    orders: '订单',
    products: '商品',
    customers: '客户',
    lowStockCount: '低库存',
    sales7d: '7天图表',
    salesProfitChart: '销售 / 利润图表',
    transactionMix: '交易占比',
    noPie: '暂无饼图数据。',
    finance: '财务摘要',
    topProducts: '热销商品',
    lowStock: '低库存商品',
    recent: '最近交易',
    cashIn: '收入',
    cashOut: '支出',
    netProfit: '利润',
    qty: '数量',
    left: '剩余',
    sale: '销售',
    purchase: '采购',
    expense: '费用',
    noProducts: '暂无商品销售。',
    noLowStock: '库存正常。',
    noTransactions: '暂无交易。',
    noChart: '暂无销售数据。',
    refresh: '刷新',
    loading: '正在加载仪表盘数据...',
    unableToRead: '无法读取仪表盘数据。',
    viewAll: '查看全部',
  },
};



const DASHBOARD_CACHE_TTL_MS = 60 * 1000;

function getDashboardCacheKey(tenantId) {
  return tenantId ? `quickpos_dashboard_${tenantId}` : '';
}

function readDashboardCache(tenantId) {
  if (typeof window === 'undefined') return null;
  const key = getDashboardCacheKey(tenantId);
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.savedAt || Date.now() - cached.savedAt > DASHBOARD_CACHE_TTL_MS) return null;
    return cached;
  } catch (error) {
    return null;
  }
}

function writeDashboardCache(tenantId, payload) {
  if (typeof window === 'undefined') return;
  const key = getDashboardCacheKey(tenantId);
  if (!key) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), ...payload }));
  } catch (error) {
    // Cache failures must never block POS usage.
  }
}

const toneClasses = {
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
  slate: 'border-white/10 bg-white/[0.04] text-slate-200',
};

async function safeReadCollection(collectionName, tenantId, maxRows) {
  if (!tenantId) return [];
  try {
    const snap = await getDocs(query(collection(db, collectionName), where('tenantId', '==', tenantId), limit(maxRows)));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Dashboard ${collectionName} read error:`, error);
    return [];
  }
}

function Panel({ children, className = '' }) {
  return <section className={`rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-black/20 sm:p-5 ${className}`}>{children}</section>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-3 pb-28 sm:p-6">
      <div className="h-8 w-36 animate-pulse rounded-2xl bg-white/10" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-3xl bg-white/10" />)}
      </div>
      <div className="h-48 animate-pulse rounded-3xl bg-white/10" />
      <div className="h-56 animate-pulse rounded-3xl bg-white/10" />
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-slate-500">{children}</div>;
}

export default function DashboardPage({ records: recordsFromApp = [] }) {
  const { profile, hasPermission } = useAuth();
  const { t, language } = useLanguage();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState(Array.isArray(recordsFromApp) ? recordsFromApp : []);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [range, setRange] = useState('today');

  const text = TEXT[language] || TEXT.mm;
  const tx = (key) => t?.(`dashboard_${key}`, text[key] || TEXT.en[key] || key) || text[key] || TEXT.en[key] || key;
  const fmt = (num) => toNumber(num).toLocaleString();
  const money = (num) => `${fmt(num)} Ks`;

  const loadDashboard = async ({ force = false } = {}) => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const cached = !force ? readDashboardCache(tenantId) : null;
    if (cached) {
      setRecords(cached.records || []);
      setProducts(cached.products || []);
      setCustomers(cached.customers || []);
      setSuppliers(cached.suppliers || []);
      setLoading(false);
      setErrorText('');
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const [recordRows, productRows, customerRows, supplierRows] = await Promise.all([
        safeReadCollection('pos_records', tenantId, 1200),
        safeReadCollection('pos_products', tenantId, 900),
        safeReadCollection('pos_customers', tenantId, 900),
        safeReadCollection('pos_suppliers', tenantId, 900),
      ]);
      const nextRecords = recordRows.length ? recordRows : Array.isArray(recordsFromApp) ? recordsFromApp : [];
      setRecords(nextRecords);
      setProducts(productRows);
      setCustomers(customerRows);
      setSuppliers(supplierRows);
      writeDashboardCache(tenantId, { records: nextRecords, products: productRows, customers: customerRows, suppliers: supplierRows });
    } catch (error) {
      console.error('Dashboard load error:', error);
      setErrorText(tx('unableToRead'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (Array.isArray(recordsFromApp) && recordsFromApp.length > records.length) setRecords(recordsFromApp);
  }, [recordsFromApp, records.length]);

  if (profile && profile.role !== 'admin' && profile.role !== 'owner' && !hasPermission('view_reports')) {
    const permissions = profile.permissions || [];
    if (permissions.includes('create_sale')) return <Navigate to="/entry" replace />;
    if (permissions.includes('view_inventory')) return <Navigate to="/inventory" replace />;
    if (permissions.includes('accept_payment')) return <Navigate to="/customers" replace />;
    return <Navigate to="/entry" replace />;
  }

  const selectedRecords = useMemo(() => {
    return records.filter((record) => isRecordInRange(record, range)).sort((a, b) => getTimeValue(b) - getTimeValue(a));
  }, [records, range]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      map[product.id] = product;
      if (product.name) map[product.name] = product;
      if (product.productName) map[product.productName] = product;
    });
    return map;
  }, [products]);

  const analytics = useMemo(() => {
    const result = {
      revenue: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
      cashIn: 0,
      cashOut: 0,
      customerDebt: 0,
      supplierPayable: 0,
      purchaseAmount: 0,
      salesCount: 0,
      purchaseCount: 0,
      expenseCount: 0,
      topProducts: {},
      recent: selectedRecords.slice(0, 5),
    };

    selectedRecords.forEach((record) => {
      const type = getRecordType(record);
      const amount = getRecordAmount(record);
      const paid = getRecordPaid(record);
      const debt = getRecordDebt(record);

      if (type === 'sale') {
        result.revenue += amount;
        result.cashIn += paid || Math.max(amount - debt, 0);
        result.customerDebt += debt;
        result.salesCount += 1;

        let recordCost = 0;
        getRecordItems(record).forEach((item) => {
          const product = productMap[item.productId] || productMap[item.name] || {};
          const name = item.name || getProductName(product);
          const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
          const price = toNumber(item.unitPrice ?? item.price ?? 0);
          const cost = toNumber(item.costPrice ?? item.cost ?? getProductCost(product));
          const discount = toNumber(item.itemDiscountAmt ?? item.discount ?? 0);
          const itemRevenue = price * qty - discount;
          const itemProfit = itemRevenue - cost * qty;
          recordCost += cost * qty;
          if (!result.topProducts[name]) result.topProducts[name] = { name, qty: 0, revenue: 0, profit: 0 };
          result.topProducts[name].qty += qty;
          result.topProducts[name].revenue += itemRevenue;
          result.topProducts[name].profit += itemProfit;
        });
        result.grossProfit += amount - recordCost;
      } else if (type === 'purchase') {
        result.purchaseAmount += amount;
        result.cashOut += paid || amount;
        result.supplierPayable += debt;
        result.purchaseCount += 1;
      } else if (type === 'expense') {
        result.expenses += amount;
        result.cashOut += paid || amount;
        result.expenseCount += 1;
      }
    });

    result.netProfit = result.grossProfit - result.expenses;
    result.topProducts = Object.values(result.topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 4);
    return result;
  }, [selectedRecords, productMap]);

  const inventoryStats = useMemo(() => {
    const lowStock = products
      .map((product) => {
        const stock = getProductStock(product);
        const minStock = toNumber(product.minStock ?? product.minStockAlert ?? 5);
        return { id: product.id, name: getProductName(product), stock, minStock, category: product.category || '' };
      })
      .filter((product) => product.stock <= product.minStock)
      .sort((a, b) => a.stock - b.stock);
    return { lowStock, lowStockCount: lowStock.length };
  }, [products]);

  const chartData = useMemo(() => {
    const days = [];
    const daysToShow = range === '30d' ? 29 : 6;
    for (let i = daysToShow; i >= 0; i -= 1) {
      const iso = getPastISO(i);
      const label = new Date(iso).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'my-MM', { weekday: 'short' });
      let sales = 0;
      let profit = 0;
      let expenses = 0;

      records.forEach((record) => {
        if (getRecordDateISO(record) !== iso) return;
        const type = getRecordType(record);
        const amount = getRecordAmount(record);
        if (type === 'sale') {
          sales += amount;
          let cost = 0;
          getRecordItems(record).forEach((item) => {
            const product = productMap[item.productId] || productMap[item.name] || {};
            const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
            cost += toNumber(item.costPrice ?? item.cost ?? getProductCost(product)) * qty;
          });
          profit += amount - cost;
        }
        if (type === 'expense') expenses += amount;
      });

      days.push({ iso, label, sales, profit, expenses });
    }
    return days;
  }, [records, productMap, language, range]);

  const maxSales = Math.max(...chartData.map((day) => day.sales), 1);

  const pieData = useMemo(() => [
    { name: tx('sale'), value: analytics.revenue, color: '#22d3ee' },
    { name: tx('purchase'), value: analytics.purchaseAmount, color: '#34d399' },
    { name: tx('expense'), value: analytics.expenses, color: '#fb7185' },
  ].filter((row) => row.value > 0), [analytics.revenue, analytics.purchaseAmount, analytics.expenses, language]);

  const kpiCards = [
    { label: tx('todaySales'), value: money(analytics.revenue), tone: 'cyan', icon: Wallet, to: '/records' },
    { label: tx('todayProfit'), value: money(analytics.netProfit), tone: analytics.netProfit >= 0 ? 'emerald' : 'rose', icon: TrendingUp, to: '/reports' },
    { label: tx('customerDebt'), value: money(analytics.customerDebt), tone: 'amber', icon: Users, to: '/customers' },
    { label: tx('supplierPayable'), value: money(analytics.supplierPayable), tone: 'rose', icon: CreditCard, to: '/suppliers' },
  ];

  const miniCards = [
    { label: tx('orders'), value: analytics.salesCount + analytics.purchaseCount + analytics.expenseCount, tone: 'violet', icon: ShoppingCart, to: '/records' },
    { label: tx('products'), value: products.length, tone: 'cyan', icon: Package, to: '/products' },
    { label: tx('customers'), value: customers.length, tone: 'emerald', icon: Users, to: '/customers' },
    { label: tx('lowStockCount'), value: inventoryStats.lowStockCount, tone: inventoryStats.lowStockCount > 0 ? 'amber' : 'emerald', icon: AlertTriangle, to: '/inventory' },
  ];

  const financeRows = [
    { label: tx('cashIn'), value: analytics.cashIn, tone: 'cyan' },
    { label: tx('cashOut'), value: analytics.cashOut, tone: 'rose' },
    { label: tx('netProfit'), value: analytics.netProfit, tone: analytics.netProfit >= 0 ? 'emerald' : 'rose' },
  ];

  const typeLabel = (type) => tx(type) || type || '-';

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <main className="mx-auto w-full max-w-7xl space-y-4 p-3 pb-32 sm:space-y-5 sm:p-6 lg:pb-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">{tx('dashboard')}</h1>
          <button
            type="button"
            onClick={() => loadDashboard({ force: true })}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 active:scale-95"
          >
            <RefreshCw size={16} /> {tx('refresh')}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-1.5">
          {[
            { key: 'today', label: tx('today') },
            { key: '7d', label: tx('last7') },
            { key: '30d', label: tx('last30') },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`rounded-2xl px-3 py-2 text-xs font-black transition active:scale-[0.98] ${range === item.key ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {errorText && (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">{errorText}</div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} to={card.to} className={`min-w-0 rounded-3xl border p-3 shadow-lg transition active:scale-[0.99] sm:p-4 ${toneClasses[card.tone] || toneClasses.slate}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 sm:text-xs">{card.label}</p>
                  <Icon className="shrink-0 text-current" size={18} />
                </div>
                <p className="break-words text-[19px] font-black leading-tight text-white sm:text-2xl">{card.value}</p>
              </Link>
            );
          })}
        </section>

        <section className="grid grid-cols-4 gap-2 sm:gap-3">
          {miniCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} to={card.to} className={`rounded-2xl border p-2 text-center transition active:scale-[0.99] sm:p-3 ${toneClasses[card.tone] || toneClasses.slate}`}>
                <Icon className="mx-auto mb-1 text-current" size={16} />
                <p className="text-lg font-black leading-none text-white sm:text-2xl">{fmt(card.value)}</p>
                <p className="mt-1 truncate text-[10px] font-black text-slate-400 sm:text-xs">{card.label}</p>
              </Link>
            );
          })}
        </section>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-black sm:text-xl">{tx('salesProfitChart')}</h2>
            <span className="text-xs font-black text-cyan-300">{money(chartData.reduce((sum, day) => sum + day.sales, 0))}</span>
          </div>
          {chartData.every((day) => day.sales === 0 && day.profit === 0 && day.expenses === 0) ? (
            <EmptyState>{tx('noChart')}</EmptyState>
          ) : (
            <>
              <div className="h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                    <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,.25)', borderRadius: 16, color: '#fff', fontWeight: 800 }} formatter={(value) => money(value)} />
                    <Line type="monotone" dataKey="sales" name={tx('sale')} stroke="#22d3ee" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="profit" name={tx('netProfit')} stroke="#34d399" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="expenses" name={tx('expense')} stroke="#fb7185" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2 sm:hidden">
                {chartData.map((day) => {
                  const width = Math.max((day.sales / maxSales) * 100, day.sales > 0 ? 7 : 0);
                  return (
                    <div key={day.iso} className="grid grid-cols-[42px_1fr_82px] items-center gap-2 text-xs">
                      <span className="font-black text-slate-400">{day.label}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-black/35">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${width}%` }} />
                      </div>
                      <span className="truncate text-right font-black text-white">{money(day.sales)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel>
            <h2 className="mb-4 text-base font-black sm:text-xl">{tx('transactionMix')}</h2>
            {pieData.length === 0 ? (
              <EmptyState>{tx('noPie')}</EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
                <div className="h-44 sm:h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={4}>
                        {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,.25)', borderRadius: 16, color: '#fff', fontWeight: 800 }} formatter={(value) => money(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
                  {financeRows.map((row) => (
                    <div key={row.label} className={`rounded-2xl border p-3 ${toneClasses[row.tone] || toneClasses.slate}`}>
                      <p className="truncate text-[10px] font-black text-slate-400 sm:text-xs">{row.label}</p>
                      <p className="mt-2 break-words text-sm font-black text-white sm:text-lg">{money(row.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-4 text-base font-black sm:text-xl">{tx('topProducts')}</h2>
            {analytics.topProducts.length === 0 ? (
              <EmptyState>{tx('noProducts')}</EmptyState>
            ) : (
              <div className="space-y-3">
                {analytics.topProducts.map((product, index) => {
                  const max = analytics.topProducts[0]?.revenue || 1;
                  const width = Math.max((product.revenue / max) * 100, 8);
                  return (
                    <div key={product.name} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{index + 1}. {product.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{tx('qty')}: {fmt(product.qty)}</p>
                        </div>
                        <p className="shrink-0 text-right text-sm font-black text-cyan-300">{money(product.revenue)}</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/45">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-black sm:text-xl">{tx('lowStock')}</h2>
              <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs font-black text-amber-300">{inventoryStats.lowStockCount}</span>
            </div>
            {inventoryStats.lowStock.length === 0 ? (
              <EmptyState>{tx('noLowStock')}</EmptyState>
            ) : (
              <div className="space-y-2">
                {inventoryStats.lowStock.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{product.name}</p>
                      <p className="truncate text-xs font-bold text-slate-500">{product.category || tx('products')}</p>
                    </div>
                    <span className={`shrink-0 rounded-xl px-2 py-1 text-xs font-black ${product.stock <= 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {fmt(product.stock)} {tx('left')}
                    </span>
                  </div>
                ))}
                {inventoryStats.lowStock.length > 5 && (
                  <Link to="/inventory" className="inline-flex items-center gap-1 text-xs font-black text-cyan-300">{tx('viewAll')} <ArrowRight size={14} /></Link>
                )}
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-4 text-base font-black sm:text-xl">{tx('recent')}</h2>
            {analytics.recent.length === 0 ? (
              <EmptyState>{tx('noTransactions')}</EmptyState>
            ) : (
              <div className="space-y-2">
                {analytics.recent.map((record) => {
                  const type = getRecordType(record);
                  const tone = type === 'sale' ? 'cyan' : type === 'purchase' ? 'emerald' : 'rose';
                  const date = getRecordDateISO(record).slice(5);
                  return (
                    <Link key={record.id} to="/records" className={`block rounded-2xl border p-3 active:scale-[0.99] ${toneClasses[tone] || toneClasses.slate}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{typeLabel(type)}</p>
                          <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{record.personName || record.customerName || record.supplierName || record.voucherNo || record.invoiceNo || '-'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="max-w-[120px] truncate text-sm font-black text-white sm:max-w-none">{money(getRecordAmount(record))}</p>
                          <p className="text-xs font-bold text-slate-500">{date}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
}
