import { useEffect, useMemo, useState } from 'react';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  calculateBaseQuantity,
  formatMoney,
  formatQuantity,
  getAvailableBaseStock,
  getBaseUnitName,
  getDefaultUnit,
  getQuantityStep,
  getUnitMultiplier,
  getUnitName,
  getUnitPrice,
  roundQuantity,
  toSafeNumber,
} from './entryUomHelpers';

export default function ProductUnitSelector({ product, entryTab, onAddToCart, stockBase, playBeep }) {
  const { t } = useLanguage();
  const [selectedUnitName, setSelectedUnitName] = useState('');
  const [priceType, setPriceType] = useState('retail');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [warning, setWarning] = useState('');

  const units = useMemo(() => (Array.isArray(product?.packageUnits) ? product.packageUnits : []), [product]);
  const selectedUnit = useMemo(
    () => units.find((unit) => getUnitName(unit) === selectedUnitName) || getDefaultUnit(product),
    [product, selectedUnitName, units]
  );
  const availableStockBase = toSafeNumber(stockBase ?? getAvailableBaseStock(product), 0);
  const baseUnitName = getBaseUnitName(product);
  const qtyNumber = roundQuantity(quantity, 4);
  const needBase = calculateBaseQuantity(qtyNumber, selectedUnit);
  const remainingBase = Math.max(availableStockBase - needBase, 0);
  const canSell = entryTab !== 'Sale' || needBase <= availableStockBase;

  useEffect(() => {
    if (!product) return;
    const defaultUnit = getDefaultUnit(product);
    setSelectedUnitName(getUnitName(defaultUnit));
    setPriceType('retail');
    setUnitPrice(String(getUnitPrice(defaultUnit, 'retail', entryTab) || ''));
    setQuantity('1');
    setWarning('');
  }, [product, entryTab]);

  const handleUnitChange = (unitName) => {
    const nextUnit = units.find((unit) => getUnitName(unit) === unitName) || getDefaultUnit(product);
    setSelectedUnitName(getUnitName(nextUnit));
    setUnitPrice(String(getUnitPrice(nextUnit, priceType, entryTab) || ''));
    setWarning('');
  };

  const handlePriceTypeChange = (type) => {
    setPriceType(type);
    setUnitPrice(String(getUnitPrice(selectedUnit, type, entryTab) || ''));
  };

  const handleAdd = () => {
    const price = toSafeNumber(unitPrice, 0);
    const qty = roundQuantity(quantity, 4);

    if (!product || !selectedUnit || price < 0 || qty <= 0) {
      setWarning(t('invalidQtyOrPrice', 'Quantity and price must be valid.'));
      playBeep?.('error');
      return;
    }

    const baseQuantity = calculateBaseQuantity(qty, selectedUnit);
    if (entryTab === 'Sale' && baseQuantity > availableStockBase) {
      setWarning(t('stockNotEnough', 'Insufficient stock'));
      playBeep?.('error');
      return;
    }

    const item = {
      productId: product.id,
      name: product.name,
      unitName: getUnitName(selectedUnit),
      multiplier: getUnitMultiplier(selectedUnit),
      baseQuantity,
      baseUnitName,
      priceType: entryTab === 'Sale' ? priceType : 'cost',
      unitPrice: price,
      quantity: qty,
      costPrice: entryTab === 'Purchase' ? price : toSafeNumber(selectedUnit.costPrice, 0),
      itemDiscountAmt: 0,
      notes: '',
    };

    onAddToCart?.(item);
    setWarning('');
    playBeep?.('success');
  };

  if (!product || !selectedUnit) return null;

  return (
    <div className="bg-[#0d1120] border border-cyan-500/20 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-cyan-400 leading-tight">{product.name}</p>
          <p className="text-[9px] text-slate-500 mt-0.5">
            {t('baseUnit', 'Base Unit')}: {baseUnitName} · {t('stockLabel', 'Stock')}: {formatQuantity(availableStockBase)}
          </p>
        </div>
        {entryTab === 'Sale' && !canSell && <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <select
          value={getUnitName(selectedUnit)}
          onChange={(event) => handleUnitChange(event.target.value)}
          className="bg-black border border-cyan-500/20 rounded-md px-2 py-2 text-[12px] text-white outline-none focus:border-cyan-400"
        >
          {units.length > 0 ? (
            units.map((unit) => (
              <option key={getUnitName(unit)} value={getUnitName(unit)}>
                {getUnitName(unit)} × {formatQuantity(getUnitMultiplier(unit))}
              </option>
            ))
          ) : (
            <option value={getUnitName(selectedUnit)}>{getUnitName(selectedUnit)}</option>
          )}
        </select>

        {entryTab === 'Sale' && (
          <select
            value={priceType}
            onChange={(event) => handlePriceTypeChange(event.target.value)}
            className="bg-black border border-cyan-500/20 rounded-md px-2 py-2 text-[12px] text-white outline-none focus:border-cyan-400"
          >
            <option value="retail">{t('retailPrice', 'Retail Price')}</option>
            <option value="wholesaleA">{t('wholesaleA', 'Wholesale A')}</option>
            <option value="wholesaleB">{t('wholesaleB', 'Wholesale B')}</option>
            <option value="wholesaleC">{t('wholesaleC', 'Wholesale C')}</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-[1fr_88px_auto] gap-1.5 items-center">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
          placeholder={t('price', 'Price')}
          className="bg-black/40 border border-cyan-500/20 rounded-md px-2 py-2 text-[16px] sm:text-xs text-white text-right outline-none focus:border-cyan-400"
        />
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={getQuantityStep(getUnitName(selectedUnit))}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="1"
          className="bg-black/40 border border-cyan-500/20 rounded-md px-2 py-2 text-[16px] sm:text-xs text-white text-center outline-none focus:border-cyan-400"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={entryTab === 'Sale' && !canSell}
          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-md font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 transition-all"
        >
          <PlusCircle size={12} /> {t('addToCart', 'Add')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
        <div className="bg-black/30 rounded-lg px-2 py-1.5 border border-white/5">
          {t('baseQty', 'Base Qty')}: <span className="text-cyan-300 font-bold">{formatQuantity(needBase)} {baseUnitName}</span>
        </div>
        <div className="bg-black/30 rounded-lg px-2 py-1.5 border border-white/5 text-right">
          {t('lineTotal', 'Line Total')}: <span className="text-emerald-300 font-bold">{formatMoney(toSafeNumber(unitPrice) * qtyNumber)}</span>
        </div>
      </div>

      {entryTab === 'Sale' && (
        <p className={`text-[10px] font-bold ${canSell ? 'text-emerald-400' : 'text-rose-400'}`}>
          {canSell
            ? `${t('remainingStock', 'Remaining')}: ${formatQuantity(remainingBase)} ${baseUnitName}`
            : warning || t('stockNotEnough', 'Insufficient stock')}
        </p>
      )}

      {warning && canSell && <p className="text-rose-400 text-[10px] font-bold">{warning}</p>}
    </div>
  );
}
