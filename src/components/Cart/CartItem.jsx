import { Plus, Minus, Trash2, AlertTriangle } from 'lucide-react';
import { formatMMK } from '../../utils/formatMMK';

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clampQuantity = (quantity, min = 0) => Math.max(min, Number(quantity) || min);

const isDecimalUnit = (item) => {
  const unit = String(item?.selectedUnit || item?.unit || item?.unitName || '').toLowerCase();
  return Boolean(item?.allowDecimal || ['kg', 'g', 'lb', 'oz', 'liter', 'l', 'ml', 'm', 'meter', 'cm', 'ft', 'feet', 'yard', 'yd', 'ပိဿာ', 'ကျပ်သား', 'ပဲ', 'ပြည်', 'တင်း'].includes(unit));
};

const formatQuantity = (value, item) => {
  const qty = toNumber(value);
  if (!isDecimalUnit(item)) return String(Math.trunc(qty));
  return qty.toLocaleString('en-US', { maximumFractionDigits: 3 });
};

const getUnitLabel = (item) => item?.selectedUnit || item?.unitName || item?.unit || 'pcs';

const getBaseQuantity = (item) => {
  const quantity = toNumber(item?.quantity);
  const multiplier = Math.max(toNumber(item?.unitMultiplier ?? item?.multiplier, 1), 0);
  return quantity * multiplier;
};

const getStep = (item) => (isDecimalUnit(item) ? 0.1 : 1);

export default function CartItem({ item = {}, onUpdateQuantity, onRemove }) {
  const quantity = clampQuantity(item.quantity, isDecimalUnit(item) ? 0.001 : 1);
  const price = Math.max(toNumber(item.price), 0);
  const stock = toNumber(item.stock ?? item.baseStock ?? item.currentStock, null);
  const baseQuantity = getBaseQuantity({ ...item, quantity });
  const lineTotal = price * quantity;
  const unitLabel = getUnitLabel(item);
  const step = getStep(item);
  const stockLimited = Number.isFinite(stock) && stock >= 0;
  const exceedsStock = stockLimited && baseQuantity > stock + 0.000001;
  const canDecrease = quantity > (isDecimalUnit(item) ? 0.001 : 1);
  const nextMinus = Math.max(isDecimalUnit(item) ? 0.001 : 1, quantity - step);
  const nextPlus = quantity + step;

  const updateQuantity = (nextQuantity) => {
    if (typeof onUpdateQuantity !== 'function') return;
    const normalized = isDecimalUnit(item)
      ? Math.max(0.001, Number(nextQuantity) || 0.001)
      : Math.max(1, Math.trunc(Number(nextQuantity) || 1));
    onUpdateQuantity(item.id, normalized, item);
  };

  return (
    <div className={`flex items-center justify-between gap-3 p-3 border-b border-gray-800 bg-gray-900/30 ${exceedsStock ? 'ring-1 ring-red-500/50' : ''}`}>
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-sm font-medium text-gray-200 truncate" title={item.name || 'Unnamed product'}>
          {item.name || 'Unnamed product'}
        </h4>
        <p className="text-xs text-neon-cyan font-mono mt-1">
          {formatMMK(price)} / {unitLabel}
        </p>
        <p className="text-[11px] text-gray-500 mt-1">
          {formatQuantity(quantity, item)} {unitLabel}
          {toNumber(item.unitMultiplier ?? item.multiplier, 1) !== 1 && (
            <span> · base {formatQuantity(baseQuantity, { allowDecimal: true })}</span>
          )}
        </p>
        {exceedsStock && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-red-300">
            <AlertTriangle size={12} /> Stock ထက်ကျော်နေသည်
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-950 rounded-lg border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => updateQuantity(nextMinus)}
            disabled={!canDecrease}
            className="p-2 text-gray-400 hover:text-neon-cyan transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min={isDecimalUnit(item) ? '0.001' : '1'}
            step={String(step)}
            value={quantity}
            onChange={(event) => updateQuantity(event.target.value)}
            className="w-14 bg-transparent text-center text-sm font-mono text-white outline-none [appearance:textfield]"
            aria-label="Cart quantity"
          />
          <button
            type="button"
            onClick={() => updateQuantity(nextPlus)}
            className="p-2 text-gray-400 hover:text-neon-cyan transition-colors"
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="w-24 text-right">
          <p className="text-sm font-bold text-white font-mono">{formatMMK(lineTotal)}</p>
        </div>

        <button
          type="button"
          onClick={() => typeof onRemove === 'function' && onRemove(item.id, item)}
          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
          aria-label="Remove item"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
