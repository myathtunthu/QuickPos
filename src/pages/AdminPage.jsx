import React, { useEffect, useMemo, useState } from 'react';
import { db, auth, secondaryAuth } from '../firebase/config';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
} from 'lucide-react';

import ConfirmDialog from '../components/UI/ConfirmDialog';
import { usernameToEmail } from '../firebase/adminAuth';

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

const DEFAULT_STAFF_PERMS = [
  'create_sale',
  'view_sales',
  'accept_payment',
  'view_inventory',
  'view_customers',
];

const DEFAULT_FORM = {
  username: '',
  password: '',
  role: 'staff',
};

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

export default function AdminPage() {
  const { userData } = useAuth();
  const { t } = useLanguage();

  const [posUsers, setPosUsers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [editingPerms, setEditingPerms] = useState(null);
  const [confirmDisable, setConfirmDisable] = useState(null);

  const currentTenantId = userData?.tenantId;

  const activeAdminCount = useMemo(() => {
    return posUsers.filter(
      (u) => (u.role === 'admin' || u.role === 'owner') && u.active !== false
    ).length;
  }, [posUsers]);

  useEffect(() => {
    if (!currentTenantId) return;

    const q = query(
      collection(db, 'pos_users'),
      where('tenantId', '==', currentTenantId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        all.sort((a, b) => {
          const aName = a.username || a.email || '';
          const bName = b.username || b.email || '';
          return aName.localeCompare(bName);
        });
        setPosUsers(all);
      },
      (error) => {
        console.error('Failed to load users:', error);
        alert('User စာရင်းဖတ်ရာတွင် အမှားဖြစ်နေပါသည်။ Firestore rules ကိုစစ်ပါ။');
      }
    );

    return () => unsub();
  }, [currentTenantId]);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setAdminPassword('');
    setShowPwd(false);
  };

  const validateForm = () => {
    const username = normalizeUsername(form.username);

    if (!username) {
      alert('Username သို့မဟုတ် Email ထည့်ပါ။');
      return null;
    }

    if (!form.password || form.password.length < 6) {
      alert('Password သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရပါမည်။');
      return null;
    }

    if (!adminPassword.trim()) {
      alert(t('adminPasswordRequired') || 'Admin password ထည့်ပါ။');
      return null;
    }

    const authEmail = usernameToEmail(username);

    const duplicate = posUsers.some((u) => {
      const uUsername = normalizeUsername(u.username);
      const uEmail = normalizeUsername(u.email);
      return uUsername === username || uEmail === authEmail;
    });

    if (duplicate) {
      alert('ဒီ Username/Email ဖြင့် User ရှိပြီးသားပါ။');
      return null;
    }

    return { username, authEmail };
  };

  const reauthenticateAdmin = async () => {
    if (!auth.currentUser?.email) {
      throw new Error('Admin email မတွေ့ပါ။ ပြန် login ဝင်ပါ။');
    }

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      adminPassword
    );

    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!currentTenantId) {
      alert('Tenant ID မတွေ့ပါ။ ပြန် login ဝင်ပါ။');
      return;
    }

    const valid = validateForm();
    if (!valid) return;

    setIsSaving(true);

    try {
      await reauthenticateAdmin();

      const newUserCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        valid.authEmail,
        form.password
      );

      const newFirebaseUser = newUserCredential.user;

      await setDoc(doc(db, 'pos_users', newFirebaseUser.uid), {
        tenantId: currentTenantId,
        username: valid.username,
        email: valid.authEmail,
        role: form.role,
        permissions: form.role === 'staff' ? DEFAULT_STAFF_PERMS : [],
        active: true,
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
      });

      await firebaseSignOut(secondaryAuth).catch(() => {});

      resetForm();
      setAdding(false);

      alert('User အကောင့် ဖန်တီးပြီးပါပြီ။ Password ကို database ထဲ မသိမ်းတော့ပါ။');
    } catch (error) {
      console.error('Error creating user:', error);

      if (error.code === 'auth/wrong-password') {
        alert('Admin Password မှားနေပါသည်။');
      } else if (error.code === 'auth/email-already-in-use') {
        alert('ဒီ Email/Username နဲ့ Firebase Auth account ရှိပြီးသားပါ။');
      } else if (error.code === 'auth/weak-password') {
        alert('Password အားနည်းနေပါသည်။ အနည်းဆုံး ၆ လုံးထည့်ပါ။');
      } else if (error.code === 'permission-denied') {
        alert('ခွင့်ပြုချက်မရှိပါ။ Firestore rules သို့မဟုတ် admin role ကိုစစ်ပါ။');
      } else {
        alert(`User ဖန်တီးရာတွင် အမှားဖြစ်နေပါသည်။ ${error.message || ''}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = async (targetUser, permKey) => {
    if (!targetUser?.id) return;
    if (targetUser.role === 'admin' || targetUser.role === 'owner') return;

    try {
      const currentPerms = Array.isArray(targetUser.permissions)
        ? targetUser.permissions
        : [];

      const newPerms = currentPerms.includes(permKey)
        ? currentPerms.filter((p) => p !== permKey)
        : [...currentPerms, permKey];

      await updateDoc(doc(db, 'pos_users', targetUser.id), {
        permissions: newPerms,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
      });
    } catch (error) {
      console.error('Permission update failed:', error);
      alert('လုပ်ပိုင်ခွင့် ပြင်ဆင်ခြင်း မအောင်မြင်ပါ။');
    }
  };

  const handleDisableRequest = (targetUser) => {
    if (!targetUser) return;

    if (targetUser.id === auth.currentUser?.uid) {
      alert('ကိုယ့် account ကို ကိုယ် disable လုပ်ခွင့်မပြုပါ။');
      return;
    }

    if (
      (targetUser.role === 'admin' || targetUser.role === 'owner') &&
      activeAdminCount <= 1 &&
      targetUser.active !== false
    ) {
      alert('နောက်ဆုံး Admin ကို disable လုပ်ခွင့်မပြုပါ။');
      return;
    }

    setConfirmDisable(targetUser);
  };

  const executeDisable = async () => {
    if (!confirmDisable?.id) return;

    try {
      await updateDoc(doc(db, 'pos_users', confirmDisable.id), {
        active: confirmDisable.active === false ? true : false,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
      });

      setConfirmDisable(null);
    } catch (error) {
      console.error('User disable failed:', error);
      alert('User status ပြောင်းခြင်း မအောင်မြင်ပါ။');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 text-white pb-10 space-y-6">
      <div className="bg-[#0d1120] border-2 border-indigo-500/15 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in">
        <div>
          <h3 className="font-black text-white flex items-center gap-4 text-2xl">
            <Users size={30} className="text-indigo-500" />
            {t('staffManagement') || 'Staff Management'}
          </h3>
          <p className="text-slate-500 font-bold mt-2">
            Firebase Auth ဖြင့် User ဖန်တီးမည်။ Password ကို Firestore ထဲ မသိမ်းပါ။
          </p>
        </div>

        <button
          onClick={() => {
            setAdding(!adding);
            if (adding) resetForm();
          }}
          className="bg-indigo-900/40 text-indigo-400 px-5 sm:px-6 py-3 sm:py-4 rounded-xl font-black text-lg flex items-center gap-2 hover:bg-indigo-900/60 transition-all active:scale-95"
        >
          <Plus size={24} />
          {t('add') || 'Add'}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="bg-black/40 p-6 sm:p-8 rounded-3xl border-2 border-indigo-500/15 space-y-5 shadow-lg animate-in slide-in-from-top-4"
        >
          <input
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="Username သို့မဟုတ် Email"
            className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl outline-none focus:border-indigo-500/50"
          />

          <p className="text-xs text-slate-500 -mt-3 ml-2">
            ဥပမာ: cashier1 သို့မဟုတ် cashier1@gmail.com
          </p>

          <div className="relative">
            <input
              required
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t('password') || 'Password'}
              className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl pr-16 outline-none focus:border-indigo-500/50"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-5 top-4 sm:top-5 text-slate-500 hover:text-indigo-400 transition-colors"
            >
              {showPwd ? <EyeOff size={26} /> : <Eye size={26} />}
            </button>
          </div>

          <p className="text-xs text-amber-500/80 -mt-3 ml-2">
            * Password သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။
          </p>

          <input
            required
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder={t('adminPasswordRequired') || 'Admin Password'}
            className="w-full px-5 py-4 sm:py-5 bg-amber-950/20 border-2 border-amber-500/20 rounded-xl text-lg sm:text-xl text-amber-300 outline-none focus:border-amber-400/50"
          />

          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-5 py-4 sm:py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-lg sm:text-xl outline-none focus:border-indigo-500/50"
          >
            <option value="staff">{t('roleStaff') || 'Staff'}</option>
            <option value="admin">{t('roleAdmin') || 'Admin'}</option>
          </select>

          <div className="flex gap-4 sm:gap-5 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white rounded-xl font-black text-lg sm:text-xl flex justify-center items-center disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t('save') || 'Save'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setAdding(false);
                resetForm();
              }}
              disabled={isSaving}
              className="px-6 sm:px-8 py-4 sm:py-5 bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 rounded-xl font-black text-lg sm:text-xl disabled:opacity-50"
            >
              {t('cancel') || 'Cancel'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
        {posUsers.map((u) => {
          const inactive = u.active === false;
          const isCurrentUser = u.id === auth.currentUser?.uid;
          const displayName = u.username || u.email || 'Unknown User';
          const isAdminRole = u.role === 'admin' || u.role === 'owner';

          return (
            <div
              key={u.id}
              className={`p-5 sm:p-6 rounded-2xl border-2 transition-colors group ${
                inactive
                  ? 'bg-rose-950/20 border-rose-500/20 opacity-70'
                  : 'bg-black/30 border-indigo-500/10 hover:border-indigo-500/30'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-indigo-950/60 flex items-center justify-center text-indigo-400 font-black text-xl sm:text-2xl uppercase shadow-inner shadow-indigo-500/20">
                    {displayName?.[0] || '?'}
                  </div>

                  <div>
                    <p className="font-black text-white text-xl sm:text-2xl">
                      {displayName}
                    </p>

                    <p className="text-xs text-slate-500 font-bold mt-1">
                      {u.email || '-'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`text-xs sm:text-sm font-black px-3 sm:px-4 py-1 sm:py-1.5 rounded uppercase inline-block ${
                          isAdminRole
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        }`}
                      >
                        {isAdminRole ? t('roleAdmin') || 'Admin' : t('roleStaff') || 'Staff'}
                      </span>

                      <span
                        className={`text-xs sm:text-sm font-black px-3 sm:px-4 py-1 sm:py-1.5 rounded inline-flex items-center gap-1 ${
                          inactive
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {inactive ? <UserX size={14} /> : <UserCheck size={14} />}
                        {inactive ? 'Disabled' : 'Active'}
                      </span>

                      {isCurrentUser && (
                        <span className="text-xs sm:text-sm font-black px-3 sm:px-4 py-1 sm:py-1.5 rounded bg-amber-500/20 text-amber-300">
                          Current User
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-none border-white/5">
                  <button
                    onClick={() => setEditingPerms(editingPerms === u.id ? null : u.id)}
                    className={`flex-1 sm:flex-none text-sm sm:text-base font-bold px-4 sm:px-5 py-3 rounded-xl border-2 flex justify-center items-center gap-2 transition-colors ${
                      editingPerms === u.id
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20'
                    }`}
                  >
                    <ShieldCheck size={20} />
                    {editingPerms === u.id ? t('close') || 'Close' : t('permissions') || 'Permissions'}
                  </button>

                  {!isCurrentUser && (
                    <button
                      onClick={() => handleDisableRequest(u)}
                      className={`border-2 p-3 rounded-xl transition-all ${
                        inactive
                          ? 'text-emerald-400 hover:text-white hover:bg-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-500/10 border-rose-500/20'
                      }`}
                      title={inactive ? 'Enable user' : 'Disable user'}
                    >
                      {inactive ? <UserCheck size={22} /> : <Trash2 size={22} />}
                    </button>
                  )}
                </div>
              </div>

              {editingPerms === u.id && (
                <div className="mt-5 sm:mt-6 p-5 sm:p-6 bg-black/60 rounded-2xl border-2 border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 animate-in fade-in shadow-inner">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className={`flex items-center gap-3 sm:gap-4 text-base sm:text-lg font-bold ${
                        isAdminRole || inactive
                          ? 'text-slate-600'
                          : 'text-slate-300 hover:text-white'
                      } cursor-pointer transition-colors p-2 rounded-lg hover:bg-white/5`}
                    >
                      <input
                        type="checkbox"
                        checked={isAdminRole ? true : Array.isArray(u.permissions) && u.permissions.includes(perm.key)}
                        onChange={() => togglePermission(u, perm.key)}
                        disabled={isAdminRole || inactive}
                        className="accent-indigo-500 w-5 h-5 sm:w-6 sm:h-6 rounded cursor-pointer"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDisable}
        title={t('warning') || 'Warning'}
        message={
          confirmDisable?.active === false
            ? `"${confirmDisable?.username || confirmDisable?.email}" ကို ပြန်ဖွင့်ရန် သေချာပါသလား?`
            : `"${confirmDisable?.username || confirmDisable?.email}" ကို Disable လုပ်ရန် သေချာပါသလား? Login ဝင်လို့ မရတော့ပါ။`
        }
        isDangerous={confirmDisable?.active !== false}
        onConfirm={executeDisable}
        onCancel={() => setConfirmDisable(null)}
      />
    </div>
  );
}
