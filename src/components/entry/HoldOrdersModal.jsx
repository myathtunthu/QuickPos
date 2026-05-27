import { useEffect } from 'react';
import { X, Clock } from 'lucide-react';

export default function HoldOrdersModal({ tenantId, onLoadOrder, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      if (!tenantId) return;
      try {
        const q = query(
          collection(db, 'held_orders'),
          where('tenantId', '==', tenantId),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error loading holds:", error);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [tenantId]);

  const handleLoad = (order) => {
    onLoadOrder(order);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-cyan-500/20 rounded-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-cyan-500/20">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-cyan-400" /> Held Orders
          </h2>
          <button onClick={onClose} className="text-slate-400"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-slate-400">Loading...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-slate-400">No held orders</p>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className="bg-black/40 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-white">{order.personName || 'Guest'}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-cyan-400 mt-1">
                        Items: {order.cart?.length || 0} | Total: {order.totals?.total?.toLocaleString()} Ks
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoad(order)}
                      className="px-3 py-1 bg-cyan-600 rounded-lg text-xs font-bold"
                    >
                      Load
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
