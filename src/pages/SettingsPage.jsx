import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import {
  Download,
  Image as ImageIcon,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  Settings,
  Store,
  Upload,
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


const readLogoImageFile = (file) => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith('image/')) {
    reject(new Error('Please select an image file.'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Unable to read image file.'));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('Unable to load image.'));
    image.onload = () => resolve({
      dataUrl: reader.result,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      name: file.name || 'logo',
    });
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onerror = () => reject(new Error('Unable to load crop image.'));
  image.onload = () => resolve(image);
  image.src = dataUrl;
});

const cropLogoToPng = async ({ dataUrl, width, height }, zoom, offset, removeLightBackground) => {
  const image = await loadImageFromDataUrl(dataUrl);
  const cropSize = 300;
  const outputSize = 512;
  const scale = Math.min(cropSize / width, cropSize / height) * Number(zoom || 1);
  const displayWidth = width * scale;
  const displayHeight = height * scale;
  const imageLeft = ((cropSize - displayWidth) / 2) + Number(offset?.x || 0);
  const imageTop = ((cropSize - displayHeight) / 2) + Number(offset?.y || 0);

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, outputSize, outputSize);
  const outputScale = outputSize / cropSize;
  ctx.save();
  ctx.translate(imageLeft * outputScale, imageTop * outputScale);
  ctx.scale(scale * outputScale, scale * outputScale);
  ctx.drawImage(image, 0, 0);
  ctx.restore();

  if (removeLightBackground) {
    const imageData = ctx.getImageData(0, 0, outputSize, outputSize);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const red = pixels[i];
      const green = pixels[i + 1];
      const blue = pixels[i + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max > 238 && max - min < 18) {
        pixels[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL('image/png');
};

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
  const [logoCrop, setLogoCrop] = useState(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [removeLightBackground, setRemoveLightBackground] = useState(false);
  const fileRef = useRef(null);
  const logoInputRef = useRef(null);
  const cropDragRef = useRef(null);

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

  useEffect(() => {
    if (!logoCrop || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [logoCrop]);

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoLoading(true);
    try {
      const imageInfo = await readLogoImageFile(file);
      setLogoCrop(imageInfo);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setRemoveLightBackground(false);
    } catch (error) {
      logger.error('Logo upload failed:', error);
      showToast(error?.message || t('logoUploadFailed', 'Logo upload failed.'), 'error');
    } finally {
      setLogoLoading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const closeLogoCrop = () => {
    setLogoCrop(null);
    setCropOffset({ x: 0, y: 0 });
    setCropZoom(1);
    setRemoveLightBackground(false);
  };

  const handleCropPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    cropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cropOffset.x,
      originY: cropOffset.y,
    };
  };

  const handleCropPointerMove = (event) => {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setCropOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const handleCropPointerUp = (event) => {
    if (cropDragRef.current?.pointerId === event.pointerId) cropDragRef.current = null;
  };

  const applyLogoCrop = async () => {
    if (!logoCrop) return;
    setLogoLoading(true);
    try {
      const croppedLogo = await cropLogoToPng(logoCrop, cropZoom, cropOffset, removeLightBackground);
      setShopLogo(croppedLogo);
      closeLogoCrop();
      showToast(t('logoReady', 'Logo ready. Save settings to apply.'), 'success');
    } catch (error) {
      logger.error('Logo crop failed:', error);
      showToast(error?.message || t('logoUploadFailed', 'Logo upload failed.'), 'error');
    } finally {
      setLogoLoading(false);
    }
  };

  const renderLogoCropModal = () => {
    if (!logoCrop || typeof document === 'undefined') return null;

    const cropSize = 300;
    const baseScale = Math.min(cropSize / logoCrop.width, cropSize / logoCrop.height);
    const scale = baseScale * cropZoom;
    const displayWidth = logoCrop.width * scale;
    const displayHeight = logoCrop.height * scale;
    const imageLeft = ((cropSize - displayWidth) / 2) + cropOffset.x;
    const imageTop = ((cropSize - displayHeight) / 2) + cropOffset.y;

    const modal = (
      <div
        className="fixed inset-0 z-[2147483647] grid place-items-center bg-black/70 p-3 backdrop-blur-xl print:hidden"
        onWheel={(event) => event.preventDefault()}
        onTouchMove={(event) => event.preventDefault()}
      >
        <div className="w-full max-w-[390px] overflow-hidden rounded-[28px] border border-cyan-400/30 bg-[#090f1d] shadow-2xl shadow-cyan-950/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">{t('logoCropTitle', 'Crop Logo')}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{t('logoCropHelp', 'Drag the photo and keep only the logo inside the box.')}</p>
            </div>
            <button type="button" onClick={closeLogoCrop} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-slate-300 active:scale-95">
              ✕
            </button>
          </div>

          <div className="p-4">
            <div
              className="relative mx-auto h-[300px] w-[300px] touch-none overflow-hidden rounded-3xl border-2 border-cyan-300 bg-[linear-gradient(45deg,#182235_25%,transparent_25%),linear-gradient(-45deg,#182235_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#182235_75%),linear-gradient(-45deg,transparent_75%,#182235_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] shadow-inner"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              <img
                src={logoCrop.dataUrl}
                alt="Crop logo"
                draggable="false"
                className="absolute max-w-none select-none"
                style={{
                  left: `${imageLeft}px`,
                  top: `${imageTop}px`,
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-cyan-300/75" />
              <div className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-white/20" />
              <div className="pointer-events-none absolute left-2/3 top-0 h-full w-px bg-white/20" />
              <div className="pointer-events-none absolute left-0 top-1/3 h-px w-full bg-white/20" />
              <div className="pointer-events-none absolute left-0 top-2/3 h-px w-full bg-white/20" />
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t('zoom', 'Zoom')}</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="w-full accent-cyan-300"
              />
            </label>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={removeLightBackground}
                onChange={(event) => setRemoveLightBackground(event.target.checked)}
                className="mt-1 h-4 w-4 accent-cyan-300"
              />
              <span>
                <span className="block font-black text-white">{t('removeWhiteBg', 'Remove white/light background')}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{t('removeWhiteBgHelp', 'Useful for JPG logos with white background. The saved logo will be PNG.')}</span>
              </span>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={closeLogoCrop} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-slate-200 active:scale-95">
                {t('cancel', 'Cancel')}
              </button>
              <button type="button" onClick={applyLogoCrop} disabled={logoLoading} className="rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 active:scale-95 disabled:opacity-60">
                {logoLoading ? t('processing', 'Processing...') : t('applyCrop', 'Apply Crop')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return createPortal(modal, document.body);
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
      {renderLogoCropModal()}

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

          <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-black/35 p-5">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">{t('receiptPreview', 'Receipt Preview')}</p>
                <h5 className="mt-1 text-lg font-black text-white">{shopName?.trim() || t('shopName', 'Shop Name')}</h5>
              </div>
              {shopLogo ? (
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
                  <img src={shopLogo} alt="Receipt logo preview" className="h-full w-full object-contain" />
                </div>
              ) : null}
            </div>
            <div className="space-y-2 text-center text-sm leading-6 text-slate-300">
              <p className="text-base font-black text-white">{shopName?.trim() || t('shopName', 'Shop Name')}</p>
              {shopPhone?.trim() ? <p>{t('shopPhone', 'Phone')}: {shopPhone.trim()}</p> : null}
              {shopAddress?.trim() ? <p className="whitespace-pre-line">{shopAddress.trim()}</p> : null}
              <div className="my-3 border-t border-dashed border-white/20" />
              <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-400">
                <span>{t('item', 'Item')}</span>
                <span>{t('qty', 'Qty')}</span>
                <span>{t('amount', 'Amount')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 text-xs">
                <span>{t('sampleItem', 'Sample Item')}</span>
                <span>1</span>
                <span>1,000 {currency || 'Ks'}</span>
              </div>
              <div className="my-3 border-t border-dashed border-white/20" />
              <p className="text-right text-base font-black text-cyan-200">{t('total', 'Total')}: 1,000 {currency || 'Ks'}</p>
              {receiptFooter?.trim() ? <p className="pt-2 text-xs font-bold text-slate-400 whitespace-pre-line">{receiptFooter.trim()}</p> : null}
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

        <div className="space-y-4 rounded-3xl border-2 border-white/5 bg-[#0d1120] p-6 shadow-lg sm:p-8 md:col-span-2">
          <h4 className="mb-4 border-b border-white/10 pb-2 text-lg font-black text-cyan-400">{t('backupRestore', 'Backup / Restore')}</h4>
          <BackupSettings tenantId={profile?.tenantId} shopName={shopName} />
        </div>
      </div>
    </div>
  );
}
