import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DatabaseBackup,
  Download,
  FileJson,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import Button from '../UI/Button';
import ConfirmDialog from '../UI/ConfirmDialog';
import { showToast } from '../UI/Toast';
import { db } from '../../firebase/config';
import { useLanguage } from '../../context/LanguageContext';

const BACKUP_COLLECTIONS = [
  'pos_settings',
  'pos_products',
  'pos_customers',
  'pos_suppliers',
  'pos_records',
  'pos_drafts',
  'pos_users',
];

const SYSTEM_COLLECTIONS = new Set(['pos_settings']);

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const serializeValue = (value) => {
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return { __type: 'timestamp', value: value.toDate().toISOString() };
    if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
      return { __type: 'timestamp', value: new Date(value.seconds * 1000).toISOString() };
    }

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }
  return value;
};

const readTenantCollection = async (collectionName, tenantId) => {
  if (SYSTEM_COLLECTIONS.has(collectionName)) {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs
      .filter((item) => item.id === tenantId || item.data()?.tenantId === tenantId)
      .map((item) => ({ id: item.id, data: serializeValue(item.data()) }));
  }

  const snap = await getDocs(query(collection(db, collectionName), where('tenantId', '==', tenantId)));
  return snap.docs.map((item) => ({ id: item.id, data: serializeValue(item.data()) }));
};

const downloadJson = (filename, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const formatBytes = (bytes = 0) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const sanitizeFilenamePart = (value = '') => String(value || '')
  .trim()
  .replace(/[\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60);

const validateBackup = (payload, tenantId) => {
  if (!payload || payload.app !== 'QuickPos' || payload.type !== 'tenant-browser-backup') {
    throw new Error('Invalid QuickPos backup file.');
  }
  if (!payload.tenantId || payload.tenantId !== tenantId) {
    throw new Error('Backup tenant does not match current tenant.');
  }
  if (!payload.collections || typeof payload.collections !== 'object') {
    throw new Error('Backup collections are missing.');
  }
  return true;
};

export default function BackupSettings({ tenantId, shopName = '' }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const isLoading = useMemo(() => Boolean(loadingAction), [loadingAction]);

  const createBrowserBackup = useCallback(async () => {
    if (!tenantId || isLoading) return;

    setLoadingAction('backup');
    try {
      const collections = {};
      let totalDocuments = 0;

      for (const collectionName of BACKUP_COLLECTIONS) {
        const rows = await readTenantCollection(collectionName, tenantId);
        collections[collectionName] = rows;
        totalDocuments += rows.length;
      }

      const payload = {
        app: 'QuickPos',
        type: 'tenant-browser-backup',
        version: 1,
        tenantId,
        createdAt: new Date().toISOString(),
        totalDocuments,
        collections,
      };

      const jsonText = JSON.stringify(payload);
      const safeShopName = sanitizeFilenamePart(shopName) || 'Shop';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const filename = `${safeShopName}-backup-${timestamp}.json`;
      downloadJson(filename, payload);
      setLastBackup({ filename, totalDocuments, sizeBytes: new Blob([jsonText]).size, createdAt: payload.createdAt });
      showToast(t('backupCreated', 'Backup downloaded successfully.'), 'success');
    } catch (error) {
      console.error('Browser backup failed:', error);
      showToast(error?.message || t('backupFailed', 'Backup failed.'), 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [isLoading, tenantId, t]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const restoreFromFile = async () => {
    if (!tenantId || !selectedFile || isLoading) return;

    setConfirmDialog({
      isOpen: true,
      title: t('restoreBackup', 'Restore Backup'),
      message: t('restoreWarning', 'This will overwrite matching documents from the selected backup file. Continue?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        setLoadingAction('restore');
        try {
          const text = await selectedFile.text();
          const payload = JSON.parse(text);
          validateBackup(payload, tenantId);

          let totalWrites = 0;
          let batch = writeBatch(db);
          let pending = 0;

          for (const [collectionName, rows] of Object.entries(payload.collections)) {
            if (!BACKUP_COLLECTIONS.includes(collectionName) || !Array.isArray(rows)) continue;

            for (const row of rows) {
              if (!row?.id || !row?.data) continue;
              const ref = doc(db, collectionName, row.id);
              batch.set(ref, { ...row.data, tenantId: row.data.tenantId || tenantId }, { merge: true });
              totalWrites += 1;
              pending += 1;

              if (pending >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                pending = 0;
              }
            }
          }

          if (pending > 0) await batch.commit();
          showToast(`${t('restoreDone', 'Restore completed.')} ${totalWrites}`, 'success');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
          console.error('Browser restore failed:', error);
          showToast(error?.message || t('restoreFailed', 'Restore failed.'), 'error');
        } finally {
          setLoadingAction(null);
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <ConfirmDialog
        {...confirmDialog}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
      />

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
        <div className="flex items-start gap-3">
          <DatabaseBackup className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
          <div>
            <p className="font-black text-white">{t('browserBackupTitle', 'Browser Backup')}</p>
            <p className="mt-1 text-xs leading-6 text-slate-400">
              {t('browserBackupDesc', 'Download this tenant data as a JSON file. This works without Cloud Functions.')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button onClick={createBrowserBackup} loading={loadingAction === 'backup'} icon={Download} disabled={isLoading || !tenantId}>
          {t('backupNow', 'Backup Now')}
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={Upload} disabled={isLoading || !tenantId}>
          {t('chooseBackupFile', 'Choose Backup File')}
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleFileChange} className="hidden" />

      {selectedFile ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-black text-white"><FileJson size={17} />{selectedFile.name}</p>
              <p className="mt-1 text-xs text-slate-400">{formatBytes(selectedFile.size)}</p>
            </div>
            <Button variant="warning" onClick={restoreFromFile} loading={loadingAction === 'restore'} disabled={isLoading}>
              {t('restoreBackup', 'Restore Backup')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-black text-white">{t('lastBackup', 'Last Backup')}</h4>
          <button
            type="button"
            onClick={() => setLastBackup(null)}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-slate-200"
          >
            <RefreshCw size={13} /> {t('clear', 'Clear')}
          </button>
        </div>

        {lastBackup ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            <p className="font-black">{lastBackup.filename}</p>
            <p className="mt-1 text-xs text-emerald-100/75">
              Docs: {Number(lastBackup.totalDocuments || 0).toLocaleString()} · Size: {formatBytes(lastBackup.sizeBytes)}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
            {t('noBackupYet', 'No backup has been downloaded in this session yet.')}
          </div>
        )}
      </div>


    </div>
  );
}
