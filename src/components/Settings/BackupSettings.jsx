import { useMemo, useState } from 'react';
import { AlertTriangle, Cloud, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import Button from '../UI/Button';
import { useToastStore } from '../../store/toastStore';

const BACKUP_ENDPOINT = '/api/backups/create';
const EXPORT_ENDPOINT = '/api/exports/csv';
const SYNC_ENDPOINT = '/api/sync/offline';

async function postJson(endpoint, payload = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getActionMessage(status, actionName) {
  if (status === 404) {
    return `${actionName} အတွက် backend API မတပ်ဆင်ရသေးပါ။ Production တွင် Cloud Function/server endpoint ထည့်ပါ။`;
  }

  if (status === 401 || status === 403) {
    return `${actionName} လုပ်ရန် permission မလုံလောက်ပါ။`;
  }

  return `${actionName} မအောင်မြင်ပါ။ Server logs ကိုစစ်ပါ။`;
}

export default function BackupSettings() {
  const addToast = useToastStore((state) => state.addToast);
  const [loadingAction, setLoadingAction] = useState(null);

  const isLoading = useMemo(() => Boolean(loadingAction), [loadingAction]);

  const runServerAction = async ({ actionKey, actionName, endpoint }) => {
    if (isLoading) return;

    setLoadingAction(actionKey);
    try {
      const response = await postJson(endpoint, { requestedAt: new Date().toISOString() });

      if (response.ok) {
        addToast(`${actionName} အောင်မြင်ပါသည်။`);
        return;
      }

      addToast(getActionMessage(response.status, actionName), 'error');
    } catch (error) {
      if (error?.name === 'AbortError') {
        addToast(`${actionName} timeout ဖြစ်သွားပါသည်။ Network/backend ကိုစစ်ပါ။`, 'error');
      } else {
        addToast(`${actionName} လုပ်ရာတွင် network error ဖြစ်ပါသည်။`, 'error');
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManualBackup = () => runServerAction({
    actionKey: 'backup',
    actionName: 'Manual Cloud Backup',
    endpoint: BACKUP_ENDPOINT,
  });

  const handleExportCSV = () => runServerAction({
    actionKey: 'export',
    actionName: 'CSV Export',
    endpoint: EXPORT_ENDPOINT,
  });

  const handleSyncOfflineData = () => runServerAction({
    actionKey: 'sync',
    actionName: 'Offline Data Sync',
    endpoint: SYNC_ENDPOINT,
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-gray-300">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-cyan" />
          <div>
            <p className="font-semibold text-white">Production backup policy</p>
            <p className="mt-1 text-xs leading-6 text-gray-400">
              Backup/export များကို client browser ထဲကနေ database အပြည့် download မလုပ်စေဘဲ backend API/Cloud Function ဖြင့်သာ လုပ်ရန်ပြင်ထားပါသည်။
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Manual Cloud Backup</h4>
          <p className="mt-1 text-xs leading-5 text-gray-400">Current tenant data snapshot ကို server-side backup အဖြစ်ဖန်တီးပါ။</p>
        </div>
        <Button onClick={handleManualBackup} loading={loadingAction === 'backup'} icon={Cloud} disabled={isLoading}>
          Backup Now
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Export to CSV</h4>
          <p className="mt-1 text-xs leading-5 text-gray-400">Products, sales, and reports ကို role-based CSV export အဖြစ်ထုတ်ပါ။</p>
        </div>
        <Button variant="ghost" onClick={handleExportCSV} loading={loadingAction === 'export'} icon={Download} className="border border-gray-700" disabled={isLoading}>
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Sync Offline Data</h4>
          <p className="mt-1 text-xs leading-5 text-gray-400">Local cached transactions များကို cloud သို့ server-side conflict check ဖြင့် sync လုပ်ပါ။</p>
        </div>
        <Button variant="ghost" onClick={handleSyncOfflineData} loading={loadingAction === 'sync'} icon={RefreshCw} className="border border-gray-700" disabled={isLoading}>
          Sync Now
        </Button>
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-amber-100/80">
        <div className="mb-1 flex items-center gap-2 font-semibold text-amber-100">
          <AlertTriangle size={16} />
          <span>Backend required</span>
        </div>
        <p>
          `/api/backups/create`, `/api/exports/csv`, `/api/sync/offline` endpoint များကို backend/Cloud Functions တွင်တပ်ဆင်ပြီးမှ live backup/export/sync အလုပ်လုပ်ပါမည်။
        </p>
      </div>
    </div>
  );
}
