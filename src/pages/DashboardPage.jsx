import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
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
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const moneyUnit = 'Ks';

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return toNumber(value).toLocaleString();
}

function tr(t, key, fallback) {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
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

function isoDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function recordISO(record) {
  if (record?.date && String(record.date).includes('-')) return record.date;
  const time = getTimeValue(record);
  const date = time ? new Date(time) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function recordType(record) {
  return String(record?.type || '').toLowerCase();
}

function recordAmount(record) {
  return toNumber(record?.amount ?? record?.total ?? record?.grandTotal ?? 0);
}

function recordPaid(record) {
  return toNumber(record?.paidAmount ?? record?.paid ?? record?.amount ?? 0);
}

function recordDebt(record) {
  return toNumber(record?.remainingDebt ?? record?.creditBalance ?? 0);
}

function recordItems(record) {
  if (Array.isArray(record?.itemsDetail)) return record.itemsDetail;
  if (Array.isArray(record?.items)) return record.items;
  if (record?.item && record.item !== 'Multiple') {
    return [{ name: record.item, quantity: 1, price: recordAmount(record), costPrice: 0 }];
  }
  return [];
}

function productName(product) {
  return product?.name || product?.productName || product?.itemName || 'Unnamed Product';
}

function productStock(product) {
  return toNumber(product?.stockBase ?? product?.stock ?? product?.qty ?? 0);
}

function productCost(product) {
  return toNumber(product?.costPrice ?? product?.packageUnits?.[0]?.costPrice ?? 0);
}

function percent(part, total) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

const cardMotion = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { profile, hasPermission } = useAuth();
  const { t } = useLanguage();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');

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
    if (permissions.includes('create_sale') || permissions.includes('create_purchase')) return <Navigate to="/entry" replace />;
    if (permissions.includes('view_inventory')) return <Navigate to="/inventory" replace />;
    if (permissions.includes('accept_payment')) return <Navigate to="/customers" replace />;
    return <Navigate to="/entry" replace />;
  }

  const filteredRecords = useMemo(() => {
    const today = isoDate(0);
    const weekStart = isoDate(6);
    const monthStart = isoDate(29);
    const keyword = searchTerm.trim().toLowerCase();

    return records
      .filter((record) => {
        const date = recordISO(record);
        if (range === 'today') return date === today;
        if (range === 'week') return date >= weekStart && date <= today;
        if (range === 'month') return date >= monthStart && date <= today;
        return true;
      })
      .filter((record) => {
        if (!keyword) return true;
        return (
          String(record.personName || '').toLowerCase().includes(keyword) ||
          String(record.voucherNo || record.invoiceNo || '').toLowerCase().includes(keyword) ||
          String(record.item || '').toLowerCase().includes(keyword) ||
          String(record.type || '').toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => getTimeValue(b) - getTimeValue(a));
  }, [records, range, searchTerm]);

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
    let cogs = 0;
    let expenses = 0;
    let purchaseTotal = 0;
    let cashIn = 0;
    let cashOut = 0;
    let customerCredit = 0;
    let supplierPayable = 0;
    const productCounter = {};
    const productRevenue = {};
    const productProfit = {};

    filteredRecords.forEach((record) => {
      const type = recordType(record);
      const amount = recordAmount(record);
      const paid = recordPaid(record);
      const debt = recordDebt(record);

      if (type === 'sale') {
        revenue += amount;
        cashIn += paid;
        customerCredit += debt;

        const items = recordItems(record);
        if (items.length === 0 && record.item === 'Multiple') {
          productCounter.Multiple = (productCounter.Multiple || 0) + 1;
          productRevenue.Multiple = (productRevenue.Multiple || 0) + amount;
          productProfit.Multiple = (productProfit.Multiple || 0) + amount;
        }

        items.forEach((item) => {
          const product = productMap[item.productId] || productMap[item.name] || {};
          const name = item.name || productName(product);
          const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
          const price = toNumber(item.unitPrice ?? item.price ?? amount);
          const cost = toNumber(item.costPrice ?? item.cost ?? productCost(product));
          const discount = toNumber(item.itemDiscountAmt ?? item.discount ?? 0);
          const itemRevenue = Math.max(0, price * qty - discount);
          const itemCost = cost * qty;
          cogs += itemCost;
          productCounter[name] = (productCounter[name] || 0) + qty;
          productRevenue[name] = (productRevenue[name] || 0) + itemRevenue;
          productProfit[name] = (productProfit[name] || 0) + (itemRevenue - itemCost);
        });
      }

      if (type === 'purchase') {
        purchaseTotal += amount;
        cashOut += paid || amount;
        supplierPayable += debt;
      }

      if (type === 'expense') {
        expenses += amount;
        cashOut += paid || amount;
      }
    });

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;
    const saleCount = filteredRecords.filter((record) => recordType(record) === 'sale').length;
    const purchaseCount = filteredRecords.filter((record) => recordType(record) === 'purchase').length;
    const expenseCount = filteredRecords.filter((record) => recordType(record) === 'expense').length;

    return {
      revenue,
      cogs,
      grossProfit,
      expenses,
      purchaseTotal,
      netProfit,
      cashIn,
      cashOut,
      cashBalance: cashIn - cashOut,
      customerCredit,
      supplierPayable,
      saleCount,
      purchaseCount,
      expenseCount,
      averageSale: saleCount ? revenue / saleCount : 0,
      topProducts: Object.entries(productCounter)
        .map(([name, qty]) => ({ name, qty, revenue: productRevenue[name] || 0, profit: productProfit[name] || 0 }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    };
  }, [filteredRecords, productMap]);

  const inventory = useMemo(() => {
    let stockValue = 0;
    const lowStock = products
      .map((product) => {
        const stock = productStock(product);
        const minStock = toNumber(product.minStock ?? product.minStockAlert ?? 5);
        const cost = productCost(product);
        stockValue += stock * cost;
        return { id: product.id, name: productName(product), stock, minStock, category: product.category || 'General' };
      })
      .filter((product) => product.stock <= product.minStock)
      .sort((a, b) => a.stock - b.stock);

    return {
      stockValue,
      lowStock,
      lowStockCount: lowStock.length,
      outOfStock: lowStock.filter((product) => product.stock <= 0).length,
      totalProducts: products.length,
    };
  }, [products]);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const iso = isoDate(i);
      const label = new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
      const dayRecords = records.filter((record) => recordISO(record) === iso);
      let sales = 0;
      let expenses = 0;
      let cost = 0;

      dayRecords.forEach((record) => {
        const type = recordType(record);
        if (type === 'sale') {
          sales += recordAmount(record);
          recordItems(record).forEach((item) => {
            const product = productMap[item.productId] || productMap[item.name] || {};
            const qty = toNumber(item.quantity ?? item.qty ?? 1) || 1;
            cost += toNumber(item.costPrice ?? item.cost ?? productCost(product)) * qty;
          });
        }
        if (type === 'expense') expenses += recordAmount(record);
      });

      days.push({ day: label, sales, profit: sales - cost - expenses, expenses });
    }
    return days;
  }, [records, productMap]);

  const recentTransactions = useMemo(() => filteredRecords.slice(0, 6), [filteredRecords]);

  const alerts = useMemo(() => {
    const list = [];
    if (inventory.lowStockCount > 0) {
      list.push({
        title: tr(t, 'lowStock', 'လက်ကျန်နည်း'),
        message: `${inventory.lowStockCount} ${tr(t, 'productsNeedRestock', 'ပစ္စည်းကို ပြန်ဖြည့်ရန်လိုသည်')}`,
        tone: 'warning',
      });
    }
    if (analytics.customerCredit > 0) {
      list.push({
        title: tr(t, 'customerDebt', 'Customer ကြွေးကျန်'),
        message: `${money(analytics.customerCredit)} ${moneyUnit} ${tr(t, 'unpaidSaleBalance', 'မဆပ်ရသေးသော ရောင်းချငွေ')}`,
        tone: 'danger',
      });
    }
    if (analytics.supplierPayable > 0) {
      list.push({
        title: tr(t, 'supplierPayable', 'Supplier ပေးချေရန်'),
        message: `${money(analytics.supplierPayable)} ${moneyUnit} ${tr(t, 'unpaidPurchaseBalance', 'မပေးရသေးသော အဝယ်ငွေ')}`,
        tone: 'warning',
      });
    }
    if (list.length === 0) {
      list.push({ title: tr(t, 'allGood', 'အားလုံးကောင်းသည်'), message: tr(t, 'noImportantAlerts', 'ဒီကာလအတွက် အရေးကြီးသတိပေးချက် မရှိပါ။'), tone: 'success' });
    }
    return list;
  }, [analytics, inventory, t]);

  const currentUserName = profile?.displayName || profile?.fullName || profile?.username || profile?.email || 'Admin';

  const primaryKpis = [
    { label: tr(t, 'revenue', 'ရောင်းအား'), value: analytics.revenue, icon: ShoppingCart, tone: 'cyan', sub: `${analytics.saleCount} ${tr(t, 'sales', 'အရောင်း')}` },
    { label: tr(t, 'netProfit', 'အသားတင်အမြတ်'), value: analytics.netProfit, icon: TrendingUp, tone: 'emerald', sub: tr(t, 'afterExpenses', 'အသုံးစရိတ်ဖြုတ်ပြီး') },
    { label: tr(t, 'expenses', 'အသုံးစရိတ်'), value: analytics.expenses, icon: TrendingDown, tone: 'rose', sub: `${analytics.expenseCount} ${tr(t, 'records', 'စာရင်း')}` },
    { label: tr(t, 'stockValue', 'Stock တန်ဖိုး'), value: inventory.stockValue, icon: Package, tone: 'violet', sub: `${inventory.totalProducts} ${tr(t, 'products', 'ပစ္စည်း')}` },
  ];

  const miniStats = [
    { label: tr(t, 'grossProfit', 'စုစုပေါင်းအမြတ်'), value: analytics.grossProfit, icon: DollarSign },
    { label: tr(t, 'cashBalance', 'လက်ကျန်ငွေ'), value: analytics.cashBalance, icon: Wallet },
    { label: tr(t, 'customerDebt', 'Customer ကြွေးကျန်'), value: analytics.customerCredit, icon: CreditCard },
    { label: tr(t, 'lowStock', 'လက်ကျန်နည်း'), value: inventory.lowStockCount, suffix: '', icon: AlertTriangle },
  ];

  const rangeOptions = [
    { id: 'today', label: tr(t, 'today', 'ယနေ့') },
    { id: 'week', label: tr(t, 'week', '၇ ရက်') },
    { id: 'month', label: tr(t, 'month', '၃၀ ရက်') },
    { id: 'all', label: tr(t, 'all', 'အားလုံး') },
  ];

  const revenueMax = Math.max(analytics.revenue, analytics.expenses, Math.abs(analytics.netProfit), 1);

  const panelClass = 'rounded-[28px] border border-white/10 bg-[#0c1222]/95 shadow-2xl shadow-black/30';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] flex flex-col items-center justify-center text-white">
        <div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-cyan-300 font-black">NexPOS Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#050814] text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-1/4 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <motion.main
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto max-w-7xl space-y-5 p-4 pb-24 sm:p-6 lg:p-8"
      >
        <motion.section variants={cardMotion} className={`${panelClass} overflow-hidden`}>
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="relative p-5 sm:p-7">
              <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-cyan-500/10 to-transparent" />
              <div className="relative z-10 flex items-start gap-4">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
                  <Zap size={28} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">NexPOS Command Center</p>
                  <h1 className="mt-2 text-2xl font-black leading-tight sm:text-4xl">
                    {tr(t, 'dashboard', 'Dashboard')}
                  </h1>
                  <p className="mt-2 text-sm font-bold text-slate-400">
                    {currentUserName} • {tr(t, 'ownerDashboardHint', 'ရောင်းအား၊ အမြတ်၊ ကြွေးကျန်၊ stock အခြေအနေကို တစ်နေရာတည်းကြည့်ရန်')}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={tr(t, 'searchTransactions', 'Voucher / customer / item ရှာရန်...')}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-11 pr-10 text-[16px] text-white outline-none transition focus:border-cyan-400"
                />
                {searchTerm ? (
                  <button type="button" onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {rangeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRange(option.id)}
                    className={`rounded-xl px-2 py-2 text-xs font-black transition ${range === option.id ? 'bg-cyan-400 text-[#06101d]' : 'bg-black/30 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={cardMotion} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {primaryKpis.map((item) => {
            const Icon = item.icon;
            const toneClass = {
              cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/15',
              emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/15',
              rose: 'text-rose-300 bg-rose-400/10 border-rose-400/15',
              violet: 'text-violet-300 bg-violet-400/10 border-violet-400/15',
            }[item.tone];
            return (
              <div key={item.label} className={`${panelClass} relative overflow-hidden p-4 sm:p-5`}>
                <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-white sm:text-3xl">{money(item.value)} <span className="text-sm text-slate-500">{moneyUnit}</span></p>
                    <p className="mt-2 truncate text-xs font-bold text-slate-500">{item.sub}</p>
                  </div>
                  <div className={`rounded-2xl border p-3 ${toneClass}`}>
                    <Icon size={22} />
                  </div>
                </div>
              </div>
            );
          })}
        </motion.section>

        <motion.section variants={cardMotion} className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <div className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Owner Summary</p>
                <h2 className="mt-1 text-xl font-black sm:text-2xl">{tr(t, 'todayBusinessStatus', 'လုပ်ငန်းအခြေအနေ အကျဉ်းချုပ်')}</h2>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-black text-slate-300">
                <CalendarDays className="mr-2 inline" size={15} />{rangeOptions.find((item) => item.id === range)?.label}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {miniStats.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black text-slate-400">{item.label}</p>
                      <Icon size={18} className="text-cyan-300" />
                    </div>
                    <p className="mt-3 text-2xl font-black text-white">{money(item.value)} {item.suffix === '' ? '' : moneyUnit}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Link to="/entry" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-center text-sm font-black text-cyan-200 hover:bg-cyan-400/20">
                <Plus className="mx-auto mb-2" size={18} />{tr(t, 'newSale', 'အရောင်းအသစ်')}
              </Link>
              <Link to="/entry?mode=purchase" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-center text-sm font-black text-emerald-200 hover:bg-emerald-400/20">
                <ShoppingCart className="mx-auto mb-2" size={18} />{tr(t, 'purchase', 'အဝယ်')}
              </Link>
              <Link to="/inventory" className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-4 text-center text-sm font-black text-violet-200 hover:bg-violet-400/20">
                <Package className="mx-auto mb-2" size={18} />{tr(t, 'stock', 'Stock')}
              </Link>
              <Link to="/records" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-center text-sm font-black text-amber-200 hover:bg-amber-400/20">
                <ReceiptText className="mx-auto mb-2" size={18} />{tr(t, 'records', 'မှတ်တမ်း')}
              </Link>
            </div>
          </div>

          <div className={`${panelClass} p-5 sm:p-6`}>
            <h2 className="flex items-center gap-2 text-xl font-black"><AlertTriangle size={22} className="text-amber-300" />{tr(t, 'alerts', 'သတိပေးချက်များ')}</h2>
            <div className="mt-5 space-y-3">
              {alerts.map((alert) => (
                <div
                  key={`${alert.title}-${alert.message}`}
                  className={`rounded-2xl border p-4 ${alert.tone === 'danger' ? 'border-rose-400/25 bg-rose-400/10' : alert.tone === 'warning' ? 'border-amber-400/25 bg-amber-400/10' : 'border-emerald-400/25 bg-emerald-400/10'}`}
                >
                  <p className={`font-black ${alert.tone === 'danger' ? 'text-rose-300' : alert.tone === 'warning' ? 'text-amber-300' : 'text-emerald-300'}`}>{alert.title}</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-400">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={cardMotion} className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black"><TrendingUp size={20} className="text-cyan-300" />{tr(t, 'salesProfitTrend', 'အရောင်းနှင့်အမြတ် လမ်းကြောင်း')}</h2>
              <div className="flex flex-wrap gap-3 text-xs font-black text-slate-300">
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" />{tr(t, 'sales', 'အရောင်း')}</span>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />{tr(t, 'profit', 'အမြတ်')}</span>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />{tr(t, 'expenses', 'အသုံးစရိတ်')}</span>
              </div>
            </div>
            <div className="mt-5 h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dashSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                    <linearGradient id="dashProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                    <linearGradient id="dashExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fb7185" stopOpacity={0.25} /><stop offset="95%" stopColor="#fb7185" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.10)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={48} tickFormatter={(value) => (value >= 1000000 ? `${Math.round(value / 1000000)}M` : value >= 1000 ? `${Math.round(value / 1000)}K` : value)} />
                  <Tooltip contentStyle={{ background: '#070b16', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 16, color: '#fff' }} formatter={(value, name) => [`${money(value)} ${moneyUnit}`, name]} />
                  <Area type="monotone" dataKey="sales" name={tr(t, 'sales', 'အရောင်း')} stroke="#22d3ee" strokeWidth={3} fill="url(#dashSales)" />
                  <Area type="monotone" dataKey="profit" name={tr(t, 'profit', 'အမြတ်')} stroke="#34d399" strokeWidth={3} fill="url(#dashProfit)" />
                  <Area type="monotone" dataKey="expenses" name={tr(t, 'expenses', 'အသုံးစရိတ်')} stroke="#fb7185" strokeWidth={2} fill="url(#dashExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${panelClass} p-5 sm:p-6`}>
            <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 size={20} className="text-violet-300" />{tr(t, 'revenueExpenseCompare', 'ငွေဝင် / ငွေထွက် နှိုင်းယှဉ်')}</h2>
            <div className="mt-6 space-y-5">
              {[
                { label: tr(t, 'revenue', 'ရောင်းအား'), value: analytics.revenue, color: 'bg-cyan-400', text: 'text-cyan-300' },
                { label: tr(t, 'grossProfit', 'စုစုပေါင်းအမြတ်'), value: analytics.grossProfit, color: 'bg-emerald-400', text: 'text-emerald-300' },
                { label: tr(t, 'expenses', 'အသုံးစရိတ်'), value: analytics.expenses, color: 'bg-rose-400', text: 'text-rose-300' },
                { label: tr(t, 'netProfit', 'အသားတင်အမြတ်'), value: analytics.netProfit, color: 'bg-violet-400', text: 'text-violet-300' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                    <span className="text-slate-300">{row.label}</span>
                    <span className={row.text}>{money(row.value)} {moneyUnit}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-black/40">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(3, percent(Math.abs(row.value), revenueMax))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={cardMotion} className="grid gap-5 xl:grid-cols-3">
          <div className={`${panelClass} p-5 sm:p-6`}>
            <h2 className="text-xl font-black">🏆 {tr(t, 'topSellingProducts', 'အရောင်းရဆုံးပစ္စည်းများ')}</h2>
            {analytics.topProducts.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">{tr(t, 'noProductsSold', 'ရောင်းထားသော ပစ္စည်းမရှိသေးပါ')}</div>
            ) : (
              <div className="mt-5 space-y-4">
                {analytics.topProducts.map((product, index) => {
                  const max = analytics.topProducts[0]?.revenue || 1;
                  return (
                    <div key={product.name}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{index + 1}. {product.name}</p>
                          <p className="text-xs font-bold text-slate-500">{product.qty} sold • {money(product.profit)} {moneyUnit} profit</p>
                        </div>
                        <p className="text-sm font-black text-cyan-300">{money(product.revenue)} {moneyUnit}</p>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-200" style={{ width: `${Math.max(8, percent(product.revenue, max))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${panelClass} p-5 sm:p-6`}>
            <h2 className="flex items-center gap-2 text-xl font-black"><Package size={20} className="text-amber-300" />{tr(t, 'lowStock', 'လက်ကျန်နည်း')}</h2>
            {inventory.lowStock.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm font-bold text-emerald-200">{tr(t, 'allStockHealthy', 'လက်ကျန်အားလုံး ကောင်းမွန်နေသည်')}</div>
            ) : (
              <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-1">
                {inventory.lowStock.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{product.name}</p>
                      <p className="text-xs font-bold text-slate-500">{product.category}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${product.stock <= 0 ? 'bg-rose-400/15 text-rose-300' : 'bg-amber-400/15 text-amber-300'}`}>{product.stock}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${panelClass} p-5 sm:p-6`}>
            <h2 className="flex items-center gap-2 text-xl font-black"><ReceiptText size={20} className="text-blue-300" />{tr(t, 'recentTransactions', 'နောက်ဆုံးစာရင်းများ')}</h2>
            {recentTransactions.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">{tr(t, 'noTransactions', 'စာရင်းမရှိသေးပါ')}</div>
            ) : (
              <div className="mt-5 space-y-3">
                {recentTransactions.map((record) => {
                  const type = recordType(record);
                  const typeClass = type === 'sale' ? 'text-cyan-300 bg-cyan-400/10' : type === 'purchase' ? 'text-emerald-300 bg-emerald-400/10' : 'text-rose-300 bg-rose-400/10';
                  return (
                    <div key={record.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${typeClass}`}>{record.type || '-'}</span>
                        <span className="text-sm font-black text-white">{money(recordAmount(record))} {moneyUnit}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                        <span className="truncate">{record.personName || record.item || tr(t, 'walkInCustomer', 'Walk-in')}</span>
                        <span>{record.voucherNo || record.invoiceNo || recordISO(record)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>
      </motion.main>
    </div>
  );
}
