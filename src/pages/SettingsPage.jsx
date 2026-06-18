import React, { useEffect, useRef, useState } from 'react';
import { db, auth } from '../firebase/config';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Cloud, FileDown, FileUp, Lock, Save, Settings, Store, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { showToast } from '../components/UI/Toast';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import BackupSettings from '../components/Settings/BackupSettings';
import logger from '../utils/logger';

const SECRET_SALT = 'QPOS_SECURE_99';
const encodeAuth = (pwd) => btoa(encodeURIComponent(pwd + SECRET_SALT)).split('').reverse().join('');

const fieldClass = 'w-full rounded-xl border border-cyan-500/20 bg-black/50 px-4 py-3 text-white outline-none transition focus:border-cyan-400';
const labelClass = 'mb-2 block text-sm font-bold text-slate-400';

export default function SettingsPage() {
  const { profile, logout } = useAuth();
  const { t } = useLanguage();
  const fileRef = useRef(null);

  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('Ks');

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
        if (!snap.exists()) return;

        const data = snap.data();
        setShopName(data.shopName || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setLogoUrl(data.logoUrl || data.logo || data.shopLogo || '');
        setReceiptFooter(data.receiptFooter || data.footerText || '');
        setCurrencySymbol(data.currencySymbol || data.currency || 'Ks');
        setTgToken(data.tgToken || '');
        setTgChatId(data.tgChatId || '');
        setOpeningBalance(data.openingBalance ?? '');
        setClosingBalance(data.closingBalance ?? '');
      } catch (error) {
        logger.error('Failed to fetch settings:', error);
        showToast(t('settingsLoadFailed', 'ဆက်တင်များ ရယူရာတွင် အမှားဖြစ်နေပါသည်။'), 'error');
      }
    };

    fetchSettings();
  }, [profile?.tenantId, t]);

  const saveSettings = async () => {
    if (!profile?.tenantId) return;

    try {
      await setDoc(
        doc(db, 'pos_settings', profile.tenantId),
        {
          shopName: shopName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          logoUrl: logoUrl.trim(),
          receiptFooter: receiptFooter.trim(),
          currencySymbol: currencySymbol.trim() || 'Ks',
          tgToken: tgToken.trim(),
          tgChatId: tgChatId.trim(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      showToast(t('settingsSaved', 'ဆက်တင်များ သိမ်းဆည်းပြီးပါပြီ။'), 'success');
    } catch (error) {
      logger.error('Error saving settings:', error);
      showToast(t('settingsSaveFailed', 'ဆက်တင် သိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။'), 'error');
    }
  };

  const saveBalance = async () => {
    if (!profile?.tenantId) return;

    try {
      await setDoc(
        doc(db, 'pos_settings', profile.tenantId),
        {
          openingBalance: parseFloat(openingBalance) || 0,
          closingBalance: parseFloat(closingBalance) || 0,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      showToast(t('balanceSaved', 'လက်ကျန်ငွေစာရင်း သိမ်းဆည်းပြီးပါပြီ။'), 'success');
    } catch (error) {
      logger.error('Error saving balance:', error);
      showToast(t('balanceSaveFailed', 'လက်ကျန်ငွေစာရင်း သိမ်းဆည်းရာတွင် အမှားဖြစ်နေပါသည်။'), 'error');
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      showToast(t('passwordRequired', 'စကားဝှက်ဟောင်းနှင့် အသစ်ကို ဖြည့်ပါ။'), 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast(t('passwordMinLength', 'စကားဝှက်အသစ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။'), 'error');
      return;
    }

    setIsChangingPwd(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not found');

      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      await setDoc(
        doc(db, 'pos_users', profile.id || currentUser.uid),
        { encryptedKey: encodeAuth(newPassword), updatedAt: Date.now() },
        { merge: true }
      );

      showToast(t('passwordChanged', 'စကားဝှက် ပြောင်းလဲပြီးပါပြီ။ ပြန်လည် Login ဝင်ပါ။'), 'success');
      setOldPassword('');
      setNewPassword('');
      logout();
    } catch (error) {
      logger.error('Error changing password:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        showToast(t('oldPasswordWrong', 'စကားဝှက်အဟောင်း မှားနေပါသည်။'), 'error');
      } else {
        showToast(t('passwordChangeFailed', 'စကားဝှက်ပြောင်းလဲရာတွင် အမှားဖြစ်နေပါသည်။'), 'error');
      }
    } finally {
      setIsChangingPwd(false);
    }
  };

  const exportAllCSV = async () => {
    setConfirmDialog({
      isOpen: true,
      title: t('exportRecords', 'Export Records'),
      message: t('exportRecordsConfirm', 'မှတ်တမ်းများအားလုံးကို CSV ဖိုင်အဖြစ် ဒေါင်းလုဒ်လုပ်မလား?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const q = query(collection(db, 'pos_records'), where('tenantId', '==', profile?.tenantId));
          const snap = await getDocs(q);
          if (snap.empty) {
            showToast(t('noRecords', 'မှတ်တမ်းမရှိပါ။'), 'warning');
            return;
          }

          let csv = 'Date,Invoice,Type,Customer,Item,Amount,Discount,PaymentType\n';
          snap.docs.forEach((recordDoc) => {
            const d = recordDoc.data();
            csv += `"${d.date || ''}","${d.invoiceNo || ''}","${d.type || ''}","${d.personName || ''}","${d.item || 'Multiple'}","${d.amount || 0}","${d.discount || 0}","${d.paymentType || ''}"\n`;
          });
          const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `Records_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          showToast(t('csvDownloaded', 'CSV ဖိုင် ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။'), 'success');
        } catch (error) {
          logger.error('Error exporting CSV:', error);
          showToast(t('exportFailed', 'Export လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။'), 'error');
        }
      },
    });
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmDialog({
      isOpen: true,
      title: t('importCsv', 'Import CSV'),
      message: t('importCsvConfirm', 'ရွေးချယ်ထားသော CSV ဖိုင်မှ ဒေတာများကို တင်သွင်းမလား?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const text = event.target.result;
            const rows = text.split('\n').filter((row) => row.trim() !== '');
            if (rows.length <= 1) {
              showToast(t('emptyFile', 'ဖိုင်ထဲတွင် ဒေတာမရှိပါ။'), 'warning');
              return;
            }

            let count = 0;
            let batch = writeBatch(db);

            for (let i = 1; i < rows.length; i += 1) {
              const rowStr = rows[i];
              const cols = [];
              let inQuotes = false;
              let current = '';

              for (let j = 0; j < rowStr.length; j += 1) {
                if (rowStr[j] === '"') inQuotes = !inQuotes;
                else if (rowStr[j] === ',' && !inQuotes) {
                  cols.push(current.trim());
                  current = '';
                } else current += rowStr[j];
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
                createdAt: Date.now(),
              });

              count += 1;
              if (count % 400 === 0) {
                await batch.commit();
                batch = writeBatch(db);
              }
            }

            if (count % 400 !== 0) await batch.commit();

            if (count > 0) showToast(t('importSuccess', 'တင်သွင်းပြီးပါပြီ။') + ` (${count})`, 'success');
            else showToast(t('importNoValidData', 'တင်သွင်းရန် မှန်ကန်သော ဒေတာမတွေ့ရှိပါ။'), 'warning');
          };
          reader.readAsText(file);
        } catch (error) {
          logger.error('Import error:', error);
          showToast(t('importFailed', 'Import လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။'), 'error');
        }
        if (fileRef.current) fileRef.current.value = '';
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-28 text-white sm:p-6">
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />

      <div className="flex items-center gap-4 rounded-3xl border-2 border-cyan-500/15 bg-[#0d1120] p-6 shadow-xl sm:p-8">
        <Settings size={32} className="text-cyan-500" />
        <h3 className="text-2xl font-black">{t('settings', 'Settings')}</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-cyan-400">
            <Store size={20} /> {t('shopSettings', 'Shop Settings')}
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('shopName', 'Shop Name')}</label>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('phone', 'Phone')}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t('address', 'Address')}</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t('logoUrl', 'Logo URL')}</label>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className={fieldClass} />
              {logoUrl ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <img src={logoUrl} alt="Logo preview" className="max-h-20 max-w-full object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                </div>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>{t('currencySymbol', 'Currency')}</label>
              <input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t('receiptFooter', 'Receipt Footer')}</label>
              <input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Telegram Bot Token</label>
              <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC-DEF..." className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Telegram Chat ID</label>
              <input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="123456789" className={fieldClass} />
            </div>
          </div>

          <button onClick={saveSettings} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-4 font-black text-white transition-colors hover:bg-cyan-500 active:scale-95">
            <Save size={18} /> {t('save', 'Save')}
          </button>
        </section>

        <section className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-indigo-400">
            <Lock size={20} /> {t('changePassword', 'Change Password')}
          </h4>
          <input type="password" placeholder={t('oldPassword', 'Old Password')} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={fieldClass.replace('cyan', 'indigo')} />
          <input type="password" placeholder={t('newPassword', 'New Password')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={fieldClass.replace('cyan', 'indigo')} />
          <button onClick={handleChangePassword} disabled={isChangingPwd} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 py-4 font-black text-indigo-300 transition-all hover:bg-indigo-600/40 disabled:opacity-50 active:scale-95">
            {isChangingPwd ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" /> : <><Lock size={18} /> {t('updatePassword', 'Update Password')}</>}
          </button>
        </section>

        <section className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-purple-400">
            <Wallet size={20} /> {t('dailyBalance', 'Daily Balance')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('openingBalance', 'Opening Balance')}</label>
              <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={fieldClass.replace('cyan', 'purple')} />
            </div>
            <div>
              <label className={labelClass}>{t('closingBalance', 'Closing Balance')}</label>
              <input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} className={fieldClass.replace('cyan', 'purple')} />
            </div>
          </div>
          <button onClick={saveBalance} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-600/20 py-4 font-black text-purple-300 transition-all hover:bg-purple-600/40 active:scale-95">
            <Save size={18} /> {t('save', 'Save')}
          </button>
        </section>

        <section className="space-y-4 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-sky-400">
            <FileDown size={20} /> {t('dataTools', 'Data Tools')}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={exportAllCSV} className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-600/20 py-4 font-black text-sky-200 transition hover:bg-sky-600/30 active:scale-95">
              <FileDown size={18} /> {t('exportCsv', 'Export CSV')}
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-600/20 py-4 font-black text-amber-200 transition hover:bg-amber-600/30 active:scale-95">
              <FileUp size={18} /> {t('importCsv', 'Import CSV')}
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-emerald-400">
            <Cloud size={20} /> {t('backupRestore', 'Backup / Restore')}
          </h4>
          <BackupSettings tenantId={profile?.tenantId} />
        </section>
      </div>
    </div>
  );
}
