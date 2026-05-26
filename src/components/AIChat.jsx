import { useState } from 'react';
import { Send, Bot, X, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../context/AuthContext';

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 မင်္ဂလာပါ! QuickPOS AI Assistant ပါ။\n\nမေးနိုင်သောမေးခွန်းများ:\n• ဒီနေ့အရောင်းဘယ်လောက်လဲ\n• ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ\n• Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ\n• ဒီနေ့အကြွေးဘယ်လောက်ရှိလဲ' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const records = useStore(state => state.records || []);
  const products = useStore(state => state.products || []);
  const { profile } = useAuth();

  const fmt = n => (Number(n) || 0).toLocaleString();

  // ✅ Local AI Rules Engine
  const getAIResponse = (userInput) => {
    const q = userInput.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    // Today's data
    const todayRecords = records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt?.seconds * 1000 : (r.createdAt || 0);
      return new Date(ts).toISOString().split('T')[0] === today;
    });

    const todaySales = todayRecords.filter(r => r.type === 'Sale' || r.type === 'sale');
    const todayExpenses = todayRecords.filter(r => r.type === 'Expense' || r.type === 'expense');
    const totalSales = todaySales.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalExpenses = todayExpenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalDebt = records.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0);
    const orderCount = todaySales.length;

    // Low stock
    const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5));

    // Top products
    const productMap = {};
    todaySales.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const name = item.name || 'Unknown';
        productMap[name] = (productMap[name] || 0) + (Number(item.quantity) || 1);
      });
    });
    const topProducts = Object.entries(productMap).sort((a,b) => b[1] - a[1]).slice(0, 5);

    // ✅ Rule-based responses
    if (q.includes('အရောင်း') || q.includes('sales') || q.includes('ဝင်ငွေ')) {
      return `📊 ဒီနေ့အရောင်း အနှစ်ချုပ်:\n• အော်ဒါ: ${orderCount} ခု\n• စုစုပေါင်း: ${fmt(totalSales)} Ks\n• အသုံးစရိတ်: ${fmt(totalExpenses)} Ks\n• အသားတင်: ${fmt(totalSales - totalExpenses)} Ks`;
    }

    if (q.includes('ပစ္စည်း') || q.includes('product') || q.includes('ရောင်းအား')) {
      if (topProducts.length === 0) return '📦 ဒီနေ့ အရောင်းမရှိသေးပါ။';
      let reply = '🏆 ဒီနေ့ ရောင်းအားအကောင်းဆုံးပစ္စည်းများ:\n';
      topProducts.forEach((p, i) => { reply += `• ${i+1}. ${p[0]} - ${p[1]} ခု\n`; });
      return reply;
    }

    if (q.includes('stock') || q.includes('နည်း') || q.includes('ကုန်')) {
      if (lowStock.length === 0) return '✅ Stock နည်းနေတဲ့ ပစ္စည်းမရှိပါ။';
      let reply = `⚠️ Stock နည်းနေသောပစ္စည်း (${lowStock.length} မျိုး):\n`;
      lowStock.slice(0, 10).forEach(p => { reply += `• ${p.name} - ${p.stock || 0} ${p.baseUnit || 'ခု'}\n`; });
      return reply;
    }

    if (q.includes('ကြွေး') || q.includes('debt') || q.includes('ကျန်')) {
      if (totalDebt === 0) return '💳 ကြွေးကျန်မရှိပါ။';
      return `💳 စုစုပေါင်းကြွေးကျန်: ${fmt(totalDebt)} Ks`;
    }

    if (q.includes('profit') || q.includes('အမြတ်')) {
      const profit = totalSales - totalExpenses;
      return `💰 ဒီနေ့အမြတ်: ${fmt(profit)} Ks\n(အရောင်း: ${fmt(totalSales)} - အသုံးစရိတ်: ${fmt(totalExpenses)})`;
    }

    if (q.includes('ဘာတွေ') || q.includes('မေး') || q.includes('ကူညီ')) {
      return '📋 မေးနိုင်သောမေးခွန်းများ:\n• ဒီနေ့အရောင်းဘယ်လောက်လဲ\n• ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ\n• Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ\n• ဒီနေ့အကြွေးဘယ်လောက်ရှိလဲ\n• ဒီနေ့အမြတ်ဘယ်လောက်လဲ';
    }

    return '🤔 နားမလည်ပါ။ "ဘာတွေမေးလို့ရလဲ" လို့ မေးကြည့်ပါ။';
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulate thinking time
    setTimeout(() => {
      const reply = getAIResponse(input);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setLoading(false);
    }, 500);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-all animate-pulse">
        <Bot size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 h-96 bg-[#0d1120] border border-emerald-500/20 rounded-2xl shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-emerald-500/10 bg-emerald-900/20 rounded-t-2xl">
        <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
          <Bot size={18}/> AI Assistant
          <span className="text-[10px] text-slate-500 font-normal">Local Engine</span>
        </h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={18}/></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`p-2.5 rounded-xl max-w-[85%] whitespace-pre-line ${msg.role === 'user' ? 'bg-emerald-900/30 text-white ml-auto' : 'bg-slate-800 text-slate-300 mr-auto'}`}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-xs p-2">
            <Loader2 size={14} className="animate-spin"/> စဉ်းစားနေသည်...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-emerald-500/10 flex gap-2">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && sendMessage()} 
          placeholder="မေးခွန်းမေးပါ..." 
          className="flex-1 bg-black border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
        />
        <button onClick={sendMessage} disabled={loading} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-all disabled:opacity-50">
          <Send size={14}/>
        </button>
      </div>
    </div>
  );
}
