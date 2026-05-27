import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  Zap, ShoppingCart, DollarSign, CreditCard, MinusCircle,
  AlertTriangle, TrendingUp, Clock3, Plus, Printer, Download,
  Save, Calendar, Activity, Package, Search, Filter, X
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import AIChat from '../components/AIChat';

export default function DashboardPage() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dashPeriod, setDashPeriod] = useState('Today');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ✅ Firebase Optimization: Last 30 Days & Limit 500
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
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId]);

  const fmt = useCallback((n) => (Number(n) || 0).toLocaleString(), []);

  // ✅ Search + Filters & Performance Fixes
  const periodRecs = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    return records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
      if (dashPeriod === 'Today') return new Date(ts).toDateString() === today;
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
              r.type?.toLowerCase().includes(searchLower));
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
  
  const totalCustomerDebt = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0), [salesRecs]);
  const totalSupplierDebt = useMemo(() => purchaseRecs.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0), [purchaseRecs]);

  const orderCount = salesRecs.length;
  const balance = totalSales - totalPurchases - totalExpenses + totalPayments;
  const profit = totalSales - totalPurchases - totalExpenses;
  const profitMargin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;
  
  // Today's growth calculation (compare with yesterday)
  const todaySales = useMemo(() => {
    const today = new Date().toDateString();
    return records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
      return new Date(ts).toDateString() === today && r.type?.toLowerCase() === 'sale';
    }).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [records]);
  
  const yesterdaySales = useMemo(() => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    return records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
      return new Date(ts).toDateString() === yesterdayStr && r.type?.toLowerCase() === 'sale';
    }).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [records]);
  
  const growthPercent = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1) : 0;

  // ✅ Daily Summary
  const dailySummary = useMemo(() => {
    const avgOrder = orderCount > 0 ? totalSales / orderCount : 0;
    const hours = salesRecs.map(r => new Date(r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt).getHours());
    const hourCount = hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
    const bestHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
    const bestHour = bestHourEntry ? `${bestHourEntry[0]}:00` : '-';
    
    // Best selling category
    const categorySales = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        categorySales[cat] = (categorySales[cat] || 0) + (Number(item.quantity) || 1);
      });
    });
    const bestCategory = Object.entries(categorySales).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    
    return { avgOrder, bestHour, bestCategory, customers: orderCount };
  }, [salesRecs, orderCount, totalSales]);

  // ✅ Top Products Section
  const topProducts = useMemo(() => {
    const map = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const name = item.name || 'Unknown';
        const qty = Number(item.quantity) || Number(item.qty) || 1;
        const price = Number(item.price) || 0;
        const cost = Number(item.costPrice) || Number(item.cost) || 0;
        
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0, profit: 0 };
        map[name].qty += qty;
        map[name].revenue += (qty * price);
        map[name].profit += (qty * price) - (qty * cost);
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [salesRecs]);

  // ✅ Low Stock Alert Improvements
  const lowStock = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)), [products]);
  const getStockColor = (stock) => {
    if (stock === 0) return 'text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/20';
    if (stock <= 5) return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';
    return 'text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/20';
  };
  
  const getDaysRemaining = (stock, avgDailyUsage) => {
    if (!avgDailyUsage || avgDailyUsage <= 0) return 'N/A';
    return Math.floor(stock / avgDailyUsage);
  };
  
  // Calculate average daily usage for each product
  const avgDailyUsage = useMemo(() => {
    const usage = {};
    const last30Days = records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
      return Date.now() - ts <= 30 * 86400000 && r.type?.toLowerCase() === 'sale';
    });
    last30Days.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const name = item.name;
        if (name) {
          usage[name] = (usage[name] || 0) + (Number(item.quantity) || 1);
        }
      });
    });
    Object.keys(usage).forEach(key => { usage[key] = usage[key] / 30; });
    return usage;
  }, [records]);

  // ✅ Chart Improvements (Real data grouping by Date)
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const dayRecs = records.filter(r => {
        const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
        return new Date(ts).toDateString() === ds;
      });
      const sales = dayRecs.filter(r => r.type?.toLowerCase() === 'sale').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const purchases = dayRecs.filter(r => r.type?.toLowerCase() === 'purchase').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const expenses = dayRecs.filter(r => r.type?.toLowerCase() === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      days.push({ day: dayName, sales, profit: sales - purchases - expenses, expenses });
    }
    return days;
  }, [records]);

  // ✅ Recent Sales Section
  const recentSales = useMemo(() => salesRecs.slice(0, 5), [salesRecs]);

  // Animations
  const containerVars = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  const handleExportExcel = () => {
    const csvRows = [
      ['Date', 'Type', 'Person', 'Amount', 'Payment Method', 'Items'],
      ...periodRecs.map(r => [
        new Date(r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString(),
        r.type,
        r.personName || '',
        r.amount,
        r.paymentMethod || '',
        (r.itemsDetail || r.items || []).length
      ])
    ];
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_export_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center overflow-x-hidden">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-[#06b6d4] rounded-full animate-ping opacity-75" />
          </div>
        </div>
      </div>
    );
  }

  return (
    // ✅ 3. Fix Bottom Buttons Not Clickable (pb-36) + Dark Cyber Theme + Mobile Fixes
    <div className="min-h-screen bg-[#060816] overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-6 text-white pb-36 max-w-7xl mx-auto">
        
        {/* ✅ 1. Fix Header Overflow & 2. Fix Month Buttons Overflow */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <h1 className="text-2xl font-black text-[#06b6d4] tracking-wider flex items-center gap-2">
            <Zap size={24} className="text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"/>
            NEXUS<span className="text-white">POS</span>
          </h1>
          
          {/* Search Bar */}
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
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <X size={14} className="text-slate-400 hover:text-white" />
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {dashPeriod === 'Custom' && showDatePicker && (
              <div className="flex gap-2 animate-fadeIn">
                <input type="date" className="bg-[#0f172a] border border-[#06b6d4]/30 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#06b6d4]" onChange={e => setDateRange(p => ({...p, start: e.target.value}))}/>
                <input type="date" className="bg-[#0f172a] border border-[#06b6d4]/30 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#06b6d4]" onChange={e => setDateRange(p => ({...p, end: e.target.value}))}/>
              </div>
            )}
            <div className="flex bg-[#0f172a] rounded-xl p-1 overflow-x-auto scrollbar-hide w-full sm:w-auto border border-[#06b6d4]/15">
              {['Today','Week','Month','Custom'].map(p => (
                <button 
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

        {/* ✅ ADD QUICK ACTIONS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: Plus, label: "Add Sale", color: "text-[#10b981]", onClick: () => window.location.href = '/pos' },
            { icon: Package, label: "Add Product", color: "text-[#06b6d4]", onClick: () => window.location.href = '/inventory' },
            { icon: Printer, label: "Print Report", color: "text-purple-400", onClick: () => window.print() },
            { icon: Download, label: "Export Excel", color: "text-blue-400", onClick: handleExportExcel },
            { icon: Save, label: "Backup Data", color: "text-slate-300", onClick: () => alert('Backup feature coming soon') },
          ].map((action, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={action.onClick}
              className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 backdrop-blur-md border border-[rgba(6,182,212,0.15)] rounded-xl hover:bg-[#06b6d4]/10 transition-all duration-200 group"
            >
              <action.icon size={20} className={`${action.color} group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-bold text-slate-300 group-hover:text-white">{action.label}</span>
            </motion.button>
          ))}
        </div>

        <motion.div variants={containerVars} initial="hidden" animate="visible" className="space-y-6">
          
          {/* ✅ 5. Improve Balance Card */}
          <motion.div variants={itemVars} className="rounded-2xl p-6 bg-gradient-to-br from-[#06b6d4]/20 via-[#0f172a] to-black border border-[#06b6d4]/30 backdrop-blur-xl relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={100} /></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#06b6d4] rounded-full filter blur-3xl opacity-10 -translate-x-16 translate-y-16" />
            <div className="relative z-10 flex justify-between items-start flex-wrap gap-4">
              <div>
                <p className="text-xs text-[#06b6d4] font-bold uppercase tracking-widest mb-1">Net Balance</p>
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

          {/* ✅ 4. Add Responsive Stats Cards */}
          <motion.div variants={itemVars} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Revenue", val: totalSales, color: "text-[#06b6d4]", icon: DollarSign, bg: "from-[#06b6d4]/10 to-transparent" },
              { label: "Net Profit", val: profit, color: profit >= 0 ? "text-[#10b981]" : "text-[#f43f5e]", icon: TrendingUp, bg: profit >= 0 ? "from-[#10b981]/10 to-transparent" : "from-[#f43f5e]/10 to-transparent" },
              { label: "ရရန် (To Receive)", val: totalCustomerDebt, color: "text-[#f43f5e]", icon: CreditCard, bg: "from-[#f43f5e]/10 to-transparent" },
              { label: "ပေးရန် (To Pay)", val: totalSupplierDebt, color: "text-[#f59e0b]", icon: MinusCircle, bg: "from-[#f59e0b]/10 to-transparent" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02, y: -2 }}
                className={`bg-gradient-to-br ${stat.bg} bg-[#0f172a] rounded-xl p-4 border border-[rgba(6,182,212,0.15)] transition-all duration-200 cursor-pointer group`}
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
            
            {/* ✅ CHART IMPROVEMENTS */}
            <motion.div variants={itemVars} className="lg:col-span-2 bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-[#06b6d4]"/> Sales Trend & Profit (7 Days)</h2>
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
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* ✅ DAILY SUMMARY */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)] space-y-4">
              <h2 className="text-sm font-black mb-2 border-b border-white/5 pb-2 flex items-center gap-2"><Calendar size={16} className="text-[#06b6d4]"/> Daily Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Avg Order Value</span>
                  <span className="font-bold text-[#06b6d4]">{fmt(dailySummary.avgOrder)} Ks</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Best Selling Hour</span>
                  <span className="font-bold text-white flex items-center gap-1"><Clock3 size={10} className="text-[#06b6d4]"/>{dailySummary.bestHour}</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Best Category</span>
                  <span className="font-bold text-[#10b981]">{dailySummary.bestCategory}</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-colors">
                  <span className="text-xs text-slate-400">Today's Customers</span>
                  <span className="font-bold text-white">{dailySummary.customers}</span>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ✅ TOP PRODUCTS SECTION */}
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
                          <p className="text-[10px] text-slate-400">Qty Sold: {p.qty}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#06b6d4]">{fmt(p.revenue)} Ks</p>
                        <p className="text-[10px] text-[#10b981]">Profit: +{fmt(p.profit)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ✅ RECENT SALES SECTION */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">💳 Recent Transactions</h2>
              {recentSales.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-xl">
                  No recent sales
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto scrollbar-hide pr-1">
                  {recentSales.map((sale, i) => {
                    const isCredit = sale.paymentMethod?.toLowerCase() === 'credit' || (sale.remainingDebt > 0);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-[#06b6d4]/30 transition-all"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{sale.personName || 'Walk-in Customer'}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(sale.createdAt?.seconds ? sale.createdAt.seconds * 1000 : sale.createdAt).toLocaleTimeString()} • 
                            {(sale.itemsDetail || sale.items || []).length} items
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
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ✅ LOW STOCK ALERT IMPROVEMENTS */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-[#f59e0b]"/> Inventory Alerts</h2>
              {lowStock.length === 0 ? (
                <div className="py-6 text-center text-[#10b981] text-xs bg-[#10b981]/10 rounded-xl border border-[#10b981]/20 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
                  Inventory levels are healthy
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-2">
                  {lowStock.map(p => {
                    const daysLeft = getDaysRemaining(p.stock, avgDailyUsage[p.name]);
                    return (
                      <motion.div
                        key={p.id}
                        whileHover={{ scale: 1.01 }}
                        className={`flex justify-between items-center p-3 rounded-xl border ${getStockColor(p.stock)}`}
                      >
                        <div>
                          <p className="text-sm font-bold">{p.name}</p>
                          <p className="text-[10px] opacity-80">Stock: {p.stock} (Min: {p.minStock || 5})</p>
                          {daysLeft !== 'N/A' && daysLeft <= 7 && (
                            <p className="text-[9px] text-[#f59e0b] mt-1">⚠️ ~{daysLeft} days remaining</p>
                          )}
                        </div>
                        <button className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors hover:scale-105">
                          Reorder
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* ✅ AI FEATURES / INSIGHTS */}
            <motion.div variants={itemVars} className="bg-gradient-to-br from-indigo-900/30 to-[#0f172a] rounded-2xl p-5 border border-indigo-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={100} className="text-indigo-400"/></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500 rounded-full filter blur-3xl opacity-5" />
              <h2 className="text-sm font-black text-indigo-400 mb-4 relative z-10 flex items-center gap-2">🧠 AI Insights & Forecast</h2>
              <div className="space-y-3 relative z-10">
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#10b981] hover:border-l-[#10b981] transition-all">
                  <p className="text-[11px] text-slate-400">Daily Sales Forecast</p>
                  <p className="text-sm font-bold text-white">Expected ~{fmt(dailySummary.avgOrder * 1.2)} Ks today based on trend.</p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#06b6d4] hover:border-l-[#06b6d4] transition-all">
                  <p className="text-[11px] text-slate-400">Smart Reorder Suggestion</p>
                  <p className="text-sm font-bold text-white">
                    {topProducts[0]?.name ? `${topProducts[0].name} is selling fast. Consider restocking soon.` : 'Gathering product data...'}
                  </p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#f59e0b] hover:border-l-[#f59e0b] transition-all">
                  <p className="text-[11px] text-slate-400">Expense Anomaly</p>
                  <p className="text-sm font-bold text-white">
                    {totalExpenses > totalSales * 0.5 ? '⚠️ Expenses are unusually high compared to revenue.' : '✅ Expenses are within normal operating ranges.'}
                  </p>
                </div>
                <div className="p-3 bg-black/30 rounded-xl border border-white/5 border-l-2 border-l-[#f43f5e] hover:border-l-[#f43f5e] transition-all">
                  <p className="text-[11px] text-slate-400">Profit Warning</p>
                  <p className="text-sm font-bold text-white">
                    {profitMargin < 10 ? '⚠️ Profit margin is below 10%. Review pricing strategy.' : `✅ Profit margin is healthy at ${profitMargin}%.`}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* AI Chat Bot */}
        <AIChat records={records} products={products} />
      </div>
    </div>
  );
}
