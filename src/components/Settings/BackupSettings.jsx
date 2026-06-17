import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cloud, Download, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import Button from '../UI/Button';
import ConfirmDialog from '../UI/ConfirmDialog';
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
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
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
  const showToast = useToastStore((state) => state.showToast);
  const [loadingAction, setLoadingAction] = useState(null);
  const [backups, setBackups] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const isLoading = useMemo(() => Boolean(loadingAction), [loadingAction]);

  const loadBackups = useCallback(async () => {
    if (!tenantId) return;

    setLoadingAction((current) => current || 'list');
    try {
      const result = await listTenantBackups({ tenantId, limit: 20 });
      setBackups(Array.isArray(result?.backups) ? result.backups : []);
    } catch (error) {
      console.error('Unable to list backups:', error);
      showToast('Backup list ရယူရာတွင် အမှားဖြစ်နေပါသည်။ Cloud Functions deploy ဖြစ်မဖြစ်စစ်ပါ။', 'error');
    } finally {
      setLoadingAction((current) => (current === 'list' ? null : current));
    }
  }, [showToast, tenantId]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleManualBackup = async () => {
    if (!tenantId || isLoading) return;

    setLoadingAction('backup');
    try {
      const result = await createTenantBackup({ tenantId, reason: 'manual_settings_page' });
      showToast(`Backup အောင်မြင်ပါသည်။ Docs: ${result?.totalDocuments || 0}`, 'success');
      await loadBackups();
    } catch (error) {
      console.error('Manual backup failed:', error);
      showToast(error?.message || 'Backup မအောင်မြင်ပါ။ Cloud Function logs ကိုစစ်ပါ။', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownload = async (backupId) => {
    if (!backupId || isLoading) return;

    setLoadingAction(`download:${backupId}`);
    try {
      const result = await createBackupDownloadUrl({ backupId });
      if (!result?.url) throw new Error('Download URL မရပါ။');

      window.open(result.url, '_blank', 'noopener,noreferrer');
      showToast('Backup download link ဖွင့်ထားပါသည်။ Link သည် ၁၀ မိနစ်အတွင်းသာ အသုံးပြုနိုင်ပါသည်။', 'success');
    } catch (error) {
      console.error('Backup download failed:', error);
      showToast(error?.message || 'Backup download မအောင်မြင်ပါ။', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const askRestore = (backup) => {
    if (!backup?.id || backup.status !== 'completed') return;

    setConfirmDialog({
      isOpen: true,
      title: 'Backup Restore လုပ်မည်',
      message: `ဤ backup (${formatDateTime(backup.createdAt)}) ကို tenant data အဖြစ်ပြန်ရေးပါမည်။ လက်ရှိ data များကို overwrite လုပ်နိုင်သည်။ ဆက်လုပ်မလား?`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
        setLoadingAction(`restore:${backup.id}`);
        try {
          const result = await restoreTenantBackup({ backupId: backup.id, confirmation: 'RESTORE' });
          showToast(`Restore အောင်မြင်ပါသည်။ Writes: ${result?.totalWrites || 0}`, 'success');
          await loadBackups();
        } catch (error) {
          console.error('Restore failed:', error);
          showToast(error?.message || 'Restore မအောင်မြင်ပါ။ Cloud Function logs ကိုစစ်ပါ။', 'error');
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

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-cyan" />
          <div>
            <p className="font-semibold text-white">Production backup policy</p>
            <p className="mt-1 text-xs leading-6 text-gray-400">
              Live POS data ကို browser ထဲ download မလုပ်ဘဲ Cloud Functions ကနေ tenant-wise JSON backup အဖြစ် Firebase Storage ထဲသိမ်းပါသည်။ Restore လုပ်နိုင်ရန် backup metadata ကို Firestore ထဲသိမ်းထားပါသည်။
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button onClick={handleManualBackup} loading={loadingAction === 'backup'} icon={Cloud} disabled={isLoading}>
          Backup Now
        </Button>
        <Button variant="secondary" onClick={loadBackups} loading={loadingAction === 'list'} icon={RefreshCw} disabled={isLoading}>
          Refresh List
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-black text-white">Recent Backups</h4>
          <span className="text-xs text-gray-500">{backups.length} items</span>
        </div>

        {backups.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm text-gray-400">
            Backup မရှိသေးပါ။ ပထမဆုံး Backup Now ကိုနှိပ်ပါ။
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
                      Docs: {Number(backup.totalDocuments || 0).toLocaleString()} · Size: {formatBackupSize(backup.sizeBytes)}
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
                      Download
                    </Button>
                    <Button
                      variant="warning"
                      icon={RotateCcw}
                      loading={loadingAction === `restore:${backup.id}`}
                      disabled={backup.status !== 'completed' || isLoading}
                      onClick={() => askRestore(backup)}
                    >
                      Restore
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100/80">
        <div className="mb-1 flex items-center gap-2 font-semibold text-amber-100">
          <AlertTriangle size={16} />
          <span>Deploy required</span>
        </div>
        <p>
          ဒီ UI အလုပ်လုပ်ရန် `functions/index.js` နှင့် `functions/package.json` ကို Firebase Functions အဖြစ် deploy လုပ်ရပါမည်။ Restore သည် overwrite လုပ်နိုင်သောကြောင့် production တွင် backup download တစ်ခု အရင်ယူပြီးမှလုပ်ပါ။
        </p>
      </div>
    </div>
  );
}
