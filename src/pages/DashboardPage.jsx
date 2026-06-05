import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CreditCard,
  DollarSign,
  Package,
  Plus,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
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

function getRecordDateISO(record) {
  if (record?.date && String(record.date).includes('-')) return record.date;

  const time = getTimeValue(record);
  if (time) {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }

  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getProductStock(product) {
  return toNumber(product?.stockBase ?? product?.stock ?? product?.qty ?? 0);
}

function getProductCost(product) {
  return toNumber(
    product?.costPrice ??
      product?.packageUnits?.[0]?.costPrice ??
      product?.packages?.[0]?.costPrice ??
      0
  );
}

function getProductName(product) {
  return product?.name || product?.productName || product?.itemName || 'Unnamed Product';
}

function getRecordAmount(record) {
  return toNumber(record?.amount ?? record?.total ?? record?.grandTotal ?? 0);
}

function getRecordPaid(record) {
  return toNumber(record?.paidAmount ?? record?.paid ?? record?.amount ?? 0);
}

function getRecordDebt(record) {
  return toNumber(record?.remainingDebt ?? record?.creditBalance ?? 0);
}

function getRecordType(record) {
  return String(record?.type || '').toLowerCase();
}

function getRecordItems(record) {
  if (Array.isArray(record?.itemsDetail)) return record.itemsDetail;
  if (Array.isArray(record?.items)) return record.items;

  if (record?.item && record.item !== 'Multiple') {
    return [
      {
        name: record.item,
        quantity: 1,
        price: getRecordAmount(record),
        costPrice: 0,
      },
    ];
  }

  return [];
}

function getPastISO(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getTodayISO() {
  return getPastISO(0);
}

function translate(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
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
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubRecords = onSnapshot(
      query(collection(db, 'pos_records'), where('tenantId', '==', tenantId)),
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
      query(collection(db, 'pos_products'), where('tenantId', '==', tenantId)),
      (snap) => setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error('Dashboard products error:', error)
    );

    const unsubCustomers = onSnapshot(
      query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId)),
      (snap) => setCustomers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
      (error) => console.error('Dashboard customers error:', error)
    );

    const unsubSuppliers = onSnapshot(
      query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId)),
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

  const fmt = (num) => toNumber(num).toLocaleString();

  const filteredRecords = useMemo(() => {
    const today = getTodayISO();
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

        return (
          String(record.personName || '').toLowerCase().includes(keyword) ||
          String(record.voucherNo || record.invoiceNo || '').toLowerCase().includes(keyword) ||
          String(record.type || '').toLowerCase().includes(keyword) ||
          String(record.item || '').toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => getTimeValue(b) - getTimeValue(a));
  }, [records, dateRange, searchTerm]);

  const saleRecords = useMemo(
    () => filteredRecords.filter((record) => getRecordType(record) === 'sale'),
    [filteredRecords]
  );

  const purchaseRecords = useMemo(
    () => filteredRecords.filter((record) => getRecordType(record) === 'purchase'),
    [filteredRecords]
  );

  const expenseRecords = useMemo(
    () => filteredRecords.filter((record) => getRecordType(record) === 'expense'),
    [filteredRecords]
  );

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
    let purchases = 0;
    let costOfGoods = 0;
    let cashIn = 0;
    let cashOut = 0;
    let creditGiven = 0;

    const productCounter = {};
    const customerCounter = {};
    const productProfitCounter = {};

    saleRecords.forEach((record) => {
      const amount = getRecordAmount(record);
      revenue += amount;
      cashIn += getRecordPaid(record);
      creditGiven += getRecordDebt(record);

      const customerName = record.personName || translate(t, 'walkInCustomer', 'Walk-in Customer');
      customerCounter[customerName] = (customerCounter[customerName] || 0) + amount;

      const items = getRecordItems(record);
      if (items.length === 0 && record.item === 'Multiple') {
        productCounter.Multiple = (productCounter.Multiple || 0) + 1;
        productProfitCounter.Multiple = (productProfitCounter.Multiple || 0) + amount;
      }

      items.forEach((item) => {
        const product = productMap[item.productId] || productMap[item.name] || {};
        const name = item.name || getProductName(product);
        const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
        const price = toNumber(item.unitPrice ?? item.price ?? amount);
        const cost = toNumber(item.costPrice ?? item.cost ?? getProductCost(product));
        const discount = toNumber(item.itemDiscountAmt ?? item.discount ?? 0);

        const itemRevenue = price * qty - discount;
        const itemCost = cost * qty;

        costOfGoods += itemCost;
        productCounter[name] = (productCounter[name] || 0) + qty;
        productProfitCounter[name] = (productProfitCounter[name] || 0) + (itemRevenue - itemCost);
      });
    });

    purchaseRecords.forEach((record) => {
      const amount = getRecordAmount(record);
      purchases += amount;
      cashOut += getRecordPaid(record) || amount;
    });

    expenseRecords.forEach((record) => {
      const amount = getRecordAmount(record);
      expenses += amount;
      cashOut += getRecordPaid(record) || amount;
    });

    const profit = revenue - costOfGoods - expenses;
    const cashInHand = cashIn - cashOut;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const averageOrderValue = saleRecords.length > 0 ? revenue / saleRecords.length : 0;

    const topProducts = Object.entries(productCounter)
      .map(([name, qty]) => ({
        name,
        qty,
        profit: productProfitCounter[name] || 0,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const profitableProducts = Object.entries(productProfitCounter)
      .map(([name, profitValue]) => ({ name, profit: profitValue }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    const topCustomers = Object.entries(customerCounter)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      revenue,
      purchases,
      expenses,
      costOfGoods,
      profit,
      cashIn,
      cashOut,
      cashInHand,
      creditGiven,
      profitMargin,
      averageOrderValue,
      orders: saleRecords.length,
      topProducts,
      profitableProducts,
      topCustomers,
    };
  }, [saleRecords, purchaseRecords, expenseRecords, productMap, t]);

  const inventoryStats = useMemo(() => {
    let inventoryValue = 0;

    const lowStock = products
      .map((product) => {
        const stock = getProductStock(product);
        const minStock = toNumber(product.minStock ?? product.minStockAlert ?? 5);
        const cost = getProductCost(product);

        inventoryValue += stock * cost;

        return {
          id: product.id,
          name: getProductName(product),
          stock,
          minStock,
          cost,
          category: product.category || 'General',
        };
      })
      .filter((product) => product.stock <= product.minStock)
      .sort((a, b) => a.stock - b.stock);

    const outOfStock = lowStock.filter((product) => product.stock <= 0).length;

    return {
      inventoryValue,
      lowStock,
      lowStockCount: lowStock.length,
      outOfStock,
      totalProducts: products.length,
    };
  }, [products]);

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
          cost += toNumber(item.costPrice ?? item.cost ?? getProductCost(product)) * toNumber(item.quantity ?? item.qty ?? 1);
        });
      });

      days.push({
        day,
        sales,
        profit: sales - cost - expenses,
        expenses,
      });
    }

    return days;
  }, [records, productMap]);

  const recentTransactions = useMemo(() => {
    return [...records].sort((a, b) => getTimeValue(b) - getTimeValue(a)).slice(0, 10);
  }, [records]);

  const aiInsight = useMemo(() => {
    if (analytics.profit < 0) {
      return {
        title: 'Profit Warning',
        message: 'Expenses and product costs are higher than sales. Review pricing and expenses.',
        tone: 'danger',
      };
    }

    if (inventoryStats.outOfStock > 0) {
      return {
        title: 'Stock Alert',
        message: `${inventoryStats.outOfStock} products are out of stock. Restock them first.`,
        tone: 'danger',
      };
    }

    if (inventoryStats.lowStockCount >= 5) {
      return {
        title: 'Inventory Warning',
        message: `${inventoryStats.lowStockCount} products are low stock. Prepare purchase orders.`,
        tone: 'warning',
      };
    }

    if (analytics.profitMargin >= 25) {
      return {
        title: 'Excellent Performance',
        message: `Profit margin is ${analytics.profitMargin.toFixed(1)}%. Business performance looks strong.`,
        tone: 'success',
      };
    }

    return {
      title: 'Business Healthy',
      message: 'Sales, profit, and inventory are stable. Keep monitoring daily sales.',
      tone: 'success',
    };
  }, [analytics, inventoryStats]);

  const currentUserName =
    profile?.displayName || profile?.fullName || profile?.username || profile?.email || 'Admin';

  const statCards = [
    {
      title: translate(t, 'revenue', 'Revenue'),
      value: analytics.revenue,
      suffix: 'Ks',
      subtitle: `${analytics.orders} ${translate(t, 'totalOrders', 'orders')}`,
      icon: DollarSign,
      color: 'cyan',
      trend: analytics.revenue > 0 ? 'Live' : 'No sales',
      isNegative: false,
    },
    {
      title: translate(t, 'netProfit', 'Net Profit'),
      value: analytics.profit,
      suffix: 'Ks',
      subtitle: `${analytics.profitMargin.toFixed(1)}% margin`,
      icon: TrendingUp,
      color: analytics.profit >= 0 ? 'emerald' : 'rose',
      trend: analytics.profit >= 0 ? 'Positive' : 'Loss',
      isNegative: analytics.profit < 0,
    },
    {
      title: 'Cash Flow',
      value: analytics.cashInHand,
      suffix: 'Ks',
      subtitle: `In ${fmt(analytics.cashIn)} • Out ${fmt(analytics.cashOut)}`,
      icon: Wallet,
      color: 'blue',
      trend: analytics.cashInHand >= 0 ? 'Healthy' : 'Negative',
      isNegative: analytics.cashInHand < 0,
    },
    {
      title: translate(t, 'expenses', 'Expenses'),
      value: analytics.expenses,
      suffix: 'Ks',
      subtitle: 'Operational costs',
      icon: TrendingDown,
      color: 'rose',
      trend: analytics.expenses > 0 ? 'Tracked' : 'None',
      isNegative: true,
    },
    {
      title: 'Inventory Value',
      value: inventoryStats.inventoryValue,
      suffix: 'Ks',
      subtitle: `${inventoryStats.totalProducts} products`,
      icon: Package,
      color: 'violet',
      trend: 'Stock capital',
      isNegative: false,
    },
    {
      title: 'Customer Credit',
      value: analytics.creditGiven,
      suffix: 'Ks',
      subtitle: 'Unpaid sale balance',
      icon: CreditCard,
      color: 'amber',
      trend: analytics.creditGiven > 0 ? 'Need follow-up' : 'Clear',
      isNegative: analytics.creditGiven > 0,
    },
    {
      title: 'Customers',
      value: customers.length,
      suffix: '',
      subtitle: 'Customer records',
      icon: Users,
      color: 'emerald',
      trend: 'CRM',
      isNegative: false,
    },
    {
      title: 'Low Stock',
      value: inventoryStats.lowStockCount,
      suffix: '',
      subtitle: `${inventoryStats.outOfStock} out of stock`,
      icon: AlertTriangle,
      color: inventoryStats.lowStockCount > 0 ? 'rose' : 'emerald',
      trend: inventoryStats.lowStockCount > 0 ? 'Action needed' : 'Good',
      isNegative: inventoryStats.lowStockCount > 0,
    },
  ];

  const colorMap = {
    cyan: {
      border: 'border-cyan-500/20',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      glow: 'bg-cyan-500/20',
    },
    emerald: {
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      glow: 'bg-emerald-500/20',
    },
    rose: {
      border: 'border-rose-500/20',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      glow: 'bg-rose-500/20',
    },
    blue: {
      border: 'border-blue-500/20',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      glow: 'bg-blue-500/20',
    },
    amber: {
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      glow: 'bg-amber-500/20',
    },
    violet: {
      border: 'border-violet-500/20',
      bg: 'bg-violet-500/10',
      text: 'text-violet-400',
      glow: 'bg-violet-500/20',
    },
  };

  const Card = ({ children, className = '' }) => (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
      className={`bg-[#0d1120]/95 border border-white/5 rounded-3xl shadow-xl shadow-black/20 ${className}`}
    >
      {children}
    </motion.div>
  );

  const StatCard = ({ card }) => {
    const Icon = card.icon;
    const colors = colorMap[card.color] || colorMap.cyan;

    return (
      <Card className={`p-5 relative overflow-hidden ${colors.border}`}>
        <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-3xl ${colors.glow}`} />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">
                {card.title}
              </p>
              <h3 className={`mt-2 text-2xl sm:text-3xl font-black ${colors.text}`}>
                {fmt(card.value)} {card.suffix}
              </h3>
            </div>
            <div className={`p-3 rounded-2xl ${colors.bg} ${colors.text}`}>
              <Icon size={24} />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <span
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-black ${
                card.isNegative ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {card.isNegative ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
              {card.trend}
            </span>
            <span className="text-xs text-slate-500 font-bold truncate">{card.subtitle}</span>
          </div>
        </div>
      </Card>
    );
  };

  const EmptyState = ({ text }) => (
    <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-white/10 rounded-2xl">
      {text}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060816] flex flex-col items-center justify-center text-white">
        <div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-cyan-400 font-black animate-pulse">Loading NexPOS Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#060816] overflow-hidden text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-24 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="bg-[#0d1120]/90 border border-cyan-500/15 rounded-3xl p-5 flex-1 shadow-xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400">
                    <Zap size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black">
                      <span className="text-white">NexPOS</span>{' '}
                      <span className="text-cyan-400">Analytics</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1">
                      Welcome back, {currentUserName}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-slate-400 text-sm">
                  Realtime business intelligence for sales, profit, inventory, customers and cash flow.
                </p>
              </div>

              <div className="hidden sm:block text-right bg-black/30 border border-white/5 rounded-2xl px-4 py-3">
                <p className="text-xs text-slate-500 font-bold">{clock.toLocaleDateString()}</p>
                <p className="text-cyan-400 font-black">{clock.toLocaleTimeString()}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row xl:flex-col gap-3 xl:w-80">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={translate(t, 'searchTransactions', 'Search transactions...')}
                className="w-full bg-[#0d1120] border border-cyan-500/20 rounded-2xl pl-11 pr-10 py-3 text-sm outline-none focus:border-cyan-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex bg-[#0d1120] border border-cyan-500/20 rounded-2xl p-1 overflow-x-auto">
              {[
                { id: 'today', label: translate(t, 'today', 'Today') },
                { id: 'week', label: translate(t, 'week', 'Week') },
                { id: 'month', label: translate(t, 'month', 'Month') },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateRange(item.id)}
                  className={`flex-1 min-w-[80px] px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    dateRange === item.id
                      ? 'bg-cyan-500 text-[#060816]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 relative overflow-hidden border-cyan-500/20">
              <div className="absolute top-0 right-0 opacity-5">
                <Activity size={180} />
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-cyan-400 font-black uppercase tracking-[0.25em]">
                    {translate(t, 'cashFlowBalance', 'Cash Flow Balance')}
                  </p>
                  <h2 className="text-4xl sm:text-6xl font-black mt-3">
                    {fmt(analytics.cashInHand)} <span className="text-xl text-slate-400">Ks</span>
                  </h2>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black">
                      Cash In: {fmt(analytics.cashIn)} Ks
                    </span>
                    <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-black">
                      Cash Out: {fmt(analytics.cashOut)} Ks
                    </span>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 min-w-[150px]">
                  <p className="text-xs text-slate-500 font-black">Profit Margin</p>
                  <p className={`text-3xl font-black mt-2 ${analytics.profitMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {analytics.profitMargin.toFixed(1)}%
                  </p>
                  <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${analytics.profitMargin >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(Math.abs(analytics.profitMargin), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className={`p-6 ${aiInsight.tone === 'danger' ? 'border-rose-500/20' : aiInsight.tone === 'warning' ? 'border-amber-500/20' : 'border-emerald-500/20'}`}>
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl ${
                    aiInsight.tone === 'danger'
                      ? 'bg-rose-500/10 text-rose-400'
                      : aiInsight.tone === 'warning'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  <BarChart3 size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-black uppercase">NexPOS Insight</p>
                  <h3 className="text-lg font-black">{aiInsight.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-400 leading-6">{aiInsight.message}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.title} card={card} />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2 p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black flex items-center gap-2">
                  <TrendingUp size={18} className="text-cyan-400" />
                  {translate(t, 'salesProfitTrend', 'Sales & Profit Trend')}
                </h2>
                <span className="text-xs text-slate-500 font-bold">Last 7 days</span>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="salesColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profitColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#060816',
                        border: '1px solid rgba(6,182,212,0.25)',
                        borderRadius: 14,
                      }}
                      formatter={(value, name) => [`${fmt(value)} Ks`, name]}
                    />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#06b6d4" strokeWidth={3} fill="url(#salesColor)" />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} fill="url(#profitColor)" />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#expenseColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-black mb-5 flex items-center gap-2">
                <Calendar size={18} className="text-cyan-400" />
                Today Summary
              </h2>

              <div className="space-y-3">
                {[
                  ['Average Order', `${fmt(analytics.averageOrderValue)} Ks`],
                  ['Total Orders', analytics.orders],
                  ['Products', inventoryStats.totalProducts],
                  ['Customers', customers.length],
                  ['Suppliers', suppliers.length],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between bg-black/25 border border-white/5 rounded-2xl p-3">
                    <span className="text-xs text-slate-400 font-bold">{label}</span>
                    <span className="font-black text-white">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link to="/entry" className="flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-2xl py-3 text-xs font-black border border-cyan-500/20">
                  <Plus size={15} /> Sale
                </Link>
                <Link to="/inventory" className="flex items-center justify-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-2xl py-3 text-xs font-black border border-violet-500/20">
                  <Package size={15} /> Stock
                </Link>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="p-5">
              <h2 className="font-black mb-5 flex items-center gap-2">
                🏆 {translate(t, 'topSellingProducts', 'Top Selling Products')}
              </h2>
              {analytics.topProducts.length === 0 ? (
                <EmptyState text={translate(t, 'noProductsSold', 'No products sold yet.')} />
              ) : (
                <div className="space-y-4">
                  {analytics.topProducts.map((product, index) => {
                    const max = analytics.topProducts[0]?.qty || 1;
                    const width = Math.max((product.qty / max) * 100, 8);

                    return (
                      <div key={product.name}>
                        <div className="flex items-center justify-between text-xs font-bold mb-2">
                          <span className="truncate pr-3">
                            {index === 0 ? '👑 ' : ''}
                            {product.name}
                          </span>
                          <span className="text-cyan-400">{product.qty}</span>
                        </div>
                        <div className="h-2.5 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-black mb-5 flex items-center gap-2">
                <Users size={18} className="text-emerald-400" /> Best Customers
              </h2>
              {analytics.topCustomers.length === 0 ? (
                <EmptyState text="No customer data." />
              ) : (
                <div className="space-y-4">
                  {analytics.topCustomers.map((customer) => {
                    const max = analytics.topCustomers[0]?.total || 1;
                    const width = Math.max((customer.total / max) * 100, 8);

                    return (
                      <div key={customer.name}>
                        <div className="flex items-center justify-between text-xs font-bold mb-2">
                          <span className="truncate pr-3">{customer.name}</span>
                          <span className="text-emerald-400">{fmt(customer.total)} Ks</span>
                        </div>
                        <div className="h-2.5 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-300 rounded-full" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5 border-rose-500/10">
              <h2 className="font-black mb-5 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-400" /> Low Stock Center
              </h2>
              {inventoryStats.lowStock.length === 0 ? (
                <EmptyState text="All products are healthy." />
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {inventoryStats.lowStock.slice(0, 8).map((product) => (
                    <div key={product.id} className="flex items-center justify-between bg-black/25 border border-white/5 rounded-2xl p-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{product.name}</p>
                        <p className="text-[10px] text-slate-500">{product.category}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black ${
                          product.stock <= 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-400" />
                {translate(t, 'recentTransactions', 'Recent Transactions')}
              </h2>
              <span className="text-xs text-slate-500 font-bold">{recentTransactions.length} latest</span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/5">
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 px-4">Date</th>
                    <th className="pb-3 px-4">Voucher</th>
                    <th className="pb-3 px-4">Person</th>
                    <th className="pb-3 px-4">Payment</th>
                    <th className="pb-3 pl-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        {translate(t, 'noTransactions', 'No transactions recorded')}
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map((transaction) => {
                      const type = getRecordType(transaction);
                      const isExpense = type === 'expense';
                      const isSale = type === 'sale';

                      return (
                        <tr key={transaction.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                isSale
                                  ? 'bg-cyan-500/10 text-cyan-400'
                                  : isExpense
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {transaction.type || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">{getRecordDateISO(transaction)}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                            {transaction.voucherNo || transaction.invoiceNo || '-'}
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {transaction.personName || transaction.item || translate(t, 'walkInCustomer', 'Walk-in')}
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {transaction.paymentType || transaction.paymentMethod || '-'}
                          </td>
                          <td className={`py-3 pl-4 text-right font-black ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {isExpense ? '-' : '+'}
                            {fmt(getRecordAmount(transaction))} Ks
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
