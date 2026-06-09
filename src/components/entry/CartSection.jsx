import React from 'react';
import { AlertTriangle, Tag, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  calculateBaseQuantity,
  formatMoney,
  formatQuantity,
  getAvailableBaseStock,
  getBaseUnitName,
  getQuantityStep,
  getUnitMultiplier,
  getUnitName,
  getUnitPrice,
  toSafeNumber,
} from './entryUomHelpers';

const CartSection = React.memo(({
  cart,
  products = [],
  onUpdateQty,
  onUpdateUnit,
  onUpdatePriceType,
  onUpdateDiscount,
  onUpdatePrice,
  onRemove,
  entryTab = 'Sale',
}) => {
  const { t } = useLanguage();

  if (!cart || cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
        <p className="text-xs font-bold">{t('cartEmpty', 'Cart is empty')}</p>
        <p className="text-[10px] mt-1 text-slate-600">{t('scanOrSelectProduct', 'Scan barcode or select product to start')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar w-full overflow-x-hidden">
      {cart.map((item) => {
        const product = Array.isArray(products) ? products.find((p) => p.id === item.productId) : null;
        const availableUnits = product?.packageUnits || [];
        const selectedUnit = availableUnits.find((unit) => getUnitName(unit) === item.unitName) || {
          name: item.unitName,
          multiplier: item.multiplier || 1,
          prices: { [item.priceType || 'retail']: item.unitPrice },
          costPrice: item.costPrice,
        };
        const rowQty = toSafeNumber(item.quantity, 0);
        const rowSubtotal = toSafeNumber(item.unitPrice, 0) * rowQty;
        const rowDiscount = toSafeNumber(item.itemDiscountAmt, 0);
        const rowTotal = Math.max(rowSubtotal - rowDiscount, 0);
        const baseQty = calculateBaseQuantity(rowQty, selectedUnit);
        const baseUnitName = item.baseUnitName || getBaseUnitName(product);
        const stockBase = getAvailableBaseStock(product);
        const stockWarning = entryTab === 'Sale' && product && baseQty > stockBase;

        return (
          <div
            key={item.id}
            className={`bg-[#0d1120] border rounded-xl p-3 transition-all w-full box-border ${
              stockWarning ? 'border-rose-500/40 shadow-lg shadow-rose-950/20' : 'border-cyan-500/10 hover:border-cyan-500/30'
            }`}
          >
            <div className="flex justify-between items-start w-full mb-2 gap-2">
              <div className="min-w-0">
                <p className="font-black text-xs text-white truncate">{item.name || t('unknownItem', 'Unknown Item')}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  {t('baseQty', 'Base Qty')}: {formatQuantity(baseQty)} {baseUnitName}
                  {entryTab === 'Sale' && product ? ` / ${t('stockLabel', 'Stock')}: ${formatQuantity(stockBase)} ${baseUnitName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-rose-400 hover:text-rose-300 transition-colors p-1 flex-shrink-0"
                aria-label={t('delete', 'Delete')}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-[72px_92px_105px_1fr_92px] gap-1.5 w-full">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={getQuantityStep(item.unitName)}
                value={item.quantity}
                onChange={(event) => onUpdateQty(item.id, event.target.value)}
                className="bg-black/50 border border-white/10 rounded px-1.5 py-1.5 text-center text-[16px] sm:text-xs text-white outline-none focus:border-cyan-400"
                aria-label={t('quantity', 'Quantity')}
              />

              {availableUnits.length > 0 ? (
                <select
                  value={item.unitName}
                  onChange={(event) => onUpdateUnit(item.id, event.target.value)}
                  className="bg-black/50 border border-white/10 rounded px-1 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
                  aria-label={t('unitName', 'Unit Name')}
                >
                  {availableUnits.map((unit) => (
                    <option key={getUnitName(unit)} value={getUnitName(unit)}>
                      {getUnitName(unit)} ×{formatQuantity(getUnitMultiplier(unit))}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-2 py-1.5 rounded bg-black/30 text-[10px] text-slate-400 border border-white/10">{item.unitName}</span>
              )}

              {entryTab === 'Sale' ? (
                <select
                  value={item.priceType || 'retail'}
                  onChange={(event) => onUpdatePriceType(item.id, event.target.value)}
                  className="bg-black/50 border border-white/10 rounded px-1 py-1.5 text-[10px] text-white outline-none focus:border-cyan-400"
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
                onChange={(event) => onUpdatePrice(item.id, event.target.value)}
                className="bg-black/50 border border-cyan-500/20 rounded px-1.5 py-1.5 text-right text-[16px] sm:text-xs text-cyan-300 outline-none focus:border-cyan-400"
                aria-label={t('price', 'Price')}
              />

              <div className="relative">
                <Tag size={10} className="absolute left-1.5 top-2 text-amber-400" />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={rowSubtotal}
                  value={item.itemDiscountAmt || ''}
                  onChange={(event) => onUpdateDiscount(item.id, event.target.value)}
                  placeholder="0"
                  className="w-full bg-black/50 border border-amber-500/20 rounded pl-5 pr-1 py-1.5 text-right text-[16px] sm:text-xs text-amber-300 outline-none focus:border-amber-400"
                  aria-label={t('discountLabel', 'Discount')}
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[11px]">
              <span className="text-slate-500">
                {formatMoney(getUnitPrice(selectedUnit, item.priceType, entryTab))} Ks / {getUnitName(selectedUnit)}
              </span>
              <span className="font-black text-cyan-300">{formatMoney(rowTotal)} Ks</span>
            </div>

            {stockWarning && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1.5">
                <AlertTriangle size={12} />
                {t('stockNotEnough', 'Insufficient stock')} — {formatQuantity(baseQty - stockBase)} {baseUnitName} {t('overStock', 'over')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

CartSection.displayName = 'CartSection';

export default CartSection;
