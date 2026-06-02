import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, X, Loader2, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function AIChat({ records = [], products = [] }) {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId;
  const [open, setOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 မင်္ဂလာပါ! POSIFY AI Assistant ပါ။\n\nဆိုင်ရဲ့ Live Data မှတ်တမ်းများကို ဖတ်ရှုပြီး မေးခွန်းများကို အချိန်နှင့်တပြေးညီ အဖြေထုတ်ပေးနိုင်ပါပြီ။\n\nမေးမြန်းနိုင်သည့် ဥပမာများ -\n• ဒီနေ့ အရောင်းအနှစ်ချုပ်နဲ့ အမြတ်ကို တွက်ပေးပါ\n• လက်ရှိ ဆိုင်မှာ ရောင်းအားအကောင်းဆုံးပစ္စည်း ၅ မျိုးက ဘာလဲ\n• ဘယ်ပစ္စည်းတွေ Stock ပြန်ဖြည့်ဖို့ လိုနေပြီလဲ', isDefault: true }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const lastRequestTime = useRef(0);

  const fmt = n => (Number(n) || 0).toLocaleString();

  // ✅ Load Gemini API Key from Settings Once
  useEffect(() => {
    if (!tenantId) return;
    const loadKey = async () => {
      try {
        const snap = await getDoc(doc(db, 'pos_settings', tenantId));
        if (snap.exists() && snap.data().geminiKey) {
          setGeminiKey(snap.data().geminiKey);
          setUseAI(true);
        }
      } catch (err) { console.error(err); }
    };
    loadKey();
  }, [tenantId]);

  const quickQuestions = [
    { icon: DollarSign, text: 'ဒီနေ့ အရောင်းအနှစ်ချုပ်နဲ့ အမြတ်ကို တွက်ပေးပါ', color: 'text-cyan-400' },
    { icon: TrendingUp, text: 'လက်ရှိ ဆိုင်မှာ ရောင်းအားအကောင်းဆုံးပစ္စည်း ၅ မျိုးက ဘာလဲ', color: 'text-emerald-400' },
    { icon: AlertTriangle, text: 'ဘယ်ပစ္စည်းတွေ Stock ပြန်ဖြည့်ဖို့ လိုနေပြီလဲ', color: 'text-amber-400' },
  ];

  // 🌟 100% Pure AI Core Engine (Injecting Live Store Context Data into Gemini)
  const callGemini = async (userInput) => {
    try {
      // ဆိုင်၏ လက်ရှိ Data များအား AI နားလည်နိုင်သော ပုံစံဖြင့် ချုံ့၍ Context ထဲ ထည့်ခြင်း
      const sales = records.filter(r => r.type?.toLowerCase() === 'sale');
      const expenses = records.filter(r => r.type?.toLowerCase() === 'expense');
      
      const totalSalesAmt = sales.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalExpensesAmt = expenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalDebtAmt = sales.reduce((s, r) => s + (Number(r.remainingDebt) || 0), 0);
      
      const lowStockItems = products
        .filter(p => (Number(p.stockBase) ?? Number(p.stock) ?? 0) <= (Number(p.minStock) || 5))
        .map(p => `- ${p.name}: လက်ကျန် ${p.stockBase ?? p.stock ?? 0} (Min Alert: ${p.minStock || 5})`)
        .slice(0, 15)
        .join('\n');

      const recentSalesSummary = sales.slice(0, 15).map(s => {
        return `- Customer: ${s.personName || 'Walk-in'}, Total: ${s.amount} Ks, Credit: ${s.remainingDebt || 0} Ks, Date: ${s.date || ''}`;
      }).join('\n');

      // AI ဆီသို့ Live Data များနှင့် ညွှန်ကြားချက်များ ပေးပို့ခြင်း
      const systemContext = `You are the expert Business Intelligence AI Engine for POSIFY POS System.
You have direct, real-time access to the store's live database provided below. Use this data to calculate and answer the user's questions perfectly. 

[LIVE CORE METRICS]
- Total Registered Products in System: ${products.length}
- Total Sales Revenue Loaded: ${totalSalesAmt} Ks
- Total Expenses Loaded: ${totalExpensesAmt} Ks
- Total Outstanding Customer Credits/Debts: ${totalDebtAmt} Ks

[CURRENT LOW STOCK ALERT ITEMS]
${lowStockItems || 'All products have a healthy stock level.'}

[RECENT SALES TRANSACTIONS DUMP (LAST 15)]
${recentSalesSummary || 'No sales transactions recorded yet.'}

[STRICT ARCHITECT RULES]
1. Reply ONLY in polite, professional Burmese language (မြန်မာဘာသာ).
2. Keep responses highly concise, accurate, and business-focused (maximum 2-3 sentences).
3. Always format cash and currencies with commas (e.g., 50,000 Ks).
4. Do NOT hallucinate or make up fake numbers. If data is missing for a specific date, state it honestly.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemContext}\n\nUser Question: ${userInput}` }]
              }
            ],
            generationConfig: {
              temperature: 0.2, // တိကျမှုမြင့်မားစေရန် တန်ဖိုးလျှော့ချထားသည်
              maxOutputTokens: 300
            }
          })
        }
      );

      // 🌟 Bug Fix Looker: 429 Quota Exceeded ဖြစ်ပါက သုံးစွဲသူအား တိုက်ရိုက်အသိပေးခြင်း
      if (response.status === 429) {
        return '⏳ Gemini AI Free Tier ရဲ့ တစ်မိနစ် Request Limit ပြည့်သွားပါပြီ။ ၁ မိနစ်ခန့် ခဏစောင့်ပြီးမှ ထပ်မံမေးမြန်းပေးပါရန် သို့မဟုတ် API Key အား Upgrade ပြုလုပ်ပါ။';
      }

      if (!response.ok) {
        return `❌ AI Server Response Error (Status: ${response.status})။ ခဏနေမှ ပြန်လည်ကြိုးစားကြည့်ပါ။`;
      }

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '❌ AI ထံမှ တုံ့ပြန်မှု ကုဒ်အမှား ဖြစ်ပေါ်နေပါသည်။';
    } catch (err) {
      console.error('Gemini Fetch Error:', err);
      return '❌ ကွန်ရက်ချိတ်ဆက်မှု ချို့ယွင်းနေပါသည်။ အင်တာနက်လိုင်း ပြန်လည်စစ်ဆေးပေးပါ။';
    }
  };

  const sendMessage = async (text) => {
    if (loading) return;

    const msg = text || input;
    if (!msg.trim()) return;

    // Cooldown Guard: စက္ကန့်ပိုင်းအတွင်း ဆင့်နှိပ်ပြီး 429 ထပ်မတက်စေရန် တားဆီးခြင်း
    const now = Date.now();
    if (now - lastRequestTime.current < 2500) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⏳ စာရိုက်နှုန်း မြန်လွန်းနေပါသည်။ ခဏစောင့်ပါ။' }]);
      return;
    }
    lastRequestTime.current = now;

    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);

    if (!useAI || !geminiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Gemini API Key ထည့်သွင်းထားခြင်း မရှိသေးပါ။ ကျေးဇူးပြု၍ ဆိုင်၏ Settings စာမျက်နှာတွင် API Key အရင်သွားထည့်ပေးပါ။' }]);
      setLoading(false);
      return;
    }

    const aiReply = await callGemini(msg);
    setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
    setLoading(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-20 right-4 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 rounded-full shadow-lg hover:scale-110 transition-all">
        <Bot size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 h-[450px] bg-[#0d1120] border border-emerald-500/20 rounded-2xl shadow-2xl flex flex-col font-sans">
      <div className="flex justify-between items-center p-3 border-b border-emerald-500/10 bg-emerald-900/20 rounded-t-2xl">
        <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
          <Bot size={18}/> AI Assistant
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
            Gemini 2.0 Live Core
          </span>
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white p-1"><X size={18}/></button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs sm:text-sm custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`p-2.5 rounded-xl max-w-[85%] whitespace-pre-line ${msg.role === 'user' ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/10 ml-auto' : msg.isDefault ? 'bg-slate-800/40 text-slate-400 mr-auto text-xs border border-white/5' : 'bg-slate-800 text-slate-200 mr-auto border border-white/5'}`}>
            {msg.content}
            {msg.isDefault && (
              <div className="grid grid-cols-1 gap-1.5 mt-3">
                {quickQuestions.map((qq, idx) => {
                  const Icon = qq.icon;
                  return (
                    <button type="button" key={idx} onClick={() => sendMessage(qq.text)} className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/60 text-xs text-left text-emerald-400 transition-all border border-white/5">
                      <Icon size={13}/> {qq.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-slate-500 text-xs p-2"><Loader2 size={13} className="animate-spin"/> AI မှ ဒေတာများအား စတင်သုံးသပ်နေပါသည်...</div>}
      </div>

      <div className="p-2 border-t border-emerald-500/10 flex gap-2 bg-black/20">
        <input 
          type="text"
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && sendMessage()} 
          placeholder="မေးခွန်းမေးပါ..." 
          className="flex-1 bg-black/60 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
        />
        <button type="button" onClick={() => sendMessage()} disabled={loading} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white disabled:opacity-50 transition-colors flex items-center justify-center">
          <Send size={13}/>
        </button>
      </div>
    </div>
  );
}
