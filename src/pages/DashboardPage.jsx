import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  Plus,
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  return toNumber(product?.costPrice ?? product?.packageUnits?.[0]?.costPrice ?? 0);
}

const LOCAL_TEXT = {
  mm: {
    dashboard: 'ဒက်ရှ်ဘုတ်',
    commandCenter: 'လုပ်ငန်းထိန်းချုပ်ခန်း',
    subtitle: 'ယနေ့အရောင်း၊ အမြတ်၊ ကုန်လက်ကျန်၊ ကြွေးကျန်များကို တစ်နေရာတည်းမှာ စစ်ပါ။',
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
    salesAndProfit: 'အရောင်းနှင့် အမြတ် လမ်းကြောင်း',
    revenueExpense: 'အရောင်း / အမြတ် / အသုံးစရိတ်',
    topProducts: 'ရောင်းအားအကောင်းဆုံးပစ္စည်းများ',
    lowStock: 'လက်ကျန်နည်းနေသောပစ္စည်းများ',
    recentActivity: 'နောက်ဆုံးလုပ်ဆောင်မှုများ',
    ownerSummary: 'Owner Summary',
    alerts: 'သတိပေးချက်များ',
    noAlerts: 'အရေးကြီးသတိပေးချက် မရှိပါ။',
    noProducts: 'ရောင်းထားသောပစ္စည်း မရှိသေးပါ။',
    noTransactions: 'Transaction မရှိသေးပါ။',
    stockOut: 'လက်ကျန်ကုန်',
    lowStockItems: 'လက်ကျန်နည်း',
    orders: 'အော်ဒါ',
    products: 'ပစ္စည်း',
    customers: 'Customer',
    suppliers: 'Supplier',
    sales: 'အရောင်း',
    profit: 'အမြတ်',
    expenses: 'အသုံးစရိတ်',
    cashIn: 'ဝင်ငွေ',
    cashOut: 'ထွက်ငွေ',
    margin: 'အမြတ်နှုန်း',
    qty: 'အရေအတွက်',
    amount: 'ပမာဏ',
    actionCenter: 'အမြန်လုပ်ဆောင်ရန်',
    importantNow: 'အခုအရေးကြီးတာ',
    healthyStock: 'ကုန်လက်ကျန်ကောင်းသည်',
  },
  en: {
    dashboard: 'Dashboard',
    commandCenter: 'Business Command Center',
    subtitle: 'Monitor sales, profit, inventory, debts, and alerts from one owner-focused screen.',
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
    salesAndProfit: 'Sales & Profit Trend',
    revenueExpense: 'Revenue / Profit / Expenses',
    topProducts: 'Top Selling Products',
    lowStock: 'Low Stock Items',
    recentActivity: 'Recent Activity',
    ownerSummary: 'Owner Summary',
    alerts: 'Alerts',
    noAlerts: 'No important alerts.',
    noProducts: 'No products sold yet.',
    noTransactions: 'No transactions yet.',
    stockOut: 'Out of stock',
    lowStockItems: 'Low stock',
    orders: 'Orders',
    products: 'Products',
    customers: 'Customers',
    suppliers: 'Suppliers',
    sales: 'Sales',
    profit: 'Profit',
    expenses: 'Expenses',
    cashIn: 'Cash In',
    cashOut: 'Cash Out',
    margin: 'Margin',
    qty: 'Qty',
    amount: 'Amount',
    actionCenter: 'Action Center',
    importantNow: 'Important Now',
    healthyStock: 'Stock is healthy',
  },
  zh: {
    dashboard: '仪表盘',
    commandCenter: '业务控制中心',
    subtitle: '在一个页面查看销售、利润、库存、欠款和提醒。',
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
    salesAndProfit: '销售与利润趋势',
    revenueExpense: '收入 / 利润 / 费用',
    topProducts: '热销商品',
    lowStock: '低库存商品',
    recentActivity: '最近交易',
    ownerSummary: '老板摘要',
    alerts: '提醒',
    noAlerts: '暂无重要提醒。',
    noProducts: '暂无销售商品。',
    noTransactions: '暂无交易。',
    stockOut: '缺货',
    lowStockItems: '低库存',
    orders: '订单',
    products: '商品',
    customers: '客户',
    suppliers: '供应商',
    sales: '销售',
    profit: '利润',
    expenses: '费用',
    cashIn: '现金收入',
    cashOut: '现金支出',
    margin: '利润率',
    qty: '数量',
    amount: '金额',
    actionCenter: '快捷操作',
    importantNow: '当前重点',
    healthyStock: '库存健康',
  },
};

const palette = {
  cyan: 'from-cyan-500/20 to-sky-500/5 text-cyan-300 border-cyan-400/20',
  emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-300 border-emerald-400/20',
  rose: 'from-rose-500/20 to-pink-500/5 text-rose-300 border-rose-400/20',
  amber: 'from-amber-500/20 to-orange-500/5 text-amber-300 border-amber-400/20',
  violet: 'from-violet-500/20 to-indigo-500/5 text-violet-300 border-violet-400/20',
  blue: 'from-blue-500/20 to-cyan-500/5 text-blue-300 border-blue-400/20',
};

export default function DashboardPage() {
  const { profile, hasPermission } = useAuth();
  const { t, language } = useLanguage();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');

  const tx = (key) => t(`dashboard_${key}`, LOCAL_TEXT?.[language]?.[key] || LOCAL_TEXT.en[key] || key);
  const fmt = (num) => toNumber(num).toLocaleString();
  const money = (num) => `${fmt(num)} Ks`;

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubRecords = onSnapshot(
      query(collection(db, 'pos_records'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(800)),
      (snap) => {
        setRecords(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Dashboard records error:', error);
        setLoading(false);
      }
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'pos_products'), where('tenantId', '==', tenantId), limit(500)),
      (snap) => setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error('Dashboard products error:', error)
    );

    const unsubCustomers = onSnapshot(
      query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId), limit(500)),
      (snap) => setCustomers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error('Dashboard customers error:', error)
    );

    const unsubSuppliers = onSnapshot(
      query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId), limit(500)),
      (snap) => setSuppliers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error('Dashboard suppliers error:', error)
    );

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

  const filteredRecords = useMemo(() => {
    const today = getPastISO(0);
    const weekStart = getPastISO(6);
    const monthStart = getPastISO(29);

    return records
      .filter((record) => {
        const iso = getRecordDateISO(record);
        if (dateRange === 'today') return iso === today;
        if (dateRange === 'week') return iso >= weekStart && iso <= today;
        if (dateRange === 'month') return iso >= monthStart && iso <= today;
        return true;
      })
      .filter((record) => {
        if (!searchTerm.trim()) return true;
        const keyword = searchTerm.trim().toLowerCase();
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
    result.topProducts = Object.values(result.topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
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
      const day = new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
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
      days.push({ day, sales, profit, expenses, net: profit - expenses });
    }
    return days;
  }, [records, productMap]);

  const importantAlerts = useMemo(() => {
    const alerts = [];
    if (inventoryStats.outOfStock > 0) alerts.push({ tone: 'rose', title: tx('stockOut'), text: `${inventoryStats.outOfStock} ${tx('products')}`, icon: AlertTriangle });
    if (inventoryStats.lowStockCount > 0) alerts.push({ tone: 'amber', title: tx('lowStockItems'), text: `${inventoryStats.lowStockCount} ${tx('products')}`, icon: Package });
    if (analytics.customerDebt > 0) alerts.push({ tone: 'amber', title: tx('customerDebt'), text: money(analytics.customerDebt), icon: CreditCard });
    if (analytics.supplierPayable > 0) alerts.push({ tone: 'rose', title: tx('supplierPayable'), text: money(analytics.supplierPayable), icon: Wallet });
    if (alerts.length === 0) alerts.push({ tone: 'emerald', title: tx('healthyStock'), text: tx('noAlerts'), icon: ShieldCheck });
    return alerts.slice(0, 4);
  }, [analytics.customerDebt, analytics.supplierPayable, inventoryStats.lowStockCount, inventoryStats.outOfStock, language]);

  const mainKpis = [
    { label: tx('revenue'), value: money(analytics.revenue), icon: DollarSign, tone: 'cyan', note: `${analytics.salesCount} ${tx('orders')}` },
    { label: tx('netProfit'), value: money(analytics.netProfit), icon: TrendingUp, tone: analytics.netProfit >= 0 ? 'emerald' : 'rose', note: `${tx('grossProfit')}: ${money(analytics.grossProfit)}` },
    { label: tx('cashBalance'), value: money(analytics.cashBalance), icon: Wallet, tone: analytics.cashBalance >= 0 ? 'blue' : 'rose', note: `${tx('cashIn')} ${money(analytics.cashIn)} / ${tx('cashOut')} ${money(analytics.cashOut)}` },
    { label: tx('inventoryValue'), value: money(inventoryStats.inventoryValue), icon: Package, tone: 'violet', note: `${products.length} ${tx('products')}` },
  ];

  const miniStats = [
    { label: tx('customerDebt'), value: money(analytics.customerDebt), tone: 'amber' },
    { label: tx('supplierPayable'), value: money(analytics.supplierPayable), tone: 'rose' },
    { label: tx('expenses'), value: money(analytics.expenses), tone: 'rose' },
    { label: tx('lowStock'), value: inventoryStats.lowStockCount, tone: inventoryStats.lowStockCount > 0 ? 'amber' : 'emerald' },
    { label: tx('customers'), value: customers.length, tone: 'emerald' },
    { label: tx('suppliers'), value: suppliers.length, tone: 'blue' },
  ];

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

  const Card = ({ children, className = '' }) => (
    <motion.section variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} className={`rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl ${className}`}>
      {children}
    </motion.section>
  );

  const KpiCard = ({ item }) => {
    const Icon = item.icon;
    return (
      <Card className={`relative overflow-hidden p-5 bg-gradient-to-br ${palette[item.tone] || palette.cyan}`}>
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
            <h3 className="mt-3 break-words text-3xl font-black text-white sm:text-4xl">{item.value}</h3>
            <p className="mt-3 truncate text-xs font-bold text-slate-400">{item.note}</p>
          </div>
          <div className="rounded-2xl bg-black/25 p-3"><Icon size={24} /></div>
        </div>
      </Card>
    );
  };

  const EmptyState = ({ text }) => (
    <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-slate-500">{text}</div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050713] text-white">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        <p className="mt-4 animate-pulse font-black text-cyan-300">Loading NexPOS Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050713] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.12),transparent_32%),linear-gradient(180deg,#050713,#070b16)]" />

      <motion.main variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible" className="relative z-10 mx-auto w-full max-w-7xl space-y-5 px-4 py-5 pb-28 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 p-5 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Zap size={14} /> {tx('commandCenter')}
              </div>
              <div>
                <h1 className="text-4xl font-black leading-tight sm:text-5xl">NexPOS <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">{tx('dashboard')}</span></h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-400">{tx('subtitle')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} to={action.to} className={`group rounded-3xl border bg-gradient-to-br p-4 transition hover:-translate-y-1 hover:shadow-xl ${palette[action.tone] || palette.cyan}`}>
                    <Icon size={24} />
                    <div className="mt-4 flex items-center justify-between gap-2 text-sm font-black text-white">
                      <span>{action.label}</span>
                      <ArrowRight size={16} className="opacity-60 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={tx('search')} className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/80 pl-12 pr-4 text-base font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10" />
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
            {rangeOptions.map((option) => (
              <button key={option.key} type="button" onClick={() => setDateRange(option.key)} className={`rounded-xl px-3 py-3 text-xs font-black transition ${dateRange === option.key ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {mainKpis.map((item) => <KpiCard key={item.label} item={item} />)}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{tx('ownerSummary')}</p>
                <h2 className="mt-2 text-2xl font-black">{tx('importantNow')}</h2>
              </div>
              <Sparkles className="text-cyan-300" size={30} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {miniStats.map((stat) => (
                <div key={stat.label} className={`rounded-3xl border bg-gradient-to-br p-4 ${palette[stat.tone] || palette.cyan}`}>
                  <p className="text-xs font-black text-slate-400">{stat.label}</p>
                  <p className="mt-2 break-words text-2xl font-black text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><AlertTriangle className="text-amber-300" /> {tx('alerts')}</h2>
            <div className="space-y-3">
              {importantAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div key={`${alert.title}-${alert.text}`} className={`flex items-center gap-3 rounded-3xl border bg-gradient-to-br p-4 ${palette[alert.tone] || palette.emerald}`}>
                    <div className="rounded-2xl bg-black/25 p-3"><Icon size={22} /></div>
                    <div className="min-w-0">
                      <p className="font-black text-white">{alert.title}</p>
                      <p className="truncate text-sm font-bold text-slate-400">{alert.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-2xl font-black"><TrendingUp className="text-cyan-300" /> {tx('salesAndProfit')}</h2>
              <div className="flex flex-wrap gap-3 text-xs font-black text-slate-400">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-cyan-400" />{tx('sales')}</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-400" />{tx('profit')}</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-400" />{tx('expenses')}</span>
              </div>
            </div>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(34,211,238,.25)', borderRadius: 16, color: '#fff' }} formatter={(value, name) => [money(value), name]} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontWeight: 800 }} />
                  <Line type="monotone" dataKey="sales" name={tx('sales')} stroke="#22d3ee" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="profit" name={tx('profit')} stroke="#34d399" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="expenses" name={tx('expenses')} stroke="#fb7185" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><BarChart3 className="text-violet-300" /> {tx('revenueExpense')}</h2>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: tx('revenue'), value: analytics.revenue, color: '#22d3ee' },
                  { name: tx('grossProfit'), value: analytics.grossProfit, color: '#34d399' },
                  { name: tx('expenses'), value: analytics.expenses, color: '#fb7185' },
                  { name: tx('netProfit'), value: analytics.netProfit, color: '#a78bfa' },
                ]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval={0} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(167,139,250,.25)', borderRadius: 16, color: '#fff' }} formatter={(value) => money(value)} />
                  <Bar dataKey="value" radius={[16, 16, 6, 6]}>
                    {['#22d3ee', '#34d399', '#fb7185', '#a78bfa'].map((color) => <Cell key={color} fill={color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-5 text-2xl font-black">🏆 {tx('topProducts')}</h2>
            {analytics.topProducts.length === 0 ? <EmptyState text={tx('noProducts')} /> : (
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
                      <div className="h-2.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-300" style={{ width: `${width}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><Package className="text-amber-300" /> {tx('lowStock')}</h2>
            {inventoryStats.lowStock.length === 0 ? <EmptyState text={tx('healthyStock')} /> : (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {inventoryStats.lowStock.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/25 p-4">
                    <div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="text-xs font-bold text-slate-500">{product.category}</p></div>
                    <span className={`rounded-2xl px-3 py-1 text-sm font-black ${product.stock <= 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>{product.stock}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><FileText className="text-blue-300" /> {tx('recentActivity')}</h2>
            {analytics.recent.length === 0 ? <EmptyState text={tx('noTransactions')} /> : (
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {analytics.recent.map((record) => {
                  const type = getRecordType(record);
                  const tone = type === 'sale' ? 'cyan' : type === 'purchase' ? 'emerald' : 'rose';
                  return (
                    <Link key={record.id} to="/records" className={`block rounded-3xl border bg-gradient-to-br p-4 transition hover:-translate-y-0.5 ${palette[tone] || palette.cyan}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0"><p className="truncate font-black capitalize">{type || 'record'} • {record.voucherNo || record.invoiceNo || '-'}</p><p className="truncate text-xs font-bold text-slate-500">{record.personName || record.customerName || record.supplierName || '-'}</p></div>
                        <p className="text-right font-black text-white">{money(getRecordAmount(record))}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </motion.main>
    </div>
  );
}
