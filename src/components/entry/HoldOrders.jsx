import { Clock, RotateCcw, Trash2 } from 'lucide-react';

export default function HoldOrders({ orders, onRestore, onDelete, fmt }) {
  if (orders.length === 0) return null;

  return (
    <div className="bg-[#0d1120] border border-cyan-500/20 rounded-lg p-2 max-h-40 overflow-y-auto">
      <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-1 mb-2">
        <Clock size={12} /> Held Invoices
      </h3>
      {orders.map(order => (
        <div key={order.id} className="flex justify-between items-center py-1 border-b border-white/5 text-[10px]">
          <div>
            <p className="text-white font-bold">{order.personName || 'Walk-in'}</p>
            <p className="text-slate-400">{fmt(order.totalsSnapshot?.total || 0)} Ks - {order.createdAt?.toDate().toLocaleTimeString()}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onRestore(order)} className="p-1 bg-cyan-600 rounded text-white"><RotateCcw size={12}/></button>
            <button onClick={() => onDelete(order.id)} className="p-1 bg-rose-600 rounded text-white"><Trash2 size={12}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}
