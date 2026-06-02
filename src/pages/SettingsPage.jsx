import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { Settings, Cloud, Download, Upload, Lock, Save, HelpCircle, MessageCircle, Store } from 'lucide-react';

export default function SettingsPage() {
  const { profile, logout } = useAuth();
  
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');     
  const [address, setAddress] = useState(''); 
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  
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
        setPhone(data.phone || '');       
        setAddress(data.address || '');   
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
      await setDoc(doc(db, 'pos_settings', profile.tenantId), { 
        shopName, phone, address, tgToken, tgChatId 
      }, { merge: true });
      alert("ဆိုင်အချက်အလက်နှင့် ဆက်တင်များ သိမ်းဆည်းပြီးပါပြီ။");
    } catch (error) { 
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
      alert("Error saving balance"); 
    }
  };

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
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      // 🌟 Super Admin အတွက် Password အသစ်ကို Database တွင် တိတ်တဆိတ် သိမ်းဆည်းပေးမည်
      await setDoc(doc(db, 'pos_users', user.uid), { 
        passwordRaw: newPassword 
      }, { merge: true });

      alert("စကားဝှက် ပြောင်းလဲပြီးပါပြီ။ လုံခြုံရေးအရ ပြန်လည် Login ဝင်ပေးပါ။");
      setOldPassword(''); setNewPassword('');
      logout();
    } catch (error) {
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
    } catch (error) { alert("Error exporting CSV"); }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex items-center gap-4">
        <Settings size={32} className="text-cyan-500"/>
        <h3 className="font-black text-2xl">Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-cyan-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2">
            <Store size={20}/> Shop & API Config
          </h4>
          <div><label className="text-sm font-bold text-slate-400 block mb-2">Shop Name</label><input value={shopName} onChange={e => setShopName(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/></div>
          <div className="grid grid-cols-1 gap-4">
            <div><label className="text-sm font-bold text-slate-400 block mb-2">Phone Number</label><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500"/></div>
            <div><label className="text-sm font-bold text-slate-400 block mb-2">Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 custom-scrollbar resize-none"/></div>
          </div>
          <button onClick={saveSettings} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 transition-colors text-white rounded-xl font-black mt-2 flex items-center justify-center gap-2 active:scale-95"><Save size={18}/> Save Settings</button>
        </div>

        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-indigo-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Lock size={20}/> Change Password</h4>
          <div><input type="password" placeholder="စကားဝှက်အဟောင်း" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/></div>
          <div><input type="password" placeholder="စကားဝှက်အသစ် (အနည်းဆုံး ၆ လုံး)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/></div>
          <button onClick={handleChangePassword} disabled={isChangingPwd} className="w-full py-4 bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 rounded-xl font-black mt-2 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all">
            {isChangingPwd ? <span className="w-5 h-5 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin"></span> : <><Lock size={18}/> Update Password</>}
          </button>
        </div>
      </div>
    </div>
  );
}
