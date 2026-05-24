import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ShieldAlert, Plus, Store, Trash2 } from 'lucide-react';

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPwd, setMasterPwd] = useState('');
  
  const [tenants, setTenants] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ shopName: '', username: '', password: '', expiryDate: '' });

  // 🔒 Master Password စစ်ဆေးခြင်း
  const handleMasterLogin = (e) => {
    e.preventDefault();
    if (masterPwd === 'admin922021') {
      setIsAuthenticated(true);
    } else {
      alert("Master Password မှားယွင်းနေပါသည်။");
      setMasterPwd('');
    }
  };

  // Database မှ Admin အားလုံးကို ဆွဲထုတ်ခြင်း
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'pos_users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTenants(allUsers.filter(u => u.role === 'admin'));
    }, (error) => {
      console.error('Firestore error:', error);
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Admin အသစ် ဖန်တီးခြင်း
  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.username || !form.password || !form.expiryDate) {
      return alert("အချက်အလက်အားလုံး ပြည့်စုံအောင် ထည့်ပါ။");
    }

    try {
      // 1. Generate UNIQUE tenantId
      const tenantId = `tnt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;

      // 2. Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, form.username.trim(), form.password);
      const uid = userCredential.user.uid;

      // 3. Save to pos_users with UID as Document ID
      await setDoc(doc(db, 'pos_users', uid), {
        email: form.username.trim(),
        username: form.username.trim(),
        role: 'admin',
        permissions: [],
        tenantId: tenantId,
        expiryDate: form.expiryDate,
        createdAt: Date.now(),
      });

      // 4. Create pos_settings for this tenant
      await setDoc(doc(db, 'pos_settings', tenantId), {
        shopName: form.shopName.trim(),
        tenantId: tenantId,
        createdAt: Date.now(),
      });

      alert(`✅ Admin ဖန်တီးပြီးပါပြီ!\nEmail: ${form.username}\nTenant ID: ${tenantId}`);
      setForm({ shopName: '', username: '', password: '', expiryDate: '' });
      setAdding(false);
    } catch (error) {
      // Handle duplicate email error
      if (error.code === 'auth/email-already-in-use') {
        alert('❌ ဒီ Email ကို သုံးပြီးသားပါ။ တခြား Email သုံးပါ။');
      } else {
        alert('❌ Error: ' + error.message);
      }
      console.error(error);
    }
  };

  // သက်တမ်း ပြင်ဆင်ခြင်း
  const updateExpiry = async (userId, newDate) => {
    if (!newDate) return;
    try {
      await setDoc(doc(db, 'pos_users', userId), { expiryDate: newDate }, { merge: true });
      alert("သက်တမ်း အောင်မြင်စွာ တိုးပေးလိုက်ပါပြီ။");
    } catch (error) {
      alert("Error updating expiry date.");
    }
  };

  // Admin ဖျက်ခြင်း
  const deleteTenant = async (userId, username) => {
    if (window.confirm(`သတိပြုရန် - [ ${username} ] ၏ အကောင့်ကို ဖျက်ရန် သေချာပါသလား?`)) {
      await deleteDoc(doc(db, 'pos_users', userId));
    }
  };

  // 🔒 Master Login UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
        <form onSubmit={handleMasterLogin} className="bg-rose-950/20 border-2 border-rose-500/30 p-10 rounded-3xl w-full max-w-md text-center shadow-[0_0_50px_rgba(244,63,94,0.15)] animate-fade-in">
          <ShieldAlert size={64} className="mx-auto text-rose-500 mb-6"/>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Master Control</h2>
          <p className="text-rose-400 font-bold mb-8">Restricted Area (Authorized Personnel Only)</p>
          <input 
            type="password" autoFocus required value={masterPwd} onChange={e => setMasterPwd(e.target.value)} 
            placeholder="Enter Master Key" 
            className="w-full bg-black/50 border-2 border-rose-500/30 text-center text-2xl font-black tracking-widest text-white px-6 py-4 rounded-xl outline-none focus:border-rose-500 mb-6"
          />
          <button type="submit" className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xl rounded-xl transition-all shadow-lg shadow-rose-500/20">
            Access System
          </button>
        </form>
      </div>
    );
  }

  // 🛠 Master Control Panel UI
  return (
    <div className="min-h-screen bg-[#080c14] p-4 sm:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-900 border-2 border-rose-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500"><ShieldAlert size={36}/></div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-widest">SaaS Master Panel</h1>
              <p className="text-rose-400 font-bold mt-1">Manage Tenants & Subscriptions</p>
            </div>
          </div>
          <button onClick={() => setAdding(!adding)} className="mt-4 sm:mt-0 bg-rose-600 text-white px-6 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20">
            <Plus size={24}/> Create Tenant
          </button>
        </div>

        {/* Add Tenant Form */}
        {adding && (
          <form onSubmit={handleCreateTenant} className="bg-gray-900 border-2 border-cyan-500/20 rounded-3xl p-6 sm:p-8 shadow-xl animate-fade-in space-y-6">
            <h3 className="text-xl font-black text-cyan-400 border-b border-white/5 pb-4">Register New Shop (ဆိုင်သစ် ဖွင့်ပေးရန်)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Shop Name</label><input required value={form.shopName} onChange={e=>setForm({...form, shopName: e.target.value})} placeholder="ဆိုင်အမည်..." className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl p-4 text-xl font-bold text-white outline-none focus:border-cyan-400"/></div>
              <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Admin Email</label><input required type="email" value={form.username} onChange={e=>setForm({...form, username: e.target.value})} placeholder="admin@shop.com" className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl p-4 text-xl font-bold text-white outline-none focus:border-cyan-400"/></div>
              <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Password</label><input required type="text" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Password..." className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl p-4 text-xl font-bold text-white outline-none focus:border-cyan-400"/></div>
              <div><label className="text-xs font-black text-slate-500 uppercase block mb-2">Expiry Date (သက်တမ်း)</label><input required type="date" value={form.expiryDate} onChange={e=>setForm({...form, expiryDate: e.target.value})} className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl p-4 text-xl font-bold text-cyan-400 outline-none focus:border-cyan-400"/></div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="submit" className="px-8 py-4 bg-cyan-600 text-white rounded-xl font-black text-lg hover:bg-cyan-500">Create Account</button>
              <button type="button" onClick={()=>setAdding(false)} className="px-8 py-4 bg-slate-800 text-slate-400 rounded-xl font-black text-lg hover:bg-slate-700">Cancel</button>
            </div>
          </form>
        )}

        {/* Tenants List */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest pl-2">Active Tenants ({tenants.length})</h3>
          {tenants.map(t => {
            const isExpired = new Date(t.expiryDate) < new Date();
            return (
              <div key={t.id} className={`bg-gray-900 p-6 rounded-2xl border-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all shadow-lg ${isExpired ? 'border-rose-500/30 hover:border-rose-500/50' : 'border-emerald-500/20 hover:border-emerald-500/40'}`}>
                
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-4 rounded-xl flex-shrink-0 ${isExpired ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    <Store size={32}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-2xl text-white">{t.username}</p>
                      <span className="text-xs font-black px-2 py-1 rounded bg-slate-800 text-slate-400 border border-white/10 uppercase">Admin</span>
                    </div>
                    <p className="text-sm font-mono text-slate-500 mt-2">Tenant: {t.tenantId}</p>
                    <p className={`text-sm font-bold mt-1 ${isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isExpired ? '⚠️ သက်တမ်းကုန်သွားပါပြီ' : '✓ Active'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                  <div className="flex-1 md:flex-none">
                    <label className="text-xs font-black text-slate-500 uppercase block mb-1">Expiry Date</label>
                    <input 
                      type="date" 
                      defaultValue={t.expiryDate} 
                      onBlur={e => updateExpiry(t.id, e.target.value)}
                      className={`w-full md:w-auto px-4 py-3 bg-black border-2 rounded-xl text-lg font-bold outline-none transition-colors ${isExpired ? 'border-rose-500/30 text-rose-300 focus:border-rose-400' : 'border-emerald-500/30 text-emerald-300 focus:border-emerald-400'}`}
                    />
                  </div>
                  <button onClick={() => deleteTenant(t.id, t.username)} className="p-4 bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white mt-5 transition-colors">
                    <Trash2 size={24}/>
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
