import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  Zap, ShoppingCart, DollarSign, CreditCard, MinusCircle,
  AlertTriangle, TrendingUp, Clock3
} from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip,
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

  useEffect(() => {
    if (!tenantId) { setDataLoading(false); return; }
    const q = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId));
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

  const fmt = n => (Number(n) || 0).toLocaleString();

  // ✅ Period Filter
  const periodRecs = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    return records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt.seconds * 1000 : (r.createdAt || 0);
      if (dashPeriod === 'Today') return new Date(ts).toDateString() === today;
      if (dashPeriod === 'Week') return now - ts <= 7 * 86400000;
      if (dashPeriod === 'Month') return now - ts <= 30 * 86400000;
      return true;
    });
  }, [records, dashPeriod]);

  // ✅ Separate by Type
  const salesRecs = useMemo(() => periodRecs.filter(r => r.type === 'Sale' || r.type === 'sale'), [periodRecs]);
  const purchaseRecs = useMemo(() => periodRecs.filter(r => r.type === 'Purchase' || r.type === 'purchase'), [periodRecs]);
  const expenseRecs = useMemo(() => periodRecs.filter(r => r.type === 'Expense' || r.type === 'expense'), [periodRecs]);
  const paymentRecs = useMemo(() => periodRecs.filter(r => r.type === 'Payment'), [periodRecs]);

  // ✅ Correct Stats
  const totalSales = useMemo(() => salesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [salesRecs]);
  const totalPurchases = useMemo(() => purchaseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [purchaseRecs]);
  const totalExpenses = useMemo(() => expenseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [expenseRecs]);
  const totalPayments = useMemo(() => paymentRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0), [paymentRecs]);
  
  // ✅ Debt = Only from Sale records (remainingDebt)
  const totalDebt = useMemo(() => {
    return records
      .filter(r => r.type === 'Sale' || r.type === 'sale')
      .reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0);
  }, [records]);

  const orderCount = useMemo(() => salesRecs.length, [salesRecs]);
  const balance = totalSales - totalPurchases - totalExpenses + totalPayments;
  const profit = totalSales - totalPurchases - totalExpenses;

  // ✅ Low Stock
  const lowStock = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)), [products]);

  // ✅ Top Products
  const topProducts = useMemo(() => {
    const map = {};
    salesRecs.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const name = item.name || 'Unknown';
        map[name] = (map[name] || 0) + (Number(item.quantity) || Number(item.qty) || 1);
      });
    });
    return Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [salesRecs]);

  // ✅ Payment Methods
  const payments = useMemo(() => {
    const methods = { Cash: 0, Kpay: 0, Wave: 0, AYAPay: 0 };
    salesRecs.forEach(r => {
      const method = r.paymentMethod || r.paymentType || 'Cash';
      methods[method] = (methods[method] || 0) + Number(r.amount || 0);
    });
    return methods;
  }, [salesRecs]);

  // ✅ Chart Data (7 Days)
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
      const sales = dayRecs.filter(r => r.type === 'Sale' || r.type === 'sale').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const purchases = dayRecs.filter(r => r.type === 'Purchase' || r.type === 'purchase').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const expenses = dayRecs.filter(r => r.type === 'Expense' || r.type === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      days.push({ day: dayName, sales, purchases, expenses });
    }
    return days;
  }, [records]);

  // ✅ Recent Sales
  const recentSales = useMemo(() => salesRecs.slice(-5).reverse(), [salesRecs]);

  // ✅ AI Insights
  const insights = useMemo(() => {
    const ins = [];
    if (totalSales > 0) ins.push(`💰 Total sales: ${fmt(totalSales)} Ks`);
    if (topProducts.length > 0) ins.push(`🏆 Top seller: ${topProducts[0]?.name}`);
    if (lowStock.length > 0) ins.push(`⚠️ ${lowStock.length} products low in stock`);
    if (profit > 0) ins.push(`📈 Net profit: ${fmt(profit)} Ks`);
    if (totalDebt > 0) ins.push(`💳 Outstanding debt: ${fmt(totalDebt)} Ks`);
    return ins.length > 0 ? ins : ['Start selling to see insights 📊'];
  }, [totalSales, lowStock, topProducts, profit, totalDebt]);

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-4 text-white pb-28 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-black text-cyan-400"><Zap size={22} className="inline mr-1"/>QuickPOS</h1>
        <div className="flex bg-[#111827] p-1 rounded-xl border border-cyan-500/10">
          {['Today','Week','Month'].map(p => (
            <button key={p} onClick={() => setDashPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dashPeriod===p?'bg-cyan-500 text-black':'text-slate-500'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-2 text-xs text-center text-cyan-300">
        📊 {records.length} Records | 📦 {products.length} Products | 💰 Balance: {fmt(balance)} Ks
      </div>

      {/* Balance Card */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-cyan-950 to-[#111827] border border-cyan-500/10">
        <p className="text-xs text-cyan-400 font-bold uppercase">Net Balance</p>
        <h2 className="text-3xl font-black mt-1">{fmt(balance)} Ks</h2>
        <div className="grid grid-cols-4 gap-2 mt-3 text-center">
          <div><p className="text-xs text-slate-500">Sales</p><p className="text-sm font-black text-cyan-400">{fmt(totalSales)}</p></div>
          <div><p className="text-xs text-slate-500">Purchases</p><p className="text-sm font-black text-blue-400">{fmt(totalPurchases)}</p></div>
          <div><p className="text-xs text-slate-500">Expenses</p><p className="text-sm font-black text-amber-400">{fmt(totalExpenses)}</p></div>
          <div><p className="text-xs text-slate-500">Orders</p><p className="text-sm font-black">{orderCount}</p></div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] rounded-2xl p-4 border border-cyan-500/10">
        <h2 className="text-sm font-black mb-3">📈 Sales vs Purchases vs Expenses (7 Days)</h2>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
              <XAxis dataKey="day" stroke="#64748b" fontSize={10}/>
              <YAxis stroke="#64748b" fontSize={10}/>
              <Tooltip contentStyle={{background:'#020617',border:'1px solid #22d3ee22',borderRadius:'12px',fontSize:'11px'}}/>
              <Area type="monotone" dataKey="sales" stroke="#22d3ee" fill="url(#grd)" strokeWidth={2} name="Sales"/>
              <Line type="monotone" dataKey="purchases" stroke="#3b82f6" strokeWidth={2} name="Purchases"/>
              <Line type="monotone" dataKey="expenses" stroke="#fb7185" strokeWidth={2} name="Expenses"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-400"/> Sales</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"/> Purchases</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-400"/> Expenses</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#111827] rounded-xl p-3 border border-white/5">
          <p className="text-xs text-slate-500">Sales</p>
          <p className="text-lg font-black text-cyan-400">{fmt(totalSales)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/5">
          <p className="text-xs text-slate-500">Profit</p>
          <p className={`text-lg font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(profit)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/5">
          <p className="text-xs text-slate-500">Debt (Sales)</p>
          <p className={`text-lg font-black ${totalDebt > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{fmt(totalDebt)}</p>
        </div>
        <div className="bg-[#111827] rounded-xl p-3 border border-white/5">
          <p className="text-xs text-slate-500">Expenses</p>
          <p className="text-lg font-black text-amber-400">{fmt(totalExpenses)}</p>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-[#111827] rounded-2xl p-4 border border-cyan-500/10">
        <h2 className="text-sm font-black mb-3">💳 Payment Methods</h2>
        <div className="space-y-2">
          {Object.entries(payments).map(([name, value]) => (
            <div key={name}>
              <div className="flex justify-between text-xs mb-1"><span>{name}</span><span className="font-bold">{fmt(value)} Ks</span></div>
              <div className="h-2 rounded-full bg-black/20 overflow-hidden"><div className="h-full rounded-full bg-cyan-400" style={{width:`${totalSales?(value/totalSales)*100:0}%`}}/></div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="bg-[#111827] rounded-2xl p-4 border border-cyan-500/10">
          <h2 className="text-sm font-black mb-3">🏆 Top Products</h2>
          <div className="space-y-2">
            {topProducts.map((p,i) => (
              <div key={i} className="flex justify-between text-xs"><span>{p.name}</span><span className="font-bold">{p.qty} sold</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock */}
      {lowStock.length > 0 && (
        <div className="bg-rose-950/20 rounded-2xl p-4 border border-rose-500/20">
          <h2 className="text-sm font-black text-rose-400 mb-2"><AlertTriangle size={16} className="inline mr-1"/>Low Stock</h2>
          {lowStock.map(p => <p key={p.id} className="text-rose-300 text-xs">• {p.name} ({p.stock})</p>)}
        </div>
      )}

      {/* Recent Sales */}
      <div className="bg-[#111827] rounded-2xl p-4 border border-cyan-500/10">
        <h2 className="text-sm font-black mb-2"><Clock3 size={14} className="inline mr-1 text-cyan-400"/>Recent Sales</h2>
        {recentSales.length === 0 && <p className="text-slate-500 text-xs">No sales yet</p>}
        {recentSales.map((sale,i) => (
          <div key={i} className="flex justify-between py-1.5 border-b border-white/5 text-xs">
            <span>{sale.personName || 'Walk-in'}</span>
            <span className="text-cyan-400 font-bold">{fmt(sale.amount)} Ks</span>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="bg-[#111827] rounded-2xl p-4 border border-purple-500/10">
        <h2 className="text-sm font-black text-purple-300 mb-2"><TrendingUp size={14} className="inline mr-1"/>Insights</h2>
        <div className="space-y-1">
          {insights.map((text,i) => (
            <div key={i} className="p-2 rounded-lg bg-purple-500/10 text-xs">{text}</div>
          ))}
        </div>
      </div>

      {/* ✅ AI Chat */}
      <AIChat records={records} products={products} />
    </div>
  );
}
