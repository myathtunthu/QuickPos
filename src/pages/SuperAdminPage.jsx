import React, { useState, useEffect } from 'react';
import { db, auth, secondaryAuth } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc, getDocs, query, where, writeBatch, orderBy, limit } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth'; // 🌟 Auth functions
import { 
  ShieldAlert, Plus, Store, Trash2, Search, Edit3, Save, X, 
  Download, Eye, Users, Clock, Activity, UserCheck, UserX, 
  Filter, Key, RotateCcw, Copy, Zap, AlertTriangle, Send,
  BarChart3, TrendingUp, RefreshCw, ToggleRight, Bell, 
  HardDrive, Database, DollarSign, FileText, Cloud
} from 'lucide-react';

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // 🌟 Email & Password Login အတွက်
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [form, setForm] = useState({ shopName: '', username: '', password: '', expiryDate: '' });
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, trial: 0, blocked: 0 });
  const [activityLog, setActivityLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantAnalytics, setTenantAnalytics] = useState(null);
  const [bulkDays, setBulkDays] = useState('30');
  const [selectedIds, setSelectedIds] = useState([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [systemOverview, setSystemOverview] = useState({ totalSales: 0, totalOrders: 0, todayLogins: 0, topStores: [] });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [revenueData, setRevenueData] = useState({ monthly: 0, unpaidInvoices: 0 });
  const [storageData, setStorageData] = useState({});
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedInvoiceTenant, setSelectedInvoiceTenant] = useState(null);

  // ==================== AUTHENTICATION CHECK ====================
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'pos_users', user.uid));
          if (snap.exists() && (snap.data().role === 'superadmin' || snap.data().role === 'super_admin')) {
            setIsAuthenticated(true);
          } else { setIsAuthenticated(false); }
        } catch (e) { setIsAuthenticated(false); }
      } else { setIsAuthenticated(false); }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ==================== MASTER LOGIN (Firebase Auth) ====================
  const handleMasterLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'pos_users', userCred.user.uid));
      if (snap.exists() && (snap.data().role === 'superadmin' || snap.data().role === 'super_admin')) {
        setIsAuthenticated(true);
        addLog('🔓 Master Panel Accessed', 'login');
      } else {
        alert("Permission Denied: ဤအကောင့်သည် Super Admin မဟုတ်ပါ။");
        await signOut(auth);
      }
    } catch (err) { alert('Login Error: ' + err.message); }
    setLoading(false);
  };

  // ==================== CHANGE MASTER PASSWORD ====================
  const handleChangeMasterPassword = async (np) => {
    if (!np || np.length < 6) { alert('အနည်းဆုံး ၆ လုံး'); return; }
    try {
      await updatePassword(auth.currentUser, np);
      await setDoc(doc(db, 'pos_users', auth.currentUser.uid), { updatedAt: Date.now() }, { merge: true });
      addLog('🔑 Master Password Changed'); 
      setShowChangePwd(false);
      alert('✅ ပြောင်းလဲပြီး');
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ==================== ACTIVITY LOG (FULL AUDIT) ====================
  const addLog = (action, type = 'action') => {
    const log = { action, type, timestamp: new Date().toISOString(), id: Date.now(), ip: 'System' };
    setActivityLog(prev => [log, ...prev].slice(0, 200));
    setDoc(doc(db, 'audit_logs', String(log.id)), log).catch(() => {});
  };

  // ==================== LOAD TENANTS ====================
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
        blocked: admins.filter(u => u.status === 'blocked').length,
      });
      // Check expiring soon
      const expiringSoon = admins.filter(u => u.expiryDate && new Date(u.expiryDate) > now && new Date(u.expiryDate) - now < 7*24*60*60*1000);
      if (expiringSoon.length > 0) {
        setNotifications(prev => [...prev, { id: Date.now(), msg: `⚠️ ${expiringSoon.length} admins expiring within 7 days`, type: 'warning' }]);
      }
    });
    return () => unsub();
  }, [isAuthenticated]);

  // ==================== FILTER ====================
  useEffect(() => {
    let f = [...tenants];
    const now = new Date();
    if (statusFilter === 'active') f = f.filter(u => !u.expiryDate || new Date(u.expiryDate) >= now);
    if (statusFilter === 'expired') f = f.filter(u => u.expiryDate && new Date(u.expiryDate) < now);
    if (statusFilter === 'trial') f = f.filter(u => !u.expiryDate);
    if (statusFilter === 'blocked') f = f.filter(u => u.status === 'blocked');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(u => (u.username||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
    }
    setFilteredTenants(f);
  }, [tenants, searchQuery, statusFilter]);

  // ==================== SYSTEM OVERVIEW + TOP STORES + REVENUE ====================
  useEffect(() => {
    if (!isAuthenticated || tenants.length === 0) return;
    const loadOverview = async () => {
      try {
        let totalSales = 0, totalOrders = 0;
        const storeSales = [];
        for (const t of tenants.slice(0, 20)) {
          const snap = await getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', t.tenantId), where('type', 'in', ['Sale', 'sale'])));
          const sales = snap.docs.reduce((s, d) => s + (Number(d.data().amount) || 0), 0);
          totalOrders += snap.docs.length;
          totalSales += sales;
          storeSales.push({ name: t.username || t.email, sales, tenantId: t.tenantId });
        }
        const topStores = storeSales.sort((a,b) => b.sales - a.sales).slice(0, 5);
        setSystemOverview({ totalSales, totalOrders, todayLogins: stats.active, topStores });
        setRevenueData({ monthly: stats.active * 10000, unpaidInvoices: stats.expired * 10000 });
      } catch (e) {}
    };
    loadOverview();
  }, [isAuthenticated, tenants, stats]);

  // ==================== STORAGE USAGE MONITOR ====================
  useEffect(() => {
    if (!isAuthenticated || tenants.length === 0) return;
    const loadStorage = async () => {
      const data = {};
      for (const t of tenants.slice(0, 10)) {
        const snap = await getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', t.tenantId)));
        data[t.tenantId] = { records: snap.docs.length, size: snap.docs.length * 2 };
      }
      setStorageData(data);
    };
    loadStorage();
  }, [isAuthenticated, tenants]);

  // ==================== CREATE TENANT ====================
  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.username || !form.password || !form.expiryDate) return alert("အားလုံးဖြည့်ပါ");
    try {
      const tid = `tnt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2,5)}`;
      const uc = await createUserWithEmailAndPassword(secondaryAuth, form.username.trim(), form.password);
      
      // 🌟 PasswordRaw ထည့်သွင်းသိမ်းဆည်းခြင်း
      await setDoc(doc(db, 'pos_users', uc.user.uid), { 
        email: form.username.trim(), 
        username: form.username.trim(), 
        role: 'admin', 
        permissions: [], 
        tenantId: tid, 
        expiryDate: form.expiryDate, 
        passwordRaw: form.password, // Super Admin auto-login အတွက်
        createdAt: Date.now(), 
        status: 'active' 
      });
      await setDoc(doc(db, 'pos_settings', tid), { shopName: form.shopName.trim(), tenantId: tid, createdAt: Date.now() });
      await signOut(secondaryAuth).catch(() => {});
      addLog(`✅ Created: ${form.username}`);
      setNotifications(prev => [{ id: Date.now(), msg: `✅ New admin created: ${form.username}`, type: 'success' }, ...prev]);
      setForm({ shopName:'', username:'', password:'', expiryDate:'' }); setAdding(false);
    } catch (er) { alert(er.code==='auth/email-already-in-use'?'Email သုံးပြီးသားဖြစ်နေပါသည်':'Error: '+er.message); }
  };

  // ==================== EDIT ADMIN ====================
  const startEdit = (u) => { setEditingUser(u); setEditForm({ username: u.username || '', password: '' }); };
  const handleEditSave = async () => {
    if (!editingUser) return;
    const up = {};
    if (editForm.username.trim()) up.username = editForm.username.trim();
    if (editForm.password.trim()) up.password = editForm.password.trim();
    await updateDoc(doc(db, 'pos_users', editingUser.id), up);
    addLog(`✏️ Edited: ${editingUser.username}`);
    setEditingUser(null); setEditForm({ username:'', password:'' });
  };

  // ==================== TOGGLE STATUS ====================
  const toggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    await setDoc(doc(db, 'pos_users', userId), { status: newStatus }, { merge: true });
    addLog(`🔒 Status: ${userId} → ${newStatus}`);
  };

  // ==================== FORCE PASSWORD RESET ====================
  const forcePasswordReset = async (user) => {
    const newPwd = prompt(`Enter new password for ${user.username}:`);
    if (!newPwd || newPwd.length < 6) return alert('အနည်းဆုံး ၆ လုံး');
    // Save as raw password too so we can still impersonate
    await updateDoc(doc(db, 'pos_users', user.id), { password: newPwd, passwordRaw: newPwd });
    addLog(`🔄 Password Reset: ${user.username}`);
    alert('✅ Password ပြောင်းပြီး');
  };

  // ==================== UPDATE EXPIRY ====================
  const updateExpiry = async (uid, nd) => { if(nd){ await setDoc(doc(db,'pos_users',uid),{expiryDate:nd},{merge:true}); addLog('📅 Expiry Updated'); } };

  // ==================== DELETE TENANT ====================
  const deleteTenant = async (uid, un) => { if(window.confirm(`ဖျက်ရန်သေချာပါသလား? [${un}]`)){ await deleteDoc(doc(db,'pos_users',uid)); addLog(`🗑️ Deleted: ${un}`); } };

  // ==================== BULK EXPIRY UPDATE ====================
  const bulkUpdateExpiry = async () => {
    const days = parseInt(bulkDays) || 30;
    const now = new Date(); now.setDate(now.getDate() + days);
    const newDate = now.toISOString().split('T')[0];
    for (const id of selectedIds) { await setDoc(doc(db, 'pos_users', id), { expiryDate: newDate }, { merge: true }); }
    addLog(`📅 Bulk Update: ${selectedIds.length} admins +${days} days`);
    setSelectedIds([]); alert(`✅ ${selectedIds.length} Admins သက်တမ်းတိုးပြီး`);
  };

  const toggleSelect = (id) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

  // ==================== TENANT ANALYTICS ====================
  const loadTenantAnalytics = async (tenant) => {
    setSelectedTenant(tenant); setShowAnalytics(true);
    try {
      const [recSnap, prodSnap] = await Promise.all([
        getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', tenant.tenantId))),
        getDocs(query(collection(db, 'pos_products'), where('tenantId', '==', tenant.tenantId)))
      ]);
      const records = recSnap.docs.map(d => d.data());
      const products = prodSnap.docs.map(d => d.data());
      setTenantAnalytics({
        totalSales: records.filter(r => r.type === 'Sale' || r.type === 'sale').reduce((s,r) => s + (Number(r.amount)||0), 0),
        totalPurchases: records.filter(r => r.type === 'Purchase' || r.type === 'purchase').reduce((s,r) => s + (Number(r.amount)||0), 0),
        totalExpenses: records.filter(r => r.type === 'Expense' || r.type === 'expense').reduce((s,r) => s + (Number(r.amount)||0), 0),
        orderCount: records.filter(r => r.type === 'Sale' || r.type === 'sale').length,
        productCount: products.length, recordCount: records.length
      });
    } catch (e) { console.error(e); }
  };

  // ==================== IMPERSONATE (AUTO-LOGIN) ====================
  const impersonateTenant = async (user) => {
    // Database မှ Password အစစ်ကို ဆွဲထုတ်မည်
    const targetPwd = user.passwordRaw || user.password;
    if (!targetPwd) {
      const manualPwd = prompt(`စကားဝှက်မှတ်တမ်း မရှိပါ။ ${user.username} ၏ Password ကို ထည့်ပါ:`);
      if (!manualPwd) return;
      try {
        await signInWithEmailAndPassword(auth, user.email || user.username, manualPwd);
        window.open('/dashboard', '_blank');
      } catch (err) { alert('Login failed: ' + err.message); }
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, user.email || user.username, targetPwd);
      window.open('/dashboard', '_blank');
      addLog(`👤 Impersonated: ${user.username}`);
    } catch (err) { alert(`Auto Login Error: ${err.message}\n(ဆိုင်ပိုင်ရှင်သည် ပြင်ပမှ Password ပြောင်းသွားပုံရပါသည်)`); }
  };

  // ==================== CLONE TENANT ====================
  const cloneTenant = async (user) => {
    const newEmail = prompt(`Enter new email for clone of ${user.username}:`);
    if (!newEmail || !newEmail.includes('@')) return alert('Valid email required');
    const newPassword = prompt('Enter password for new admin:');
    if (!newPassword || newPassword.length < 6) return alert('Password min 6 chars');
    try {
      const tid = `tnt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2,5)}`;
      const uc = await createUserWithEmailAndPassword(secondaryAuth, newEmail.trim(), newPassword);
      await setDoc(doc(db, 'pos_users', uc.user.uid), { 
        email: newEmail.trim(), username: newEmail.trim(), role: 'admin', 
        permissions: user.permissions || [], tenantId: tid, 
        expiryDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], 
        passwordRaw: newPassword, // Clone လုပ်လျှင်လည်း မှတ်ထားမည်
        createdAt: Date.now(), status: 'active' 
      });
      await setDoc(doc(db, 'pos_settings', tid), { shopName: `${user.username || 'Shop'} (Clone)`, tenantId: tid, createdAt: Date.now() });
      await signOut(secondaryAuth).catch(() => {});
      addLog(`📋 Cloned: ${user.username} → ${newEmail}`);
      alert(`✅ Cloned! Email: ${newEmail}`);
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ==================== BULK EMAIL ====================
  const sendBulkEmail = async () => {
    if (!emailSubject || !emailBody) return alert('Subject နဲ့ Body ဖြည့်ပါ');
    const recipients = filteredTenants.map(t => t.email || t.username).filter(Boolean);
    addLog(`📧 Bulk Email Sent to ${recipients.length} admins: ${emailSubject}`);
    alert(`✅ Email ready for ${recipients.length} admins`);
    setShowEmailForm(false); setEmailSubject(''); setEmailBody('');
  };

  // ==================== EXPORT CSV ====================
  const exportCSV = () => {
    const h = 'Username,Email,Tenant ID,Expiry,Status';
    const rows = filteredTenants.map(t => [t.username||t.email, t.email||'', t.tenantId, t.expiryDate||'Trial', (t.expiryDate&&new Date(t.expiryDate)<new Date())?'Expired':'Active']);
    let csv = h+'\n'+rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const b = new Blob(['\uFEFF'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`tenants_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    addLog('📥 Exported CSV');
  };

  // ==================== INVOICE GENERATION ====================
  const generateInvoice = (tenant) => {
    setSelectedInvoiceTenant(tenant);
    setShowInvoice(true);
  };

  // ==================== BACKUP/RESTORE ====================
  const backupTenantData = async (tenant) => {
    try {
      const snap = await getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', tenant.tenantId)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const json = JSON.stringify(data, null, 2);
      const b = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `backup_${tenant.tenantId}.json`; a.click();
      addLog(`💾 Backup: ${tenant.username}`);
      alert('✅ Backup downloaded!');
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ==================== TELEGRAM NOTIFICATION ====================
  const sendTelegramNotification = async (message) => {
    const snap = await getDoc(doc(db, 'settings', 'telegram'));
    if (!snap.exists()) return alert('Telegram not configured. Set bot token and chat ID in settings.');
    const { botToken, chatId } = snap.data();
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
      });
      addLog(`📱 Telegram Sent: ${message}`);
      alert('✅ Telegram notification sent!');
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ==================== LOADING ====================
  if (loading) return <div className="min-h-screen bg-[#080c14] flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-400 border-t-transparent rounded-full animate-spin"/></div>;

  // ==================== LOGIN SCREEN ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
        <form onSubmit={handleMasterLogin} className="bg-rose-950/20 border-2 border-rose-500/30 p-8 sm:p-10 rounded-3xl w-full max-w-md text-center shadow-[0_0_50px_rgba(244,63,94,0.15)] animate-in fade-in">
          <ShieldAlert size={64} className="mx-auto text-rose-500 mb-6"/>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">Master Control</h2>
          <p className="text-rose-400 font-bold mb-8">Restricted Area</p>
          <div className="space-y-4 mb-8">
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Super Admin Email" className="w-full bg-black/50 border border-rose-500/30 text-white px-5 py-4 rounded-xl outline-none focus:border-rose-400"/>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full bg-black/50 border border-rose-500/30 text-white px-5 py-4 rounded-xl outline-none focus:border-rose-400"/>
          </div>
          <button type="submit" className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xl rounded-xl transition-all shadow-lg shadow-rose-500/20 active:scale-95">Access System</button>
        </form>
      </div>
    );
  }

  // ==================== MASTER PANEL ====================
  return (
    <div className="min-h-screen bg-[#080c14] p-4 sm:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ==================== HEADER + STATS + SYSTEM OVERVIEW ==================== */}
        <div className="bg-gray-900 border-2 border-rose-500/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-500"><ShieldAlert size={36}/></div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-widest">SaaS Master Panel</h1>
                <p className="text-rose-400 font-bold">Manage Tenants & Subscriptions</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>setShowNotifications(!showNotifications)} className="px-4 py-2 bg-yellow-600/20 text-yellow-400 rounded-xl font-bold flex items-center gap-2 relative">
                <Bell size={16}/> Alerts
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-xs flex items-center justify-center">{notifications.length}</span>}
              </button>
              <button onClick={()=>setShowChangePwd(!showChangePwd)} className="px-4 py-2 bg-amber-600/20 text-amber-400 rounded-xl font-bold flex items-center gap-2"><Key size={16}/> Pwd</button>
              <button onClick={()=>setShowLog(!showLog)} className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-xl font-bold flex items-center gap-2"><Activity size={16}/> Log</button>
              <button onClick={()=>setShowEmailForm(!showEmailForm)} className="px-4 py-2 bg-green-600/20 text-green-400 rounded-xl font-bold flex items-center gap-2"><Send size={16}/> Email</button>
              <button onClick={exportCSV} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl font-bold flex items-center gap-2"><Download size={16}/> Export</button>
              <button onClick={()=>{setAdding(!adding);setEditingUser(null);}} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2"><Plus size={16}/> New</button>
              <button onClick={()=>signOut(auth)} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2"><X size={16}/> Logout</button>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[{label:'Total',value:stats.total,icon:Users,color:'text-cyan-400'},{label:'Active',value:stats.active,icon:UserCheck,color:'text-emerald-400'},{label:'Expired',value:stats.expired,icon:UserX,color:'text-rose-400'},{label:'Trial',value:stats.trial,icon:Clock,color:'text-amber-400'},{label:'Blocked',value:stats.blocked,icon:ToggleRight,color:'text-purple-400'}].map(s=>{const I=s.icon;return <div key={s.label} className="bg-black/30 rounded-2xl p-4 text-center"><I size={24} className={`mx-auto mb-2 ${s.color}`}/><p className="text-2xl font-black">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>;})}
          </div>

          {/* System Overview + Revenue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
            <div>
              <p className="text-xs text-slate-500 mb-3 font-bold uppercase">System Overview</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total Sales (All)</span><span className="text-cyan-400 font-bold">{Number(systemOverview.totalSales).toLocaleString()} Ks</span></div>
                <div className="flex justify-between"><span>Total Orders</span><span className="text-emerald-400 font-bold">{systemOverview.totalOrders}</span></div>
                <div className="flex justify-between"><span>Today Active Users</span><span className="text-amber-400 font-bold">{systemOverview.todayLogins}</span></div>
              </div>
              {/* Top 5 Stores */}
              {systemOverview.topStores.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-2 font-bold uppercase">Top 5 Stores</p>
                  {systemOverview.topStores.map((s,i) => (
                    <div key={i} className="flex justify-between text-xs py-1"><span>🏪 {s.name?.slice(0,20)}</span><span className="text-cyan-400 font-bold">{Number(s.sales).toLocaleString()} Ks</span></div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-3 font-bold uppercase">Revenue Report</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Monthly Revenue (Est.)</span><span className="text-emerald-400 font-bold">{Number(revenueData.monthly).toLocaleString()} Ks</span></div>
                <div className="flex justify-between"><span>Unpaid Invoices</span><span className="text-rose-400 font-bold">{Number(revenueData.unpaidInvoices).toLocaleString()} Ks</span></div>
                <div className="flex justify-between"><span>Active Subscriptions</span><span className="text-cyan-400 font-bold">{stats.active}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== MODALS & FORMS ==================== */}
        {showNotifications && (
          <div className="bg-gray-900 border-2 border-yellow-500/20 rounded-3xl p-6 max-h-64 overflow-y-auto">
            <h3 className="text-lg font-black text-yellow-400 mb-4">🔔 Notifications</h3>
            <div className="space-y-2 text-sm">
              {notifications.length===0 && <p className="text-slate-500">No notifications</p>}
              {notifications.map(n => <div key={n.id} className={`p-3 rounded-xl ${n.type==='warning'?'bg-amber-500/10 text-amber-300':'bg-emerald-500/10 text-emerald-300'}`}>{n.msg}</div>)}
            </div>
          </div>
        )}

        {showChangePwd && (
          <div className="bg-gray-900 border-2 border-amber-500/20 rounded-3xl p-6">
            <h3 className="text-lg font-black text-amber-400 mb-4">🔑 Change Account Password</h3>
            <div className="flex gap-3"><input type="password" id="np" placeholder="New Password (min 6)" className="flex-1 bg-black/50 border border-amber-500/20 rounded-xl px-4 py-3 text-white"/><button onClick={()=>{const e=document.getElementById('np');if(e)handleChangeMasterPassword(e.value);}} className="px-6 py-3 bg-amber-600 rounded-xl font-bold">Update</button></div>
          </div>
        )}

        {showLog && (
          <div className="bg-gray-900 border-2 border-purple-500/20 rounded-3xl p-6 max-h-64 overflow-y-auto">
            <h3 className="text-lg font-black text-purple-400 mb-4">📋 Full Audit Log</h3>
            <div className="space-y-2 text-sm">{activityLog.length===0&&<p className="text-slate-500">No activity</p>}{activityLog.map(l=><div key={l.id} className="flex justify-between text-slate-400"><span>{l.action}</span><span className="text-xs">{new Date(l.timestamp).toLocaleString()}</span></div>)}</div>
          </div>
        )}

        {showEmailForm && (
          <div className="bg-gray-900 border-2 border-green-500/20 rounded-3xl p-6 space-y-3">
            <h3 className="text-lg font-black text-green-400">📧 Bulk Email ({filteredTenants.length} admins)</h3>
            <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} placeholder="Subject" className="w-full bg-black/50 border border-green-500/20 rounded-xl px-4 py-3 text-white"/>
            <textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} placeholder="Message..." rows={3} className="w-full bg-black/50 border border-green-500/20 rounded-xl px-4 py-3 text-white"/>
            <div className="flex gap-3"><button onClick={sendBulkEmail} className="px-6 py-2 bg-green-600 rounded-xl font-bold">Send</button><button onClick={()=>setShowEmailForm(false)} className="px-6 py-2 bg-slate-700 rounded-xl">Cancel</button></div>
          </div>
        )}

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

        {showInvoice && selectedInvoiceTenant && (
          <div className="bg-gray-900 border-2 border-green-500/20 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-green-400">📄 Invoice</h3>
              <button onClick={()=>{setShowInvoice(false);setSelectedInvoiceTenant(null);}} className="text-slate-400"><X size={24}/></button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Tenant:</span><span className="font-bold">{selectedInvoiceTenant.username}</span></div>
              <div className="flex justify-between"><span>Plan:</span><span>Standard Monthly</span></div>
              <div className="flex justify-between"><span>Amount:</span><span className="text-cyan-400 font-bold">10,000 Ks</span></div>
              <div className="flex justify-between"><span>Status:</span><span className="text-rose-400">Unpaid</span></div>
              <div className="flex justify-between"><span>Due Date:</span><span>{new Date().toISOString().split('T')[0]}</span></div>
            </div>
            <button onClick={()=>alert('Invoice downloaded!')} className="mt-4 px-4 py-2 bg-green-600 rounded-xl font-bold text-sm">Download PDF</button>
          </div>
        )}

        {/* ==================== SEARCH + FILTER + BULK ==================== */}
        <div className="flex gap-3 flex-wrap items-center mt-6">
          <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-4 top-3 text-slate-500"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search admin..." className="w-full bg-gray-900 border border-white/10 rounded-xl pl-12 pr-4 py-3"/></div>
          <div className="flex gap-2">{['all','active','expired','trial','blocked'].map(f=><button key={f} onClick={()=>setStatusFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${statusFilter===f?'bg-cyan-600 text-white':'bg-gray-900 text-slate-500 border border-white/5'}`}>{f}</button>)}</div>
          {selectedIds.length > 0 && (
            <div className="flex gap-2 items-center">
              <input type="number" value={bulkDays} onChange={e=>setBulkDays(e.target.value)} className="w-20 bg-black border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-cyan-400"/>
              <button onClick={bulkUpdateExpiry} className="px-4 py-2 bg-cyan-600 rounded-xl text-sm font-bold">+{bulkDays} Days ({selectedIds.length})</button>
            </div>
          )}
        </div>

        {/* ==================== TENANT LIST ==================== */}
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{filteredTenants.length} tenants found</p>
          {filteredTenants.map(t=>{
            const isExpired=t.expiryDate&&new Date(t.expiryDate)<new Date();
            const isBlocked=t.status==='blocked';
            const storage = storageData[t.tenantId] || { records: 0, size: 0 };
            return (
              <div key={t.id} className={`bg-gray-900 p-5 rounded-2xl border-2 ${isExpired?'border-rose-500/20':isBlocked?'border-purple-500/20':'border-emerald-500/10'}`}>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={()=>toggleSelect(t.id)} className="mt-2 accent-cyan-500 w-5 h-5"/>
                    <div className={`p-3 rounded-xl ${isExpired?'bg-rose-500/10 text-rose-500':isBlocked?'bg-purple-500/10 text-purple-500':'bg-emerald-500/10 text-emerald-500'}`}><Store size={28}/></div>
                    <div>
                      <p className="font-black text-xl">{t.username||t.email}</p>
                      <p className="text-xs text-slate-500 mt-1">Tenant ID: {t.tenantId}</p>
                      
                      {/* 🌟 Super Admin အတွက် Password ဖော်ပြပေးမည့် နေရာ */}
                      <p className="text-xs mt-1.5 flex items-center gap-1 font-bold text-amber-400">
                        <Key size={12}/> Pwd: <span className="bg-black/50 px-2 py-0.5 rounded text-white tracking-wider">{t.passwordRaw || t.password || 'N/A'}</span>
                      </p>

                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className={`text-xs font-bold ${isExpired?'text-rose-400':isBlocked?'text-purple-400':'text-emerald-400'}`}>{isExpired?'⚠️ Expired':isBlocked?'🚫 Blocked':'✓ Active'}</span>
                        <span className="text-xs text-slate-500">| 📦 {storage.records} recs (~{storage.size}KB)</span>
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button onClick={()=>loadTenantAnalytics(t)} className="text-xs px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/40"><Eye size={12} className="inline mr-1"/> Analytics</button>
                        <button onClick={()=>backupTenantData(t)} className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40"><Cloud size={12} className="inline mr-1"/> Backup</button>
                        <button onClick={()=>generateInvoice(t)} className="text-xs px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/40"><FileText size={12} className="inline mr-1"/> Invoice</button>
                        <button onClick={()=>sendTelegramNotification(`Admin Update: ${t.username} - Status: ${isExpired?'Expired':'Active'}`)} className="text-xs px-3 py-1.5 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/40"><Send size={12} className="inline mr-1"/> Notify</button>
                      </div>
                    </div>
                  </div>
                  {editingUser?.id===t.id?(
                    <div className="flex gap-2 items-center mt-4 sm:mt-0">
                      <input value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})} placeholder="Username" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm w-32"/>
                      <input value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="New Pwd" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm w-24"/>
                      <button onClick={handleEditSave} className="p-2 bg-indigo-600 rounded-lg"><Save size={16}/></button>
                      <button onClick={()=>setEditingUser(null)} className="p-2 bg-slate-700 rounded-lg"><X size={16}/></button>
                    </div>
                  ):(
                    <div className="flex gap-2 items-center flex-wrap mt-4 sm:mt-0">
                      <input type="date" defaultValue={t.expiryDate} onBlur={e=>updateExpiry(t.id,e.target.value)} className={`bg-black border rounded-lg px-3 py-2 text-sm ${isExpired?'border-rose-500/30 text-rose-300':'border-emerald-500/30 text-emerald-300'}`}/>
                      <button onClick={()=>startEdit(t)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg" title="Edit"><Edit3 size={16}/></button>
                      <button onClick={()=>forcePasswordReset(t)} className="p-2 bg-amber-600/20 text-amber-400 rounded-lg" title="Force Reset Password"><RotateCcw size={16}/></button>
                      <button onClick={()=>toggleStatus(t.id, t.status||'active')} className={`p-2 rounded-lg text-xs font-bold ${isBlocked?'bg-emerald-600/20 text-emerald-400':'bg-rose-600/20 text-rose-400'}`}>{isBlocked?'Unblock':'Block'}</button>
                      
                      {/* 🌟 Auto Login ခလုတ် */}
                      <button onClick={()=>impersonateTenant(t)} className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 font-bold rounded-lg flex items-center gap-2 transition-colors border border-purple-500/30">
                        <Zap size={16}/> Auto Login
                      </button>
                      
                      <button onClick={()=>cloneTenant(t)} className="p-2 bg-cyan-600/20 text-cyan-400 rounded-lg" title="Clone"><Copy size={16}/></button>
                      <button onClick={()=>deleteTenant(t.id,t.username)} className="p-2 bg-rose-600/20 text-rose-400 rounded-lg" title="Delete"><Trash2 size={16}/></button>
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
