import React, { useState, useMemo } from 'react';
import { PieChart } from 'lucide-react';

export default function ReportsPage({ records = [] }) {
  const todayISO = new Date().toISOString().split('T')[0];
  const [repStart, setRepStart] = useState(todayISO);
  const [repEnd, setRepEnd] = useState(todayISO);

  // ရက်စွဲအလိုက် စစ်ထုတ်ခြင်းနှင့် တွက်ချက်ခြင်း
  const reportStats = useMemo(() => {
    const recs = records.filter(r => {
      // Date Format မျိုးစုံကို အဆင်ပြေအောင် စစ်ထုတ်ပေးခြင်း
      let iso = '';
      if (r.date && r.date.includes('-')) {
         iso = r.date;
      } else if (r.date && r.date.includes('/')) {
         const parts = r.date.split(',')[0].split('/');
         if (parts.length === 3) iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
         const ts = r.timestamp?.seconds ? r.timestamp.seconds * 1000 : (r.createdAt || 0);
         if (ts) iso = new Date(ts).toISOString().split('T')[0];
      }
      if (!iso) return false;
      return iso >= repStart && iso <= repEnd;
    });

    const sum = (arr, fn) => arr.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
    
    const sales = sum(recs.filter(r => r.type === 'Sale'), r => r.amount);
    const purchases = sum(recs.filter(r => r.type === 'Purchase'), r => r.amount);
    const expenses = sum(recs.filter(r => r.type === 'Expense'), r => r.amount);
    
    // အရောင်းအမြတ် (Gross Profit) မှ စရိတ်များကို နုတ်၍ Net Profit ရှာခြင်း
    const gp = sum(recs.filter(r => r.type === 'Sale'), r => r.profit || (r.amount - (r.discount || 0)));
    const netProfit = gp - expenses;

    return { sales, purchases, expenses, netProfit };
  }, [records, repStart, repEnd]);

  const fmt = n => (Number(n) || 0).toLocaleString();

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 text-white pb-10">
      <div className="bg-[#0d1120] p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/15 shadow-xl space-y-6 animate-fade-in">
        <h3 className="font-black text-white flex items-center gap-4 text-2xl">
          <PieChart size={30} className="text-cyan-500"/> Profit/Loss Report
        </h3>
        
        {/* Date Filter (Start Date / End Date) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-black text-slate-500 uppercase mb-2 block">Start Date</label>
            <input 
              type="date" 
              value={repStart} 
              onChange={e => setRepStart(e.target.value)} 
              className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-4 sm:py-5 text-xl font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-black text-slate-500 uppercase mb-2 block">End Date</label>
            <input 
              type="date" 
              value={repEnd} 
              onChange={e => setRepEnd(e.target.value)} 
              className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-4 sm:py-5 text-xl font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>
        
        {/* Statistics View */}
        <div className="space-y-4 sm:space-y-5 pt-4">
          <div className="flex justify-between items-center p-5 sm:p-6 rounded-xl bg-cyan-950/20 border-2 border-cyan-500/10">
            <span className="text-lg sm:text-xl font-bold text-slate-300">Total Sales (အရောင်း)</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-400">{fmt(reportStats.sales)} Ks</span>
          </div>
          
          <div className="flex justify-between items-center p-5 sm:p-6 rounded-xl bg-blue-950/20 border-2 border-blue-500/10">
            <span className="text-lg sm:text-xl font-bold text-slate-300">Total Purchases (အဝယ်)</span>
            <span className="text-xl sm:text-2xl font-black text-blue-400">{fmt(reportStats.purchases)} Ks</span>
          </div>
          
          <div className="flex justify-between items-center p-5 sm:p-6 rounded-xl bg-amber-950/20 border-2 border-amber-500/10">
            <span className="text-lg sm:text-xl font-bold text-slate-300">Total Expenses (စရိတ်)</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400">{fmt(reportStats.expenses)} Ks</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-6 sm:p-8 rounded-xl bg-emerald-950/30 border-2 border-emerald-500/30 mt-6 gap-3">
            <span className="text-lg sm:text-xl font-black text-emerald-200 uppercase tracking-widest">Net Profit (အသားတင်အမြတ်)</span>
            <span className="text-3xl sm:text-4xl font-black text-emerald-400">{fmt(reportStats.netProfit)} Ks</span>
          </div>
        </div>
        
      </div>
    </div>
  );
}
