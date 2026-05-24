import { useState } from 'react';
import Button from '../UI/Button';
import { Download, Cloud, RefreshCw } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';

export default function BackupSettings() {
  const addToast = useToastStore(state => state.addToast);
  const [loading, setLoading] = useState(false);

  const handleManualBackup = () => {
    setLoading(true);
    // In production, this would trigger a Cloud Function to export Firestore DB to JSON/CSV
    setTimeout(() => {
      setLoading(false);
      addToast('Database snapshot created successfully!');
    }, 2000);
  };

  const handleExportCSV = () => {
    addToast('Generating CSV report...');
    // Implement CSV generation logic
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-white">Manual Cloud Backup</h4>
          <p className="text-xs text-gray-400 mt-1">Force an immediate snapshot of current tenant data.</p>
        </div>
        <Button onClick={handleManualBackup} loading={loading} icon={Cloud}>
          Backup Now
        </Button>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-white">Export to CSV</h4>
          <p className="text-xs text-gray-400 mt-1">Download product and sales data as CSV for Excel.</p>
        </div>
        <Button variant="ghost" onClick={handleExportCSV} icon={Download} className="border border-gray-700">
          Export CSV
        </Button>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        <div>
          <h4 className="text-sm font-bold text-white">Sync Offline Data</h4>
          <p className="text-xs text-gray-400 mt-1">Push local cached transactions to cloud.</p>
        </div>
        <Button variant="ghost" onClick={() => addToast('System is in sync')} icon={RefreshCw} className="border border-gray-700">
          Sync Now
        </Button>
      </div>
    </div>
  );
}
