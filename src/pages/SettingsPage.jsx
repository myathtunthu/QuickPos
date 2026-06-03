import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { Settings, Cloud, Download, Upload, Lock, Save, Store, Wallet } from 'lucide-react';

import { showToast } from '../components/UI/Toast';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import logger from '../utils/logger';

const SECRET_SALT = "QPOS_SECURE_99";
const encodeAuth = (pwd) => btoa(encodeURIComponent(pwd + SECRET_SALT)).split('').reverse().join('');

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
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    if (!profile?.tenantId) return;
    const fetchSettings = async () => {
      try {
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
      } catch (error) {
        logger.error('Failed to fetch settings', error);
        showToast('Settings failed to load', 'error');
      }
    };
    fetchSettings();
  }, [profile]);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'pos_settings', profile.tenantId), { 
        shopName, phone, address, tgToken, tgChatId 
      }, { merge: true });
      showToast("ဆိုင်အချက်အလက် သိမ်းဆည်းပြီးပါပြီ။", "success");
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
      showToast("Error saving balance", "error"); 
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) return showToast("စကားဝှက်အဟောင်းနှင့် အသစ်ကို ဖြည့်ပါ။", "error");
    if (newPassword.length < 6) return showToast("အနည်းဆုံး (၆) လုံး လိုအပ်ပါသည်။", "error");

    const user = auth.currentUser;
    setIsChangingPwd(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      await setDoc(doc(db, 'pos_users', user.uid), { encryptedKey: encodeAuth(newPassword) }, { merge: true });

      showToast("စကားဝှက် ပြောင်းလဲပြီးပါပြီ။", "success");
      setOldPassword(''); setNewPassword('');
      logout();
    } catch (error) {
      logger.error('Password change error:', error);
      showToast("စကားဝှက်ပြောင်းလဲခြင်း မအောင်မြင်ပါ။", "error");
    } finally {
      setIsChangingPwd(false);
    }
  };

  const exportAllCSV = async () => {
    setConfirmDialog({
      isOpen: true,
      title: "Data Export",
      message: "မှတ်တမ်းအားလုံးကို CSV ဖိုင်အဖြစ် ဒေါင်းလုဒ်လုပ်မှာ သေချာပါသလား?",
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
        } catch (error) { 
          logger.error('Error exporting CSV:', error);
          showToast("Error exporting CSV", "error"); 
        }
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}/>
      
      <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Settings size={32} className="text-cyan-500"/>
            <h3 className="font-black text-2xl">Settings</h3>
        </div>
        <button onClick={exportAllCSV} className="bg-indigo-600 px-4 py-2 rounded-xl flex items-center gap-2 font-bold"><Download size={18}/> Export CSV</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shop Config */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 shadow-lg space-y-4">
          <h4 className="text-lg font-black text-cyan-400 flex items-center gap-2"><Store size={20}/> Shop Config</h4>
          <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Shop Name" className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/>
          <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white resize-none" placeholder="Address"/>
          <button onClick={saveSettings} className="w-full py-3 bg-cyan-600 rounded-xl font-black">Save Shop Details</button>
        </div>

        {/* Balance */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 shadow-lg space-y-4">
          <h4 className="text-lg font-black text-emerald-400 flex items-center gap-2"><Wallet size={20}/> Daily Balance</h4>
          <input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} placeholder="Opening Balance" className="w-full bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-3 text-white"/>
          <input type="number" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} placeholder="Closing Balance" className="w-full bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-3 text-white"/>
          <button onClick={saveBalance} className="w-full py-3 bg-emerald-600 rounded-xl font-black">Save Balance</button>
        </div>

        {/* Password */}
        <div className="bg-[#0d1120] border-2 border-white/5 rounded-3xl p-6 shadow-lg space-y-4 md:col-span-2">
          <h4 className="text-lg font-black text-indigo-400 flex items-center gap-2"><Lock size={20}/> Change Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="password" placeholder="Old Password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white"/>
            <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-black/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-white"/>
          </div>
          <button onClick={handleChangePassword} disabled={isChangingPwd} className="w-full py-3 bg-indigo-600 rounded-xl font-black">{isChangingPwd ? 'Updating...' : 'Update Password'}</button>
        </div>
      </div>
    </div>
  );
}
