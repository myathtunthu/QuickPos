import React from 'react';
import { Trash2, Tag } from 'lucide-react';

const CartSection = React.memo(({ 
  cart, 
  products = [], 
  onUpdateQty, 
  onUpdateUnit, 
  onUpdatePriceType, 
  onUpdateDiscount, 
  onUpdatePrice, 
  onRemove 
}) => {
  if (!cart || cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
        <p className="text-xs font-bold">Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar w-full overflow-x-hidden">
      {cart.map(item => {
        const product = products && Array.isArray(products) ? products.find(p => p.id === item.productId) : null;
        const availableUnits = product?.packageUnits || [];

        const rowQty = Number(item.quantity) || 0; 
        const rowSubtotal = item.unitPrice * rowQty;
        const rowDiscount = Number(item.itemDiscountAmt) || 0;
        const rowTotal = Math.max(rowSubtotal - rowDiscount, 0);

        return (
          <div key={item.id} className="bg-[#0d1120] border border-cyan-500/10 rounded-xl p-3 transition-all hover:border-cyan-500/30 w-full box-border">
            {/* Top Row: Name and Delete Button */}
            <div className="flex justify-between items-center w-full mb-2">
              <p className="font-black text-xs text-white truncate max-w-[85%]">{item.name || 'Unknown Item'}</p>
              <button type="button" onClick={() => onRemove(item.id)} className="text-rose-400 hover:text-rose-300 transition-colors p-1 flex-shrink-0">
                <Trash2 size={14}/>
              </button>
            </div>
            
            {/* Bottom Row: 🌟 Responsive Flex-Wrap Controls (ဘေးသို့ လုံးဝလျှံထွက်မသွားစေရပါ) */}
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              {/* အရေအတွက် ပြင်ရန် */}
              <input 
                type="number" 
                min="1"
                value={item.quantity} 
                onChange={(e) => onUpdateQty(item.id, e.target.value)}
                className="w-14 bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white text-center outline-none focus:border-cyan-400"
                placeholder="Qty"
              />
              
              {/* Unit ရွေးရန် */}
              <select 
                value={item.unitName}
                onChange={(e) => onUpdateUnit(item.id, e.target.value)}
                className="bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400 max-w-[80px]"
              >
                {availableUnits.map(u => (
                  <option key={u.name} value={u.name}>{u.name}</option>
                ))}
              </select>

              {/* ဈေးနှုန်းအမျိုးအစား (Retail/Wholesale) */}
              <select 
                value={item.priceType}
                onChange={(e) => onUpdatePriceType(item.id, e.target.value)}
                className="bg-black/60 border border-cyan-500/20 rounded px-1.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400 max-w-[80px]"
              >
                <option value="retail">Retail</option>
                <option value="wholesaleA">WS-A</option>
                <option value="wholesaleB">WS-B</option>
                <option value="wholesaleC">WS-C</option>
              </select>

              {/* ဈေးနှုန်း ပြင်ရန် */}
              <input 
                type="number" 
                value={item.unitPrice === 0 ? '' : item.unitPrice} 
                onChange={(e) => onUpdatePrice(item.id, e.target.value)}
                className="w-20 bg-amber-900/10 border border-amber-500/30 rounded px-1.5 py-1 text-[11px] text-amber-400 outline-none focus:border-amber-400 text-center"
                placeholder="Price"
              />

              {/* Item-level Row Discount Input */}
              <div className="flex items-center gap-1 text-amber-400 text-[10px] bg-amber-900/10 px-1.5 py-1 rounded border border-amber-500/10 h-[24px] box-border">
                <Tag size={10}/> 
                <input 
                  type="number"
                  value={item.itemDiscountAmt === 0 ? '' : item.itemDiscountAmt} 
                  onChange={e => onUpdateDiscount(item.id, e.target.value)} 
                  placeholder="0" 
                  className="w-10 bg-transparent text-[10px] text-amber-400 outline-none text-right placeholder-amber-700"
                /> Ks
              </div>
            </div>

            {/* Calculations Row */}
            <div className="text-cyan-400 text-[10px] mt-2 font-bold border-t border-white/5 pt-1.5 w-full">
              {Number(item.unitPrice).toLocaleString()} Ks × {rowQty}
              {rowDiscount > 0 ? ` (- Disc ${rowDiscount.toLocaleString()} Ks)` : ''} = {rowTotal.toLocaleString()} Ks
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default CartSection;
