import React from 'react';
import { Trash2, Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const CartSection = React.memo(({ 
  cart, 
  products = [], 
  onUpdateQty, 
  onUpdateUnit, 
  onUpdatePriceType, 
  onUpdateDiscount, 
  onUpdatePrice, 
  onRemove,
  entryTab = 'Sale'
}) => {
  const { t } = useLanguage();

  if (!cart || cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
        <p className="text-xs font-bold">{t('cartEmpty', 'Cart is empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar w-full overflow-x-hidden">
      {cart.map(item => {
        const product = products && Array.isArray(products) ? products.find(p => p.id === item.productId) : null;
        const availableUnits = product?.packageUnits || [];
        const rowQty = Number(item.quantity) || 0; 
        const rowSubtotal = Number(item.unitPrice || 0) * rowQty;
        const rowDiscount = Number(item.itemDiscountAmt) || 0;
        const rowTotal = Math.max(rowSubtotal - rowDiscount, 0);

        return (
          <div key={item.id} className="bg-[#0d1120] border border-cyan-500/10 rounded-xl p-3 transition-all hover:border-cyan-500/30 w-full box-border">
            <div className="flex justify-between items-center w-full mb-2">
              <p className="font-black text-xs text-white truncate max-w-[85%]">{item.name || t('unknownItem', 'Unknown Item')}</p>
              <button type="button" onClick={() => onRemove(item.id)} className="text-rose-400 hover:text-rose-300 transition-colors p-1 flex-shrink-0" aria-label={t('delete', 'Delete')}>
                <Trash2 size={14}/>
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              <input 
                type="number" 
                inputMode="decimal"
                min="1"
                value={item.quantity} 
                onChange={event => onUpdateQty(item.id, event.target.value)} 
                className="w-16 bg-black/50 border border-white/10 rounded px-1.5 py-1.5 text-center text-[16px] sm:text-xs text-white outline-none focus:border-cyan-400" 
                aria-label={t('quantity', 'Quantity')}
              />

              {availableUnits.length > 0 ? (
                <select 
                  value={item.unitName} 
                  onChange={event => onUpdateUnit(item.id, event.target.value)} 
                  className="max-w-[80px] bg-black/50 border border-white/10 rounded px-1 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
                  aria-label={t('unitName', 'Unit Name')}
                >
                  {availableUnits.map(unit => (
                    <option key={unit.name} value={unit.name}>{unit.name}</option>
                  ))}
                </select>
              ) : (
                <span className="px-2 py-1.5 rounded bg-black/30 text-[10px] text-slate-400">{item.unitName}</span>
              )}

              {entryTab === 'Sale' ? (
                <select 
                  value={item.priceType} 
                  onChange={event => onUpdatePriceType(item.id, event.target.value)} 
                  className="max-w-[90px] bg-black/50 border border-white/10 rounded px-1 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
                  aria-label={t('priceType', 'Price Type')}
                >
                  <option value="retail">{t('retailPrice', 'Retail Price')}</option>
                  <option value="wholesaleA">{t('wholesaleA', 'Wholesale A')}</option>
                  <option value="wholesaleB">{t('wholesaleB', 'Wholesale B')}</option>
                  <option value="wholesaleC">{t('wholesaleC', 'Wholesale C')}</option>
                </select>
              ) : (
                <span className="px-2 py-1.5 rounded bg-black/30 text-[10px] text-slate-400 border border-white/10">
                  {t('purchaseCost', 'Purchase Cost')}
                </span>
              )}

              <input 
                type="number" 
                inputMode="decimal"
                min="0"
                value={item.unitPrice} 
                onChange={event => onUpdatePrice(item.id, event.target.value)} 
                className="w-24 bg-black/50 border border-cyan-500/20 rounded px-1.5 py-1.5 text-right text-[16px] sm:text-xs text-cyan-300 outline-none focus:border-cyan-400" 
                aria-label={t('price', 'Price')}
              />

              <div className="relative">
                <Tag size={10} className="absolute left-1.5 top-2 text-amber-400" />
                <input 
                  type="number" 
                  inputMode="decimal"
                  min="0"
                  value={item.itemDiscountAmt || ''} 
                  onChange={event => onUpdateDiscount(item.id, event.target.value)} 
                  placeholder="0" 
                  className="w-20 bg-black/50 border border-amber-500/20 rounded pl-5 pr-1 py-1.5 text-right text-[16px] sm:text-xs text-amber-300 outline-none focus:border-amber-400" 
                  aria-label={t('discountLabel', 'Discount')}
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[11px]">
              <span className="text-slate-500">{t('totalLabel', 'Total')}</span>
              <span className="font-black text-cyan-300">{rowTotal.toLocaleString()} Ks</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default CartSection;
