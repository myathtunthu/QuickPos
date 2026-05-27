import { useState, useRef } from 'react';
import { Trash2, Tag, Minus, Plus } from 'lucide-react';

export default function CartItem({
  item,
  onRemove,
  onQuantityChange,
  onDiscountChange,
  onNotesChange,
  fmt
}) {
  const [showControls, setShowControls] = useState(false);
  const touchStart = useRef(0);
  const touchEnd = useRef(0);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    touchEnd.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStart.current - touchEnd.current > 80) {
      // Swipe left: show remove confirm
      if (window.confirm('Remove this item?')) {
        onRemove(item.id);
      }
    }
    touchStart.current = 0;
    touchEnd.current = 0;
  };

  return (
    <div
      className="bg-black/40 border border-cyan-500/10 rounded-lg p-2 mb-1.5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-bold text-xs">{item.name}</p>
          <p className="text-cyan-400 text-[10px] mt-0.5">
            {fmt(item.unitPrice)} × {item.quantity} {item.unitName} = {fmt(item.unitPrice * item.quantity)} Ks
          </p>
          <p className="text-[9px] text-slate-500">
            {item.priceType} | ×{item.multiplier}
            {item.notes && <span className="ml-2 text-amber-400">📝 {item.notes}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowControls(!showControls)}
            className="text-slate-400 text-[10px] underline"
          >
            {showControls ? 'Done' : 'Edit'}
          </button>
          <button onClick={() => onRemove(item.id)} className="text-rose-400">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showControls && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              className="p-0.5 bg-black rounded"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              value={item.quantity}
              onChange={e => onQuantityChange(item.id, Number(e.target.value) || 1)}
              className="w-14 bg-black border border-cyan-500/20 rounded px-1.5 py-0.5 text-[10px] text-white text-center"
            />
            <button
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              className="p-0.5 bg-black rounded"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="flex items-center gap-1 text-amber-400 text-[10px]">
            <Tag size={10} />
            <input
              value={item.itemDiscountAmt || ''}
              onChange={e => onDiscountChange(item.id, e.target.value)}
              placeholder="Discount"
              className="w-16 bg-black border border-amber-500/20 rounded px-1.5 py-0.5 text-[10px] text-white"
            />
            <span>Ks</span>
          </div>
          <input
            value={item.notes || ''}
            onChange={e => onNotesChange(item.id, e.target.value)}
            placeholder="Item note"
            className="w-full bg-black border border-slate-500/20 rounded px-1.5 py-0.5 text-[10px] text-white"
          />
        </div>
      )}
    </div>
  );
}
