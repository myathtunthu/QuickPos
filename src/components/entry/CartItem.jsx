import React from 'react';
import { Trash2, Tag } from 'lucide-react';

const CartItem = React.memo(({ 
  item, 
  products,
  onUpdateQty, 
  onUpdateUnit, 
  onUpdatePriceType, 
  onUpdateDiscount, 
  onRemove 
}) => {
  // လက်ရှိ Product ရဲ့ ရနိုင်တဲ့ Unit များကို ရှာဖွေခြင်း
  const product = products.find(p => p.id === item.productId);
  const availableUnits = product?.packageUnits || [];
  
  return (
    <div className="bg-black/40 border border-cyan-500/10 rounded-lg p-2 transition-all hover:border-cyan-500/30">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-bold text-xs text-white">{item.name}</p>
          
          <div className="flex items-center gap-2 mt-1.5">
            {/* အရေအတွက် ပြင်ဆင်ရန် */}
            <input 
              type="number" 
              min="1"
              value={item.quantity} 
              onChange={(e) => onUpdateQty(item.id, e.target.value)}
              className="w-12 bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white text-center outline-none focus:border-cyan-400"
            />
            
            {/* Unit ပြောင်းလဲရန် (ဥပမာ - ဖာ မှ ဘူး သို့) */}
            <select 
              value={item.unitName}
              onChange={(e) => onUpdateUnit(item.id, e.target.value)}
              className="bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400"
            >
              {availableUnits.map(u => (
                <option key={u.name} value={u.name}>{u.name}</option>
              ))}
            </select>

            {/* Price Type ပြောင်းလဲရန် */}
            <select 
              value={item.priceType}
              onChange={(e) => onUpdatePriceType(item.id, e.target.value)}
              className="bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400"
            >
              <option value="retail">Retail</option>
              <option value="wholesaleA">WS-A</option>
              <option value="wholesaleB">WS-B</option>
              <option value="wholesaleC">WS-C</option>
            </select>
          </div>

          <p className="text-cyan-400 text-[10px] mt-1.5 font-semibold">
            {Number(item.unitPrice).toLocaleString()} Ks × {item.quantity} = {Number(item.unitPrice * item.quantity).toLocaleString()} Ks
          </p>
        </div>

        {/* Discount နှင့် ဖျက်ရန် Button */}
        <div className="flex flex-col items-end gap-2">
          <button onClick={() => onRemove(item.id)} className="text-rose-400 hover:text-rose-300 transition-colors p-1">
            <Trash2 size={14}/>
          </button>
          
          <div className="flex items-center gap-1 text-amber-400 text-[10px] bg-amber-900/10 px-1.5 py-1 rounded border border-amber-500/10">
            <Tag size={10}/> 
            <input 
              type="number"
              value={item.itemDiscountAmt || ''} 
              onChange={e => onUpdateDiscount(item.id, e.target.value)} 
              placeholder="0" 
              className="w-12 bg-transparent text-[10px] text-amber-400 outline-none text-right placeholder-amber-700"
            /> Ks
          </div>
        </div>
      </div>
    </div>
  );
});

export default CartItem;
