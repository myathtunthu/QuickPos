import { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ProductUnitSelector({
  product,
  entryTab,
  onAddToCart,
  stockBase,
  playBeep
}) {
  const { t } = useLanguage();
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [priceType, setPriceType] = useState('retail');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (product && product.packageUnits?.length) {
      const defaultUnit = product.packageUnits[0];
      setSelectedUnit(defaultUnit);
      if (entryTab === 'Sale') {
        setPriceType('retail');
        setUnitPrice(String(defaultUnit.prices?.retail || ''));
      } else {
        setUnitPrice(String(defaultUnit.costPrice || ''));
      }
      setQuantity('1');
      setWarning('');
    }
  }, [product, entryTab]);

  const handleUnitChange = (unitName) => {
    const unit = product.packageUnits.find(u => u.name === unitName);
    setSelectedUnit(unit);
    if (unit) {
      if (entryTab === 'Sale') {
        setUnitPrice(String(unit.prices?.[priceType] || ''));
      } else {
        setUnitPrice(String(unit.costPrice || ''));
      }
    }
  };

  const handlePriceTypeChange = (type) => {
    setPriceType(type);
    if (selectedUnit) {
      setUnitPrice(String(selectedUnit.prices?.[type] || ''));
    }
  };

  const handleAdd = () => {
    if (!selectedUnit || !unitPrice || !quantity) return;
    const qty = Number(quantity);
    if (qty <= 0) return;
    if (entryTab === 'Sale') {
      const needBase = qty * (selectedUnit.multiplier || 1);
      if (needBase > (Number(stockBase) || 0)) {
        setWarning(t('stockNotEnough', 'Insufficient stock'));
        playBeep('error');
        return;
      }
    }
    const item = {
      productId: product.id,
      name: product.name,
      unitName: selectedUnit.name,
      multiplier: selectedUnit.multiplier || 1,
      priceType: entryTab === 'Sale' ? priceType : 'cost',
      unitPrice: Number(unitPrice),
      quantity: qty,
      costPrice: entryTab === 'Purchase' ? Number(unitPrice) : (selectedUnit.costPrice || 0),
      itemDiscountAmt: 0,
      notes: ''
    };
    onAddToCart(item);
    playBeep('success');
  };

  if (!product || !selectedUnit) return null;

  return (
    <div className="bg-[#0d1120] border border-cyan-500/20 rounded-lg p-2 space-y-1.5">
      <p className="text-[11px] font-black text-cyan-400">{product.name}</p>
      <div className="flex gap-1.5">
        <select
          value={selectedUnit.name}
          onChange={e => handleUnitChange(e.target.value)}
          className="flex-1 bg-black border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white outline-none"
        >
          {product.packageUnits.map(u => (
            <option key={u.name} value={u.name}>{u.name} (×{u.multiplier})</option>
          ))}
        </select>
        {entryTab === 'Sale' && (
          <select
            value={priceType}
            onChange={e => handlePriceTypeChange(e.target.value)}
            className="flex-1 bg-black border border-cyan-500/20 rounded-md px-2 py-1.5 text-[11px] text-white outline-none"
          >
            <option value="retail">{t('retailPrice', 'Retail Price')}</option>
            <option value="wholesaleA">{t('wholesaleA', 'Wholesale A')}</option>
            <option value="wholesaleB">{t('wholesaleB', 'Wholesale B')}</option>
            <option value="wholesaleC">{t('wholesaleC', 'Wholesale C')}</option>
          </select>
        )}
      </div>
      <div className="flex gap-1.5 items-center">
        <input
          value={unitPrice}
          onChange={e => setUnitPrice(e.target.value)}
          placeholder={t('price', 'Price')}
          className="w-16 bg-black/40 border border-cyan-500/20 rounded-md px-2 py-1.5 text-[16px] sm:text-xs text-white text-center"
        />
        <span className="text-slate-500 text-[10px]">×</span>
        <input
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="1"
          className="w-10 bg-black/40 border border-cyan-500/20 rounded-md px-2 py-1.5 text-[16px] sm:text-xs text-white text-center"
        />
        <button
          onClick={handleAdd}
          className="flex-1 py-1.5 bg-cyan-600 rounded-md font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95"
        >
          <PlusCircle size={12} /> {t('addToCart', 'Add')}
        </button>
      </div>
      {warning && (
        <p className="text-rose-400 text-[10px]">{warning}</p>
      )}
    </div>
  );
}
