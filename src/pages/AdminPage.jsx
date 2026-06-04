import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, createUserWithEmailAndPassword } from 'firebase/auth'; 
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext'; // 🌟 Language ယူရန်
import { Users, Plus, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

import ConfirmDialog from '../components/UI/ConfirmDialog';

const PERMISSION_OPTIONS = [
  { key: 'create_sale', label: 'အရောင်းလုပ်ခွင့်' },
  { key: 'view_sales', label: 'အရောင်းမှတ်တမ်းကြည့်ခွင့်' },
  { key: 'view_customers', label: 'Customer စာရင်းကြည့်ခွင့်' },
  { key: 'manage_customers', label: 'Customer စာရင်းပြင်/ဖျက်/ထည့်ခွင့်' },
  { key: 'accept_payment', label: 'Customer ကြွေးဆပ်လက်ခံခွင့်' },
  { key: 'view_suppliers', label: 'Supplier စာရင်းကြည့်ခွင့်' },
  { key: 'manage_suppliers', label: 'Supplier စာရင်းပြင်/ဖျက်/ထည့်ခွင့်' },
  { key: 'create_purchase', label: 'အဝယ်/Supplier ငွေချေခွင့်' },
  { key: 'view_inventory', label: 'ကုန်လက်ကျန်ကြည့်ခွင့်' },
  { key: 'manage_inventory', label: 'ကုန်လက်ကျန်ပြင်ခွင့်' },
  { key: 'manage_products', label: 'ကုန်ပစ္စည်းစီမံခွင့်' },
  { key: 'create_expense', label: 'စရိတ်ထည့်ခွင့်' },
  { key: 'delete_records', label: 'မှတ်တမ်းဖျက်ခွင့်' },
  { key: 'view_reports', label: 'Dashboard/Report ကြည့်ခွင့်' },
  { key: 'manage_users', label: 'User စီမံခွင့်' },
  { key: 'settings', label: 'ဆက်တင်ပြင်ခွင့်' },
];

const DEFAULT_STAFF_PERMS = ['create_sale', 'view_sales', 'accept_payment', 'view_inventory', 'view_customers'];

export default function AdminPage() {
  const { userData } = useAuth();
  const { t } = useLanguage(); // 🌟 Language Function
  const [posUsers, setPosUsers] = useState([]);
  
  const [adding, setAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' });
  const [showPwd, setShowPwd] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [editingPerms, setEditingPerms] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (!userData?.tenantId) return;
    const q = query(collection(db, 'pos_users'), where('tenantId', '==', userData.tenantId));
    
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosUsers(all);
    });
    
    return () => unsub();
  }, [userData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) return;
    if (!adminPassword.trim()) return alert(t('adminPasswordRequired'));

    const newUsername = form.username.trim().toLowerCase();

    if (posUsers.some(u => u.username.toLowerCase() === newUsername)) {
      return alert("ဒီနာမည်ဖြင့် User ရှိပြီးသားပါ။ အမည်ပြောင်းပေးပါ။");
    }

    if (form.password.length < 6) {
      return alert("Password သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရပါမည်။");
    }

    setIsSaving(true);

    try {
      // 🌟 ၁။ Admin Password အရင်တိုက်စစ်ပါမည်
      if (auth.currentUser?.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, adminPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        throw new Error("Admin email မတွေ့ပါ။");
      }

      // 🌟 ၂။ Firebase Auth တွင် အကောင့်အသစ် ဖန်တီးမည် (Auto Login မဖြစ်အောင် သတိထားရမည်)
      // Firebase ၏ သဘာဝအရ အကောင့်သစ်လုပ်လျှင် Auto ဝင်သွားတတ်သဖြင့်၊
      // Admin ရဲ့ မူလလုပ်ဆောင်ချက်များကို မပျက်စီးစေရန် သီးသန့် Firebase App ခွဲ၍လုပ်ခြင်း (သို့) Backend မပါဘဲ လတ်တလော အောက်ပါအတိုင်း ဖြေရှင်းနိုင်ပါသည်။
      
      const emailForAuth = newUsername.includes('@') ? newUsername : `${newUsername}@gmail.com`;
      
      // 🔴 သတိပြုရန် - createUserWithEmailAndPassword သုံးပါက လက်ရှိ Admin Account လွတ်သွားနိုင်ပါသည်။ 
      // ဤ POS လိုမျိုး Web-based (No backend) တွင် လုံခြုံရေးအရ အလွယ်ကူဆုံးနည်းမှာ -
      // ယာယီ Admin အကောင့်မှ ထွက်၍ အကောင့်သစ်လုပ်ပြီး Admin ထဲ ပြန်ဝင်သည့်ပုံစံ (သို့မဟုတ်) သီးသန့် Cloud Function သုံးရပါမည်။
      // အခုလောလောဆယ် Cloud Function မရှိသေးသဖြင့် Admin က User ဖွင့်ပေးရန် Browser အသစ်/Incognito မှသာ User ဖွင့်ရမည့် သဘောမျိုး ဖြစ်နေပါမည်။
      // ထို့ကြောင့် - အကောင်းဆုံး ဖြေရှင်းချက်မှာ ဒေတာဘေ့စ်တွင်သာ သိမ်းပြီး Login ဝင်ချိန်တွင် ကိုယ်တိုင် Auto Create လုပ်ပေးသောစနစ် (Lazy Auth Create) ကို LoginPage တွင် ပြင်ဆင်ခြင်းဖြစ်ပါသည်။

      // 💡 အခုအခြေအနေတွင် မူလအတိုင်း Database ထဲသို့သာ အရင်သိမ်းလိုက်ပါမည်။ (Password အစစ်ကိုပါ သိမ်းပေးထားမှ LoginPage ကနေ Auth ပြန်ဖန်တီးပေးလို့ရပါမည်)
      const userDocRef = doc(collection(db, 'pos_users'));
      await setDoc(userDocRef, {
        tenantId: userData.tenantId, 
        username: form.username.trim(),
        password: form.password, // 🌟 Login Page ကနေ Auth လုပ်ဖို့ လိုအပ်သဖြင့် Plain သိမ်းထားပါမည်။
        role: form.role,
        permissions: form.role === 'staff' ? DEFAULT_STAFF_PERMS : [],
        createdAt: Date.now(),
      });
      
      setForm({ username: '', password: '', role: 'staff' }); 
      setAdminPassword(''); 
      setAdding(false);
      alert("User အကောင့် ဖန်တီးပြီးပါပြီ။ ၎င်းအကောင့်ဖြင့် ဝင်ရောက်နိုင်ပါပြီ။");

    } catch (error) {
      console.error("Error adding user:", error);
      if (error.code === 'auth/wrong-password') {
        alert("Admin Password မှားနေပါသည်။");
      } else {
        alert("User ဖန်တီးရာတွင် အမှားအယွင်းဖြစ်နေပါသည်။");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = async (user, permKey) => {
    try {
      const newPerms = user.permissions?.includes(permKey) 
        ? user.permissions.filter(p => p !== permKey) 
        : [...(user.permissions || []), permKey];
      await setDoc(doc(db, 'pos_users', user.id), { permissions: newPerms }, { merge: true });
    } catch (error) {
      alert("လုပ်ပိုင်ခွင့် ပြင်ဆင်ခြင်း မအောင်မြင်ပါ။");
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'pos_users', confirmDelete.id));
      setConfirmDelete(null);
    } catch (error) {
      alert("User ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။");
    }
  };

  const handleDeleteRequest = (u) => {
    if (u.role === 'admin' && posUsers.filter(x => x.role === 'admin').length <= 1) {
      return alert("နောက်ဆုံး Admin ကို ဖျက်ခွင့်မပြုပါ။");
    }
    setConfirmDelete(u);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      
      <div className="bg-[#0d1120] border-2 border-indigo-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex justify-between items-center animate-in fade-in">
        <h3 className="font-black text-white flex items-center gap-4 text-2xl">
          <Users size={30} className="text-indigo-500"/> {t('staffManagement')}
        </h3>
        <button onClick={() => setAdding(!adding)} className="bg-indigo-900/40 text-indigo-400 px-5 sm:px-6 py-3 sm:py-4 rounded-xl font-black text-lg flex items-center gap-2 hover:bg-indigo-900/60 transition-all active:scale-95">
          <Plus size={24}/> {t('add')}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-black/40 p-6 sm:p-8 rounded-3xl border-2 border-indigo-500/15 space-y-5 shadow-lg animate-in slide-in-from-top-4">
          <input required value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder={t('username')} className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl outline-none focus:border-indigo-500/50" />
          
          <div className="relative">
            <input required type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={t('password')} className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl pr-16 outline-none focus:border-indigo-500/50" />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-5 top-4 sm:top-5 text-slate-500 hover:text-indigo-400 transition-colors">
              {showPwd ? <EyeOff size={26}/> : <Eye size={26}/>}
            </button>
          </div>
          <p className="text-xs text-amber-500/80 -mt-3 ml-2">* Password သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။</p>
          
          <div className="relative">
            <input required type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder={t('adminPasswordRequired')} className="w-full px-5 py-4 sm:py-5 bg-amber-950/20 border-2 border-amber-500/20 rounded-xl text-lg sm:text-xl text-amber-300 outline-none focus:border-amber-400/50" />
          </div>
          
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl outline-none focus:border-indigo-500/50">
            <option value="staff">{t('roleStaff')}</option>
            <option value="admin">{t('roleAdmin')}</option>
          </select>
          
          <div className="flex gap-4 sm:gap-5 pt-2">
            <button type="submit" disabled={isSaving} className="flex-1 py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-xl font-black text-lg sm:text-xl flex justify-center items-center disabled:opacity-50 active:scale-95">
              {isSaving ? <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></span> : t('save')}
            </button>
            <button type="button" onClick={() => setAdding(false)} disabled={isSaving} className="px-6 sm:px-8 py-4 sm:py-5 bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 rounded-xl font-black text-lg sm:text-xl disabled:opacity-50">{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
        {posUsers.map(u => (
          <div key={u.id} className="bg-black/30 p-5 sm:p-6 rounded-2xl border-2 border-indigo-500/10 hover:border-indigo-500/30 transition-colors group">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-indigo-950/60 flex items-center justify-center text-indigo-400 font-black text-xl sm:text-2xl uppercase shadow-inner shadow-indigo-500/20">
                  {u.username?.[0] || '?'}
                </div>
                <div>
                  <p className="font-black text-white text-xl sm:text-2xl">{u.username}</p>
                  <span className={`text-xs sm:text-sm font-black px-3 sm:px-4 py-1 sm:py-1.5 rounded uppercase mt-2 inline-block ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    {u.role === 'admin' ? t('roleAdmin') : t('roleStaff')}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-none border-white/5">
                <button onClick={() => setEditingPerms(editingPerms === u.id ? null : u.id)} className={`flex-1 sm:flex-none text-sm sm:text-base font-bold px-4 sm:px-5 py-3 rounded-xl border-2 flex justify-center items-center gap-2 transition-colors ${editingPerms === u.id ? 'bg-indigo-600 text-white border-indigo-500' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20'}`}>
                  <ShieldCheck size={20}/> {editingPerms === u.id ? t('close') : t('permissions')}
                </button>
                {u.username !== userData?.username && (
                  <button onClick={() => handleDeleteRequest(u)} className="text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-500/10 border-2 border-rose-500/20 p-3 rounded-xl transition-all">
                    <Trash2 size={22} sm:size={24}/>
                  </button>
                )}
              </div>
            </div>

            {editingPerms === u.id && (
              <div className="mt-5 sm:mt-6 p-5 sm:p-6 bg-black/60 rounded-2xl border-2 border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 animate-in fade-in shadow-inner">
                {PERMISSION_OPTIONS.map(perm => (
                  <label key={perm.key} className={`flex items-center gap-3 sm:gap-4 text-base sm:text-lg font-bold ${u.role === 'admin' ? 'text-slate-600' : 'text-slate-300 hover:text-white'} cursor-pointer transition-colors p-2 rounded-lg hover:bg-white/5`}>
                    <input 
                      type="checkbox" 
                      checked={u.role === 'admin' ? true : u.permissions?.includes(perm.key)} 
                      onChange={() => togglePermission(u, perm.key)} 
                      disabled={u.role === 'admin'} 
                      className="accent-indigo-500 w-5 h-5 sm:w-6 sm:h-6 rounded cursor-pointer"
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            )}
            
          </div>
        ))}
      </div>

      <ConfirmDialog 
        isOpen={!!confirmDelete}
        title={t('warning')}
        message={`"${confirmDelete?.username}" ကို ဖျက်သိမ်းရန် သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို နောက်ပြန်ဆုတ်၍ မရပါ။`}
        isDangerous={true}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />

    </div>
  );
}
