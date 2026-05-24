import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Activity, Clock } from 'lucide-react';

/**
 * Audit Logs & Activity History (For AdminPage)
 * Tracks user actions, stock transfers, and shift changes
 */
export default function AuditLogsTab() {
  const { userData } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!userData?.tenantId) return;
      try {
        // Fetching from 'shifts' as an example of audit logs
        const q = query(
          collection(db, 'shifts'), 
          where('tenantId', '==', userData.tenantId),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching logs", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [userData]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading System Logs...</div>;

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center">
        <Activity className="text-neon-cyan mr-2" size={20} />
        <h3 className="text-white font-bold tracking-wide">System Activity History</h3>
      </div>
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
        {logs.length === 0 ? (
          <p className="text-center text-gray-500">No activity recorded yet.</p>
        ) : (
          logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 p-3 bg-gray-900/30 rounded-lg border border-gray-800">
              <div className="bg-gray-800 p-2 rounded-full">
                <Clock className="text-gray-400" size={16} />
              </div>
              <div>
                <p className="text-sm text-white">
                  <span className="font-bold text-neon-cyan">{log.userName}</span> 
                  {' '}recorded a shift {log.type}
                </p>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 font-mono">
                  <span>{log.timestamp?.toDate().toLocaleString()}</span>
                  <span>Cash In Drawer: {log.cashInDrawer} MMK</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
