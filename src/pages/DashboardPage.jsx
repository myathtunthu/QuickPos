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

// 🌟 Date အတိအကျရရန် Records Page နည်းတူ တွက်ချက်ခြင်း (Import Error ဖြေရှင်းပြီး)
function getRecordDateISO(r) {
  if (r.date && r.date.includes('-')) return r.date;
  if (r.date && r.date.includes('/')) {
    const parts = r.date.split(',')[0].split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : r.createdAt;
  if (ts && !isNaN(Number(ts))) {
    const d = new Date(Number(ts));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  // Realtime Data Fetching
  useEffect(() => {
    if (!tenantId) { setDataLoading(false); return; }
    const q = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'), limit(1000));
    const unsub = onSnapshot(q, (snap) => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setDataLoading(false); }, (err) => { console.error(err); setDataLoading(false); });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const unsubProd = onSnapshot(query(collection(db, 'pos_products'), where('tenantId', '==', tenantId)), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCust = onSnapshot(query(collection(db, 'pos_customers'), where('tenantId', '==', tenantId)), (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSupp = onSnapshot(query(collection(db, 'pos_suppliers'), where('tenantId', '==', tenantId)), (snap) => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubProd(); unsubCust(); unsubSupp(); };
  }, [tenantId]);

  const fmt = (n) => (Number(n) || 0).toLocaleString();

  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = p; });
    return map;
  }, [products]);

  // 🌟 မှန်ကန်သော Date ဖြင့် စစ်ထုတ်ခြင်း
  const periodRecs = useMemo(() => {
    const d = new Date();
    const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const getPastDateISO = (days) => {
      const past = new Date(); past.setDate(past.getDate() - days);
      return `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    };

    const weekAgoISO = getPastDateISO(7);
    const monthAgoISO = getPastDateISO(30);

    return records.filter(r => {
      const rISO = getRecordDateISO(r);
      if (dashPeriod === 'Today') return rISO === todayISO;
      if (dashPeriod === 'Week') return rISO >= weekAgoISO && rISO <= todayISO;
      if (dashPeriod === 'Month') return rISO >= monthAgoISO && rISO <= todayISO;
      if (dashPeriod === 'Custom' && dateRange.start && dateRange.end) {
        return rISO >= dateRange.start && rISO <= dateRange.end;
      }
      return true;
    }).filter(r => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (r.personName?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q) || r.voucherNo?.toLowerCase().includes(q));
    });
  }, [records, dashPeriod, dateRange, searchTerm]);

  // Record Types
  const salesRecs = useMemo(() => periodRecs.filter(r => (r.type||'').toLowerCase() === 'sale'), [periodRecs]);
  const purchaseRecs = useMemo(() => periodRecs.filter(r => (r.type||'').toLowerCase() === 'purchase'), [periodRecs]);
  const expenseRecs = useMemo(() => periodRecs.filter(r => (r.type||'').toLowerCase() === 'expense'), [periodRecs]);
  const paymentInRecs = useMemo(() => periodRecs.filter(r => r.type === 'Customer Payment'), [periodRecs]);
  const paymentOutRecs = useMemo(() => periodRecs.filter(r => r.type === 'Supplier Payment'), [periodRecs]);

  // Totals
  const totalSales = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [salesRecs]);
  const totalPurchases = useMemo(() => purchaseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [purchaseRecs]);
  const totalExpenses = useMemo(() => expenseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [expenseRecs]);
  
  const cashIn = totalSales + paymentInRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const cashOut = totalPurchases + totalExpenses + paymentOutRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const cashFlowBalance = cashIn - cashOut;

  // COGS & Profit (True Net Profit)
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

  const netProfit = totalSales - totalCOGS - totalExpenses;
  const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : 0;
  const orderCount = salesRecs.length;

  // Debt Totals
  const totalCustomerDebt = useMemo(() => customers.reduce((sum, c) => sum + (Number(c.totalDebt) || 0), 0), [customers]);
  const totalSupplierDebt = useMemo(() => suppliers.reduce((sum, s) => sum + (Number(s.totalDebt) || 0), 0), [suppliers]);

  // Growth Calculation
  const getDailySales = (daysAgo) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    const targetISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return records.filter(r => getRecordDateISO(r) === targetISO && (r.type||'').toLowerCase() === 'sale')
                  .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  };
  const todaySales = getDailySales(0);
  const yesterdaySales = getDailySales(1);
  const growthPercent = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1) : 0;

  // Daily Summary (Hours & Categories)
  const dailySummary = useMemo(() => {
    const avgOrder = orderCount > 0 ? totalSales / orderCount : 0;
    const hours = salesRecs.map(r => {
      if (r.time) {
        const parts = r.time.split(' ');
        let [h] = parts[0].split(':'); h = parseInt(h, 10);
        if (parts[1] === 'PM' && h < 12) h += 12;
        if (parts[1] === 'AM' && h === 12) h = 0;
        return h;
      }
      return 12;
    });
    const hourCount = hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
    const bestHourEntry = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
    const bestHour = bestHourEntry ? `${bestHourEntry[0]}:00` : '-';

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

  // Top Products
  const topProducts = useMemo(() => {
    const map = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const prodId = item.productId || item.name;
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

  // Chart Data
  const chartData = useMemo(() => {
    const days = [];
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayName = dayNames[d.getDay()];

      const dayRecs = records.filter(r => getRecordDateISO(r) === ds);
      const daySalesRecs = dayRecs.filter(r => (r.type||'').toLowerCase() === 'sale');
      const sales = daySalesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      
      const dayCOGS = daySalesRecs.reduce((sum, r) => {
        return sum + (r.itemsDetail || r.items || []).reduce((s, item) => {
          const cost = Number(item.costPrice) || Number(productMap[item.productId]?.packageUnits?.[0]?.costPrice) || 0;
          return s + (cost * (Number(item.quantity) || 0));
        }, 0);
      }, 0);

      const expenses = dayRecs.filter(r => (r.type||'').toLowerCase() === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0);

      days.push({ day: dayName, sales, profit: sales - dayCOGS - expenses, expenses });
    }
    return days;
  }, [records, productMap]);

  const recentSales = useMemo(() => salesRecs.slice(0, 5), [salesRecs]);

  // Low Stock
  const lowStock = useMemo(() => products.filter(p => (Number(p.stockBase) ?? Number(p.stock) ?? 0) <= (Number(p.minStock) || 5)), [products]);
  const getStockColor = (s) => s <= 0 ? 'text-[#f43f5e] bg-[#f43f5e]/10' : s <= 5 ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-[#06b6d4] bg-[#06b6d4]/10';

  const containerVars = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#060816] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060816] overflow-x-hidden">
      <div className="p-4 sm:p-6 space-y-6 text-white pb-36 max-w-7xl mx-auto">
        
        {/* ─── HEADER & FILTER ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <h1 className="text-2xl font-black text-[#06b6d4] tracking-wider flex items-center gap-2">
            <Zap size={24} className="text-[#06b6d4] animate-pulse"/>
            <span className="font-black text-white">Quick POS</span>DASH
          </h1>

          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search transactions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0f172a] border border-[#06b6d4]/30 rounded-xl px-9 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#06b6d4]" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-slate-400 hover:text-white" /></button>}
          </div>

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
                  key={p} onClick={() => { setDashPeriod(p); setShowDatePicker(p === 'Custom'); }}
                  className={`min-w-[80px] px-4 py-2 text-xs font-bold rounded-lg transition-all ${dashPeriod === p ? 'bg-[#06b6d4] text-[#060816]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >{p}</button>
              ))}
            </div>
          </div>
        </div>

        <motion.div variants={containerVars} initial="hidden" animate="visible" className="space-y-6">
          
          {/* ─── CASH FLOW CARD ─── */}
          <motion.div variants={itemVars} className="rounded-2xl p-6 bg-gradient-to-br from-[#06b6d4]/20 via-[#0f172a] to-black border border-[#06b6d4]/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={100} /></div>
            <div className="relative z-10 flex justify-between items-start flex-wrap gap-4">
              <div>
                <p className="text-xs text-[#06b6d4] font-bold uppercase tracking-widest mb-1">ငွေဝင်ငွေထွက် (Cash Flow Balance)</p>
                <h2 className="text-4xl sm:text-5xl font-black text-white">{fmt(cashFlowBalance)} Ks</h2>
                <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold">
                  <span className={netProfit >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}>Profit Margin: {profitMargin}%</span>
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

          {/* ─── STATS CARDS ─── */}
          <motion.div variants={itemVars} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "အရောင်းစုစုပေါင်း (Revenue)", val: totalSales, color: "text-[#06b6d4]", icon: DollarSign, bg: "from-[#06b6d4]/10" },
              { label: "အသားတင်အမြတ် (Net Profit)", val: netProfit, color: netProfit >= 0 ? "text-[#10b981]" : "text-[#f43f5e]", icon: TrendingUp, bg: netProfit >= 0 ? "from-[#10b981]/10" : "from-[#f43f5e]/10" },
              { label: "ရရန်ရှိ (Customer Credit)", val: totalCustomerDebt, color: "text-[#f43f5e]", icon: CreditCard, bg: "from-[#f43f5e]/10" },
              { label: "ပေးရန်ရှိ (Supplier Credit)", val: totalSupplierDebt, color: "text-[#f59e0b]", icon: MinusCircle, bg: "from-[#f59e0b]/10" }
            ].map((stat, i) => (
              <motion.div key={i} whileHover={{ scale: 1.02 }} className={`bg-gradient-to-br ${stat.bg} to-transparent bg-[#0f172a] rounded-xl p-4 border border-[rgba(6,182,212,0.15)]`}>
                <div className="flex justify-between items-start">
                  <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
                  <stat.icon size={16} className={`${stat.color} opacity-50`} />
                </div>
                <p className={`text-xl font-black ${stat.color}`}>{fmt(stat.val)} Ks</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ─── CHARTS & SUMMARY ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVars} className="lg:col-span-2 bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-[#06b6d4]"/> Sales & Profit Trend (7 Days)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(6,182,212,0.1)" strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="day" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                    <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#060816',borderColor:'rgba(6,182,212,0.3)',borderRadius:'8px'}} itemStyle={{fontSize:'12px'}} labelStyle={{display:'none'}} formatter={(v) => [`${fmt(v)} Ks`, '']} />
                    <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" name="Sales" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="Net Profit" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)] space-y-4">
              <h2 className="text-sm font-black mb-2 border-b border-white/5 pb-2 flex items-center gap-2"><Calendar size={16} className="text-[#06b6d4]"/> Daily Operations Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5"><span className="text-xs text-slate-400">Avg Order Value</span><span className="font-bold text-[#06b6d4]">{fmt(dailySummary.avgOrder)} Ks</span></div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5"><span className="text-xs text-slate-400">Peak Hour</span><span className="font-bold text-white flex items-center gap-1"><Clock3 size={10} className="text-[#06b6d4]"/>{dailySummary.bestHour}</span></div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5"><span className="text-xs text-slate-400">Top Category</span><span className="font-bold text-[#10b981]">{dailySummary.bestCategory}</span></div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5"><span className="text-xs text-slate-400">Customer Count</span><span className="font-bold text-white">{dailySummary.customers}</span></div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ─── TOP PRODUCTS ─── */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">🏆 Top Selling Products</h2>
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-xl">No products sold yet</div>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#06b6d4]/20 flex items-center justify-center text-xs font-bold text-[#06b6d4]">{i + 1}</div>
                        <div><p className="text-sm font-bold text-white">{p.name}</p><p className="text-[10px] text-slate-400">Units Sold: {p.qty}</p></div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#06b6d4]">{fmt(p.revenue)} Ks</p>
                        <p className="text-[10px] text-[#10b981]">Profit: +{fmt(p.profit)} Ks</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ─── RECENT TRANSACTIONS ─── */}
            <motion.div variants={itemVars} className="bg-[#0f172a] rounded-2xl p-5 border border-[rgba(6,182,212,0.15)]">
              <h2 className="text-sm font-black mb-4 flex items-center gap-2">💳 Recent Transactions</h2>
              {recentSales.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-white/10 rounded-xl">No transactions recorded</div>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((sale, i) => {
                    const isCredit = sale.paymentMethod?.toLowerCase() === 'credit' || (Number(sale.remainingDebt) > 0);
                    return (
                      <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                        <div>
                          <p className="text-sm font-bold text-white">{sale.personName || 'Walk-in Customer'}</p>
                          <p className="text-[10px] text-slate-400">{sale.date} {sale.time} • {(sale.itemsDetail || sale.items || []).length} items</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white">{fmt(sale.amount)} Ks</p>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isCredit ? 'bg-[#f43f5e]/20 text-[#f43f5e]' : 'bg-[#06b6d4]/20 text-[#06b6d4]'}`}>{sale.paymentMethod || 'Cash'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
