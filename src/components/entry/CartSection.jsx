import { Trash2, Plus, Minus } from 'lucide-react';

export default function CartSection({ cart, onUpdateQuantity, onRemoveItem, onUpdateDiscount }) {
  const fmt = (n) => (Number(n) || 0).toLocaleString();

  if (cart.length === 0) {
    return (
      <div className="bg-[#0f172a] rounded-2xl p-8 text-center border border-cyan-500/20">
        <p className="text-slate-400">Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 overflow-hidden">
      <div className="p-4 border-b border-cyan-500/20">
        <h3 className="font-bold text-white">Shopping Cart</h3>
      </div>
      
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {cart.map(item => (
          <div key={item.id} className="p-4 hover:bg-white/5 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-white">{item.name}</p>
                <p className="text-xs text-cyan-400">
                  {fmt(item.unitPrice)} Ks × {item.quantity} {item.unitName}
                </p>
                <p className="text-[10px] text-slate-500">
                  {item.priceType} | Base: {item.baseQuantity} {item.baseUnit}
                </p>
              </div>
              <button onClick={() => onRemoveItem(item.id)} className="text-rose-400 hover:text-rose-300">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center hover:bg-cyan-600/20"
                >
                  <Minus size={12} />
                </button>
                <span className="text-white w-8 text-center">{item.quantity}</span>
                <button 
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  className="w-7 h-7 bg-black/40 rounded-lg flex items-center justify-center hover:bg-cyan-600/20"
                >
                  <Plus size={12} />
                </button>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-white">{fmt(item.subtotal)} Ks</p>
                {item.itemDiscount > 0 && (
                  <p className="text-[10px] text-amber-400">Disc: -{fmt(item.itemDiscount)}</p>
                )}
              </div>
            </div>
            
            {/* Item discount input */}
            <div className="mt-2 flex justify-end">
              <input
                type="number"
                placeholder="Item discount"
                value={item.itemDiscount || ''}
                onChange={(e) => onUpdateDiscount(item.id, Number(e.target.value) || 0)}
                className="w-24 bg-black/40 border border-amber-500/20 rounded px-2 py-1 text-xs text-amber-400"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
