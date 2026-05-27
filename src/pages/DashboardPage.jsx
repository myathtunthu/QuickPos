import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  Zap, ShoppingCart, DollarSign, CreditCard, MinusCircle,
  AlertTriangle, TrendingUp, Clock3, Plus, Printer, Download,
  Save, Calendar, Activity, Package
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

  // Firebase Optimization - Last 30 days
  useEffect(() => {
    if (!tenantId) {
      setDataLoading(false);
      return;
    }

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
    const q = query(
      collection(db, 'pos_products'),
      where('tenantId', '==', tenantId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenantId]);

  const fmt = useCallback((n) => (Number(n) || 0).toLocaleString(), []);

  // Period Filter
  const periodRecs = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();

    return records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
      
      if (dashPeriod === 'Today') return new Date(ts).toDateString() === today;
      if (dashPeriod === 'Week') return now - ts <= 7 * 86400000;
      if (dashPeriod === 'Month') return now - ts <= 30 * 86400000;
      if (dashPeriod === 'Custom' && dateRange.start && dateRange.end) {
        const startTime = new Date(dateRange.start).getTime();
        const endTime = new Date(dateRange.end).getTime() + 86399999;
        return ts >= startTime && ts <= endTime;
      }
      return true;
    });
  }, [records, dashPeriod, dateRange]);

  const salesRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'sale'), [periodRecs]);
  const purchaseRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'purchase'), [periodRecs]);
  const expenseRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'expense'), [periodRecs]);

  const totalSales = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [salesRecs]);
  const totalPurchases = useMemo(() => purchaseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [purchaseRecs]);
  const totalExpenses = useMemo(() => expenseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [expenseRecs]);

  const totalCustomerDebt = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0), [salesRecs]);
  const totalSupplierDebt = useMemo(() => purchaseRecs.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0), [purchaseRecs]);

  const orderCount = salesRecs.length;
  const balance = totalSales - totalPurchases - totalExpenses;
  const profit = totalSales - totalPurchases - totalExpenses;
  const profitMargin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;

  // Daily Summary
  const dailySummary = useMemo(() => {
    const avgOrder = orderCount > 0 ? totalSales / orderCount : 0;
    const hours = salesRecs.map(r => 
      new Date(r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt).getHours()
    );
    const bestHour = hours.length > 0 
      ? `${hours.sort((a,b) => hours.filter(v => v===a).length - hours.filter(v => v===b).length).pop()}:00` 
      : '-';

    return { avgOrder, bestHour, customers: orderCount };
  }, [salesRecs, orderCount, totalSales]);

  // Top Products
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
        map[name].revenue += qty * price;
        map[name].profit += (qty * price) - (qty * cost);
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [salesRecs]);

  // Low Stock
  const lowStock = useMemo(() => 
    products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)), 
  [products]);

  const getStockColor = (stock) => {
    if (stock === 0) return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    if (stock <= 5) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20';
  };

  // 7-Day Trend
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];

      const dayRecs = records.filter(r => {
        const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
        return new Date(ts).toDateString() === ds;
      });

      const sales = dayRecs.filter(r => r.type?.toLowerCase() === 'sale')
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const purchases = dayRecs.filter(r => r.type?.toLowerCase() === 'purchase')
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const expenses = dayRecs.filter(r => r.type?.toLowerCase() === 'expense')
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);

      days.push({
        day: dayName,
        sales,
        profit: sales - purchases - expenses,
        expenses
      });
    }
    return days;
  }, [records]);

  const recentSales = useMemo(() => salesRecs.slice(0, 5), [salesRecs]);

  const containerVars = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center overflow-x-hidden">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060816] overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-6 text-white pb-36 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <h1 className="text-3xl font-black text-cyan-400 tracking-wider flex items-center gap-3">
            <Zap size={28} className="drop-shadow-[0_0_12px_rgb(6,182,212)]"/>
            NEXUS<span className="text-white">POS</span>
          </h1>

          <div className="flex flex-col sm:flex-row gap-3">
            {dashPeriod === 'Custom' && (
              <div className="flex gap-2">
                <input type="date" className="bg-[#0f172a] border border-cyan-500/30 rounded-lg px-3 py-2 text-sm" 
                  onChange={e => setDateRange(p => ({...p, start: e.target.value}))} />
                <input type="date" className="bg-[#0f172a] border border-cyan-500/30 rounded-lg px-3 py-2 text-sm" 
                  onChange={e => setDateRange(p => ({...p, end: e.target.value}))} />
              </div>
            )}

            <div className="flex bg-[#0f172a] rounded-xl p-1 overflow-x-auto scrollbar-hide w-full sm:w-auto border border-cyan-500/15">
              {['Today', 'Week', 'Month', 'Custom'].map(p => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  className={`min-w-[80px] px-5 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${
                    dashPeriod === p 
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.6)]' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: Plus, label: "Add Sale", color: "text-emerald-400" },
            { icon: Package, label: "Add Product", color: "text-cyan-400" },
            { icon: Printer, label: "Print Report", color: "text-purple-400" },
            { icon: Download, label: "Export Excel", color: "text-blue-400" },
            { icon: Save, label: "Backup Data", color: "text-slate-300" },
          ].map((action, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 backdrop-blur-xl border border-cyan-500/15 rounded-2xl hover:border-cyan-500/40 hover:bg-white/10 transition-all"
            >
              <action.icon size={22} className={action.color} />
              <span className="text-xs font-bold text-slate-300">{action.label}</span>
            </motion.button>
          ))}
        </div>

        <motion.div variants={containerVars} initial="hidden" animate="visible" className="space-y-6">
          
          {/* Balance Card */}
          <motion.div variants={itemVars} className="rounded-3xl p-8 bg-gradient-to-br from-cyan-600/20 via-slate-900 to-black border border-cyan-500/30 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-4 right-4 opacity-10">
              <Activity size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Net Balance</p>
              <h2 className="text-5xl font-black text-white mt-2">{fmt(balance)} Ks</h2>
              <div className="flex gap-6 mt-4">
                <span className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {profitMargin}% Margin
                </span>
                <span className="text-sm text-slate-400">{orderCount} Orders</span>
              </div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVars} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Revenue", val: totalSales, color: "text-cyan-400" },
              { label: "Net Profit", val: profit, color: profit >= 0 ? "text-emerald-400" : "text-rose-400" },
              { label: "ရရန် (To Receive)", val: totalCustomerDebt, color: "text-rose-400" },
              { label: "ပေးရန် (To Pay)", val: totalSupplierDebt, color: "text-amber-400" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.02 }}
                className="bg-[#0f172a] rounded-2xl p-5 border border-cyan-500/15 hover:border-cyan-500/40 transition-all"
              >
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className={`text-2xl font-black mt-1 ${stat.color}`}>{fmt(stat.val)} Ks</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart */}
            <motion.div variants={itemVars} className="lg:col-span-2 bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-3">
                <TrendingUp className="text-cyan-400" /> Sales & Profit Trend
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(6,182,212,0.08)" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #06b6d4', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={3} fill="url(#salesGrad)" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Daily Summary */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="text-lg font-bold mb-5">📅 Daily Summary</h2>
              <div className="space-y-4">
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-slate-400">Average Order Value</p>
                  <p className="text-2xl font-black text-cyan-400 mt-1">{fmt(dailySummary.avgOrder)} Ks</p>
                </div>
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-slate-400">Best Hour</p>
                  <p className="text-2xl font-black text-white mt-1">{dailySummary.bestHour}</p>
                </div>
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-slate-400">Customers Today</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{dailySummary.customers}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Top Products + Recent Sales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="text-lg font-bold mb-5">🏆 Top Selling Products</h2>
              {topProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No sales recorded yet</div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all">
                      <div>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-xs text-slate-400">Qty: {p.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-cyan-400">{fmt(p.revenue)} Ks</p>
                        <p className="text-xs text-emerald-400">+{fmt(p.profit)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent Sales */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="text-lg font-bold mb-5">💳 Recent Sales</h2>
              {recentSales.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No recent transactions</div>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((sale, i) => {
                    const isCredit = sale.paymentMethod?.toLowerCase() === 'credit' || sale.remainingDebt > 0;
                    return (
                      <div key={i} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                        <div>
                          <p className="font-bold">{sale.personName || 'Walk-in'}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(sale.createdAt?.seconds * 1000 || sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
                            {(sale.itemsDetail || sale.items || []).length} items
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black">{fmt(sale.amount)} Ks</p>
                          <span className={`text-[10px] px-3 py-1 rounded-full font-bold ${isCredit ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
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

          {/* Low Stock + AI Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                <AlertTriangle className="text-amber-400" /> Low Stock Alerts
              </h2>
              {lowStock.length === 0 ? (
                <div className="py-10 text-center text-emerald-400 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  All inventory levels are healthy
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto scrollbar-hide">
                  {lowStock.map(p => (
                    <div key={p.id} className={`flex justify-between items-center p-4 rounded-2xl border ${getStockColor(p.stock)}`}>
                      <div>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-xs opacity-75">Stock: {p.stock} • Min: {p.minStock}</p>
                      </div>
                      <button className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">
                        Reorder
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* AI Insights */}
            <motion.div variants={itemVars} className="bg-gradient-to-br from-indigo-950/50 to-[#0f172a] rounded-3xl p-6 border border-indigo-500/30 relative overflow-hidden">
              <h2 className="text-lg font-bold mb-5 text-indigo-400">🧠 AI Insights</h2>
              <div className="space-y-4">
                <div className="p-4 bg-black/40 rounded-2xl border-l-4 border-emerald-400">
                  <p className="text-xs text-slate-400">Forecast</p>
                  <p className="text-sm font-medium">Expected sales today: ~{fmt(dailySummary.avgOrder * 1.25)} Ks</p>
                </div>
                <div className="p-4 bg-black/40 rounded-2xl border-l-4 border-cyan-400">
                  <p className="text-xs text-slate-400">Recommendation</p>
                  <p className="text-sm font-medium">
                    {topProducts[0] ? `${topProducts[0].name} is trending. Consider restocking.` : 'Collecting more data...'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <AIChat records={records} products={products} />
      </div>
    </div>
  );
}
