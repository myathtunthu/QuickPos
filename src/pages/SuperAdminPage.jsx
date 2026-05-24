import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  ShieldAlert, Plus, Store, Trash2, Search, Edit3, Save, X, 
  Download, Eye, BarChart3, Users, TrendingUp, Clock, Activity,
  UserCheck, UserX, Filter, RefreshCw, Send, Key, AlertTriangle
} from 'lucide-react';

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPwd, setMasterPwd] = useState('');
  const [masterPasswordHash, setMasterPasswordHash] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, expired
  const [adding, setAdding] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [form, setForm] = useState({ shopName: '', username: '', password: '', expiryDate: '' });
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, trial: 0 });
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  // ✅ Load Master Password
  useEffect(() => {
    const loadMasterPassword = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'master'));
        if (snap.exists()) setMasterPasswordHash(snap.data().passwordHash || '');
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    loadMasterPassword();
  }, []);

  // ✅ Master Password Check
  const handleMasterLogin = (e) => {
    e.preventDefault();
    const storedHash = masterPasswordHash || 'admin922021';
    if (masterPwd === storedHash) {
      setIsAuthenticated(true);
      addLog('Master Panel Accessed');
    } else {
      alert("Master Password မှားယွင်းနေပါသည်။");
      setMasterPwd('');
    }
  };

  // ✅ Change Master Password
  const handleChangeMasterPassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) { alert('Password အနည်းဆုံး ၆ လုံး'); return; }
    try {
      await setDoc(doc(db, 'settings', 'master'), { passwordHash: newPassword, updatedAt: Date.now() });
      setMasterPasswordHash(newPassword);
      alert('✅ Master Password ပြောင်းလဲပြီး');
      addLog('Master Password Changed');
      setShowChangePwd(false);
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ✅ Activity Log
  const addLog = (action) => {
    const log = { action, timestamp: new Date().toISOString(), id: Date.now() };
    setActivityLog(prev => [log, ...prev].slice(0, 50));
    setDoc(doc(db, 'settings', 'master'), { lastActivity: log }, { merge: true }).catch(() => {});
  };

  // ✅ Load Tenants + Stats
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = onSnapshot(collection(db, 'pos_users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const admins = allUsers.filter(u => u.role === 'admin');
      setTenants(admins);
      
      const now = new Date();
      const active = admins.filter(u => !u.expiryDate || new Date(u.expiryDate) >= now).length;
      const expired = admins.filter(u => u.expiryDate && new Date(u.expiryDate) < now).length;
      const trial = admins.filter(u => !u.expiryDate).length;
      setStats({ total: admins.length, active, expired, trial });
    });
    return () => unsub();
  }, [isAuthenticated]);

  // ✅ Filter & Search
  useEffect(() => {
    let filtered = [...tenants];
    const now = new Date();
    
    if (statusFilter === 'active') filtered = filtered.filter(u => !u.expiryDate || new Date(u.expiryDate) >= now);
    if (statusFilter === 'expired') filtered = filtered.filter(u => u.expiryDate && new Date(u.expiryDate) < now);
    if (statusFilter === 'trial') filtered = filtered.filter(u => !u.expiryDate);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u => (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.tenantId || '').toLowerCase().includes(q));
    }
    
    setFilteredTenants(filtered);
  }, [tenants, searchQuery, statusFilter]);

  // ✅ Create Tenant
  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.username || !form.password || !form.expiryDate) return alert("အားလုံးဖြည့်ပါ");
    try {
      const tenantId = `tnt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
      const userCredential = await createUserWithEmailAndPassword(auth, form.username.trim(), form.password);
      const uid = userCredential.user.uid;
      await setDoc(doc(db, 'pos_users', uid), { email: form.username.trim(), username: form.username.trim(), role: 'admin', permissions: [], tenantId, expiryDate: form.expiryDate, createdAt: Date.now() });
      await setDoc(doc(db, 'pos_settings', tenantId), { shopName: form.shopName.trim(), tenantId, createdAt: Date.now() });
      alert(`✅ ဖန်တီးပြီး\nEmail: ${form.username}\nTenant: ${tenantId}`);
      addLog(`Created Admin: ${form.username}`);
      setForm({ shopName: '', username: '', password: '', expiryDate: '' }); setAdding(false);
    } catch (error) {
      alert(error.code === 'auth/email-already-in-use' ? '❌ Email သုံးပြီးသား' : '❌ Error: ' + error.message);
    }
  };

  // ✅ Edit Admin
  const startEdit = (user) => { setEditingUser(user); setEditForm({ username: user.username || user.email || '', password: '' }); };
  const handleEditSave = async () => {
    if (!editingUser) return;
    try {
      const updates = {};
      if (editForm.username.trim()) updates.username = editForm.username.trim();
      if (editForm.password.trim()) updates.password = editForm.password.trim();
      await updateDoc(doc(db, 'pos_users', editingUser.id), updates);
      addLog(`Edited Admin: ${editingUser.username}`);
      setEditingUser(null); setEditForm({ username: '', password: '' });
      alert('✅ ပြင်ဆင်ပြီး');
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ✅ Update Expiry
  const updateExpiry = async (userId, newDate) => {
    if (!newDate) return;
    await setDoc(doc(db, 'pos_users', userId), { expiryDate: newDate }, { merge: true });
    addLog(`Updated Expiry for tenant`);
  };

  // ✅ Delete
  const deleteTenant = async (userId, username) => {
    if (window.confirm(`ဖျက်ရန်သေချာပါသလား? [${username}]`)) {
      await deleteDoc(doc(db, 'pos_users', userId));
      addLog(`Deleted Admin: ${username}`);
    }
  };

  // ✅ Export CSV
  const exportCSV = () => {
    const headers = ['Username', 'Email', 'Tenant ID', 'Expiry Date', 'Status'];
    const rows = filteredTenants.map(t => [
      t.username || t.email, t.email || '', t.tenantId, t.expiryDate || 'Trial',
      (t.expiryDate && new Date(t.expiryDate) < new Date()) ? 'Expired' : 'Active'
    ]);
    let csv = headers.join(',') + '\n' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tenants_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    addLog('Exported Tenant CSV');
  };

  // Loading
  if (loading) return <div className="min-h-screen bg-[#080c14] flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" /></div>;

  // Login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
        <form onSubmit={handleMasterLogin} className="bg-rose-950/20 border-2 border-rose-500/30 p-10 rounded-3xl w-full max-w-md text-center">
          <ShieldAlert size={64} className="mx-auto text-rose-500 mb-6"/>
          <h2 className="text-3xl font-black text-white mb-2">Master Control</h2>
          <p className="text-rose-400 font-bold mb-8">Restricted Area</p>
          <input type="password" autoFocus required value={masterPwd} onChange={e => setMasterPwd(e.target.value)} placeholder="Enter Master Key" className="w-full bg-black/50 border-2 border-rose-500/30 text-center text-2xl font-black text-white px-6 py-4 rounded-xl outline-none mb-6"/>
          <button type="submit" className="w-full py-4 bg-rose-600 text-white font-black text-xl rounded-xl">Access System</button>
        </form>
      </div>
    );
  }

  // Master Panel
  return (
    <div className="min-h-screen bg-[#080c14] p-4 sm:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header + Stats */}
        <div className="bg-gray-900 border-2 border-rose-500/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500"><ShieldAlert size={36}/></div>
              <div><h1 className="text-3xl font-black uppercase">SaaS Master Panel</h1><p className="text-rose-400 font-bold">Manage Tenants</p></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowChangePwd(!showChangePwd)} className="px-4 py-2 bg-amber-600/20 text-amber-400 rounded-xl font-bold flex items-center gap-2"><Key size={16}/> Pwd</button>
              <button onClick={() => setShowLog(!showLog)} className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-xl font-bold flex items-center gap-2"><Activity size={16}/> Log</button>
              <button onClick={exportCSV} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl font-bold flex items-center gap-2"><Download size={16}/> Export</button>
              <button onClick={() => { setAdding(!adding); setEditingUser(null); }} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2"><Plus size={16}/> New</button>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{ label: 'Total', value: stats.total, icon: Users, color: 'text-cyan-400' }, { label: 'Active', value: stats.active, icon: UserCheck, color: 'text-emerald-400' }, { label: 'Expired', value: stats.expired, icon: UserX, color: 'text-rose-400' }, { label: 'Trial', value: stats.trial, icon: Clock, color: 'text-amber-400' }].map(s => {
              const Icon = s.icon;
              return <div key={s.label} className="bg-black/30 rounded-2xl p-4 text-center"><Icon size={24} className={`mx-auto mb-2 ${s.color}`}/><p className="text-2xl font-black">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>;
            })}
          </div>
        </div>

        {/* Change Password */}
        {showChangePwd && (
          <div className="bg-gray-900 border-2 border-amber-500/20 rounded-3xl p-6">
            <h3 className="text-lg font-black text-amber-400 mb-4">🔑 Change Master Password</h3>
            <div className="flex gap-3">
              <input type="password" id="newPwd" placeholder="New Password (min 6)" className="flex-1 bg-black/50 border-2 border-amber-500/20 rounded-xl px-4 py-3 text-white outline-none"/>
              <button onClick={() => { const el = document.getElementById('newPwd'); if(el) handleChangeMasterPassword(el.value); }} className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold">Update</button>
            </div>
          </div>
        )}

        {/* Activity Log */}
        {showLog && (
          <div className="bg-gray-900 border-2 border-purple-500/20 rounded-3xl p-6 max-h-64 overflow-y-auto">
            <h3 className="text-lg font-black text-purple-400 mb-4">📋 Activity Log</h3>
            <div className="space-y-2 text-sm">
              {activityLog.length === 0 && <p className="text-slate-500">No activity yet</p>}
              {activityLog.map(log => <div key={log.id} className="flex justify-between text-slate-400"><span>{log.action}</span><span className="text-xs">{new Date(log.timestamp).toLocaleString()}</span></div>)}
            </div>
          </div>
        )}

        {/* Add Form */}
        {adding && (
          <form onSubmit={handleCreateTenant} className="bg-gray-900 border-2 border-cyan-500/20 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-black text-cyan-400">Register New Shop</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required value={form.shopName} onChange={e=>setForm({...form,shopName:e.target.value})} placeholder="Shop Name" className="bg-black/50 border border-cyan-500/20 rounded-xl p-3 text-white"/>
              <input required type="email" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Admin Email" className="bg-black/50 border border-cyan-500/20 rounded-xl p-3 text-white"/>
              <input required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" className="bg-black/50 border border-cyan-500/20 rounded-xl p-3 text-white"/>
              <input required type="date" value={form.expiryDate} onChange={e=>setForm({...form,expiryDate:e.target.value})} className="bg-black/50 border border-cyan-500/20 rounded-xl p-3 text-cyan-400"/>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold">Create</button>
              <button type="button" onClick={()=>setAdding(false)} className="px-6 py-3 bg-slate-700 rounded-xl">Cancel</button>
            </div>
          </form>
        )}

        {/* Search + Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-4 top-3 text-slate-500"/>
            <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search admin..." className="w-full bg-gray-900 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white"/>
          </div>
          <div className="flex gap-2">
            {['all','active','expired','trial'].map(f => (
              <button key={f} onClick={()=>setStatusFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${statusFilter===f?'bg-cyan-600 text-white':'bg-gray-900 text-slate-500 border border-white/5'}`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Tenant List */}
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{filteredTenants.length} tenants found</p>
          {filteredTenants.map(t => {
            const isExpired = t.expiryDate && new Date(t.expiryDate) < new Date();
            return (
              <div key={t.id} className={`bg-gray-900 p-5 rounded-2xl border-2 ${isExpired?'border-rose-500/20':'border-emerald-500/10'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isExpired?'bg-rose-500/10 text-rose-500':'bg-emerald-500/10 text-emerald-500'}`}><Store size={28}/></div>
                    <div>
                      <p className="font-black text-xl">{t.username || t.email}</p>
                      <p className="text-xs text-slate-500">Tenant: {t.tenantId}</p>
                      <span className={`text-xs font-bold ${isExpired?'text-rose-400':'text-emerald-400'}`}>{isExpired?'⚠️ Expired':'✓ Active'}</span>
                    </div>
                  </div>
                  
                  {editingUser?.id === t.id ? (
                    <div className="flex gap-2 items-center">
                      <input value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})} placeholder="Username" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white w-32"/>
                      <input value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="New Pwd" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white w-24"/>
                      <button onClick={handleEditSave} className="p-2 bg-indigo-600 text-white rounded-lg"><Save size={16}/></button>
                      <button onClick={()=>setEditingUser(null)} className="p-2 bg-slate-700 rounded-lg"><X size={16}/></button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <input type="date" defaultValue={t.expiryDate} onBlur={e=>updateExpiry(t.id,e.target.value)} className={`bg-black border rounded-lg px-3 py-2 text-sm ${isExpired?'border-rose-500/30 text-rose-300':'border-emerald-500/30 text-emerald-300'}`}/>
                      <button onClick={()=>startEdit(t)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg"><Edit3 size={16}/></button>
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
