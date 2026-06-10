import { useMemo, useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { Percent, DollarSign, X } from 'lucide-react';
import { formatMMK } from '../../utils/formatMMK';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export default function DiscountSection() {
  const { setDiscount, getTotals } = useCartStore();
  const { subtotal = 0 } = getTotals();
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [error, setError] = useState('');

  const previewDiscount = useMemo(() => {
    const value = Math.max(toNumber(discountValue), 0);
    if (discountType === 'percent') return Math.min(subtotal * (Math.min(value, 100) / 100), subtotal);
    return Math.min(value, subtotal);
  }, [discountType, discountValue, subtotal]);

  const handleApply = () => {
    const value = toNumber(discountValue);
    if (subtotal <= 0) {
      setError('Cart subtotal မရှိသေးပါ။');
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setError('Discount တန်ဖိုး မမှန်ပါ။');
      return;
    }
    if (discountType === 'percent' && value > 100) {
      setError('Percent discount သည် 100% ထက်မကျော်ရပါ။');
      return;
    }
    if (discountType === 'amount' && value > subtotal) {
      setError('Discount amount သည် subtotal ထက်မကျော်ရပါ။');
      return;
    }
    setDiscount(previewDiscount);
    setError('');
  };

  const handleClear = () => {
    setDiscountValue('');
    setDiscount(0);
    setError('');
  };

  return (
    <div className="p-4 border-t border-gray-800 bg-gray-900/50">
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-400">Apply Discount</label>
        {previewDiscount > 0 && <span className="text-xs text-neon-cyan">Preview: {formatMMK(previewDiscount)}</span>}
      </div>
      <div className="flex gap-2">
        <div className="flex bg-gray-950 rounded-lg border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => { setDiscountType('amount'); setError(''); }}
            className={`p-2 transition-colors ${discountType === 'amount' ? 'bg-neon-cyan text-black' : 'text-gray-400 hover:text-white'}`}
            aria-label="Amount discount"
          >
            <DollarSign size={16} />
          </button>
          <button
            type="button"
            onClick={() => { setDiscountType('percent'); setError(''); }}
            className={`p-2 transition-colors ${discountType === 'percent' ? 'bg-neon-cyan text-black' : 'text-gray-400 hover:text-white'}`}
            aria-label="Percent discount"
          >
            <Percent size={16} />
          </button>
        </div>
        <input
          type="number"
          min="0"
          max={discountType === 'percent' ? '100' : String(Math.max(subtotal, 0))}
          step={discountType === 'percent' ? '0.01' : '1'}
          placeholder={discountType === 'percent' ? '0 %' : '0 MMK'}
          className="input-cyber flex-1 !py-1"
          value={discountValue}
          onChange={(e) => { setDiscountValue(e.target.value); setError(''); }}
        />
        <button
          type="button"
          onClick={handleApply}
          className="px-3 bg-gray-800 text-neon-cyan text-xs font-bold rounded-lg border border-gray-700 hover:border-neon-cyan transition-colors"
        >
          APPLY
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:border-red-400 hover:text-red-300 transition-colors"
          aria-label="Clear discount"
        >
          <X size={16} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
