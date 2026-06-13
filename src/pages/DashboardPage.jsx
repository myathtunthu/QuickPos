import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  RefreshCw,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  return toNumber(product?.costPrice ?? firstUnit?.costPrice ?? 0);
}

const TEXT = {
  mm: {
    dashboard: 'ဒက်ရှ်ဘုတ်',
    heroBadge: 'လုပ်ငန်းထိန်းချုပ်ခန်း',
    heroTitleA: 'NexPOS အတွက်',
    heroTitleB: 'Smart Dashboard',
    heroText: 'ယနေ့အရောင်း၊ အမြတ်၊ ငွေလက်ကျန်၊ ကြွေးကျန်၊ စတော့အခြေအနေကို မြန်မြန်ကြည့်နိုင်အောင် ပြန်ဒီဇိုင်းလုပ်ထားသည်။',
    today: 'ယနေ့',
    week: '၇ ရက်',
    month: 'လ ၃၀',
    all: 'အားလုံး',
    search: 'Voucher / customer / product ရှာရန်...',
    newSale: 'အရောင်းအသစ်',
    purchase: 'အဝယ်ထည့်',
    addProduct: 'ပစ္စည်းထည့်',
    viewReports: 'Report ကြည့်',
    revenue: 'အရောင်းရငွေ',
    grossProfit: 'အမြတ်ကြမ်း',
    expense: 'အသုံးစရိတ်',
    netProfit: 'အသားတင်အမြတ်',
    cashBalance: 'ငွေလက်ကျန်',
    inventoryValue: 'ကုန်လက်ကျန်တန်ဖိုး',
    customerDebt: 'Customer ကြွေးကျန်',
    supplierPayable: 'Supplier ပေးရန်',
    orders: 'အော်ဒါ',
    products: 'ပစ္စည်း',
    customers: 'Customer',
    suppliers: 'Supplier',
    sales: 'အရောင်း',
    profit: 'အမြတ်',
    expenses: 'အသုံးစရိတ်',
    cashIn: 'ဝင်ငွေ',
    cashOut: 'ထွက်ငွေ',
    actionCenter: 'အမြန်လုပ်ဆောင်ရန်',
    importantNow: 'အခုအရေးကြီးတာ',
    salesTrend: '၇ ရက်အရောင်းလမ်းကြောင်း',
    financeMix: 'ငွေဝင်/ထွက် အကျဉ်း',
    topProducts: 'ရောင်းအားအကောင်းဆုံးပစ္စည်းများ',
    lowStock: 'လက်ကျန်နည်းသောပစ္စည်းများ',
    recentActivity: 'နောက်ဆုံးလုပ်ဆောင်မှုများ',
    alerts: 'သတိပေးချက်များ',
    noAlerts: 'အရေးကြီးသတိပေးချက် မရှိပါ။',
    noProducts: 'ရောင်းထားသောပစ္စည်း မရှိသေးပါ။',
    noTransactions: 'Transaction မရှိသေးပါ။',
    noLowStock: 'စတော့အခြေအနေကောင်းသည်။',
    stockOut: 'လက်ကျန်ကုန်',
    lowStockItems: 'လက်ကျန်နည်း',
    qty: 'အရေအတွက်',
    refresh: 'ပြန်ဖတ်မည်',
    loading: 'Dashboard data ဖတ်နေသည်...',
    unableToRead: 'Dashboard data မဖတ်နိုင်ပါ။',
  },
  en: {
    dashboard: 'Dashboard',
    heroBadge: 'Business Command Center',
    heroTitleA: 'NexPOS',
    heroTitleB: 'Smart Dashboard',
    heroText: 'A cleaner owner-focused dashboard for sales, profit, cash, debts, inventory, and urgent actions.',
    today: 'Today',
    week: '7 Days',
    month: '30 Days',
    all: 'All',
    search: 'Search voucher / customer / product...',
    newSale: 'New Sale',
    purchase: 'Purchase',
    addProduct: 'Add Product',
    viewReports: 'View Reports',
    revenue: 'Revenue',
    grossProfit: 'Gross Profit',
    expense: 'Expenses',
    netProfit: 'Net Profit',
    cashBalance: 'Cash Balance',
    inventoryValue: 'Inventory Value',
    customerDebt: 'Customer Debt',
    supplierPayable: 'Supplier Payable',
    orders: 'Orders',
    products: 'Products',
    customers: 'Customers',
    suppliers: 'Suppliers',
    sales: 'Sales',
    profit: 'Profit',
    expenses: 'Expenses',
    cashIn: 'Cash In',
    cashOut: 'Cash Out',
    actionCenter: 'Action Center',
    importantNow: 'Important Now',
    salesTrend: '7-Day Sales Trend',
    financeMix: 'Cash Flow Summary',
    topProducts: 'Top Selling Products',
    lowStock: 'Low Stock Items',
    recentActivity: 'Recent Activity',
    alerts: 'Alerts',
    noAlerts: 'No important alerts.',
    noProducts: 'No products sold yet.',
    noTransactions: 'No transactions yet.',
    noLowStock: 'Stock is healthy.',
    stockOut: 'Out of stock',
    lowStockItems: 'Low stock',
    qty: 'Qty',
    refresh: 'Refresh',
    loading: 'Loading dashboard data...',
    unableToRead: 'Unable to read dashboard data.',
  },
  zh: {
    dashboard: '仪表盘',
    heroBadge: '业务控制中心',
    heroTitleA: 'NexPOS',
    heroTitleB: '智能仪表盘',
    heroText: '集中查看销售、利润、现金、欠款、库存和重点提醒。',
    today: '今天',
    week: '7天',
    month: '30天',
    all: '全部',
    search: '搜索凭证 / 客户 / 商品...',
    newSale: '新销售',
    purchase: '采购',
    addProduct: '添加商品',
    viewReports: '查看报表',
    revenue: '收入',
    grossProfit: '毛利',
    expense: '费用',
    netProfit: '净利润',
    cashBalance: '现金余额',
    inventoryValue: '库存价值',
    customerDebt: '客户欠款',
    supplierPayable: '供应商应付',
    orders: '订单',
    products: '商品',
    customers: '客户',
    suppliers: '供应商',
    sales: '销售',
    profit: '利润',
    expenses: '费用',
    cashIn: '现金收入',
    cashOut: '现金支出',
    actionCenter: '快捷操作',
    importantNow: '当前重点',
    salesTrend: '7天销售趋势',
    financeMix: '现金流摘要',
    topProducts: '热销商品',
    lowStock: '低库存商品',
    recentActivity: '最近交易',
    alerts: '提醒',
    noAlerts: '暂无重要提醒。',
    noProducts: '暂无销售商品。',
    noTransactions: '暂无交易。',
    noLowStock: '库存健康。',
    stockOut: '缺货',
    lowStockItems: '低库存',
    qty: '数量',
    refresh: '刷新',
    loading: '正在加载仪表盘数据...',
    unableToRead: '无法读取仪表盘数据。',
  },
};

const tones = {
  cyan: {
    card: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200 shadow-cyan-950/40',
    icon: 'bg-cyan-300 text-slate-950',
    bar: 'from-cyan-400 to-blue-500',
  },
  emerald: {
    card: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200 shadow-emerald-950/40',
    icon: 'bg-emerald-300 text-slate-950',
    bar: 'from-emerald-400 to-teal-500',
  },
  amber: {
    card: 'border-amber-400/25 bg-amber-400/10 text-amber-200 shadow-amber-950/40',
    icon: 'bg-amber-300 text-slate-950',
    bar: 'from-amber-300 to-orange-500',
  },
  rose: {
    card: 'border-rose-400/25 bg-rose-400/10 text-rose-200 shadow-rose-950/40',
    icon: 'bg-rose-300 text-slate-950',
    bar: 'from-rose-400 to-pink-500',
  },
  violet: {
    card: 'border-violet-400/25 bg-violet-400/10 text-violet-200 shadow-violet-950/40',
    icon: 'bg-violet-300 text-slate-950',
    bar: 'from-violet-400 to-indigo-500',
  },
  blue: {
    card: 'border-blue-400/25 bg-blue-400/10 text-blue-200 shadow-blue-950/40',
    icon: 'bg-blue-300 text-slate-950',
    bar: 'from-blue-400 to-cyan-500',
  },
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
  const [dateRange, setDateRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');

  const text = TEXT[language] || TEXT.mm;
  const tx = (key) => t?.(`dashboard_${key}`, text[key] || TEXT.en[key] || key) || text[key] || TEXT.en[key] || key;
  const fmt = (num) => toNumber(num).toLocaleString();
  const money = (num) => `${fmt(num)} Ks`;

  const loadDashboard = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText('');
    try {
      const [recordRows, productRows, customerRows, supplierRows] = await Promise.all([
        safeReadCollection('pos_records', tenantId, 900),
        safeReadCollection('pos_products', tenantId, 700),
        safeReadCollection('pos_customers', tenantId, 700),
        safeReadCollection('pos_suppliers', tenantId, 700),
      ]);
      setRecords(recordRows.length ? recordRows : Array.isArray(recordsFromApp) ? recordsFromApp : []);
      setProducts(productRows);
      setCustomers(customerRows);
      setSuppliers(supplierRows);
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
    if (Array.isArray(recordsFromApp) && recordsFromApp.length > records.length) {
      setRecords(recordsFromApp);
    }
  }, [recordsFromApp]);

  if (profile && profile.role !== 'admin' && profile.role !== 'owner' && !hasPermission('view_reports')) {
    const permissions = profile.permissions || [];
    if (permissions.includes('create_sale')) return <Navigate to="/entry" replace />;
    if (permissions.includes('view_inventory')) return <Navigate to="/inventory" replace />;
    if (permissions.includes('accept_payment')) return <Navigate to="/customers" replace />;
    return <Navigate to="/entry" replace />;
  }

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
        return [record.personName, record.customerName, record.supplierName, record.voucherNo, record.invoiceNo, record.type, record.item]
          .some((value) => String(value || '').toLowerCase().includes(keyword));
      })
      .sort((a, b) => getTimeValue(b) - getTimeValue(a));
  }, [records, dateRange, searchTerm]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      map[product.id] = product;
      if (product.name) map[product.name] = product;
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
      cashBalance: 0,
      customerDebt: 0,
      supplierPayable: 0,
      salesCount: 0,
      purchaseCount: 0,
      expenseCount: 0,
      topProducts: {},
      recent: [],
    };

    filteredRecords.forEach((record) => {
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
    result.cashBalance = result.cashIn - result.cashOut;
    result.recent = filteredRecords.slice(0, 8);
    result.topProducts = Object.values(result.topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    return result;
  }, [filteredRecords, productMap]);

  const inventoryStats = useMemo(() => {
    let inventoryValue = 0;
    const lowStock = products
      .map((product) => {
        const stock = getProductStock(product);
        const minStock = toNumber(product.minStock ?? product.minStockAlert ?? 5);
        const cost = getProductCost(product);
        inventoryValue += stock * cost;
        return { id: product.id, name: getProductName(product), stock, minStock, category: product.category || 'General' };
      })
      .filter((product) => product.stock <= product.minStock)
      .sort((a, b) => a.stock - b.stock);
    return { inventoryValue, lowStock, lowStockCount: lowStock.length, outOfStock: lowStock.filter((item) => item.stock <= 0).length };
  }, [products]);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const iso = getPastISO(i);
      const day = new Date(iso).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'my-MM', { weekday: 'short' });
      const dayRecords = records.filter((record) => getRecordDateISO(record) === iso);
      let sales = 0;
      let profit = 0;
      let expenses = 0;

      dayRecords.forEach((record) => {
        const type = getRecordType(record);
        const amount = getRecordAmount(record);
        if (type === 'sale') {
          sales += amount;
          let cost = 0;
          getRecordItems(record).forEach((item) => {
            const product = productMap[item.productId] || productMap[item.name] || {};
            cost += toNumber(item.costPrice ?? item.cost ?? getProductCost(product)) * (toNumber(item.quantity ?? item.qty ?? 1) || 1);
          });
          profit += amount - cost;
        }
        if (type === 'expense') expenses += amount;
      });
      days.push({ day, sales, profit, expenses });
    }
    return days;
  }, [records, productMap, language]);

  const importantAlerts = useMemo(() => {
    const alerts = [];
    if (inventoryStats.outOfStock > 0) alerts.push({ tone: 'rose', title: tx('stockOut'), text: `${inventoryStats.outOfStock} ${tx('products')}`, icon: AlertTriangle });
    if (inventoryStats.lowStockCount > 0) alerts.push({ tone: 'amber', title: tx('lowStockItems'), text: `${inventoryStats.lowStockCount} ${tx('products')}`, icon: Package });
    if (analytics.customerDebt > 0) alerts.push({ tone: 'amber', title: tx('customerDebt'), text: money(analytics.customerDebt), icon: CreditCard });
    if (analytics.supplierPayable > 0) alerts.push({ tone: 'rose', title: tx('supplierPayable'), text: money(analytics.supplierPayable), icon: Wallet });
    if (alerts.length === 0) alerts.push({ tone: 'emerald', title: tx('noAlerts'), text: tx('noLowStock'), icon: ShieldCheck });
    return alerts.slice(0, 4);
  }, [analytics.customerDebt, analytics.supplierPayable, inventoryStats.lowStockCount, inventoryStats.outOfStock, language]);

  const rangeOptions = [
    { key: 'today', label: tx('today') },
    { key: 'week', label: tx('week') },
    { key: 'month', label: tx('month') },
    { key: 'all', label: tx('all') },
  ];

  const quickActions = [
    { label: tx('newSale'), to: '/entry', icon: ShoppingCart, tone: 'cyan' },
    { label: tx('purchase'), to: '/entry', icon: ReceiptText, tone: 'emerald' },
    { label: tx('addProduct'), to: '/inventory', icon: Package, tone: 'violet' },
    { label: tx('viewReports'), to: '/reports', icon: BarChart3, tone: 'amber' },
  ];

  const mainCards = [
    { label: tx('revenue'), value: money(analytics.revenue), icon: DollarSign, tone: 'cyan', note: `${analytics.salesCount} ${tx('orders')}` },
    { label: tx('netProfit'), value: money(analytics.netProfit), icon: analytics.netProfit >= 0 ? TrendingUp : TrendingDown, tone: analytics.netProfit >= 0 ? 'emerald' : 'rose', note: `${tx('grossProfit')}: ${money(analytics.grossProfit)}` },
    { label: tx('cashBalance'), value: money(analytics.cashBalance), icon: Wallet, tone: analytics.cashBalance >= 0 ? 'blue' : 'rose', note: `${tx('cashIn')} ${money(analytics.cashIn)}` },
    { label: tx('inventoryValue'), value: money(inventoryStats.inventoryValue), icon: Package, tone: 'violet', note: `${products.length} ${tx('products')}` },
  ];

  const CompactMetric = ({ label, value, tone = 'cyan' }) => (
    <div className={`rounded-[1.4rem] border p-4 shadow-xl ${tones[tone]?.card || tones.cyan.card}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 truncate text-xl font-black text-white">{value}</p>
    </div>
  );

  const Panel = ({ children, className = '' }) => (
    <section className={`rounded-[2rem] border border-white/10 bg-[#0c1222]/90 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl ${className}`}>{children}</section>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050713] px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-48 animate-pulse rounded-[2rem] bg-slate-800/60" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-[2rem] bg-slate-800/50" />)}
          </div>
          <p className="text-center text-sm font-black text-cyan-300">{tx('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050713] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_5%,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(168,85,247,0.18),transparent_28%),linear-gradient(180deg,#050713,#09111f_52%,#050713)]" />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 pb-28 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.3rem] border border-cyan-300/20 bg-[#070b16]/90 p-5 shadow-2xl shadow-cyan-950/20 ring-1 ring-white/10 sm:p-7">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-60 w-60 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Zap size={15} /> {tx('heroBadge')}
              </span>
              <div>
                <h1 className="text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">
                  {tx('heroTitleA')} <span className="block bg-gradient-to-r from-cyan-200 via-emerald-200 to-violet-200 bg-clip-text text-transparent">{tx('heroTitleB')}</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">{tx('heroText')}</p>
              </div>

              <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                <CompactMetric label={tx('orders')} value={analytics.salesCount} tone="cyan" />
                <CompactMetric label={tx('customers')} value={customers.length} tone="emerald" />
                <CompactMetric label={tx('products')} value={products.length} tone="violet" />
                <CompactMetric label={tx('suppliers')} value={suppliers.length} tone="blue" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} to={action.to} className={`group min-h-[132px] rounded-[1.7rem] border p-5 shadow-xl transition active:scale-[0.98] sm:hover:-translate-y-1 ${tones[action.tone]?.card || tones.cyan.card}`}>
                    <div className={`inline-flex rounded-2xl p-3 ${tones[action.tone]?.icon || tones.cyan.icon}`}>
                      <Icon size={25} />
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <p className="text-base font-black leading-snug text-white">{action.label}</p>
                      <ArrowRight className="shrink-0 opacity-70 transition group-hover:translate-x-1" size={20} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {errorText && (
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
            <span>{errorText}</span>
            <button type="button" onClick={loadDashboard} className="rounded-2xl bg-rose-400/20 px-4 py-2 font-black">{tx('refresh')}</button>
          </div>
        )}

        <section className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={21} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={tx('search')}
              className="h-14 w-full rounded-[1.4rem] border border-white/10 bg-[#0c1222]/90 pl-12 pr-4 text-base font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
            />
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-[1.4rem] border border-white/10 bg-[#0c1222]/90 p-1">
            {rangeOptions.map((option) => (
              <button key={option.key} type="button" onClick={() => setDateRange(option.key)} className={`rounded-[1.05rem] px-3 py-3 text-xs font-black transition ${dateRange === option.key ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={loadDashboard} className="hidden items-center gap-2 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200 lg:inline-flex">
            <RefreshCw size={16} /> {tx('refresh')}
          </button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {mainCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-2xl ${tones[card.tone]?.card || tones.cyan.card}`}>
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                    <p className="mt-3 break-words text-3xl font-black text-white">{card.value}</p>
                    <p className="mt-3 truncate text-xs font-bold text-slate-400">{card.note}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${tones[card.tone]?.icon || tones.cyan.icon}`}><Icon size={25} /></div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{tx('salesTrend')}</p>
                <h2 className="mt-1 text-2xl font-black">{tx('sales')} / {tx('profit')} / {tx('expenses')}</h2>
              </div>
              <CalendarDays className="text-cyan-300" size={30} />
            </div>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(34,211,238,.25)', borderRadius: 18, color: '#fff', fontWeight: 800 }} formatter={(value, name) => [money(value), name]} />
                  <Line type="monotone" dataKey="sales" name={tx('sales')} stroke="#22d3ee" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="profit" name={tx('profit')} stroke="#34d399" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="expenses" name={tx('expenses')} stroke="#fb7185" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><Sparkles className="text-amber-300" /> {tx('importantNow')}</h2>
            <div className="space-y-3">
              {importantAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div key={`${alert.title}-${alert.text}`} className={`flex items-center gap-3 rounded-[1.4rem] border p-4 ${tones[alert.tone]?.card || tones.emerald.card}`}>
                    <div className={`rounded-2xl p-3 ${tones[alert.tone]?.icon || tones.emerald.icon}`}><Icon size={22} /></div>
                    <div className="min-w-0">
                      <p className="font-black text-white">{alert.title}</p>
                      <p className="truncate text-sm font-bold text-slate-400">{alert.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel>
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><BarChart3 className="text-violet-300" /> {tx('financeMix')}</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: tx('cashIn'), value: analytics.cashIn, color: '#22d3ee' },
                  { name: tx('cashOut'), value: analytics.cashOut, color: '#fb7185' },
                  { name: tx('netProfit'), value: analytics.netProfit, color: '#34d399' },
                  { name: tx('customerDebt'), value: analytics.customerDebt, color: '#fbbf24' },
                ]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="4 8" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(167,139,250,.25)', borderRadius: 18, color: '#fff', fontWeight: 800 }} formatter={(value) => money(value)} />
                  <Bar dataKey="value" radius={[16, 16, 6, 6]}>
                    {['#22d3ee', '#fb7185', '#34d399', '#fbbf24'].map((color) => <Cell key={color} fill={color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-5 text-2xl font-black">🏆 {tx('topProducts')}</h2>
            {analytics.topProducts.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-slate-500">{tx('noProducts')}</div>
            ) : (
              <div className="space-y-4">
                {analytics.topProducts.map((product, index) => {
                  const max = analytics.topProducts[0]?.revenue || 1;
                  const width = Math.max((product.revenue / max) * 100, 8);
                  return (
                    <div key={product.name}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                        <span className="truncate">{index + 1}. {product.name}</span>
                        <span className="text-cyan-300">{money(product.revenue)}</span>
                      </div>
                      <div className="mb-1 flex justify-between text-xs font-bold text-slate-500"><span>{tx('qty')}: {product.qty}</span><span>{tx('profit')}: {money(product.profit)}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${width}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Panel>
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><Package className="text-amber-300" /> {tx('lowStock')}</h2>
            {inventoryStats.lowStock.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-slate-500">{tx('noLowStock')}</div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {inventoryStats.lowStock.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-black/25 p-4">
                    <div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="text-xs font-bold text-slate-500">{product.category}</p></div>
                    <span className={`rounded-2xl px-3 py-1 text-sm font-black ${product.stock <= 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>{product.stock}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><FileText className="text-blue-300" /> {tx('recentActivity')}</h2>
            {analytics.recent.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-slate-500">{tx('noTransactions')}</div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {analytics.recent.map((record) => {
                  const type = getRecordType(record);
                  const tone = type === 'sale' ? 'cyan' : type === 'purchase' ? 'emerald' : 'rose';
                  return (
                    <Link key={record.id} to="/records" className={`block rounded-[1.4rem] border p-4 transition active:scale-[0.99] hover:border-cyan-300/35 ${tones[tone]?.card || tones.cyan.card}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0"><p className="truncate font-black capitalize text-white">{type || 'record'} • {record.voucherNo || record.invoiceNo || '-'}</p><p className="truncate text-xs font-bold text-slate-500">{record.personName || record.customerName || record.supplierName || '-'}</p></div>
                        <p className="text-right font-black text-white">{money(getRecordAmount(record))}</p>
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
