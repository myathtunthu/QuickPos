import React, { useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import {
  Download,
  Crop,
  CheckCircle,
  Image as ImageIcon,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Settings,
  Store,
  Upload,
  X,
  Wallet,
} from 'lucide-react';
import BackupSettings from '../components/Settings/BackupSettings';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { showToast } from '../components/UI/Toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth, db } from '../firebase/config';
import logger from '../utils/logger';

const SECRET_SALT = 'QPOS_SECURE_99';
const encodeAuth = (pwd) => btoa(encodeURIComponent(pwd + SECRET_SALT)).split('').reverse().join('');

const readImageFile = (file) => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith('image/')) {
    reject(new Error('Please select an image file.'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Unable to read image file.'));
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

const cropLogoToSquare = ({ source, zoom = 1, offsetX = 0, offsetY = 0 }) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onerror = () => reject(new Error('Unable to load image.'));
  image.onload = () => {
    const outputSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
    const scale = baseScale * Math.max(1, Number(zoom) || 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const maxOffsetX = Math.max(0, (drawWidth - outputSize) / 2);
    const maxOffsetY = Math.max(0, (drawHeight - outputSize) / 2);
    const safeOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, Number(offsetX) || 0));
    const safeOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, Number(offsetY) || 0));
    const dx = (outputSize - drawWidth) / 2 + safeOffsetX;
    const dy = (outputSize - drawHeight) / 2 + safeOffsetY;

    ctx.clearRect(0, 0, outputSize, outputSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    resolve(canvas.toDataURL('image/webp', 0.86));
  };
  image.src = source;
});

export default function SettingsPage() {
  const { profile, logout } = useAuth();
  const { t } = useLanguage();

  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [currency, setCurrency] = useState('Ks');
  const [shopLogo, setShopLogo] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');

  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoCrop, setLogoCrop] = useState({ open: false, source: '', zoom: 1, offsetX: 0, offsetY: 0 });
  const fileRef = useRef(null);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (!profile?.tenantId) return;

    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'pos_settings', profile.tenantId));
        if (!snap.exists()) return;

        const data = snap.data();
        setShopName(data.shopName || '');
        setShopPhone(data.shopPhone || data.phone || '');
        setShopAddress(data.shopAddress || data.address || '');
        setReceiptFooter(data.receiptFooter || '');
        setCurrency(data.currency || 'Ks');
        setShopLogo(data.shopLogo || data.logoDataUrl || data.logoUrl || '');
        setTgToken(data.tgToken || '');
        setTgChatId(data.tgChatId || '');
        setOpeningBalance(data.openingBalance ?? '');
        setClosingBalance(data.closingBalance ?? '');
      } catch (error) {
        logger.error('Failed to fetch settings:', error);
        showToast(t('settingsLoadError', 'Unable to load settings.'), 'error');
      }
    };

    fetchSettings();
  }, [profile?.tenantId, t]);

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoLoading(true);
    try {
      const source = await readImageFile(file);
      setLogoCrop({ open: true, source, zoom: 1, offsetX: 0, offsetY: 0 });
    } catch (error) {
      logger.error('Logo upload failed:', error);
      showToast(error?.message || t('logoUploadFailed', 'Logo upload failed.'), 'error');
    } finally {
      setLogoLoading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const cancelLogoCrop = () => setLogoCrop({ open: false, source: '', zoom: 1, offsetX: 0, offsetY: 0 });

  const applyLogoCrop = async () => {
    if (!logoCrop.source) return;
    setLogoLoading(true);
    try {
      const croppedLogo = await cropLogoToSquare(logoCrop);
      setShopLogo(croppedLogo);
      cancelLogoCrop();
      showToast(t('logoReady', 'Logo ready. Save settings to apply.'), 'success');
    } catch (error) {
      logger.error('Logo crop failed:', error);
      showToast(error?.message || t('logoUploadFailed', 'Logo upload failed.'), 'error');
    } finally {
      setLogoLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!profile?.tenantId) return;

    try {
      await setDoc(doc(db, 'pos_settings', profile.tenantId), {
        tenantId: profile.tenantId,
        shopName: shopName.trim(),
        shopPhone: shopPhone.trim(),
        shopAddress: shopAddress.trim(),
        receiptFooter: receiptFooter.trim(),
        currency: currency.trim() || 'Ks',
        shopLogo: shopLogo || '',
        tgToken: tgToken.trim(),
        tgChatId: tgChatId.trim(),
        updatedAt: Date.now(),
      }, { merge: true });

      showToast(t('settingsSaved', 'Settings saved successfully.'), 'success');
    } catch (error) {
      logger.error('Error saving settings:', error);
      showToast(t('settingsSaveError', 'Unable to save settings.'), 'error');
    }
  };

  const saveBalance = async () => {
    if (!profile?.tenantId) return;

    try {
      await setDoc(doc(db, 'pos_settings', profile.tenantId), {
        tenantId: profile.tenantId,
        openingBalance: parseFloat(openingBalance) || 0,
        closingBalance: parseFloat(closingBalance) || 0,
        updatedAt: Date.now(),
      }, { merge: true });
      showToast(t('balanceSaved', 'Balance saved successfully.'), 'success');
    } catch (error) {
      logger.error('Error saving balance:', error);
      showToast(t('balanceSaveError', 'Unable to save balance.'), 'error');
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) return showToast(t('passwordRequired', 'Enter old and new password.'), 'error');
    if (newPassword.length < 6) return showToast(t('passwordMin', 'New password must be at least 6 characters.'), 'error');

    setIsChangingPwd(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not found');

      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      await setDoc(doc(db, 'pos_users', profile.id || user.uid), {
        encryptedKey: encodeAuth(newPassword),
        updatedAt: Date.now(),
      }, { merge: true });

      showToast(t('passwordChanged', 'Password changed. Please login again.'), 'success');
      setOldPassword('');
      setNewPassword('');
      logout();
    } catch (error) {
      logger.error('Error changing password:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        showToast(t('oldPasswordWrong', 'Old password is incorrect.'), 'error');
      } else {
        showToast(t('passwordChangeError', 'Unable to change password.'), 'error');
      }
    } finally {
      setIsChangingPwd(false);
    }
  };

  const exportAllCSV = async () => {
    setConfirmDialog({
      isOpen: true,
      title: t('exportRecords', 'Export Records'),
      message: t('exportRecordsConfirm', 'Download all sale records as CSV?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const q = query(collection(db, 'pos_records'), where('tenantId', '==', profile?.tenantId));
          const snap = await getDocs(q);
          if (snap.empty) return showToast(t('noRecords', 'No records found.'), 'warning');

          let csv = 'Date,Invoice,Type,Customer,Item,Amount,Discount,PaymentType\n';
          snap.docs.forEach((recordDoc) => {
            const d = recordDoc.data();
            csv += `"${d.date || ''}","${d.invoiceNo || ''}","${d.type || ''}","${d.personName || ''}","${d.item || 'Multiple'}","${d.amount || 0}","${d.discount || 0}","${d.paymentType || ''}"\n`;
          });

          const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `Records_${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          showToast(t('csvDownloaded', 'CSV downloaded.'), 'success');
        } catch (error) {
          logger.error('Error exporting CSV:', error);
          showToast(t('exportError', 'Export failed.'), 'error');
        }
      },
    });
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setConfirmDialog({
      isOpen: true,
      title: t('importCsv', 'Import CSV'),
      message: t('importCsvConfirm', 'Import data from the selected CSV file?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        try {
          const text = await file.text();
          const rows = text.split('\n').filter((row) => row.trim() !== '');
          if (rows.length <= 1) return showToast(t('fileNoData', 'File has no data.'), 'warning');

          let count = 0;
          let batch = writeBatch(db);

          for (let index = 1; index < rows.length; index += 1) {
            const rowStr = rows[index];
            const cols = [];
            let inQuotes = false;
            let current = '';

            for (let charIndex = 0; charIndex < rowStr.length; charIndex += 1) {
              const char = rowStr[charIndex];
              if (char === '"') inQuotes = !inQuotes;
              else if (char === ',' && !inQuotes) {
                cols.push(current.trim());
                current = '';
              } else current += char;
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
          showToast(count > 0 ? `${t('importDone', 'Imported records:')} ${count}` : t('noValidData', 'No valid data found.'), count > 0 ? 'success' : 'warning');
        } catch (error) {
          logger.error('Import error:', error);
          showToast(t('importError', 'Import failed.'), 'error');
        }
        if (fileRef.current) fileRef.current.value = '';
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-28 text-white sm:p-6">
      <ConfirmDialog {...confirmDialog} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />
      {logoCrop.open ? (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-400/25 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-black text-white"><Crop size={20} /> {t('cropLogo', 'Crop Logo')}</h4>
                <p className="mt-1 text-xs font-semibold text-slate-400">{t('cropLogoHint', 'Move and zoom the image before saving.')}</p>
              </div>
              <button type="button" onClick={cancelLogoCrop} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10"><X size={18} /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-3xl border border-white/10 bg-black">
                <img
                  src={logoCrop.source}
                  alt="Logo crop preview"
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: `${Number(logoCrop.zoom || 1) * 100}%`,
                    height: 'auto',
                    transform: `translate(calc(-50% + ${logoCrop.offsetX}px), calc(-50% + ${logoCrop.offsetY}px))`,
                  }}
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-cyan-300/50" />
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400">{t('zoom', 'Zoom')}</span>
                  <input type="range" min="1" max="3" step="0.05" value={logoCrop.zoom} onChange={(e) => setLogoCrop((prev) => ({ ...prev, zoom: Number(e.target.value) }))} className="w-full" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400">{t('moveHorizontal', 'Move Horizontal')}</span>
                  <input type="range" min="-160" max="160" step="1" value={logoCrop.offsetX} onChange={(e) => setLogoCrop((prev) => ({ ...prev, offsetX: Number(e.target.value) }))} className="w-full" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400">{t('moveVertical', 'Move Vertical')}</span>
                  <input type="range" min="-160" max="160" step="1" value={logoCrop.offsetY} onChange={(e) => setLogoCrop((prev) => ({ ...prev, offsetY: Number(e.target.value) }))} className="w-full" />
                </label>
                <button type="button" onClick={() => setLogoCrop((prev) => ({ ...prev, zoom: 1, offsetX: 0, offsetY: 0 }))} className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
                  {t('resetCrop', 'Reset')}
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={cancelLogoCrop} className="rounded-2xl border border-white/10 px-4 py-3 font-black text-slate-200 hover:bg-white/10">{t('cancel', 'Cancel')}</button>
              <button type="button" onClick={applyLogoCrop} disabled={logoLoading} className="rounded-2xl bg-cyan-600 px-4 py-3 font-black text-white hover:bg-cyan-500 disabled:opacity-60">
                {logoLoading ? t('processing', 'Processing...') : t('saveLogo', 'Save Logo')}
              </button>
            </div>
          </div>
        </div>
      ) : null}


      <div className="flex items-center justify-between rounded-3xl border-2 border-cyan-500/15 bg-[#0d1120] p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-4">
          <Settings size={32} className="text-cyan-400" />
          <div>
            <h3 className="text-2xl font-black">{t('settings', 'Settings')}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-400">{t('settingsSubtitle', 'Shop profile, receipt, backup and security')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-cyan-400">
            <Store size={20} /> {t('shopProfile', 'Shop Profile')}
          </h4>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[190px_1fr]">
            <div className="space-y-3">
              <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-3xl border border-cyan-400/20 bg-black/40">
                {shopLogo ? (
                  <img src={shopLogo} alt="Shop logo" className="h-full w-full object-contain p-3" />
                ) : (
                  <div className="text-center text-slate-500">
                    <ImageIcon className="mx-auto mb-2" size={34} />
                    <p className="text-xs font-bold">{t('noLogo', 'No logo')}</p>
                  </div>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
              >
                <Upload size={17} /> {logoLoading ? t('processing', 'Processing...') : t('uploadLogo', 'Upload Logo')}
              </button>
              {shopLogo ? (
                <button
                  type="button"
                  onClick={() => setShopLogo('')}
                  className="w-full rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:bg-rose-500/20"
                >
                  {t('removeLogo', 'Remove Logo')}
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-400">{t('shopName', 'Shop Name')}</span>
                <input value={shopName} onChange={(event) => setShopName(event.target.value)} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-cyan-500" />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-400"><Phone size={15} />{t('shopPhone', 'Phone')}</span>
                <input value={shopPhone} onChange={(event) => setShopPhone(event.target.value)} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-cyan-500" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-400">{t('currency', 'Currency')}</span>
                <input value={currency} onChange={(event) => setCurrency(event.target.value)} placeholder="Ks" className="w-full rounded-xl border border-cyan-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-cyan-500" />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-400"><MapPin size={15} />{t('shopAddress', 'Address')}</span>
                <textarea value={shopAddress} onChange={(event) => setShopAddress(event.target.value)} rows={2} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-cyan-500" />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-400">{t('receiptFooter', 'Receipt Footer')}</span>
                <textarea value={receiptFooter} onChange={(event) => setReceiptFooter(event.target.value)} rows={2} className="w-full rounded-xl border border-cyan-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-cyan-500" />
              </label>
            </div>
          </div>

          <button onClick={saveSettings} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-4 font-black text-white transition-colors hover:bg-cyan-500 active:scale-95">
            <Save size={18} /> {t('saveSettings', 'Save Settings')}
          </button>
        </div>

        <div className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-blue-400">
            <MessageCircle size={20} /> {t('telegramSettings', 'Telegram Settings')}
          </h4>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-400">{t('telegramBotToken', 'Telegram Bot Token')}</span>
            <input value={tgToken} onChange={(event) => setTgToken(event.target.value)} placeholder="123456:ABC-DEF..." className="w-full rounded-xl border border-blue-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-400">{t('telegramChatId', 'Telegram Chat ID')}</span>
            <input value={tgChatId} onChange={(event) => setTgChatId(event.target.value)} placeholder="123456789" className="w-full rounded-xl border border-blue-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <button onClick={saveSettings} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600/20 py-4 font-black text-blue-200 transition hover:bg-blue-600/30 active:scale-95">
            <Save size={18} /> {t('saveSettings', 'Save Settings')}
          </button>
        </div>

        <div className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-indigo-400"><Lock size={20} /> {t('changePassword', 'Change Password')}</h4>
          <input type="password" placeholder={t('oldPassword', 'Old Password')} value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} className="w-full rounded-xl border border-indigo-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-indigo-500" />
          <input type="password" placeholder={t('newPassword', 'New Password')} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-xl border border-indigo-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-indigo-500" />
          <button onClick={handleChangePassword} disabled={isChangingPwd} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 py-4 font-black text-indigo-300 transition-all hover:bg-indigo-600/40 active:scale-95 disabled:opacity-50">
            {isChangingPwd ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" /> : <><Lock size={18} /> {t('updatePassword', 'Update Password')}</>}
          </button>
        </div>

        <div className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-purple-400"><Wallet size={20} /> {t('dailyBalance', 'Daily Balance')}</h4>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-400">{t('openingBalance', 'Opening Balance')}</span>
              <input type="number" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} className="w-full rounded-xl border border-purple-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-purple-400" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-400">{t('closingBalance', 'Closing Balance')}</span>
              <input type="number" value={closingBalance} onChange={(event) => setClosingBalance(event.target.value)} className="w-full rounded-xl border border-purple-500/20 bg-black/50 px-4 py-3 text-white outline-none focus:border-purple-400" />
            </label>
          </div>
          <button onClick={saveBalance} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-600/20 py-4 font-black text-purple-300 transition-all hover:bg-purple-600/40 active:scale-95">
            <Save size={18} /> {t('saveBalance', 'Save Balance')}
          </button>
        </div>

        <div className="space-y-4 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-emerald-400"><Download size={20} /> {t('dataTools', 'Data Tools')}</h4>
          <button onClick={exportAllCSV} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600/20 py-4 font-black text-emerald-200 transition hover:bg-emerald-600/30 active:scale-95">
            <Download size={18} /> {t('exportCsv', 'Export CSV')}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleImportCSV} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500/15 py-4 font-black text-amber-200 transition hover:bg-amber-500/25 active:scale-95">
            <Upload size={18} /> {t('importCsv', 'Import CSV')}
          </button>
        </div>

        <div className="space-y-5 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2 text-lg font-black text-amber-300">
            <CheckCircle size={20} /> {t('settingsGuide', 'Settings Guide')}
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
              <p className="font-black text-cyan-100">{t('businessSetupGuide', 'Business Setup')}</p>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-300">
                <li>{t('businessSetupGuide1', 'Add shop name, phone, address and currency.')}</li>
                <li>{t('businessSetupGuide2', 'Upload the logo, crop it, then save settings.')}</li>
                <li>{t('businessSetupGuide3', 'Receipt preview uses this profile automatically.')}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
              <p className="font-black text-emerald-100">{t('backupGuide', 'Backup Guide')}</p>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-slate-300">
                <li>{t('backupGuide1', 'Use Backup Now to download a JSON backup.')}</li>
                <li>{t('backupGuide2', 'File name uses shop name and current date.')}</li>
                <li>{t('backupGuide3', 'Keep backup files private and restore only to the same shop.')}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-blue-400/15 bg-blue-500/5 p-4">
              <p className="font-black text-blue-100">{t('telegramBackupGuide', 'Telegram Backup Guide')}</p>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-slate-300">
                <li>{t('telegramGuide1', 'Create a bot from @BotFather and copy the token.')}</li>
                <li>{t('telegramGuide2', 'Create a Telegram channel/group and add the bot as admin.')}</li>
                <li>{t('telegramGuide3', 'Get the chat ID and save it in Telegram Settings.')}</li>
                <li>{t('telegramGuide4', 'Use backend/Cloud Function later for automatic backup sending.')}</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 border-b border-white/10 pb-2 text-lg font-black text-cyan-400">{t('backupRestore', 'Backup / Restore')}</h4>
          <BackupSettings tenantId={profile?.tenantId} shopName={shopName} />
        </div>
      </div>
    </div>
  );
}
