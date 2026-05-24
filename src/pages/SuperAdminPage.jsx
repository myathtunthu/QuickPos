import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  ShieldAlert, Plus, Store, Trash2, Search, Edit3, Save, X, 
  Download, BarChart3, Users, TrendingUp, Clock, Activity,
  UserCheck, UserX, Filter, Key, Eye, EyeOff, RotateCcw
} from 'lucide-react';

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPwd, setMasterPwd] = useState('');
  const [masterPasswordHash, setMasterPasswordHash] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [form, setForm] = useState({ shopName: '', username: '', password: '', expiryDate: '' });
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, trial: 0 });
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantAnalytics, setTenantAnalytics] = useState(null);
  const [bulkDays, setBulkDays] = useState('30');
  const [selectedIds, setSelectedIds] = useState([]);

  // Load Master Password
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'master'));
        if (snap.exists()) setMasterPasswordHash(snap.data().passwordHash || '');
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  const handleMasterLogin = (e) => {
    e.preventDefault();
    if (masterPwd === (masterPasswordHash || 'admin922021')) {
      setIsAuthenticated(true);
      addLog('Master Panel Accessed');
    } else { alert("Password မှားနေပါသည်"); setMasterPwd(''); }
  };

  const handleChangeMasterPassword = async (np) => {
    if (!np || np.length < 6) { alert('အနည်းဆုံး ၆ လုံး'); return; }
    await setDoc(doc(db, 'settings', 'master'), { passwordHash: np, updatedAt: Date.now() });
    setMasterPasswordHash(np); addLog('Master Password Changed'); setShowChangePwd(false);
    alert('✅ ပြောင်းလဲပြီး');
  };

  const addLog = (action) => {
    const log = { action, timestamp: new Date().toISOString(), id: Date.now() };
    setActivityLog(prev => [log, ...prev].slice(0, 100));
  };

  // Load Tenants
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'pos_users'), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const admins = all.filter(u => u.role === 'admin');
      setTenants(admins);
      const now = new Date();
      setStats({
        total: admins.length,
        active: admins.filter(u => !u.expiryDate || new Date(u.expiryDate) >= now).length,
        expired: admins.filter(u => u.expiryDate && new Date(u.expiryDate) < now).length,
        trial: admins.filter(u => !u.expiryDate).length,
      });
    });
    return () => unsub();
  }, [isAuthenticated]);

  // Filter
  useEffect(() => {
    let f = [...tenants];
    const now = new Date();
    if (statusFilter === 'active') f = f.filter(u => !u.expiryDate || new Date(u.expiryDate) >= now);
    if (statusFilter === 'expired') f = f.filter(u => u.expiryDate && new Date(u.expiryDate) < now);
    if (statusFilter === 'trial') f = f.filter(u => !u.expiryDate);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(u => (u.username||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
    }
    setFilteredTenants(f);
  }, [tenants, searchQuery, statusFilter]);

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.username || !form.password || !form.expiryDate) return alert("အားလုံးဖြည့်ပါ");
    try {
      const tid = `tnt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2,5)}`;
      const uc = await createUserWithEmailAndPassword(auth, form.username.trim(), form.password);
      await setDoc(doc(db, 'pos_users', uc.user.uid), { email: form.username.trim(), username: form.username.trim(), role: 'admin', permissions: [], tenantId: tid, expiryDate: form.expiryDate, createdAt: Date.now() });
      await setDoc(doc(db, 'pos_settings', tid), { shopName: form.shopName.trim(), tenantId: tid, createdAt: Date.now() });
      addLog(`Created: ${form.username}`);
      setForm({ shopName:'', username:'', password:'', expiryDate:'' }); setAdding(false);
    } catch (er) { alert(er.code==='auth/email-already-in-use'?'Email သုံးပြီး':'Error: '+er.message); }
  };

  const startEdit = (u) => { setEditingUser(u); setEditForm({ username: u.username || '', password: '' }); };
  const handleEditSave = async () => {
    if (!editingUser) return;
    const up = {};
    if (editForm.username.trim()) up.username = editForm.username.trim();
    if (editForm.password.trim()) up.password = editForm.password.trim();
    await updateDoc(doc(db, 'pos_users', editingUser.id), up);
    addLog(`Edited: ${editingUser.username}`);
    setEditingUser(null); setEditForm({ username:'', password:'' });
  };

  // ✅ Force Password Reset
  const forcePasswordReset = async (user) => {
    const newPwd = prompt(`Enter new password for ${user.username}:`);
    if (!newPwd || newPwd.length < 6) return alert('အနည်းဆုံး ၆ လုံး');
    await updateDoc(doc(db, 'pos_users', user.id), { password: newPwd });
    addLog(`Password Reset: ${user.username}`);
    alert('✅ Password ပြောင်းပြီး');
  };

  const updateExpiry = async (uid, nd) => { if(nd){ await setDoc(doc(db,'pos_users',uid),{expiryDate:nd},{merge:true}); addLog('Expiry Updated'); } };
  const deleteTenant = async (uid, un) => { if(window.confirm(`ဖျက်ရန်သေချာပါသလား? [${un}]`)){ await deleteDoc(doc(db,'pos_users',uid)); addLog(`Deleted: ${un}`); } };

  // ✅ Bulk Expiry Update
  const bulkUpdateExpiry = async () => {
    const days = parseInt(bulkDays) || 30;
    const now = new Date();
    now.setDate(now.getDate() + days);
    const newDate = now.toISOString().split('T')[0];
    for (const id of selectedIds) {
      await setDoc(doc(db, 'pos_users', id), { expiryDate: newDate }, { merge: true });
    }
    addLog(`Bulk Update: ${selectedIds.length} admins +${days} days`);
    setSelectedIds([]);
    alert(`✅ ${selectedIds.length} Admins သက်တမ်းတိုးပြီး`);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // ✅ Tenant Analytics
  const loadTenantAnalytics = async (tenant) => {
    setSelectedTenant(tenant);
    setShowAnalytics(true);
    try {
      const [recSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', tenant.tenantId))),
        getDocs(query(collection(db, 'pos_products'), where('tenantId', '==', tenant.tenantId)))
      ]);
      const records = recSnap.docs.map(d => d.data());
      const products = prodSnap.docs.map(d => d.data());
      const totalSales = records.filter(r => r.type === 'Sale' || r.type === 'sale').reduce((s,r) => s + (Number(r.amount)||0), 0);
      const totalPurchases = records.filter(r => r.type === 'Purchase' || r.type === 'purchase').reduce((s,r) => s + (Number(r.amount)||0), 0);
      const totalExpenses = records.filter(r => r.type === 'Expense' || r.type === 'expense').reduce((s,r) => s + (Number(r.amount)||0), 0);
      const orderCount = records.filter(r => r.type === 'Sale' || r.type === 'sale').length;
      setTenantAnalytics({ totalSales, totalPurchases, totalExpenses, orderCount, productCount: products.length, recordCount: records.length });
    } catch (e) { console.error(e); }
  };

  const exportCSV = () => {
    const h = 'Username,Email,Tenant ID,Expiry,Status';
    const rows = filteredTenants.map(t => [t.username||t.email, t.email||'', t.tenantId, t.expiryDate||'Trial', (t.expiryDate&&new Date(t.expiryDate)<new Date())?'Expired':'Active']);
    let csv = h+'\n'+rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const b = new Blob(['\uFEFF'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`tenants_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  if (loading) return <div className="min-h-screen bg-[#080c14] flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-400 border-t-transparent rounded-full animate-spin"/></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
        <form onSubmit={handleMasterLogin} className="bg-rose-950/20 border-2 border-rose-500/30 p-10 rounded-3xl w-full max-w-md text-center">
          <ShieldAlert size={64} className="mx-auto text-rose-500 mb-6"/>
          <h2 className="text-3xl font-black text-white mb-2">Master Control</h2>
          <input type="password" autoFocus value={masterPwd} onChange={e=>setMasterPwd(e.target.value)} placeholder="Master Key" className="w-full bg-black/50 border-2 border-rose-500/30 text-center text-2xl font-black text-white px-6 py-4 rounded-xl outline-none mb-6"/>
          <button type="submit" className="w-full py-4 bg-rose-600 text-white font-black text-xl rounded-xl">Access</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] p-4 sm:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header + Stats */}
        <div className="bg-gray-900 border-2 border-rose-500/20 rounded-3xl p-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-4"><div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500"><ShieldAlert size={36}/></div><div><h1 className="text-3xl font-black">SaaS Master Panel</h1></div></div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>setShowChangePwd(!showChangePwd)} className="px-4 py-2 bg-amber-600/20 text-amber-400 rounded-xl font-bold flex items-center gap-2"><Key size={16}/> Pwd</button>
              <button onClick={()=>setShowLog(!showLog)} className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-xl font-bold flex items-center gap-2"><Activity size={16}/> Log</button>
              <button onClick={exportCSV} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl font-bold flex items-center gap-2"><Download size={16}/> Export</button>
              <button onClick={()=>{setAdding(!adding);setEditingUser(null);}} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2"><Plus size={16}/> New</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{label:'Total',value:stats.total,icon:Users,color:'text-cyan-400'},{label:'Active',value:stats.active,icon:UserCheck,color:'text-emerald-400'},{label:'Expired',value:stats.expired,icon:UserX,color:'text-rose-400'},{label:'Trial',value:stats.trial,icon:Clock,color:'text-amber-400'}].map(s=>{const I=s.icon;return <div key={s.label} className="bg-black/30 rounded-2xl p-4 text-center"><I size={24} className={`mx-auto mb-2 ${s.color}`}/><p className="text-2xl font-black">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>;})}
          </div>
        </div>

        {/* Change Password */}
        {showChangePwd && (
          <div className="bg-gray-900 border-2 border-amber-500/20 rounded-3xl p-6">
            <h3 className="text-lg font-black text-amber-400 mb-4">🔑 Change Master Password</h3>
            <div className="flex gap-3"><input type="password" id="np" placeholder="New Password" className="flex-1 bg-black/50 border border-amber-500/20 rounded-xl px-4 py-3 text-white"/><button onClick={()=>{const e=document.getElementById('np');if(e)handleChangeMasterPassword(e.value);}} className="px-6 py-3 bg-amber-600 rounded-xl font-bold">Update</button></div>
          </div>
        )}

        {/* Activity Log */}
        {showLog && (
          <div className="bg-gray-900 border-2 border-purple-500/20 rounded-3xl p-6 max-h-64 overflow-y-auto">
            <h3 className="text-lg font-black text-purple-400 mb-4">📋 Activity Log</h3>
            <div className="space-y-2 text-sm">{activityLog.length===0&&<p className="text-slate-500">No activity</p>}{activityLog.map(l=><div key={l.id} className="flex justify-between text-slate-400"><span>{l.action}</span><span className="text-xs">{new Date(l.timestamp).toLocaleString()}</span></div>)}</div>
          </div>
        )}

        {/* ✅ Tenant Analytics Modal */}
        {showAnalytics && selectedTenant && tenantAnalytics && (
          <div className="bg-gray-900 border-2 border-cyan-500/20 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-cyan-400">📊 {selectedTenant.username} Analytics</h3>
              <button onClick={()=>{setShowAnalytics(false);setSelectedTenant(null);setTenantAnalytics(null);}} className="text-slate-400"><X size={24}/></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[{label:'Total Sales',value:tenantAnalytics.totalSales,color:'text-cyan-400'},{label:'Purchases',value:tenantAnalytics.totalPurchases,color:'text-blue-400'},{label:'Expenses',value:tenantAnalytics.totalExpenses,color:'text-amber-400'},{label:'Orders',value:tenantAnalytics.orderCount,color:'text-white'},{label:'Products',value:tenantAnalytics.productCount,color:'text-emerald-400'},{label:'Records',value:tenantAnalytics.recordCount,color:'text-purple-400'}].map(s=><div key={s.label} className="bg-black/30 rounded-2xl p-4 text-center"><p className={`text-2xl font-black ${s.color}`}>{(s.label.includes('Sales')||s.label.includes('Purchases')||s.label.includes('Expenses'))?Number(s.value).toLocaleString()+' Ks':s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>)}
            </div>
          </div>
        )}

        {/* Add Form */}
        {adding && (
          <form onSubmit={handleCreateTenant} className="bg-gray-900 border-2 border-cyan-500/20 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-black text-cyan-400">Register New Shop</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required value={form.shopName} onChange={e=>setForm({...form,shopName:e.target.value})} placeholder="Shop Name" className="bg-black/50 border border-cyan-500/20 rounded-xl p-3"/>
              <input required type="email" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Admin Email" className="bg-black/50 border border-cyan-500/20 rounded-xl p-3"/>
              <input required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" className="bg-black/50 border border-cyan-500/20 rounded-xl p-3"/>
              <input required type="date" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})} className="bg-black/50 border border-cyan-500/20 rounded-xl p-3 text-cyan-400"/>
            </div>
            <div className="flex gap-3"><button type="submit" className="px-6 py-3 bg-cyan-600 rounded-xl font-bold">Create</button><button type="button" onClick={()=>setAdding(false)} className="px-6 py-3 bg-slate-700 rounded-xl">Cancel</button></div>
          </form>
        )}

        {/* Search + Filter + Bulk */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-4 top-3 text-slate-500"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-gray-900 border border-white/10 rounded-xl pl-12 pr-4 py-3"/></div>
          <div className="flex gap-2">{['all','active','expired','trial'].map(f=><button key={f} onClick={()=>setStatusFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${statusFilter===f?'bg-cyan-600 text-white':'bg-gray-900 text-slate-500 border border-white/5'}`}>{f}</button>)}</div>
          {selectedIds.length > 0 && (
            <div className="flex gap-2 items-center">
              <input type="number" value={bulkDays} onChange={e=>setBulkDays(e.target.value)} className="w-20 bg-black border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-cyan-400"/>
              <button onClick={bulkUpdateExpiry} className="px-4 py-2 bg-cyan-600 rounded-xl text-sm font-bold">+{bulkDays} Days ({selectedIds.length})</button>
            </div>
          )}
        </div>

        {/* Tenant List */}
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{filteredTenants.length} tenants</p>
          {filteredTenants.map(t=>{
            const isExpired=t.expiryDate&&new Date(t.expiryDate)<new Date();
            return (
              <div key={t.id} className={`bg-gray-900 p-5 rounded-2xl border-2 ${isExpired?'border-rose-500/20':'border-emerald-500/10'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* ✅ Bulk Select */}
                    <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={()=>toggleSelect(t.id)} className="mt-2 accent-cyan-500 w-5 h-5"/>
                    <div className={`p-3 rounded-xl ${isExpired?'bg-rose-500/10 text-rose-500':'bg-emerald-500/10 text-emerald-500'}`}><Store size={28}/></div>
                    <div>
                      <p className="font-black text-xl">{t.username||t.email}</p>
                      <p className="text-xs text-slate-500">Tenant: {t.tenantId}</p>
                      <span className={`text-xs font-bold ${isExpired?'text-rose-400':'text-emerald-400'}`}>{isExpired?'⚠️ Expired':'✓ Active'}</span>
                      {/* ✅ View Analytics Button */}
                      <button onClick={()=>loadTenantAnalytics(t)} className="block text-xs text-cyan-400 mt-1 hover:underline"><Eye size={12} className="inline"/> View Analytics</button>
                    </div>
                  </div>
                  {editingUser?.id===t.id?(
                    <div className="flex gap-2 items-center">
                      <input value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})} placeholder="Username" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm w-32"/>
                      <input value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="New Pwd" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm w-24"/>
                      <button onClick={handleEditSave} className="p-2 bg-indigo-600 rounded-lg"><Save size={16}/></button>
                      <button onClick={()=>setEditingUser(null)} className="p-2 bg-slate-700 rounded-lg"><X size={16}/></button>
                    </div>
                  ):(
                    <div className="flex gap-2 items-center">
                      <input type="date" defaultValue={t.expiryDate} onBlur={e=>updateExpiry(t.id,e.target.value)} className={`bg-black border rounded-lg px-3 py-2 text-sm ${isExpired?'border-rose-500/30 text-rose-300':'border-emerald-500/30 text-emerald-300'}`}/>
                      <button onClick={()=>startEdit(t)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg"><Edit3 size={16}/></button>
                      {/* ✅ Force Password Reset */}
                      <button onClick={()=>forcePasswordReset(t)} className="p-2 bg-amber-600/20 text-amber-400 rounded-lg"><RotateCcw size={16}/></button>
                      <button onClick={()=>deleteTenant(t.id,t.username)} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
