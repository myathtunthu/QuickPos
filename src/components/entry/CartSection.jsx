import React from 'react';
import { Trash2, Tag } from 'lucide-react';

const CartSection = React.memo(({ 
  cart, 
  products,
  onUpdateQty, 
  onUpdateUnit, 
  onUpdatePriceType, 
  onUpdateDiscount, 
  onUpdatePrice, // 🌟 အဝယ်ဈေး (Cost) ပြင်ရန်
  onRemove 
}) => {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
        <p className="text-xs font-bold">Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
      {cart.map(item => {
        const product = products.find(p => p.id === item.productId);
        const availableUnits = product?.packageUnits || [];

        return (
          <div key={item.id} className="bg-black/40 border border-cyan-500/10 rounded-lg p-2 transition-all hover:border-cyan-500/30">
            <div className="flex justify-between items-start">
              
              <div className="flex-1">
                <p className="font-bold text-xs text-white">{item.name}</p>
                
                <div className="flex items-center gap-1.5 mt-1.5">
                  {/* ၁။ အရေအတွက် ပြင်ရန် */}
                  <input 
                    type="number" min="1"
                    value={item.quantity} 
                    onChange={(e) => onUpdateQty(item.id, e.target.value)}
                    className="w-12 bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white text-center outline-none focus:border-cyan-400"
                    placeholder="Qty"
                  />
                  
                  {/* ၂။ Unit ရွေးရန် */}
                  <select 
                    value={item.unitName}
                    onChange={(e) => onUpdateUnit(item.id, e.target.value)}
                    className="bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400"
                  >
                    {availableUnits.map(u => (
                      <option key={u.name} value={u.name}>{u.name}</option>
                    ))}
                  </select>

                  {/* ၃။ ဈေးနှုန်းအမျိုးအစား (Retail/Wholesale) */}
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

                  {/* ၄။ 🌟 ဈေးနှုန်း ပြင်ရန် (Price Override Input) 🌟 */}
                  <input 
                    type="number" 
                    value={item.unitPrice || ''} 
                    onChange={(e) => onUpdatePrice(item.id, e.target.value)}
                    className="w-20 bg-amber-900/10 border border-amber-500/30 rounded px-1.5 py-1 text-[11px] text-amber-400 outline-none focus:border-amber-400 text-center"
                    placeholder="Price"
                  />
                </div>

                {/* Subtotal ပြသခြင်း */}
                <p className="text-cyan-400 text-[10px] mt-1.5 font-semibold">
                  {Number(item.unitPrice).toLocaleString()} Ks × {item.quantity} = {Number(item.unitPrice * item.quantity).toLocaleString()} Ks
                </p>
              </div>

              {/* ဖျက်ရန် နှင့် Discount ထည့်ရန် */}
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
      })}
    </div>
  );
});

export default CartSection;
