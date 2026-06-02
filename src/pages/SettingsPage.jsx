import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase/config'; // 🌟 Auth ကို လှမ်းခေါ်ထားပါသည်
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'; // 🌟 Auth functions
import { useAuth } from '../context/AuthContext';
import { Settings, Cloud, Download, Upload, Lock, Save, HelpCircle, MessageCircle } from 'lucide-react';

export default function SettingsPage() {
  const { profile, logout } = useAuth();
  
  const [shopName, setShopName] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false); // 🌟 Loading state for password change
  
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  
  const fileRef = useRef(null);

  useEffect(() => {
    if (!profile?.tenantId) return;
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, 'pos_settings', profile.tenantId));
      if (snap.exists()) {
        const data = snap.data();
        setShopName(data.shopName || '');
        setTgToken(data.tgToken || '');
        setTgChatId(data.tgChatId || '');
        setOpeningBalance(data.openingBalance || '');
        setClosingBalance(data.closingBalance || '');
      }
    };
    fetchSettings();
  }, [profile]);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'pos_settings', profile.tenantId), { shopName, tgToken, tgChatId }, { merge: true });
      alert("ဆက်တင်များ သိမ်းဆည်းပြီးပါပြီ။");
    } catch (error) { 
      console.error(error);
      alert("ဆက်တင် သိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။"); 
    }
  };

  const saveBalance = async () => {
    try {
      await setDoc(doc(db, 'pos_settings', profile.tenantId), { 
        openingBalance: parseFloat(openingBalance) || 0, 
        closingBalance: parseFloat(closingBalance) || 0 
      }, { merge: true });
      alert("လက်ကျန်ငွေစာရင်း သိမ်းဆည်းပြီးပါပြီ။");
    } catch (error) { 
      console.error(error);
      alert("Error saving balance"); 
    }
  };

  // 🌟 Password ပြောင်းသည့် Function (Enhanced Security)
  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      return alert("စကားဝှက်ဟောင်းနှင့် အသစ်ကို ဖြည့်ပါ။");
    }
    
    if (newPassword.length < 6) {
      return alert("စကားဝှက်အသစ်သည် အနည်းဆုံး အက္ခရာ (၆) လုံး ရှိရပါမည်။");
    }

    const user = auth.currentUser;
    if (!user || !user.email) return alert("သုံးစွဲသူ အကောင့် အချက်အလက် မတွေ့ပါ။");

    setIsChangingPwd(true);

    try {
      // ၁။ လက်ရှိစကားဝှက် မှန်/မမှန် Firebase Auth တွင် အရင်တိုက်စစ်မည်
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      // ၂။ မှန်ကန်ပါက Password အသစ်သို့ ပြောင်းလဲမည်
      await updatePassword(user, newPassword);

      alert("စကားဝှက် ပြောင်းလဲပြီးပါပြီ။ လုံခြုံရေးအရ ပြန်လည် Login ဝင်ပေးပါ။");
      setOldPassword(''); 
      setNewPassword('');
      logout(); // အလိုအလျောက် အကောင့်ထွက်ပေးမည်

    } catch (error) {
      console.error("Password change error:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        alert("စကားဝှက်အဟောင်း မှားနေပါသည်။ ပြန်လည်စစ်ဆေးပေးပါ။");
      } else {
        alert("စကားဝှက်ပြောင်းလဲခြင်း မအောင်မြင်ပါ။ နောက်မှ ထပ်မံကြိုးစားပါ။");
      }
    } finally {
      setIsChangingPwd(false);
    }
  };

  const exportAllCSV = async () => {
    try {
      const q = query(collection(db, 'pos_records'), where('tenantId', '==', profile?.tenantId));
      const snap = await getDocs(q);
      if (snap.empty) return alert("မှတ်တမ်းမရှိပါ။");
      let csv = "Date,Invoice,Type,Customer,Item,Amount,Discount,PaymentType\n";
      snap.docs.forEach(doc => { 
        const d = doc.data(); 
        csv += `"${d.date||''}","${d.invoiceNo||''}","${d.type||''}","${d.personName||''}","${d.item||'Multiple'}","${d.amount||0}","${d.discount||0}","${d.paymentType||''}"\n`; 
      });
      const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a'); 
      a.href = URL.createObjectURL(blob); 
      a.download = `Records_${new Date().toISOString().split('T')[0]}.csv`; 
      a.click();
    } catch (error) { 
      console.error(error);
      alert("Error exporting CSV"); 
    }
  };

  const backupToTelegram = () => alert("Telegram API ချိတ်ဆက်မှု လိုအပ်ပါသည်။");
  const handleImportAll = () => alert("Import function under construction.");

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      
      {/* Header */}
      <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex items-center gap-4">
        <Settings size={32} className="text-cyan-500"/>
        <h3 className="font-black text-2xl">Settings</h3>
      </div>

      {/* 📚 Setup Guides */}
      <div className="bg-[#0d1120] border-2 border-amber-500/20 rounded-3xl p-6 sm:p-8 shadow-lg space-y-4">
        <h4 className="text-lg font-black text-amber-400 flex items-center gap-2"><HelpCircle size={22}/> API ချိတ်ဆက်နည်း လမ်းညွှန်</h4>
        
        {/* Telegram Guide (Gemini Guide ကို ဖယ်ရှားထားပါသည်) */}
        <details className="bg-black/30 rounded-xl border border-blue-500/10">
          <summary className="p-4 font-bold text-blue-400 cursor-pointer flex items-center gap-2"><MessageCircle size={18}/> 📱 Telegram Bot ဖန်တီးနည်း (အဆင့်ဆင့်)</summary>
          <div className="p-4 pt-0 text-sm text-slate-300 space-y-3">
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
              <p className="font-bold text-blue-400 mb-2">အဆင့် ၁ - @BotFather ကိုသွားပါ</p>
              <p>• Telegram App ကိုဖွင့်ပါ</p>
              <p>• Search Box မှာ <b className="text-white">@BotFather</b> လို့ရိုက်ရှာပါ</p>
              <p>• Verified Account (အပြာရောင်အမှတ်ခြစ်ပါ) ကို နှိပ်ပါ</p>
              <p>• <b className="text-white">/start</b> လို့ရိုက်ပြီး စတင်ပါ</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
              <p className="font-bold text-blue-400 mb-2">အဆင့် ၂ - Bot အသစ်ဖန်တီးပါ</p>
              <p>• <b className="text-white">/newbot</b> လို့ရိုက်ပါ</p>
              <p>• Bot နာမည်ပေးပါ (ဥပမာ - My Shop POS Bot)</p>
              <p>• Bot Username ပေးပါ (ဥပမာ - myshoppos_bot) - <b>bot</b> ဆိုတဲ့စာလုံးပါရပါမယ်</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
              <p className="font-bold text-blue-400 mb-2">အဆင့် ၃ - Token ရယူပါ</p>
              <p>• Bot ဖန်တီးပြီးရင် <b className="text-white">HTTP API Token</b> တစ်ခုရပါမယ်</p>
              <p>• အဲဒီ Token ကို ကူးပြီး အောက်က <b className="text-cyan-400">Telegram Bot Token</b> အကွက်မှာ ထည့်ပါ</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
              <p className="font-bold text-blue-400 mb-2">အဆင့် ၄ - Chat ID ရယူပါ</p>
              <p>• သင့် Bot ကို Telegram မှာ ရှာပြီး <b className="text-white">/start</b> လို့ရိုက်ပါ</p>
              <p>• Browser မှာ <b className="text-cyan-400">https://api.telegram.org/botYOUR_TOKEN/getUpdates</b> ကိုဖွင့်ပါ</p>
              <p>• ပေါ်လာတဲ့ JSON ထဲက <b className="text-white">"chat":&#123;"id":123456789&#125;</b> ဆိုတဲ့ နံပါတ်ကို ကူးပါ</p>
              <p>• အဲဒီနံပါတ်ကို <b className="text-cyan-400">Telegram Chat ID</b> အကွက်မှာ ထည့်ပါ</p>
            </div>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* General + API Config */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-cyan-400 mb-4 border-b border-white/10 pb-2">General & API Config</h4>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Shop Name</label>
            <input value={shopName} onChange={e => setShopName(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Telegram Bot Token</label>
            <input value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="123456:ABC-DEF..." className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Telegram Chat ID</label>
            <input value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="123456789" className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/>
          </div>
          
          <button onClick={saveSettings} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 transition-colors text-white rounded-xl font-black mt-2 flex items-center justify-center gap-2 active:scale-95"><Save size={18}/> Save Settings</button>
        </div>

        {/* Change Password (Updated) */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-indigo-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Lock size={20}/> Change Password</h4>
          <div>
            <input type="password" placeholder="စကားဝှက်အဟောင်း" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/>
          </div>
          <div>
            <input type="password" placeholder="စကားဝှက်အသစ် (အနည်းဆုံး ၆ လုံး)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/>
          </div>
          
          <button 
            onClick={handleChangePassword} 
            disabled={isChangingPwd}
            className="w-full py-4 bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 rounded-xl font-black mt-2 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
          >
            {isChangingPwd ? (
              <span className="w-5 h-5 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin"></span>
            ) : (
              <><Lock size={18}/> Update Password</>
            )}
          </button>
        </div>

        {/* Daily Balance */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-purple-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Save size={20}/> Daily Balance</h4>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-bold text-slate-400 block mb-2">Opening Balance</label><input type="number" placeholder="ဖွင့်လက်ကျန်" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="w-full bg-black/50 border border-purple-500/20 rounded-xl px-4 py-3 text-white outline-none"/></div>
            <div><label className="text-sm font-bold text-slate-400 block mb-2">Closing Balance</label><input type="number" placeholder="ပိတ်လက်ကျန်" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} className="w-full bg-black/50 border border-purple-500/20 rounded-xl px-4 py-3 text-white outline-none"/></div>
          </div>
          <button onClick={saveBalance} className="w-full py-4 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/40 text-purple-300 rounded-xl font-black mt-2 flex items-center justify-center gap-2 active:scale-95"><Save size={18}/> Save Balance</button>
        </div>

        {/* Data Management */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-4">
          <h4 className="text-lg font-black text-emerald-400 mb-4 border-b border-white/10 pb-2">Data Management</h4>
          <button onClick={backupToTelegram} className="w-full py-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-colors font-bold active:scale-95"><Cloud size={18}/> Backup to Telegram</button>
          <button onClick={exportAllCSV} className="w-full py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center justify-center gap-2 hover:bg-emerald-600/30 transition-colors font-bold active:scale-95"><Download size={18}/> Export CSV</button>
          <button onClick={() => fileRef.current?.click()} className="w-full py-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-300 flex items-center justify-center gap-2 hover:bg-amber-600/30 transition-colors font-bold active:scale-95"><Upload size={18}/> Import CSV</button>
          <input type="file" accept=".csv" multiple ref={fileRef} onChange={handleImportAll} className="hidden"/>
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="w-full py-3 bg-cyan-600/20 border border-cyan-500/30 rounded-xl text-cyan-300 flex items-center justify-center gap-2 hover:bg-cyan-600/30 transition-colors font-bold text-sm active:scale-95"><MessageCircle size={18}/> @BotFather သို့ Telegram Bot ဖန်တီးရန်</a>
        </div>
      </div>
    </div>
  );
}
