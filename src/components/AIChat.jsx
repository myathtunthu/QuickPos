import { useState, useEffect } from 'react';
import { Send, Bot, X, Loader2, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function AIChat({ records = [], products = [] }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 မင်္ဂလာပါ! QuickPOS AI Assistant ပါ။\n\nအောက်ပါမေးခွန်းများ မေးနိုင်ပါတယ် -\n• ဒီနေ့အရောင်းဘယ်လောက်လဲ\n• ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ\n• Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ\n• ဒီနေ့အကြွေးဘယ်လောက်ရှိလဲ\n• ဒီနေ့အမြတ်ဘယ်လောက်လဲ', isDefault: true }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useAI, setUseAI] = useState(false);

  const fmt = n => (Number(n) || 0).toLocaleString();

  // ✅ Load Gemini API Key from Settings
  useEffect(() => {
    if (!profile?.tenantId) return;
    const loadKey = async () => {
      try {
        const snap = await getDoc(doc(db, 'pos_settings', profile.tenantId));
        if (snap.exists() && snap.data().geminiKey) {
          setGeminiKey(snap.data().geminiKey);
          setUseAI(true);
          console.log('✅ Gemini AI enabled');
        } else {
          console.log('ℹ️ Using Local AI (no Gemini key)');
        }
      } catch (err) {
        console.error('Error loading Gemini key:', err);
      }
    };
    loadKey();
  }, [profile]);

  const quickQuestions = [
    { icon: DollarSign, text: 'ဒီနေ့အရောင်းဘယ်လောက်လဲ', color: 'text-cyan-400' },
    { icon: TrendingUp, text: 'ဒီတစ်ပတ်လုံး အရောင်းဘယ်လောက်ရှိလဲ', color: 'text-blue-400' },
    { icon: TrendingUp, text: 'ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ', color: 'text-emerald-400' },
    { icon: AlertTriangle, text: 'Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ', color: 'text-amber-400' },
    { icon: DollarSign, text: 'ဒီနေ့အကြွေးဘယ်လောက်ရှိလဲ', color: 'text-rose-400' },
  ];

  // ✅ Gemini API Call
  const callGemini = async (userInput) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are a helpful POS assistant for QuickPOS. Keep answers short (2-3 sentences) and in Burmese. Be friendly.\n\nUser: ${userInput}` }] }]
          })
        }
      );
      const data = await response.json();
      if (data.error) {
        console.error('Gemini API Error:', data.error);
        return null;
      }
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
      console.error('Gemini fetch error:', err);
      return null;
    }
  };

  // ✅ Local AI Rules Engine
  const getLocalResponse = (userInput) => {
    const q = userInput.toLowerCase();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const getRecordsForDate = (dateStr) => records.filter(r => {
      const ts = r.createdAt?.seconds ? r.createdAt?.seconds * 1000 : (r.createdAt || 0);
      return new Date(ts).toISOString().split('T')[0] === dateStr;
    });

    const getRecordsForRange = (startDate, endDate) => {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      return records.filter(r => {
        const ts = r.createdAt?.seconds ? r.createdAt?.seconds * 1000 : (r.createdAt || 0);
        return ts >= start && ts <= end;
      });
    };

    let periodLabel = 'ဒီနေ့';
    let periodRecs = getRecordsForDate(today);

    if (q.includes('မနေ့') || q.includes('yesterday')) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      periodRecs = getRecordsForDate(yesterday.toISOString().split('T')[0]);
      periodLabel = 'မနေ့က';
    } else if (q.includes('ဒီတစ်ပတ်') || q.includes('ဒီပတ်') || q.includes('week') || q.includes('၇ရက်')) {
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
      periodRecs = getRecordsForRange(weekStart.toISOString(), now.toISOString());
      periodLabel = 'ဒီတစ်ပတ်';
    } else if (q.includes('ဒီလ') || q.includes('month') || q.includes('၃၀ရက်')) {
      const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 30);
      periodRecs = getRecordsForRange(monthStart.toISOString(), now.toISOString());
      periodLabel = 'ဒီလ';
    }

    const sales = periodRecs.filter(r => r.type === 'Sale' || r.type === 'sale');
    const expenses = periodRecs.filter(r => r.type === 'Expense' || r.type === 'expense');
    const totalSales = sales.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalExpenses = expenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalDebt = records.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0);
    const lowStock = products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5));

    const productMap = {};
    sales.forEach(r => {
      const items = r.itemsDetail || r.items || [];
      items.forEach(item => { const name = item.name || 'Unknown'; productMap[name] = (productMap[name] || 0) + (Number(item.quantity) || 1); });
    });
    const topProducts = Object.entries(productMap).sort((a,b) => b[1] - a[1]).slice(0, 5);

    if (q.includes('အရောင်း') || q.includes('sales') || q.includes('ဝင်ငွေ') || q.includes('ဘယ်လောက်ရောင်းရ') || q.includes('ဘယ်လောက်ဖိုး')) {
      if (sales.length === 0) return `📊 ${periodLabel} အရောင်းမရှိသေးပါ။`;
      return `📊 ${periodLabel}အရောင်း အနှစ်ချုပ်:\n• အော်ဒါ: ${sales.length} ခု\n• စုစုပေါင်း: ${fmt(totalSales)} Ks\n• အသုံးစရိတ်: ${fmt(totalExpenses)} Ks\n• အသားတင်: ${fmt(totalSales - totalExpenses)} Ks`;
    }
    if (q.includes('ပစ္စည်း') || q.includes('product') || q.includes('ရောင်းအား') || q.includes('အကောင်းဆုံး')) {
      if (topProducts.length === 0) return `📦 ${periodLabel} အရောင်းမရှိသေးပါ။`;
      let reply = `🏆 ${periodLabel} ရောင်းအားအကောင်းဆုံးပစ္စည်းများ:\n`;
      topProducts.forEach((p, i) => { reply += `• ${i+1}. ${p[0]} - ${p[1]} ခု\n`; });
      return reply;
    }
    if (q.includes('stock') || q.includes('နည်း') || q.includes('ကုန်') || q.includes('ပြတ်')) {
      if (lowStock.length === 0) return '✅ Stock နည်းနေတဲ့ ပစ္စည်းမရှိပါ။';
      let reply = `⚠️ Stock နည်းနေသောပစ္စည်း (${lowStock.length} မျိုး):\n`;
      lowStock.slice(0, 10).forEach(p => { reply += `• ${p.name} - ${p.stock || 0} ${p.baseUnit || 'ခု'}\n`; });
      return reply;
    }
    if (q.includes('ကြွေး') || q.includes('debt') || q.includes('ကျန်') || q.includes('အကြွေး')) {
      if (totalDebt === 0) return '💳 ကြွေးကျန်မရှိပါ။';
      return `💳 စုစုပေါင်းကြွေးကျန်: ${fmt(totalDebt)} Ks`;
    }
    if (q.includes('profit') || q.includes('အမြတ်') || q.includes('အသားတင်')) {
      return `💰 ${periodLabel}အမြတ်: ${fmt(totalSales - totalExpenses)} Ks\n(အရောင်း: ${fmt(totalSales)} - အသုံးစရိတ်: ${fmt(totalExpenses)})`;
    }
    if (q.includes('ဘာတွေ') || q.includes('မေး') || q.includes('ကူညီ')) {
      return '📋 မေးနိုင်သောမေးခွန်းများ:\n• ဒီနေ့/မနေ့က/ဒီတစ်ပတ် အရောင်းဘယ်လောက်လဲ\n• ဘယ်ပစ္စည်းရောင်းအားကောင်းလဲ\n• Stock နည်းတဲ့ပစ္စည်းတွေက ဘာတွေလဲ\n• ကြွေးကျန်ဘယ်လောက်ရှိလဲ\n• အမြတ်ဘယ်လောက်လဲ';
    }
    return '🤔 နားမလည်ပါ။ "ဘာတွေမေးလို့ရလဲ" လို့ မေးကြည့်ပါ။';
  };

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);

    let reply;
    
    // ✅ Try Gemini first, fallback to Local
    if (useAI && geminiKey) {
      const geminiReply = await callGemini(msg);
      if (geminiReply) {
        reply = geminiReply;
      } else {
        reply = getLocalResponse(msg) + '\n\n⚠️ (Gemini API error - Local AI response)';
      }
    } else {
      reply = getLocalResponse(msg);
    }

    setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    setLoading(false);
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
      <div className="flex justify-between items-center p-3 border-b border-emerald-500/10 bg-emerald-900/20 rounded-t-2xl">
        <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
          <Bot size={18}/> AI Assistant
          <span className={`text-[10px] font-normal ${useAI ? 'text-purple-400' : 'text-slate-500'}`}>
            {useAI ? 'Gemini AI' : 'Local Engine'}
          </span>
        </h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={18}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className={`p-2.5 rounded-xl max-w-[85%] whitespace-pre-line ${msg.role === 'user' ? 'bg-emerald-900/30 text-white ml-auto' : msg.isDefault ? 'bg-slate-800/50 text-slate-400 mr-auto text-xs' : 'bg-slate-800 text-slate-300 mr-auto'}`}>
            {msg.content}
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
        {loading && <div className="flex items-center gap-2 text-slate-500 text-xs p-2"><Loader2 size={14} className="animate-spin"/> စဉ်းစားနေသည်...</div>}
      </div>
      <div className="p-2 border-t border-emerald-500/10 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="မေးခွန်းမေးပါ..." className="flex-1 bg-black border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none"/>
        <button onClick={() => sendMessage()} disabled={loading} className="px-3 py-2 bg-emerald-600 rounded-lg text-white disabled:opacity-50"><Send size={14}/></button>
      </div>
    </div>
  );
}
