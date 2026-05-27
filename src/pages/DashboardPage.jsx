import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  Zap, TrendingUp, AlertTriangle, Plus, Printer, Download, Save, Package
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
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

  // Firebase - Last 30 days only
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
    const q = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
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
        const start = new Date(dateRange.start).getTime();
        const end = new Date(dateRange.end).getTime() + 86399999;
        return ts >= start && ts <= end;
      }
      return true;
    });
  }, [records, dashPeriod, dateRange]);

  const salesRecs = useMemo(() => periodRecs.filter(r => r.type?.toLowerCase() === 'sale'), [periodRecs]);

  const totalSales = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [salesRecs]);
  const orderCount = salesRecs.length;
  const profit = totalSales; // ယာယီ (လိုအပ်ရင် ပိုမိုတွက်ချက်နိုင်ပါတယ်)
  const profitMargin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;

  // Top Products
  const topProducts = useMemo(() => {
    const map = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const name = item.name || 'Unknown';
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
        map[name].qty += qty;
        map[name].revenue += qty * price;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [salesRecs]);

  // Low Stock
  const lowStock = useMemo(() => 
    products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)), 
  [products]);

  // 7-Day Chart Data
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];

      const daySales = records
        .filter(r => {
          const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt || 0;
          return new Date(ts).toDateString() === ds && r.type?.toLowerCase() === 'sale';
        })
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      days.push({ day: dayName, sales: daySales });
    }
    return days;
  }, [records]);

  const containerVars = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060816] overflow-x-hidden pb-20">
      <div className="p-4 sm:p-6 space-y-6 text-white max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <h1 className="text-3xl font-black text-cyan-400 flex items-center gap-3">
            <Zap size={28} className="drop-shadow-[0_0_12px_#06b6d4]" />
            NEXUS POS
          </h1>

          <div className="flex gap-3">
            {dashPeriod === 'Custom' && (
              <div className="flex gap-2">
                <input type="date" className="bg-[#0f172a] border border-cyan-500/30 rounded-lg px-3 py-2 text-sm" onChange={e => setDateRange(p => ({...p, start: e.target.value}))} />
                <input type="date" className="bg-[#0f172a] border border-cyan-500/30 rounded-lg px-3 py-2 text-sm" onChange={e => setDateRange(p => ({...p, end: e.target.value}))} />
              </div>
            )}
            <div className="flex bg-[#0f172a] rounded-xl p-1 overflow-x-auto scrollbar-hide border border-cyan-500/20">
              {['Today','Week','Month','Custom'].map(p => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  className={`min-w-[78px] px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${dashPeriod === p ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
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
            { icon: Download, label: "Export", color: "text-blue-400" },
            { icon: Save, label: "Backup", color: "text-slate-300" },
          ].map((act, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.05 }}
              className="bg-[#0f172a] border border-cyan-500/20 hover:border-cyan-500 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all"
            >
              <act.icon size={24} className={act.color} />
              <span className="text-xs font-bold">{act.label}</span>
            </motion.button>
          ))}
        </div>

        <motion.div variants={containerVars} initial="hidden" animate="visible" className="space-y-6">
          
          {/* Balance Card */}
          <motion.div variants={itemVars} className="bg-gradient-to-br from-cyan-600/20 to-black border border-cyan-500/30 rounded-3xl p-8 backdrop-blur-xl">
            <p className="text-cyan-400 text-sm font-bold uppercase tracking-widest">Net Balance</p>
            <h2 className="text-5xl font-black text-white mt-2">{fmt(totalSales)} Ks</h2>
            <p className="text-emerald-400 text-sm mt-2">{profitMargin}% Margin • {orderCount} Orders</p>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVars} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Today's Revenue", value: totalSales, color: "text-cyan-400" },
              { label: "Orders", value: orderCount, color: "text-white" },
              { label: "Top Product", value: topProducts[0]?.name?.slice(0,15) || "N/A", color: "text-emerald-400" },
            ].map((s, i) => (
              <div key={i} className="bg-[#0f172a] rounded-2xl p-5 border border-cyan-500/15 hover:scale-105 transition-all">
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className={`text-2xl font-black mt-2 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </motion.div>

          {/* Chart */}
          <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-cyan-400"/> 7 Days Sales Trend</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="rgba(6,182,212,0.1)" />
                  <XAxis dataKey="day" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #06b6d4' }} />
                  <Area type="monotone" dataKey="sales" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top Products & Low Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="font-bold mb-4">🏆 Top Selling Products</h2>
              {topProducts.length === 0 ? <p className="text-slate-500 py-8 text-center">No sales yet</p> : (
                topProducts.map((p,i) => (
                  <div key={i} className="flex justify-between py-3 border-b border-white/5 last:border-none">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.qty} sold</p>
                    </div>
                    <p className="text-cyan-400 font-bold">{fmt(p.revenue)} Ks</p>
                  </div>
                ))
              )}
            </motion.div>

            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-3xl p-6 border border-cyan-500/15">
              <h2 className="font-bold mb-4 flex items-center gap-2"><AlertTriangle className="text-amber-400"/> Low Stock</h2>
              {lowStock.length === 0 ? (
                <p className="text-emerald-400 py-8 text-center">Stock is healthy</p>
              ) : (
                lowStock.slice(0,5).map(p => (
                  <div key={p.id} className="flex justify-between items-center py-3 border-b border-white/5">
                    <div>
                      <p>{p.name}</p>
                      <p className="text-xs text-amber-400">Stock: {p.stock}</p>
                    </div>
                    <button className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg">Reorder</button>
                  </div>
                ))
              )}
            </motion.div>
          </div>
        </motion.div>

        <AIChat records={records} products={products} />
      </div>
    </div>
  );
}
