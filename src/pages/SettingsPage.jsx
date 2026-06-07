import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Settings, Cloud, Download, Upload, Lock, Save, HelpCircle, MessageCircle, Store, Wallet } from 'lucide-react';

// 🌟 UI & Utilities 
import { showToast } from '../components/UI/Toast';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import logger from '../utils/logger';

// 🌟 Security Utility
const SECRET_SALT = "QPOS_SECURE_99";
const encodeAuth = (pwd) => btoa(encodeURIComponent(pwd + SECRET_SALT)).split('').reverse().join('');

export default function SettingsPage() {
  const { profile, logout } = useAuth();
  const { t } = useLanguage();
  
  const [shopName, setShopName] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const fileRef = useRef(null);

  useEffect(() => {
    if (!profile?.tenantId) return;
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'pos_settings', profile.tenantId));
        if (snap.exists()) {
          const data = snap.data();
          setShopName(data.shopName || '');
          setTgToken(data.tgToken || '');
          setTgChatId(data.tgChatId || '');
          setOpeningBalance(data.openingBalance || '');
          setClosingBalance(data.closingBalance || '');
        }
      } catch (error) {
        logger.error('Failed to fetch settings:', error);
        showToast("ဆက်တင်များ ရယူရာတွင် အမှားဖြစ်နေပါသည်။", "error");
      }
    };
    fetchSettings();
  }, [profile]);

  const saveSettings = async () => {
    try {
      // 🌟 Gemini မပါတော့ပါ
      await setDoc(doc(db, 'pos_settings', profile.tenantId), { shopName, tgToken, tgChatId }, { merge: true });
      showToast("ဆက်တင်များ သိမ်းဆည်းပြီးပါပြီ။", "success");
    } catch (error) { 
      logger.error('Error saving settings:', error);
      showToast("ဆက်တင် သိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။", "error"); 
    }
  };

  const saveBalance = async () => {
    try {
      await setDoc(doc(db, 'pos_settings', profile.tenantId), { 
        openingBalance: parseFloat(openingBalance) || 0, 
        closingBalance: parseFloat(closingBalance) || 0 
      }, { merge: true });
      showToast("လက်ကျန်ငွေစာရင်း သိမ်းဆည်းပြီးပါပြီ။", "success");
    } catch (error) { 
      logger.error('Error saving balance:', error);
      showToast("လက်ကျန်ငွေစာရင်း သိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။", "error"); 
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) return showToast("စကားဝှက်ဟောင်းနှင့် အသစ်ကို ဖြည့်ပါ။", "error");
    if (newPassword.length < 6) return showToast("စကားဝှက်အသစ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။", "error");
    
    setIsChangingPwd(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not found");

      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      await setDoc(doc(db, 'pos_users', profile.id || user.uid), { 
        encryptedKey: encodeAuth(newPassword) 
      }, { merge: true });

      showToast("စကားဝှက် ပြောင်းလဲပြီးပါပြီ။ လုံခြုံရေးအရ ပြန်လည် Login ဝင်ပါ။", "success");
      setOldPassword(''); setNewPassword(''); 
      logout();
    } catch (error) { 
      logger.error('Error changing password:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        showToast("စကားဝှက်အဟောင်း မှားနေပါသည်။", "error");
      } else {
        showToast("စကားဝှက်ပြောင်းလဲရာတွင် အမှားဖြစ်နေပါသည်။", "error"); 
      }
    } finally {
      setIsChangingPwd(false);
    }
  };

  const exportAllCSV = async () => {
    setConfirmDialog({
      isOpen: true,
      title: "မှတ်တမ်းများ ဒေါင်းလုဒ်လုပ်ခြင်း",
      message: "အရောင်းမှတ်တမ်းများအားလုံးကို CSV ဖိုင်အဖြစ် ဒေါင်းလုဒ်လုပ်မှာ သေချာပါသလား?",
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const q = query(collection(db, 'pos_records'), where('tenantId', '==', profile?.tenantId));
          const snap = await getDocs(q);
          if (snap.empty) return showToast("မှတ်တမ်းမရှိပါ။", "warning");
          
          let csv = "Date,Invoice,Type,Customer,Item,Amount,Discount,PaymentType\n";
          snap.docs.forEach(doc => { 
            const d = doc.data(); 
            csv += `"${d.date||''}","${d.invoiceNo||''}","${d.type||''}","${d.personName||''}","${d.item||'Multiple'}","${d.amount||0}","${d.discount||0}","${d.paymentType||''}"\n`; 
          });
          const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Records_${new Date().toISOString().split('T')[0]}.csv`; a.click();
          showToast("CSV ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။", "success");
        } catch (error) { 
          logger.error('Error exporting CSV:', error);
          showToast("Export လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။", "error"); 
        }
      }
    });
  };

  // 🌟 Import CSV အစစ်အမှန် လုပ်ဆောင်ချက် (Under Construction အစား)
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setConfirmDialog({
      isOpen: true,
      title: "CSV တင်သွင်းခြင်း",
      message: "ရွေးချယ်ထားသော CSV ဖိုင်မှ ဒေတာများကို System အတွင်းသို့ တင်သွင်းမှာ သေချာပါသလား?",
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const text = event.target.result;
            const rows = text.split('\n').filter(row => row.trim() !== '');
            if (rows.length <= 1) return showToast("ဖိုင်ထဲတွင် ဒေတာမရှိပါ။", "warning");

            let count = 0;
            let batch = writeBatch(db);

            for (let i = 1; i < rows.length; i++) {
              const rowStr = rows[i];
              const cols = [];
              let inQuotes = false;
              let current = '';
              for (let j = 0; j < rowStr.length; j++) {
                if (rowStr[j] === '"') {
                  inQuotes = !inQuotes;
                } else if (rowStr[j] === ',' && !inQuotes) {
                  cols.push(current.trim());
                  current = '';
                } else {
                  current += rowStr[j];
                }
              }
              cols.push(current.trim());

              if (cols.length < 8) continue;

              const recordRef = doc(collection(db, 'pos_records'));
              batch.set(recordRef, {
                tenantId: profile?.tenantId,
                date: cols[0] || '',
                invoiceNo: cols[1] || '',
                type: cols[2] || '',
                personName: cols[3] || '',
                item: cols[4] || '',
                amount: Number(cols[5]) || 0,
                discount: Number(cols[6]) || 0,
                paymentType: cols[7] || '',
                createdAt: Date.now()
              });

              count++;
              // Data များလျှင် Error မတက်ရန် Batch ခွဲသွင်းခြင်း
              if (count % 400 === 0) {
                await batch.commit();
                batch = writeBatch(db);
              }
            }

            if (count % 400 !== 0) {
              await batch.commit();
            }

            if (count > 0) {
              showToast(`မှတ်တမ်းပေါင်း ${count} ခုကို အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ။`, "success");
            } else {
              showToast("တင်သွင်းရန် မှန်ကန်သော ဒေတာမတွေ့ရှိပါ။", "warning");
            }
          };
          reader.readAsText(file);
        } catch (error) {
          logger.error('Import error:', error);
          showToast("Import လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။", "error");
        }
        if (fileRef.current) fileRef.current.value = ''; // Reset file input
      }
    });
  };

  const backupToTelegram = () => showToast("Telegram API ချိတ်ဆက်မှု လိုအပ်ပါသည်။", "info");

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      
      {/* Confirm Dialog */}
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}/>

      {/* Header */}
      <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Settings size={32} className="text-cyan-500"/>
          <h3 className="font-black text-2xl">{t('settings', 'Settings')}</h3>
        </div>
      </div>

      {/* 📚 Setup Guides (Gemini Removed completely) */}
      <div className="bg-[#0d1120] border-2 border-amber-500/20 rounded-3xl p-6 sm:p-8 shadow-lg space-y-4">
        <h4 className="text-lg font-black text-amber-400 flex items-center gap-2"><HelpCircle size={22}/> {t('settingsApiGuide', 'API setup guide')}</h4>
        
        {/* Telegram Guide */}
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
        
        {/* General + API Config (Gemini Removed completely) */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-cyan-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Store size={20}/> {t('generalApiConfig', 'General & API Config')}</h4>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">{t('shopName', 'Shop Name')}</label>
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

        {/* Change Password */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-indigo-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Lock size={20}/> Change Password</h4>
          <div><input type="password" placeholder="စကားဝှက်အဟောင်း" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/></div>
          <div><input type="password" placeholder="စကားဝှက်အသစ်" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500"/></div>
          <button onClick={handleChangePassword} disabled={isChangingPwd} className="w-full py-4 bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 rounded-xl font-black mt-2 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all">
            {isChangingPwd ? <span className="w-5 h-5 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin"></span> : <><Lock size={18}/> Update Password</>}
          </button>
        </div>

        {/* Daily Balance */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-5">
          <h4 className="text-lg font-black text-purple-400 mb-4 border-b border-white/10 pb-2 flex items-center gap-2"><Wallet size={20}/> Daily Balance</h4>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-bold text-slate-400 block mb-2">Opening Balance</label><input type="number" placeholder="ဖွင့်လက်ကျန်" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="w-full bg-black/50 border border-purple-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"/></div>
            <div><label className="text-sm font-bold text-slate-400 block mb-2">Closing Balance</label><input type="number" placeholder="ပိတ်လက်ကျန်" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} className="w-full bg-black/50 border border-purple-500/20 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"/></div>
          </div>
          <button onClick={saveBalance} className="w-full py-4 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/40 text-purple-300 rounded-xl font-black mt-2 flex items-center justify-center gap-2 active:scale-95 transition-all"><Save size={18}/> Save Balance</button>
        </div>

        {/* Data Management */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 sm:p-8 shadow-lg space-y-4">
          <h4 className="text-lg font-black text-emerald-400 mb-4 border-b border-white/10 pb-2">Data Management</h4>
          <button onClick={backupToTelegram} className="w-full py-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-colors font-bold active:scale-95"><Cloud size={18}/> Backup to Telegram</button>
          
          <div className="flex gap-4">
            <button onClick={exportAllCSV} className="w-full py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center justify-center gap-2 hover:bg-emerald-600/30 transition-colors font-bold active:scale-95"><Download size={18}/> Export CSV</button>
            
            {/* 🌟 Import CSV နေရာမှန် */}
            <button onClick={() => fileRef.current?.click()} className="w-full py-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-300 flex items-center justify-center gap-2 hover:bg-amber-600/30 transition-colors font-bold active:scale-95"><Upload size={18}/> Import CSV</button>
            <input type="file" accept=".csv" ref={fileRef} onChange={handleImportCSV} className="hidden"/>
          </div>

          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="w-full py-3 bg-cyan-600/20 border border-cyan-500/30 rounded-xl text-cyan-300 flex items-center justify-center gap-2 hover:bg-cyan-600/30 transition-colors font-bold text-sm active:scale-95"><MessageCircle size={18}/> @BotFather သို့ Telegram Bot ဖန်တီးရန်</a>
        </div>

      </div>
    </div>
  );
}
