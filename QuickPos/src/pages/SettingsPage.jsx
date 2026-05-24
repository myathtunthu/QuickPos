import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Cloud, Download, Upload, Lock, Save } from 'lucide-react';

// မူရင်း Password Hash စနစ်
const simpleHash = str => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'h_' + h.toString(16).padStart(8, '0');
};

export default function SettingsPage() {
  const { userData, logout } = useAuth();
  
  const [shopName, setShopName] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  
  const fileRef = useRef(null);

  // Database ထဲမှ လက်ရှိ Settings များကို ဆွဲယူခြင်း
  useEffect(() => {
    if (!userData?.tenantId) return;
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, 'pos_settings', userData.tenantId));
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
  }, [userData]);

  // အထွေထွေ ဆက်တင်များ သိမ်းဆည်းခြင်း
  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'pos_settings', userData.tenantId), {
        shopName, tgToken, tgChatId
      }, { merge: true });
      alert("အထွေထွေဆက်တင်များ သိမ်းဆည်းပြီးပါပြီ။");
    } catch (error) {
      alert("Error saving settings");
    }
  };

  // လက်ကျန်ငွေ သိမ်းဆည်းခြင်း
  const saveBalance = async () => {
    try {
      await setDoc(doc(db, 'pos_settings', userData.tenantId), {
        openingBalance: parseFloat(openingBalance) || 0,
        closingBalance: parseFloat(closingBalance) || 0,
      }, { merge: true });
      alert("လက်ကျန်ငွေစာရင်း သိမ်းဆည်းပြီးပါပြီ။");
    } catch (error) {
      alert("Error saving balance");
    }
  };

  // စကားဝှက် ပြောင်းလဲခြင်း
  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      return alert("စကားဝှက်ဟောင်းနှင့် အသစ်ကို ပြည့်စုံအောင် ထည့်ပါ။");
    }
    if (userData.password !== simpleHash(oldPassword)) {
      return alert("စကားဝှက်ဟောင်း မှားယွင်းနေပါသည်။");
    }
    try {
      await setDoc(doc(db, 'pos_users', userData.id), { 
        password: simpleHash(newPassword) 
      }, { merge: true });
      alert("စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။ ကျေးဇူးပြု၍ ပြန်လည် Login ဝင်ပါ။");
      setOldPassword('');
      setNewPassword('');
      logout(); // Password ပြောင်းပြီးရင် အလိုလိုထွက်ပေးမည်
    } catch (error) {
      alert("Error changing password");
    }
  };

  // CSV ဒေါင်းလုဒ်လုပ်ခြင်း (အရောင်းမှတ်တမ်းများ)
  const exportAllCSV = async () => {
    try {
      const q = query(collection(db, 'pos_records'), where('tenantId', '==', userData.tenantId));
      const snap = await getDocs(q);
      if (snap.empty) return alert("ထုတ်ယူရန် မှတ်တမ်း မရှိပါ။");
      
      let csvContent = "Date,Invoice,Type,Customer,Item,Amount,Discount,PaymentType\n";
      snap.docs.forEach(doc => {
        const d = doc.data();
        csvContent += `"${d.date || ''}","${d.invoiceNo || ''}","${d.type || ''}","${d.personName || ''}","${d.item || 'Multiple Items'}","${d.amount || 0}","${d.discount || 0}","${d.paymentType || ''}"\n`;
      });
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Records_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      alert("Error exporting CSV");
    }
  };

  const backupToTelegram = () => alert("Telegram API ချိတ်ဆက်မှု လိုအပ်ပါသည်။");
  const handleImportAll = () => alert("Import function under construction.");

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      
      <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex items-center gap-4 animate-fade-in">
        <SettingsIcon size={32} className="text-cyan-500"/>
        <h3 className="font-black text-2xl">Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ─── အထွေထွေ ဆက်တင် (General & Telegram) ─── */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5 animate-fade-in">
          <h4 className="text-lg font-black text-cyan-400 mb-4 border-b border-white/10 pb-2">General & Telegram Config</h4>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Shop Name (ဆိုင်အမည်)</label>
            <input value={shopName} onChange={e => setShopName(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Telegram Bot Token</label>
            <input value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="Bot Token..." className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Telegram Chat ID</label>
            <input value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="Chat ID..." className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/>
          </div>
          <button onClick={saveSettings} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 transition-colors text-white rounded-xl font-black mt-2">
            Save Settings
          </button>
        </div>

        {/* ─── စကားဝှက် ပြောင်းလဲခြင်း (Change Password) ─── */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5 animate-fade-in">
          <h4 className="text-lg font-black text-indigo-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Lock size={20}/> Change Password</h4>
          <div>
            <input type="password" placeholder="စကားဝှက်အဟောင်း (Old Password)" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/>
          </div>
          <div>
            <input type="password" placeholder="စကားဝှက်အသစ် (New Password)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/>
          </div>
          <button onClick={handleChangePassword} className="w-full py-4 bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 transition-colors text-indigo-300 rounded-xl font-black mt-2">
            Update Password
          </button>
        </div>

        {/* ─── နေ့စဉ် လက်ကျန်ငွေ (Opening / Closing Balance) ─── */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5 animate-fade-in">
          <h4 className="text-lg font-black text-purple-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Save size={20}/> Daily Balance</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-slate-400 block mb-2">Opening Balance</label>
              <input type="number" placeholder="ဖွင့်လက်ကျန်" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="w-full bg-black/50 border border-purple-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500"/>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-400 block mb-2">Closing Balance</label>
              <input type="number" placeholder="ပိတ်လက်ကျန်" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} className="w-full bg-black/50 border border-purple-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500"/>
            </div>
          </div>
          <button onClick={saveBalance} className="w-full py-4 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/40 transition-colors text-purple-300 rounded-xl font-black mt-2">
            Save Balance
          </button>
        </div>

        {/* ─── ဒေတာစီမံခြင်း (Data Management) ─── */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-4 animate-fade-in">
          <h4 className="text-lg font-black text-emerald-400 mb-4 border-b border-white/10 pb-2">Data Management</h4>
          
          <button onClick={backupToTelegram} className="w-full py-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-colors font-bold">
            <Cloud size={18}/> Backup to Telegram
          </button>
          
          <button onClick={exportAllCSV} className="w-full py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center justify-center gap-2 hover:bg-emerald-600/30 transition-colors font-bold">
            <Download size={18}/> Export CSV
          </button>
          
          <button onClick={() => fileRef.current?.click()} className="w-full py-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-300 flex items-center justify-center gap-2 hover:bg-amber-600/30 transition-colors font-bold">
            <Upload size={18}/> Import CSV
          </button>
          <input type="file" accept=".csv" multiple ref={fileRef} onChange={handleImportAll} className="hidden"/>
          
        </div>

      </div>
    </div>
  );
}
