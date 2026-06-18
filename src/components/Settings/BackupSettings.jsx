import React, { useState } from 'react';
import { Cloud, Download, RefreshCw, RotateCcw } from 'lucide-react';
import Button from '../UI/Button';
import ConfirmDialog from '../UI/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import { useToastStore } from '../../store/toastStore';
import {
  createBackupDownloadUrl,
  createTenantBackup,
  formatBackupSize,
  listTenantBackups,
  restoreTenantBackup,
} from '../../services/backupService';

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const getStatusClass = (status) => {
  if (status === 'completed') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  if (status === 'failed') return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
};

export default function BackupSettings({ tenantId }) {
  const { t } = useLanguage();
  const showToast = useToastStore((state) => state.showToast);
  const [loadingAction, setLoadingAction] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const isLoading = Boolean(loadingAction);

  const getErrorMessage = (error, fallback) => {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('internal') || message.includes('not-found') || message.includes('functions')) {
      return t('backupFunctionMissing', 'Cloud Functions မ deploy လုပ်ရသေးပါ။');
    }
    return error?.message || fallback;
  };

  const loadBackups = async () => {
    if (!tenantId || isLoading) return;
    setLoadingAction('list');
    try {
      const result = await listTenantBackups({ tenantId, limit: 20 });
      setBackups(Array.isArray(result?.backups) ? result.backups : []);
      setLoaded(true);
    } catch (error) {
      console.error('Unable to list backups:', error);
      setBackups([]);
      setLoaded(true);
      showToast(getErrorMessage(error, t('backupListFailed', 'Backup list မရပါ။')), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManualBackup = async () => {
    if (!tenantId || isLoading) return;
    setLoadingAction('backup');
    try {
      const result = await createTenantBackup({ tenantId, reason: 'manual_settings_page' });
      showToast(t('backupSuccess', 'Backup အောင်မြင်ပါသည်။') + ` (${result?.totalDocuments || 0})`, 'success');
      await loadBackups();
    } catch (error) {
      console.error('Manual backup failed:', error);
      showToast(getErrorMessage(error, t('backupFailed', 'Backup မအောင်မြင်ပါ။')), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownload = async (backupId) => {
    if (!backupId || isLoading) return;
    setLoadingAction(`download:${backupId}`);
    try {
      const result = await createBackupDownloadUrl({ backupId });
      if (!result?.url) throw new Error(t('downloadUrlMissing', 'Download URL မရပါ။'));
      window.open(result.url, '_blank', 'noopener,noreferrer');
      showToast(t('backupDownloadOpened', 'Backup download link ဖွင့်ပြီးပါပြီ။'), 'success');
    } catch (error) {
      console.error('Backup download failed:', error);
      showToast(getErrorMessage(error, t('backupDownloadFailed', 'Backup download မအောင်မြင်ပါ။')), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const askRestore = (backup) => {
    if (!backup?.id || backup.status !== 'completed') return;
    setConfirmDialog({
      isOpen: true,
      title: t('restoreBackup', 'Restore Backup'),
      message: t('restoreBackupConfirm', 'ဤ backup ကို ပြန်ထည့်ပါမည်။ လက်ရှိ data များ overwrite ဖြစ်နိုင်သည်။ ဆက်လုပ်မလား?'),
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        setLoadingAction(`restore:${backup.id}`);
        try {
          const result = await restoreTenantBackup({ backupId: backup.id, confirmation: 'RESTORE' });
          showToast(t('restoreSuccess', 'Restore အောင်မြင်ပါသည်။') + ` (${result?.totalWrites || 0})`, 'success');
          await loadBackups();
        } catch (error) {
          console.error('Restore failed:', error);
          showToast(getErrorMessage(error, t('restoreFailed', 'Restore မအောင်မြင်ပါ။')), 'error');
        } finally {
          setLoadingAction(null);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog
        {...confirmDialog}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button onClick={handleManualBackup} loading={loadingAction === 'backup'} icon={Cloud} disabled={isLoading}>
          {t('backupNow', 'Backup Now')}
        </Button>
        <Button variant="secondary" onClick={loadBackups} loading={loadingAction === 'list'} icon={RefreshCw} disabled={isLoading}>
          {t('refreshList', 'Refresh List')}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-black text-white">{t('recentBackups', 'Recent Backups')}</h4>
          <span className="text-xs text-gray-500">{backups.length} {t('items', 'items')}</span>
        </div>

        {!loaded ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm text-gray-400">
            {t('backupRefreshHint', 'Backup list ကြည့်ရန် Refresh List ကိုနှိပ်ပါ။')}
          </div>
        ) : backups.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm text-gray-400">
            {t('noBackupsYet', 'Backup မရှိသေးပါ။')}
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div key={backup.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusClass(backup.status)}`}>
                        {backup.status || 'unknown'}
                      </span>
                      <span className="text-xs text-gray-500">{backup.reason || 'manual'}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-white">{formatDateTime(backup.createdAt)}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Docs: {Number(backup.totalDocuments || 0).toLocaleString()} · {formatBackupSize(backup.sizeBytes)}
                    </p>
                    {backup.error ? <p className="mt-1 text-xs text-rose-300">{backup.error}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      className="border border-gray-700"
                      icon={Download}
                      loading={loadingAction === `download:${backup.id}`}
                      disabled={backup.status !== 'completed' || isLoading}
                      onClick={() => handleDownload(backup.id)}
                    >
                      {t('download', 'Download')}
                    </Button>
                    <Button
                      variant="warning"
                      icon={RotateCcw}
                      loading={loadingAction === `restore:${backup.id}`}
                      disabled={backup.status !== 'completed' || isLoading}
                      onClick={() => askRestore(backup)}
                    >
                      {t('restore', 'Restore')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
