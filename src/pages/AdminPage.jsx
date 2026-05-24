import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

// ─── PERMISSIONS & HASH FUNCTION ───
const PERMISSION_OPTIONS = [
  { key: 'create_sale', label: 'အရောင်းလုပ်ခွင့်' },
  { key: 'view_sales', label: 'အရောင်းမှတ်တမ်းကြည့်ခွင့်' },
  { key: 'accept_payment', label: 'ကြွေးဆပ်လက်ခံခွင့်' },
  { key: 'view_inventory', label: 'ကုန်လက်ကျန်ကြည့်ခွင့်' },
  { key: 'create_purchase', label: 'အဝယ်လုပ်ခွင့်' },
  { key: 'create_expense', label: 'စရိတ်ထည့်ခွင့်' },
  { key: 'manage_inventory', label: 'ကုန်လက်ကျန်ပြင်ခွင့်' },
  { key: 'manage_products', label: 'ကုန်ပစ္စည်းစီမံခွင့်' },
  { key: 'manage_users', label: 'User စီမံခွင့်' },
  { key: 'delete_records', label: 'မှတ်တမ်းဖျက်ခွင့်' },
  { key: 'view_reports', label: 'Dashboard/Report ကြည့်ခွင့်' },
  { key: 'settings', label: 'ဆက်တင်ပြင်ခွင့်' },
];

const DEFAULT_STAFF_PERMS = ['create_sale', 'view_sales', 'accept_payment', 'view_inventory'];

const simpleHash = str => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'h_' + h.toString(16).padStart(8, '0');
};

export default function AdminPage() {
  const { userData } = useAuth();
  const [posUsers, setPosUsers] = useState([]);
  
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' });
  const [showPwd, setShowPwd] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [editingPerms, setEditingPerms] = useState(null);

  // Users ဆွဲထုတ်ခြင်း
  useEffect(() => {
    if (!userData?.tenantId) return;
    const unsub = onSnapshot(collection(db, 'pos_users'), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosUsers(all.filter(u => u.tenantId === userData.tenantId));
    });
    return () => unsub();
  }, [userData]);

  // User အသစ်ထည့်ခြင်း
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) return;
    if (!adminPassword.trim()) return alert("Admin password ထည့်ရန် လိုအပ်ပါသည်။");
    
    // လက်ရှိ Admin ရဲ့ Password မှန်/မမှန် စစ်ဆေးခြင်း
    if (userData.password !== simpleHash(adminPassword)) {
      return alert("Admin password မှားနေပါသည်။");
    }
    
    if (posUsers.some(u => u.username === form.username.trim())) {
      return alert("ဒီနာမည်ဖြင့် User ရှိပြီးသားပါ။");
    }

    try {
      await addDoc(collection(db, 'pos_users'), {
        tenantId: userData.tenantId, 
        username: form.username.trim(),
        password: simpleHash(form.password), 
        role: form.role,
        permissions: form.role === 'staff' ? DEFAULT_STAFF_PERMS : [],
        createdAt: Date.now(),
      });
      alert("User အသစ်ဖန်တီးပြီးပါပြီ။");
      setForm({ username: '', password: '', role: 'staff' }); 
      setAdminPassword(''); 
      setAdding(false);
    } catch (error) {
      alert("User ဖန်တီးရာတွင် အမှားအယွင်းဖြစ်နေပါသည်။");
    }
  };

  // လုပ်ပိုင်ခွင့် အဖွင့်အပိတ် လုပ်ခြင်း
  const togglePermission = async (user, permKey) => {
    const newPerms = user.permissions?.includes(permKey) 
      ? user.permissions.filter(p => p !== permKey) 
      : [...(user.permissions || []), permKey];
    await setDoc(doc(db, 'pos_users', user.id), { permissions: newPerms }, { merge: true });
  };

  const handleDelete = async (u) => {
    if (u.role === 'admin' && posUsers.filter(x => x.role === 'admin').length <= 1) {
      return alert("နောက်ဆုံး Admin ကို ဖျက်ခွင့်မပြုပါ။");
    }
    if (window.confirm(`${u.username} ကို ဖျက်ရန် သေချာပါသလား?`)) {
      await deleteDoc(doc(db, 'pos_users', u.id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      
      {/* ─── HEADER ─── */}
      <div className="bg-[#0d1120] border-2 border-indigo-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex justify-between items-center animate-fade-in">
        <h3 className="font-black text-white flex items-center gap-4 text-2xl">
          <Users size={30} className="text-indigo-500"/> Staff
        </h3>
        <button onClick={() => setAdding(!adding)} className="bg-indigo-900/40 text-indigo-400 px-5 sm:px-6 py-3 sm:py-4 rounded-xl font-black text-lg flex items-center gap-2 hover:bg-indigo-900/60 transition-all">
          <Plus size={24}/> Add
        </button>
      </div>

      {/* ─── ADD USER FORM ─── */}
      {adding && (
        <form onSubmit={handleAdd} className="bg-black/40 p-6 sm:p-8 rounded-3xl border-2 border-indigo-500/15 space-y-5 shadow-lg animate-fade-in">
          <input required value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="Username အသစ်" className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl outline-none focus:border-indigo-500/50" />
          
          <div className="relative">
            <input required type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Password အသစ်" className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl pr-16 outline-none focus:border-indigo-500/50" />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-5 top-4 sm:top-5 text-slate-500 hover:text-indigo-400 transition-colors">
              {showPwd ? <EyeOff size={26}/> : <Eye size={26}/>}
            </button>
          </div>
          
          <div className="relative">
            <input required type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="သင့် (Admin) ရဲ့ Password" className="w-full px-5 py-4 sm:py-5 bg-amber-950/20 border-2 border-amber-500/20 rounded-xl text-lg sm:text-xl text-amber-300 outline-none focus:border-amber-400/50" />
          </div>
          
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl outline-none focus:border-indigo-500/50">
            <option value="staff">Staff (ဝန်ထမ်း)</option>
            <option value="admin">Admin (မန်နေဂျာ)</option>
          </select>
          
          <div className="flex gap-4 sm:gap-5 pt-2">
            <button type="submit" className="flex-1 py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-xl font-black text-lg sm:text-xl">Create</button>
            <button type="button" onClick={() => setAdding(false)} className="px-6 sm:px-8 py-4 sm:py-5 bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 rounded-xl font-black text-lg sm:text-xl">Cancel</button>
          </div>
        </form>
      )}

      {/* ─── USERS LIST ─── */}
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
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
                    {u.role}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-none border-white/5">
                <button onClick={() => setEditingPerms(editingPerms === u.id ? null : u.id)} className={`flex-1 sm:flex-none text-sm sm:text-base font-bold px-4 sm:px-5 py-3 rounded-xl border-2 flex justify-center items-center gap-2 transition-colors ${editingPerms === u.id ? 'bg-indigo-600 text-white border-indigo-500' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20'}`}>
                  <ShieldCheck size={20}/> {editingPerms === u.id ? 'Close' : 'Permissions'}
                </button>
                {u.username !== userData?.username && (
                  <button onClick={() => handleDelete(u)} className="text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-500/10 border-2 border-rose-500/20 p-3 rounded-xl transition-all">
                    <Trash2 size={22} sm:size={24}/>
                  </button>
                )}
              </div>
            </div>

            {/* Permissions Panel */}
            {editingPerms === u.id && (
              <div className="mt-5 sm:mt-6 p-5 sm:p-6 bg-black/60 rounded-2xl border-2 border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 animate-fade-in shadow-inner">
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
    </div>
  );
}
