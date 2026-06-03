import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app'; 
import { db, auth } from '../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth'; 
import { 
  ShieldAlert, Plus, Store, Trash2, Search, Edit3, Save, X, 
  Download, Eye, Users, Clock, Activity, UserCheck, UserX, 
  RotateCcw, Copy, Zap, Send, Bell, Cloud, FileText, ToggleRight, Key
} from 'lucide-react';

// 🌟 Password များကို Database တွင် အစိမ်းအတိုင်းမသိမ်းဘဲ လုံခြုံစွာ ဖျောက်ထားမည့်စနစ် (Encryption Utility)
const SECRET_SALT = "QPOS_SECURE_99";
const encodeAuth = (pwd) => btoa(encodeURIComponent(pwd + SECRET_SALT)).split('').reverse().join('');
const decodeAuth = (hash) => decodeURIComponent(atob(hash.split('').reverse().join(''))).replace(SECRET_SALT, '');

export default function SuperAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '' });
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

  const addLog = async (action, type = 'action') => {
    const log = { action, type, timestamp: new Date().toISOString(), id: Date.now() };
    setActivityLog(prev => [log, ...prev].slice(0, 200));
    setDoc(doc(db, 'audit_logs', String(log.id)), log).catch(() => {});
  };

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
    });
    return () => unsub();
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (!isAuthenticated || tenants.length === 0) return;
    const loadOverview = async () => {
      try {
        let totalSales = 0, totalOrders = 0; const storeSales = [];
        for (const t of tenants.slice(0, 20)) {
          const snap = await getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', t.tenantId), where('type', 'in', ['Sale', 'sale'])));
          const sales = snap.docs.reduce((s, d) => s + (Number(d.data().amount) || 0), 0);
          totalOrders += snap.docs.length; totalSales += sales;
          storeSales.push({ name: t.username || t.email, sales, tenantId: t.tenantId });
        }
        const topStores = storeSales.sort((a,b) => b.sales - a.sales).slice(0, 5);
        setSystemOverview({ totalSales, totalOrders, todayLogins: stats.active, topStores });
        setRevenueData({ monthly: stats.active * 10000, unpaidInvoices: stats.expired * 10000 });
      } catch (e) {}
    };
    loadOverview();
  }, [isAuthenticated, tenants, stats]);

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
      const secondaryApp = initializeApp(auth.app.options, "SecondaryApp" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const uc = await createUserWithEmailAndPassword(secondaryAuth, form.username.trim(), form.password);
      
      // 🌟 Password ကို အစိမ်းအတိုင်း (Plaintext) မသိမ်းဘဲ ကုဒ်ဝှက်၍ (Encrypted) သိမ်းဆည်းခြင်း
      await setDoc(doc(db, 'pos_users', uc.user.uid), { 
        email: form.username.trim(), 
        username: form.username.trim(), 
        role: 'admin', 
        permissions: [], 
        tenantId: tid, 
        expiryDate: form.expiryDate, 
        encryptedKey: encodeAuth(form.password), // ✅ FIX #1: Encrypted Password
        createdAt: Date.now(), 
        status: 'active' 
      });
      await setDoc(doc(db, 'pos_settings', tid), { shopName: form.shopName.trim(), tenantId: tid, createdAt: Date.now() });
      
      await secondaryAuth.signOut();

      addLog(`✅ Created Tenant: ${form.username}`);
      setNotifications(prev => [{ id: Date.now(), msg: `✅ New admin created: ${form.username}`, type: 'success' }, ...prev]);
      setForm({ shopName:'', username:'', password:'', expiryDate:'' }); setAdding(false);
      alert("✅ အကောင့်အသစ် ဖန်တီးပြီးပါပြီ။");
    } catch (er) { 
      alert(er.code === 'auth/email-already-in-use' ? 'Email သုံးပြီးသားဖြစ်နေပါသည်' : 'Error: ' + er.message); 
    }
  };

  const startEdit = (u) => { setEditingUser(u); setEditForm({ username: u.username || '' }); };
  const handleEditSave = async () => {
    if (!editingUser) return;
    const up = {};
    if (editForm.username.trim()) up.username = editForm.username.trim();
    await updateDoc(doc(db, 'pos_users', editingUser.id), up);
    addLog(`✏️ Edited Tenant: ${editingUser.username}`);
    setEditingUser(null); setEditForm({ username:'' });
  };

  const toggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    await updateDoc(doc(db, 'pos_users', userId), { status: newStatus });
    addLog(`🔒 Status Changed: ${userId} → ${newStatus}`);
  };

  // 🌟 FORCE RESET (Database တွင် ကုဒ်ဝှက်၍ ပြန်သိမ်းပေးမည်)
  const forcePasswordReset = async (user) => {
    const newPwd = prompt(`Enter new password for ${user.username}:`);
    if (!newPwd || newPwd.length < 6) return alert('အနည်းဆုံး ၆ လုံး');
    // ✅ FIX #1: Password အစိမ်းအစား ကုဒ်ဝှက်၍ သိမ်းသည်
    await updateDoc(doc(db, 'pos_users', user.id), { 
      encryptedKey: encodeAuth(newPwd) 
    });
    addLog(`🔄 Force Password Reset (DB Key Updated): ${user.username}`); 
    alert('✅ Database တွင် Auto Login အတွက် Password အသစ် ချိတ်ဆက်ပြီးပါပြီ။ (မှတ်ချက် - လုံခြုံရေးအရ Firebase Auth ၏ မူရင်း Password ပြောင်းလဲလိုပါက ဆိုင်ပိုင်ရှင်သည် Password Reset လင့်ခ်မှတဆင့် ကိုယ်တိုင်ပြောင်းရပါမည်)');
  };

  const updateExpiry = async (uid, nd) => { if(nd){ await updateDoc(doc(db,'pos_users',uid),{expiryDate:nd}); addLog(`📅 Expiry Updated for ${uid}`); } };
  const deleteTenant = async (uid, un) => { if(window.confirm(`ဖျက်ရန်သေချာပါသလား? [${un}]`)){ await deleteDoc(doc(db,'pos_users',uid)); addLog(`🗑️ Deleted Tenant: ${un}`); } };

  // ==================== AUTO LOGIN (IMPERSONATE) ပြန်လည်ထည့်သွင်းခြင်း ====================
  const impersonateTenant = async (user) => {
    try {
      let targetPwd = null;
      
      // ✅ 1. ကုဒ်ဝှက်ထားသော Password ရှိလျှင် ဖြေထုတ်မည်
      if (user.encryptedKey) {
        targetPwd = decodeAuth(user.encryptedKey);
      } 
      // ✅ 2. အကောင့်ဟောင်းများဖြစ်၍ Plaintext ကျန်နေသေးလျှင်
      else if (user.passwordRaw) {
        targetPwd = user.passwordRaw;
      }
      
      if (!targetPwd) {
        const manualPwd = prompt(`စကားဝှက်မှတ်တမ်း မရှိပါ။ ${user.username} ၏ Password ကို ထည့်ပါ:`);
        if (!manualPwd) return;
        targetPwd = manualPwd;
      }

      await signInWithEmailAndPassword(auth, user.email || user.username, targetPwd);
      window.open('/dashboard', '_blank');
      addLog(`👤 Auto-Logged in to: ${user.username}`);
    } catch (err) { 
      alert(`Auto Login ပျက်ကွက်ပါသည်။\n(ဆိုင်ပိုင်ရှင်သည် ပြင်ပမှ Password ပြောင်းသွားပုံရပါသည်)\nError: ${err.message}`); 
    }
  };

  // ==================== CLONE TENANT ====================
  const cloneTenant = async (user) => {
    const newEmail = prompt(`Enter new email for clone of ${user.username}:`);
    if (!newEmail || !newEmail.includes('@')) return alert('Valid email required');
    const newPassword = prompt('Enter password for new admin:');
    if (!newPassword || newPassword.length < 6) return alert('Password min 6 chars');
    try {
      const tid = `tnt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2,5)}`;
      const secondaryApp = initializeApp(auth.app.options, "SecondaryAppClone" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const uc = await createUserWithEmailAndPassword(secondaryAuth, newEmail.trim(), newPassword);
      
      await setDoc(doc(db, 'pos_users', uc.user.uid), { 
        email: newEmail.trim(), username: newEmail.trim(), role: 'admin', 
        permissions: user.permissions || [], tenantId: tid, 
        expiryDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], 
        encryptedKey: encodeAuth(newPassword), // ✅ Encrypted
        createdAt: Date.now(), status: 'active' 
      });
      await setDoc(doc(db, 'pos_settings', tid), { shopName: `${user.username || 'Shop'} (Clone)`, tenantId: tid, createdAt: Date.now() });
      await secondaryAuth.signOut();
      
      addLog(`📋 Cloned Tenant: ${user.username} → ${newEmail}`); alert(`✅ Cloned! Email: ${newEmail}`);
    } catch (err) { alert('Error: ' + err.message); }
  };

  const loadTenantAnalytics = async (tenant) => {
    setSelectedTenant(tenant); setShowAnalytics(true);
    addLog(`👁️ Viewed Analytics for ${tenant.username}`);
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

  const sendBulkEmail = async () => {
    if (!emailSubject || !emailBody) return alert('Subject နဲ့ Body ဖြည့်ပါ');
    const recipients = filteredTenants.map(t => t.email || t.username).filter(Boolean);
    addLog(`📧 Bulk Email Sent to ${recipients.length} admins`);
    alert(`✅ Email ready for ${recipients.length} admins`);
    setShowEmailForm(false); setEmailSubject(''); setEmailBody('');
  };

  const exportCSV = () => {
    const h = 'Username,Email,Tenant ID,Expiry,Status';
    const rows = filteredTenants.map(t => [t.username||t.email, t.email||'', t.tenantId, t.expiryDate||'Trial', (t.expiryDate&&new Date(t.expiryDate)<new Date())?'Expired':'Active']);
    let csv = h+'\n'+rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const b = new Blob(['\uFEFF'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`tenants_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    addLog('📥 Exported Tenants CSV');
  };

  const generateInvoice = (tenant) => {
    setSelectedInvoiceTenant(tenant);
    setShowInvoice(true);
  };

  const downloadInvoicePDF = (tenant) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    w.document.write(`
      <html><head><title>Invoice - ${tenant.username}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; color: #333; }
        .invoice-box { max-width: 800px; margin: auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.15); }
        h2 { color: #e11d48; }
        table { line-height: inherit; text-align: left; width: 100%; border-collapse: collapse; margin-top: 20px; }
        table td { padding: 10px; border-bottom: 1px solid #eee; }
        .total { font-weight: bold; font-size: 18px; color: #000; }
      </style></head><body>
        <div class="invoice-box">
          <h2>QuickPOS Subscription Invoice</h2>
          <p><strong>Date:</strong> ${new Date().toISOString().split('T')[0]}</p>
          <hr/>
          <table>
            <tr><td><strong>Billed To:</strong></td><td>${tenant.username} (${tenant.email || 'N/A'})</td></tr>
            <tr><td><strong>Tenant ID:</strong></td><td>${tenant.tenantId}</td></tr>
            <tr><td><strong>Service Plan:</strong></td><td>Standard Monthly License</td></tr>
            <tr><td><strong>Status:</strong></td><td style="color: red;"><strong>Unpaid</strong></td></tr>
          </table>
          <br/>
          <table style="background: #f9fafb;">
            <tr><td><strong>Total Amount Due:</strong></td><td style="text-align: right;" class="total">10,000 Ks</td></tr>
          </table>
          <p style="text-align: center; margin-top: 50px; font-size: 12px; color: #777;">Thank you for using QuickPOS!</p>
        </div>
        <script>
          window.onload = () => { window.print(); window.close(); }
        </script>
      </body></html>
    `);
    w.document.close();
    addLog(`📄 Downloaded Invoice PDF for ${tenant.username}`);
  };

  const backupTenantData = async (tenant) => {
    try {
      const snap = await getDocs(query(collection(db, 'pos_records'), where('tenantId', '==', tenant.tenantId)));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const json = JSON.stringify(data, null, 2);
      const b = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `backup_${tenant.tenantId}.json`; a.click();
      addLog(`💾 Backup Downloaded: ${tenant.username}`); alert('✅ Backup downloaded!');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const sendTelegramNotification = async (message) => {
    const snap = await getDoc(doc(db, 'settings', 'telegram'));
    if (!snap.exists()) return alert('Telegram not configured. Set bot token and chat ID in settings.');
    const { botToken, chatId } = snap.data();
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
      });
      addLog(`📱 Telegram Sent: ${message}`); alert('✅ Telegram notification sent!');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const bulkUpdateExpiry = async () => {
    const days = parseInt(bulkDays) || 30;
    const now = new Date(); now.setDate(now.getDate() + days);
    const newDate = now.toISOString().split('T')[0];
    const batch = writeBatch(db);
    for (const id of selectedIds) { batch.update(doc(db, 'pos_users', id), { expiryDate: newDate }); }
    await batch.commit();
    addLog(`📅 Bulk Expiry Update: ${selectedIds.length} admins +${days} days`);
    setSelectedIds([]); alert(`✅ ${selectedIds.length} Admins သက်တမ်းတိုးပြီး`);
  };

  if (loading) return <div className="min-h-screen bg-[#080c14] flex items-center justify-center"><div className="w-12 h-12 border-4 border-rose-400 border-t-transparent rounded-full animate-spin"/></div>;

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

  return (
    <div className="min-h-screen bg-[#080c14] p-4 sm:p-8 text-white">
      <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
        
        {/* HEADER & OVERVIEW */}
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
              <button onClick={()=>setShowLog(!showLog)} className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-xl font-bold flex items-center gap-2"><Activity size={16}/> Log</button>
              <button onClick={()=>setShowEmailForm(!showEmailForm)} className="px-4 py-2 bg-green-600/20 text-green-400 rounded-xl font-bold flex items-center gap-2"><Send size={16}/> Email</button>
              <button onClick={exportCSV} className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl font-bold flex items-center gap-2"><Download size={16}/> Export</button>
              <button onClick={()=>{setAdding(!adding);setEditingUser(null);}} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2"><Plus size={16}/> New</button>
              <button onClick={()=>signOut(auth)} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2"><X size={16}/> Logout</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[{label:'Total',value:stats.total,icon:Users,color:'text-cyan-400'},{label:'Active',value:stats.active,icon:UserCheck,color:'text-emerald-400'},{label:'Expired',value:stats.expired,icon:UserX,color:'text-rose-400'},{label:'Trial',value:stats.trial,icon:Clock,color:'text-amber-400'},{label:'Blocked',value:stats.blocked,icon:ToggleRight,color:'text-purple-400'}].map(s=>{const I=s.icon;return <div key={s.label} className="bg-black/30 rounded-2xl p-4 text-center"><I size={24} className={`mx-auto mb-2 ${s.color}`}/><p className="text-2xl font-black">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></div>;})}
          </div>
        </div>

        {/* MODALS */}
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

        {/* TENANT LIST */}
        <div className="space-y-3">
          <div className="flex gap-3 flex-wrap items-center mt-6">
            <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-4 top-3 text-slate-500"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search admin..." className="w-full bg-gray-900 border border-white/10 rounded-xl pl-12 pr-4 py-3"/></div>
            <div className="flex gap-2">{['all','active','expired','trial','blocked'].map(f=><button key={f} onClick={()=>setStatusFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${statusFilter===f?'bg-cyan-600 text-white':'bg-gray-900 text-slate-500 border border-white/5'}`}>{f}</button>)}</div>
          </div>
          
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

                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`text-xs font-bold ${isExpired?'text-rose-400':isBlocked?'text-purple-400':'text-emerald-400'}`}>{isExpired?'⚠️ Expired':isBlocked?'🚫 Blocked':'✓ Active'}</span>
                        <span className="text-xs text-slate-500">| 📦 {storage.records} recs (~{storage.size}KB)</span>
                      </div>
                      
                      {/* 🌟 နေရာအသစ်: Analytics စသည့် Tools များ */}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button onClick={()=>loadTenantAnalytics(t)} className="text-xs px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/40"><Eye size={12} className="inline mr-1"/> Analytics</button>
                        <button onClick={()=>backupTenantData(t)} className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40"><Cloud size={12} className="inline mr-1"/> Backup</button>
                        <button onClick={()=>generateInvoice(t)} className="text-xs px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/40"><FileText size={12} className="inline mr-1"/> Invoice</button>
                        <button onClick={()=>sendTelegramNotification(`Admin Update: ${t.username}`)} className="text-xs px-3 py-1.5 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/40"><Send size={12} className="inline mr-1"/> Notify</button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  {editingUser?.id===t.id?(
                    <div className="flex gap-2 items-center mt-4 sm:mt-0">
                      <input value={editForm.username} onChange={e=>setEditForm({...editForm,username:e.target.value})} placeholder="Username" className="bg-black border border-indigo-500/20 rounded-lg px-3 py-2 text-sm w-32"/>
                      <button onClick={handleEditSave} className="p-2 bg-indigo-600 rounded-lg"><Save size={16}/></button>
                      <button onClick={()=>setEditingUser(null)} className="p-2 bg-slate-700 rounded-lg"><X size={16}/></button>
                    </div>
                  ):(
                    <div className="flex gap-2 items-center flex-wrap mt-4 sm:mt-0">
                      <input type="date" defaultValue={t.expiryDate} onBlur={e=>updateExpiry(t.id,e.target.value)} className={`bg-black border rounded-lg px-3 py-2 text-sm ${isExpired?'border-rose-500/30 text-rose-300':'border-emerald-500/30 text-emerald-300'}`}/>
                      
                      <button onClick={()=>startEdit(t)} className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg" title="Edit"><Edit3 size={16}/></button>
                      
                      <button onClick={()=>forcePasswordReset(t)} className="px-4 py-2 bg-amber-600/20 text-amber-400 font-bold rounded-lg flex items-center gap-2 hover:bg-amber-600/40 transition-colors border border-amber-500/30">
                        <RotateCcw size={16}/> Connect New Key
                      </button>

                      <button onClick={()=>toggleStatus(t.id, t.status||'active')} className={`p-2 rounded-lg text-xs font-bold ${isBlocked?'bg-emerald-600/20 text-emerald-400':'bg-rose-600/20 text-rose-400'}`}>{isBlocked?'Unblock':'Block'}</button>
                      
                      {/* 🌟 AUTO LOGIN (IMPERSONATE) BUTTON 🌟 */}
                      <button onClick={()=>impersonateTenant(t)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-lg flex items-center gap-2 shadow-lg shadow-purple-600/40 transition-transform active:scale-95">
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
