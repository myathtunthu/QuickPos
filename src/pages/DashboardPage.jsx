import { useState } from 'react';
import { Send, Bot, X, Loader2, Zap, Package, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 မင်္ဂလာပါ! QuickPOS AI Assistant ပါ။\n\nအောက်ပါမေးခွန်းများ မေးနိုင်ပါတယ် -\n• ဒီနေ့အရောင်းဘယ်လောက်လဲ\n• ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ\n• Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ\n• ဒီနေ့အကြွေးဘယ်လောက်ရှိလဲ\n• ဒီနေ့အမြတ်ဘယ်လောက်လဲ', isDefault: true }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const records = useStore(state => state.records || []);
  const products = useStore(state => state.products || []);

  const fmt = n => (Number(n) || 0).toLocaleString();

  // ✅ Quick Questions
  const quickQuestions = [
    { icon: DollarSign, text: 'ဒီနေ့အရောင်းဘယ်လောက်လဲ', color: 'text-cyan-400' },
    { icon: TrendingUp, text: 'ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ', color: 'text-emerald-400' },
    { icon: AlertTriangle, text: 'Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ', color: 'text-amber-400' },
    { icon: DollarSign, text: 'ဒီနေ့အကြွေးဘယ်လောက်ရှိလဲ', color: 'text-rose-400' },
  ];

  // ✅ Local AI Rules Engine
  const getAIResponse = (userInput) => {
    const q = userInput.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

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

    const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5));

    const productMap = {};
    todaySales.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => {
        const name = item.name || 'Unknown';
        productMap[name] = (productMap[name] || 0) + (Number(item.quantity) || 1);
      });
    });
    const topProducts = Object.entries(productMap).sort((a,b) => b[1] - a[1]).slice(0, 5);

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

  const sendMessage = (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    if (text) setInput('');
    else setInput('');
    setLoading(true);

    setTimeout(() => {
      const reply = getAIResponse(msg);
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
    <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 h-[450px] bg-[#0d1120] border border-emerald-500/20 rounded-2xl shadow-2xl flex flex-col">
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
          <div key={i} className={`p-2.5 rounded-xl max-w-[85%] whitespace-pre-line ${msg.role === 'user' ? 'bg-emerald-900/30 text-white ml-auto' : msg.isDefault ? 'bg-slate-800/50 text-slate-400 mr-auto text-xs' : 'bg-slate-800 text-slate-300 mr-auto'}`}>
            {msg.content}
            {/* ✅ Quick Question Buttons after default message */}
            {msg.isDefault && (
              <div className="grid grid-cols-1 gap-1.5 mt-3">
                {quickQuestions.map((qq, idx) => {
                  const Icon = qq.icon;
                  return (
                    <button key={idx} onClick={() => sendMessage(qq.text)} className={`flex items-center gap-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-xs text-left ${qq.color} transition-all`}>
                      <Icon size={14}/> {qq.text}
                    </button>
                  );
                })}
              </div>
            )}
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
        <button onClick={() => sendMessage()} disabled={loading} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-all disabled:opacity-50">
          <Send size={14}/>
        </button>
      </div>
    </div>
  );
}
