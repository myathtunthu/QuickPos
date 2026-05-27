import { Clock, RotateCcw, Trash2 } from 'lucide-react';

export default function HoldOrders({ heldOrders }) {
  return (
    <div className="bg-[#0f172a] border border-amber-500/20 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Clock size={28} className="text-amber-400" />
        <h2 className="text-2xl font-black">Hold Orders</h2>
      </div>

      {heldOrders.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          ယာယီ သိမ်းထားတဲ့ အော်ဒါ မရှိသေးပါ
        </div>
      ) : (
        <div className="space-y-3">
          {heldOrders.map((order, i) => (
            <div key={i} className="bg-black/40 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-bold">Order #{order.id}</p>
                  <p className="text-xs text-slate-400">{order.items.length} items</p>
                </div>
                <p className="text-amber-400 font-bold">{order.total.toLocaleString()} Ks</p>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="flex-1 py-3 bg-amber-500/20 text-amber-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <RotateCcw size={16} /> Restore
                </button>
                <button className="flex-1 py-3 bg-rose-500/20 text-rose-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
