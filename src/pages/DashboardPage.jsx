import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  Zap, DollarSign, CreditCard, MinusCircle,
  AlertTriangle, TrendingUp, Clock3, Calendar, Activity, Search, X
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';

// Pure helper to get timestamp in ms
function getTimestamp(r) {
  if (r.createdAt?.seconds) return r.createdAt.seconds * 1000;
  if (r.createdAt && !isNaN(Number(r.createdAt))) return Number(r.createdAt);
  if (r.date) return new Date(r.date).getTime();
  return Date.now();
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dashPeriod, setDashPeriod] = useState('Today');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Realtime records
  useEffect(() => {
    if (!tenantId) { setDataLoading(false); return; }
    const q = query(
      collection(db, 'pos_records'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDataLoading(false);
    }, (err) => { console.error(err); setDataLoading(false); });
    return () => unsub();
  }, [tenantId]);

  // Realtime products
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId]);

  // Realtime customers (for customer credit)
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId]);

  // Realtime suppliers (for supplier credit)
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId]);

  const fmt = (n) => (Number(n) || 0).toLocaleString();

  // Build product map for O(1) lookup
  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = p; });
    return map;
  }, [products]);

  // Filter records based on period and search
  const periodRecs = useMemo(() => {
    const now = Date.now();
    const todayStr = new Date().toDateString();
    return records.filter(r => {
      const ts = getTimestamp(r);
      if (dashPeriod === 'Today') return new Date(ts).toDateString() === todayStr;
      if (dashPeriod === 'Week') return now - ts <= 7 * 86400000;
      if (dashPeriod === 'Month') return now - ts <= 30 * 86400000;
      if (dashPeriod === 'Custom' && dateRange.start && dateRange.end) {
        return ts >= new Date(dateRange.start).getTime() && ts <= new Date(dateRange.end).getTime() + 86399999;
      }
      return true;
    }).filter(r => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (r.personName?.toLowerCase().includes(searchLower) ||
              r.id?.toLowerCase().includes(searchLower) ||
              r.type?.toLowerCase().includes(searchLower) ||
              r.voucherNo?.toLowerCase().includes(searchLower));
    });
  }, [records, dashPeriod, dateRange, searchTerm]);

  const salesRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'sale'), [periodRecs]);
  const purchaseRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'purchase'), [periodRecs]);
  const expenseRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'expense'), [periodRecs]);
  const paymentRecs = useMemo(() => periodRecs.filter(r => r.type === 'Payment'), [periodRecs]);

  const totalSales = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [salesRecs]);
  const totalPurchases = useMemo(() => purchaseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [purchaseRecs]);
  const totalExpenses = useMemo(() => expenseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [expenseRecs]);
  const totalPayments = useMemo(() => paymentRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [paymentRecs]);

  // ✅ Real-time customer/supplier debt from dedicated collections
  const totalCustomerDebt = useMemo(
    () => customers.reduce((sum, c) => sum + (Number(c.totalDebt) || 0), 0),
    [customers]
  );
  const totalSupplierDebt = useMemo(
    () => suppliers.reduce((sum, s) => sum + (Number(s.totalDebt) || 0), 0),
    [suppliers]
  );

  const orderCount = salesRecs.length;

  // Cash Flow Balance
  const balance = totalSales - totalPurchases - totalExpenses + totalPayments;

  // COGS calculation using productMap for efficiency
  const totalCOGS = useMemo(() => {
    return salesRecs.reduce((sum, r) => {
      const items = r.itemsDetail || r.items || [];
      return sum + items.reduce((s, item) => {
        const prod = productMap[item.productId];
        const cost = Number(item.costPrice) || Number(item.cost) || Number(prod?.packageUnits?.[0]?.costPrice) || 0;
        return s + (cost * (Number(item.quantity) || 0));
      }, 0);
    }, 0);
  }, [salesRecs, productMap]);

  const profit = totalSales - totalCOGS - totalExpenses;
  const profitMargin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;

  // Today's growth comparison
  const todaySales = useMemo(() => {
    const todayStr = new Date().toDateString();
    return records.filter(r => {
      return new Date(getTimestamp(r)).toDateString() === todayStr && r.type?.toLowerCase() === 'sale';
    }).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [records]);

  const yesterdaySales = useMemo(() => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    return records.filter(r => {
      return new Date(getTimestamp(r)).toDateString() === yesterdayStr && r.type?.toLowerCase() === 'sale';
    }).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [records]);

  const growthPercent = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1) : 0;

  // Daily Summary
  const dailySummary = useMemo(() => {
    const avgOrder = orderCount > 0 ? totalSales / orderCount : 0;
    const hours = salesRecs.map(r => new Date(getTimestamp(r)).getHours());
    const hourCount = hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
    const bestHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
    const bestHour = bestHourEntry ? `${bestHourEntry[0]}:00` : '-';

    // Best category using product map
    const categorySales = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const prodData = productMap[item.productId];
        const cat = prodData?.category || item.category || 'General';
        categorySales[cat] = (categorySales[cat] || 0) + (Number(item.quantity) || 1);
      });
    });
    const bestCategory = Object.entries(categorySales).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return { avgOrder, bestHour, bestCategory, customers: orderCount };
  }, [salesRecs, orderCount, totalSales, productMap]);

  // Top Products (using product map and item.productId for grouping)
  const topProducts = useMemo(() => {
    const map = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const prodId = item.productId || item.name; // fallback
        const name = productMap[item.productId]?.name || item.name || 'Unknown';
        const qty = Number(item.quantity) || Number(item.qty) || 0;
        if (qty <= 0) return;

        const price = Number(item.unitPrice) || Number(item.price) || 0;
        const cost = Number(item.costPrice) || Number(item.cost) || Number(productMap[item.productId]?.packageUnits?.[0]?.costPrice) || 0;
        const rowDiscount = Number(item.itemDiscountAmt) || 0;

        const itemRevenue = (price * qty) - rowDiscount;
        const itemProfit = itemRevenue - (cost * qty);

        if (!map[prodId]) map[prodId] = { name, qty: 0, revenue: 0, profit: 0 };
        map[prodId].qty += qty;
        map[prodId].revenue += itemRevenue;
        map[prodId].profit += itemProfit;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [salesRecs, productMap]);

  // Low Stock Alerts
  const lowStock = useMemo(
    () => products.filter(p => (Number(p.stockBase) ?? Number(p.stock) ?? 0) <= (Number(p.minStock) || 5)),
    [products]
  );

  const getStockColor = (stock) => {
    if (stock <= 0) return 'text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/20';
    if (stock <= 5) return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';
    return 'text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/20';
  };

  // Average daily usage per product (productId based)
  const avgDailyUsage = useMemo(() => {
    const usage = {};
    const last30Days = records.filter(r => {
      const ts = getTimestamp(r);
      return Date.now() - ts <= 30 * 86400000 && r.type?.toLowerCase() === 'sale';
    });
    last30Days.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const prodId = item.productId || item.name;
        if (prodId) {
          usage[prodId] = (usage[prodId] || 0) + (Number(item.quantity) || 1);
        }
      });
    });
    Object.keys(usage).forEach(key => { usage[key] = usage[key] / 30; });
    return usage;
  }, [records]);

  const getDaysRemaining = (stock, usageVal) => {
    if (!usageVal || usageVal <= 0) return 'N/A';
    return Math.floor(stock / usageVal);
  };

  // Chart Data (7-day trend)
  const chartData = useMemo(() => {
    const days = [];
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayName = dayNames[d.getDay()];

      const dayRecs = records.filter(r => new Date(getTimestamp(r)).toDateString() === ds);
      const sales = dayRecs.filter(r => r.type?.toLowerCase() === 'sale').reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const daySalesRecs = dayRecs.filter(r => r.type?.toLowerCase() === 'sale');
      const dayCOGS = daySalesRecs.reduce((sum, r) => {
        const items = r.itemsDetail || r.items || [];
        return sum + items.reduce((s, item) => {
          const prod = productMap[item.productId];
          const cost = Number(item.costPrice) || Number(item.cost) || Number(prod?.packageUnits?.[0]?.costPrice) || 0;
          return s + (cost * (Number(item.quantity) || 0));
        }, 0);
      }, 0);

      const purchases = dayRecs.filter(r => r.type?.toLowerCase() === 'purchase').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const expenses = dayRecs.filter(r => r.type?.toLowerCase() === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0);

      days.push({ day: dayName, sales, profit: sales - dayCOGS - expenses, expenses });
    }
    return days;
  }, [records, productMap]);

  const recentSales = useMemo(() => salesRecs.slice(0, 5), [salesRecs]);

  // Animation variants
  const containerVars = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center overflow-x-hidden">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060816] overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-6 text-white pb-36 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <h1 className="text-2xl font-black text-[#06b6d4] tracking-wider flex items-center gap-2">
            <Zap size={24} className="text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"/>
            <span className="font-black text-white">Quick POS</span>DASH
          </h1>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0f172a] border border-[#06b6d4]/30 rounded-xl px-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4] transition-colors"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <X size={14} className="text-slate-400 hover:text-white" />
              </button>
            )}
          </div>

          {/* Period Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {dashPeriod === 'Custom' && showDatePicker && (
              <div className="flex gap-2 animate-fadeIn">
                <input type="date" className="bg-[#0f172a] border border-[#06b6d4]/30 rounded-lg px-2 py-1 text-xs text-white" onChange={e => setDateRange(p => ({...p, start: e.target.value}))}/>
                <input type="date" className="bg-[#0f172a] border border-[#06b6d4]/30 rounded-lg px-2 py-1 text-xs text-white" onChange={e => setDateRange(p => ({...p, end: e.target.value}))}/>
              </div>
            )}
            <div className="flex bg-[#0f172a] rounded-xl p-1 overflow-x-auto scrollbar-hide w-full sm:w-auto border border-[#06b6d4]/15">
              {['Today','Week','Month','Custom'].map(p => (
                <button
                  type="button"
                  key={p} onClick={() => { setDashPeriod(p); if(p === 'Custom') setShowDatePicker(true); else setShowDatePicker(false); }}
                  className={`min-w-[80px] px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${
                    dashPeriod === p
                      ? 'bg-[#06b6d4] text-[#060816] shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <motion.div variants={containerVars} initial="hidden" animate="visible" className="space-y-6">
          {/* Net Balance Card */}
          <motion.div variants={itemVars} className="rounded-2xl p-6 bg-gradient-to-br from-[#06b6d4]/20 via-[#0f172a] to-black border border-[#06b6d4]/30 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={100} /></div>
            <div className="relative z-10 flex justify-between items-start flex-wrap gap-4">
              <div>
                <p className="text-xs text-[#06b6d4] font-bold uppercase tracking-widest mb-1">Cash Flow Balance</p>
                <h2 className="text-4xl sm:text-5xl font-black text-white drop-shadow-md">{fmt(balance)} Ks</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold">
                  <span className={profit >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}>Margin: {profitMargin}%</span>
                  <span className="text-slate-400">Total Orders: {orderCount}</span>
                </div>
              </div>
              <div className="bg-black/40 rounded-xl px-3 py-2 text-center border border-[#06b6d4]/20">
                <p className="text-[10px] text-slate-400">Today's Growth</p>
                <p className={`text-sm font-bold ${Number(growthPercent) >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                  {Number(growthPercent) >= 0 ? '+' : ''}{growthPercent}%
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVars} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Revenue (Sales)", val: totalSales, color: "text-[#06b6d4]", icon: DollarSign, bg: "from-[#06b6d4]/10 to-transparent" },
              { label: "Net Profit", val: profit, color: profit >= 0 ? "text-[#10b981]" : "text-[#f43f5e]", icon: TrendingUp, bg: profit >= 0 ? "from-[#10b981]/10 to-transparent" : "from-[#f43f5e]/10 to-transparent" },
              { label: "ရရန်ရှိ (Customer Credit)", val: totalCustomerDebt, color: "text-[#f43f5e]", icon: CreditCard, bg: "from-[#f43f5e]/10 to-transparent" },
              { label: "ပေးရန်ရှိ (Supplier Credit)", val: totalSupplierDebt, color: "text-[#f59e0b]", icon: MinusCircle, bg: "from-[#f59e0b]/10 to-transparent" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02, y: -2 }}
                className={`bg-gradient-to-br ${stat.bg} bg-[#0f172a] rounded-xl p-4 border border-[rgba(6,182,212,0.15)] transition-all duration-200 group`}
              >
                <div className="flex justify-between items-start">
                  <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                  <stat.icon size={16} className={`${stat.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
                </div>
                <p className={`text-xl font-black ${stat.color}`}>{fmt(stat.val)} Ks</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <motion.div variants={itemVars} className="lg:col-span-2 bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-[#06b6d4]"/> Sales Trend & Net Profit (7 Days)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(6,182,212,0.1)" strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                    <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                    <Tooltip
                      contentStyle={{background:'#060816',border:'1px solid rgba(6,182,212,0.3)',borderRadius:'8px'}}
                      itemStyle={{fontSize:'12px'}}
                      labelStyle={{display:'none'}}
                      formatter={(value) => [`${fmt(value)} Ks`, '']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" name="Sales" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="Net Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Daily Summary */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)] space-y-4">
              <h2 className="text-sm font-black mb-2 border-b border-white/5 pb-2 flex items-center gap-2"><Calendar size={16} className="text-[#06b6d4]"/> Daily Operations Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Avg Order Value</span>
                  <span className="font-bold text-[#06b6d4]">{fmt(dailySummary.avgOrder)} Ks</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Peak Hour</span>
                  <span className="font-bold text-white flex items-center gap-1"><Clock3 size={10} className="text-[#06b6d4]"/>{dailySummary.bestHour}</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Top Category</span>
                  <span className="font-bold text-[#10b981]">{dailySummary.bestCategory}</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Customer Count</span>
                  <span className="font-bold text-white">{dailySummary.customers}</span>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">🏆 Top Selling Products</h2>
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-xl">
                  No products sold yet
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.01, x: 4 }}
                      className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-[#06b6d4]/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#06b6d4]/20 flex items-center justify-center text-xs font-bold text-[#06b6d4]">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{p.name}</p>
                          <p className="text-[10px] text-slate-400">Units Sold: {p.qty}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#06b6d4]">{fmt(p.revenue)} Ks</p>
                        <p className="text-[10px] text-[#10b981]">Profit: +{fmt(p.profit)} Ks</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent Transactions */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">💳 Recent Transactions</h2>
              {recentSales.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-xl">
                  No transactions recorded
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto scrollbar-hide pr-1">
                  {recentSales.map((sale, i) => {
                    const isCredit = sale.paymentMethod?.toLowerCase() === 'credit' || (Number(sale.remainingDebt) > 0);
                    return (
                      <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-[#06b6d4]/30 transition-all">
                        <div>
                          <p className="text-sm font-bold text-white">{sale.personName || 'Walk-in Customer'}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(getTimestamp(sale)).toLocaleTimeString()} • {(sale.itemsDetail || sale.items || []).length} items
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="text-sm font-black text-white">{fmt(sale.amount)} Ks</p>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                            isCredit
                              ? 'bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/30'
                              : 'bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/30'
                          }`}>
                            {sale.paymentMethod || 'Cash'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alerts */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-[#f59e0b]"/> Inventory Stock Alerts</h2>
              {lowStock.length === 0 ? (
                <div className="py-6 text-center text-[#10b981] text-xs bg-[#10b981]/10 rounded-xl border border-[#10b981]/20 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
                  All product inventory levels are healthy.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto scrollbar-hide pr-2">
                  {lowStock.map(p => {
                    const stockBaseVal = Number(p.stockBase) ?? Number(p.stock) ?? 0;
                    const daysLeft = getDaysRemaining(stockBaseVal, avgDailyUsage[p.id] || avgDailyUsage[p.name]);
                    return (
                      <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border ${getStockColor(stockBaseVal)}`}>
                        <div>
                          <p className="text-sm font-bold text-white">{p.name}</p>
                          <p className="text-[10px] opacity-80">Current Stock: {stockBaseVal} (Min: {p.minStock || 5})</p>
                          {daysLeft !== 'N/A' && daysLeft <= 7 && (
                            <p className="text-[9px] text-[#f59e0b] mt-1 font-bold">⚠️ Approx. ~{daysLeft} days of stock remaining</p>
                          )}
                        </div>
                        <button type="button" onClick={() => window.location.href = '/inventory'} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all hover:scale-105 text-white">
                          Restock
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* AI Insights */}
            <motion.div variants={itemVars} className="bg-gradient-to-br from-indigo-900/30 to-[#0f172a] rounded-2xl p-5 border border-indigo-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={100} className="text-indigo-400"/></div>
              <h2 className="text-sm font-black text-indigo-400 mb-4 relative z-10 flex items-center gap-2">🧠 AI Predictive Data Forecast</h2>
              <div className="space-y-3 relative z-10">
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#10b981] transition-all">
                  <p className="text-[11px] text-slate-400">Daily Sales Revenue Forecast</p>
                  <p className="text-sm font-bold text-white">Expected ~{fmt(dailySummary.avgOrder * 1.2)} Ks execution target based on automated velocity tracking.</p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#06b6d4] transition-all">
                  <p className="text-[11px] text-slate-400">Smart Sourcing Advisory</p>
                  <p className="text-sm font-bold text-white">
                    {topProducts[0]?.name ? `"${topProducts[0].name}" generates optimal yield velocity. Maintain warehouse priority.` : 'Analyzing sales inventory cycles...'}
                  </p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#f59e0b] transition-all">
                  <p className="text-[11px] text-slate-400">Expense Anomaly Monitoring</p>
                  <p className="text-sm font-bold text-white">
                    {totalExpenses > totalSales * 0.4 ? '⚠️ Overhead threshold exceeded 40% of standard top-line performance.' : '✅ Operational expenses are safely scaled within margin parameters.'}
                  </p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#f43f5e] transition-all">
                  <p className="text-[11px] text-slate-400">Profit Health Metric</p>
                  <p className="text-sm font-bold text-white">
                    {Number(profitMargin) < 15 ? '⚠️ Operational margins compressed. Review row discount distribution profiles.' : `✅ Safe operational execution. Net baseline margin sustained at ${profitMargin}%.`}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
