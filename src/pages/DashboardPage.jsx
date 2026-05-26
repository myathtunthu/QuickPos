import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Zap, ShoppingCart, DollarSign, CreditCard, AlertTriangle, Clock3 } from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import AIChat from '../components/AIChat';

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenantId;

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    const q = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => d.data()));
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, [tenantId]);

  const fmt = n => (Number(n) || 0).toLocaleString();

  const salesRecs = records.filter(r => r.type === 'Sale' || r.type === 'sale');
  const purchaseRecs = records.filter(r => r.type === 'Purchase' || r.type === 'purchase');
  const expenseRecs = records.filter(r => r.type === 'Expense' || r.type === 'expense');

  const totalSales = salesRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPurchases = purchaseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalExpenses = expenseRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalDebt = records.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0);
  const orderCount = salesRecs.length;
  const balance = totalSales - totalPurchases - totalExpenses;

  const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5));
  const recentSales = salesRecs.slice(-5).reverse();

  // Chart Data - Fixed for Firestore Timestamp
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    const dayRecs = records.filter(r => {
      if (!r.createdAt) return false;
      const ts = r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt;
      return new Date(ts).toDateString() === ds;
    });
    const sales = dayRecs.filter(r => r.type === 'Sale' || r.type === 'sale').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const expenses = dayRecs.filter(r => r.type === 'Expense' || r.type === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    chartData.push({ day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], sales, expenses });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-white pb-28 max-w-7xl mx-auto bg-[#080c14] min-h-screen">
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-cyan-400"><Zap size={24} className="inline mr-1"/>POSIFY</h1>
      </div>

      <div className="rounded-2xl p-5 bg-[#0d1120] border border-cyan-500/20">
        <p className="text-xs text-slate-500">Net Balance</p>
        <h2 className="text-3xl font-black text-cyan-400 mt-1">{fmt(balance)} Ks</h2>
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          <div><p className="text-xs text-slate-500">Sales</p><p className="text-base font-black text-cyan-400">{fmt(totalSales)}</p></div>
          <div><p className="text-xs text-slate-500">Purchases</p><p className="text-base font-black text-blue-400">{fmt(totalPurchases)}</p></div>
          <div><p className="text-xs text-slate-500">Expenses</p><p className="text-base font-black text-amber-400">{fmt(totalExpenses)}</p></div>
          <div><p className="text-xs text-slate-500">Orders</p><p className="text-base font-black">{orderCount}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[{ label:'Sale', icon:ShoppingCart, path:'/entry' },{ label:'Expense', icon:DollarSign, path:'/entry' },{ label:'Debt', icon:CreditCard, path:'/ledger' },{ label:'Stock', icon:AlertTriangle, path:'/inventory' }].map(item => {
          const Icon = item.icon;
          return (
            <button key={item.label} onClick={()=>navigate(item.path)} className="bg-[#0d1120] border border-cyan-500/20 rounded-xl p-3 flex flex-col items-center gap-1">
              <Icon size={18} className="text-cyan-400"/><span className="text-xs font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#0d1120] rounded-xl p-3 border border-cyan-500/20"><p className="text-xs text-slate-500">Total Sales</p><p className="text-lg font-black text-cyan-400">{fmt(totalSales)}</p></div>
        <div className="bg-[#0d1120] rounded-xl p-3 border border-cyan-500/20"><p className="text-xs text-slate-500">Total Debt</p><p className="text-lg font-black text-rose-400">{fmt(totalDebt)}</p></div>
        <div className="bg-[#0d1120] rounded-xl p-3 border border-cyan-500/20"><p className="text-xs text-slate-500">Profit</p><p className="text-lg font-black text-emerald-400">{fmt(balance)}</p></div>
        <div className="bg-[#0d1120] rounded-xl p-3 border border-cyan-500/20"><p className="text-xs text-slate-500">Orders</p><p className="text-lg font-black">{orderCount}</p></div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-rose-950/20 rounded-xl p-3 border border-rose-500/20">
          <p className="text-sm font-black text-rose-400"><AlertTriangle size={14} className="inline mr-1"/>Low Stock</p>
          {lowStock.map(p => <p key={p.name} className="text-rose-300 text-xs">• {p.name} ({p.stock})</p>)}
        </div>
      )}

      <div className="bg-[#0d1120] rounded-xl p-3 border border-cyan-500/20">
        <p className="text-sm font-black mb-2">📈 7 Day Trend</p>
        {chartData.every(d => d.sales === 0 && d.expenses === 0) ? (
          <p className="text-slate-500 text-xs text-center py-4">No chart data available</p>
        ) : (
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
                <XAxis dataKey="day" stroke="#64748b" fontSize={9}/>
                <YAxis stroke="#64748b" fontSize={9}/>
                <Tooltip contentStyle={{background:'#020617',border:'1px solid #22d3ee22',borderRadius:'12px',fontSize:'11px'}}/>
                <Area type="monotone" dataKey="sales" stroke="#22d3ee" fill="url(#grd)" strokeWidth={2}/>
                <Line type="monotone" dataKey="expenses" stroke="#fb7185" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 🤖 AI Insights */}
<div className="bg-[#0d1120] rounded-xl p-3 border border-purple-500/10">
  <p className="text-sm font-black text-purple-300 mb-2">🤖 AI Insights</p>
  <div className="space-y-2">

    {/* 📊 Sales Summary */}
    {totalSales > 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        📊 Today's sales: <b className="text-cyan-400">{fmt(totalSales)} Ks</b> from <b className="text-white">{orderCount} orders</b>
        {orderCount > 0 && <> • Avg: <b className="text-emerald-400">{fmt(totalSales / orderCount)} Ks</b> per order</>}
      </div>
    )}

    {/* 📈 Profit Analysis */}
    {totalSales > 0 && totalPurchases > 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        📈 Profit Margin: <b className={balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {((balance / totalSales) * 100).toFixed(1)}%
        </b> (Sales: {fmt(totalSales)} - Cost: {fmt(totalPurchases + totalExpenses)})
      </div>
    )}

    {/* 🔥 Best Selling Product */}
    {(() => {
      const productMap = {};
      salesRecs.forEach(r => {
        const items = r.itemsDetail || r.items || [];
        items.forEach(item => {
          const name = item.name || 'Unknown';
          productMap[name] = (productMap[name] || 0) + (Number(item.quantity) || Number(item.qty) || 1);
        });
      });
      const bestProduct = Object.entries(productMap).sort((a,b) => b[1] - a[1])[0];
      if (bestProduct) {
        return (
          <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
            🔥 Best Seller: <b className="text-emerald-400">{bestProduct[0]}</b> • Sold <b className="text-white">{bestProduct[1]} units</b>
          </div>
        );
      }
      return null;
    })()}

    {/* ⚠️ Purchase Warning */}
    {totalPurchases > totalSales && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        ⚠️ Purchases (<b className="text-blue-400">{fmt(totalPurchases)} Ks</b>) exceed Sales (<b className="text-cyan-400">{fmt(totalSales)} Ks</b>)
      </div>
    )}

    {/* 💳 Debt Alert */}
    {totalDebt > 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        💳 Outstanding debt: <b className="text-rose-400">{fmt(totalDebt)} Ks</b> • {(() => {
          const debtorMap = {};
          records.filter(r => (r.type === 'Sale' || r.type === 'sale') && (r.remainingDebt || 0) > 0).forEach(r => {
            const name = r.personName || r.customerName || 'Unknown';
            debtorMap[name] = (debtorMap[name] || 0) + (Number(r.remainingDebt) || 0);
          });
          const topDebtor = Object.entries(debtorMap).sort((a,b) => b[1] - a[1])[0];
          return topDebtor ? `Top: ${topDebtor[0]} (${fmt(topDebtor[1])} Ks)` : '';
        })()}
      </div>
    )}

    {/* 🚨 Low Stock */}
    {lowStock.length > 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        🚨 <b className="text-amber-400">{lowStock.length} products</b> low in stock: <b className="text-white">{lowStock.slice(0,3).map(p => p.name).join(', ')}</b>
      </div>
    )}

    {/* 📅 Daily Trend */}
    {(() => {
      const todaySales = salesRecs.filter(r => {
        if (!r.createdAt) return false;
        const ts = r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt;
        return new Date(ts).toDateString() === new Date().toDateString();
      });
      const yesterdaySales = salesRecs.filter(r => {
        if (!r.createdAt) return false;
        const ts = r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt;
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        return new Date(ts).toDateString() === yesterday.toDateString();
      });
      const todayTotal = todaySales.reduce((s,r) => s + (Number(r.amount)||0), 0);
      const yesterdayTotal = yesterdaySales.reduce((s,r) => s + (Number(r.amount)||0), 0);
      
      if (todayTotal > 0 && yesterdayTotal > 0) {
        const change = ((todayTotal - yesterdayTotal) / yesterdayTotal * 100).toFixed(0);
        return (
          <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
            📅 vs Yesterday: <b className={change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {change >= 0 ? '+' : ''}{change}%
            </b> (Today: {fmt(todayTotal)} vs Yesterday: {fmt(yesterdayTotal)})
          </div>
          <AIChat />
        );
      }
      return null;
    })()}

    {/* 🏦 Balance Status */}
    {balance >= 0 && totalSales > 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        ✅ Net balance is positive: <b className="text-emerald-400">{fmt(balance)} Ks</b> • Keep up the good work! 🎉
      </div>
    )}
    {balance < 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        📉 Net balance is negative: <b className="text-rose-400">{fmt(balance)} Ks</b> • Consider reducing expenses
      </div>
    )}

    {/* 🆕 New Business */}
    {totalSales === 0 && totalPurchases === 0 && (
      <div className="bg-purple-500/10 rounded-lg p-2 text-xs text-slate-300">
        👋 Welcome! Start by adding your first <b className="text-cyan-400">product</b> and making a <b className="text-emerald-400">sale</b>!
      </div>
    )}

  </div>
</div>

      <div className="bg-[#0d1120] rounded-xl p-3 border border-cyan-500/20">
        <p className="text-sm font-black mb-2"><Clock3 size={14} className="inline mr-1 text-cyan-400"/>Recent Sales</p>
        {recentSales.length === 0 && <p className="text-slate-500 text-xs">No sales yet</p>}
        {recentSales.map((sale,i) => (
          <div key={i} className="flex justify-between py-1.5 border-b border-white/5 text-xs">
            <span>{sale.personName || 'Walk-in'}</span>
            <span className="text-cyan-400 font-bold">{fmt(sale.amount)} Ks</span>
          </div>
        ))}
      </div>
    </div>
  );
}
