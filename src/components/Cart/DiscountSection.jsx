import { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { Percent, DollarSign } from 'lucide-react';

export default function DiscountSection() {
  const { setDiscount, getTotals } = useCartStore();
  const { subtotal } = getTotals();
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'
  const [discountValue, setDiscountValue] = useState('');

  const handleApply = () => {
    const val = Number(discountValue);
    if (isNaN(val) || val < 0) return;

    if (discountType === 'percent') {
      const calculatedDiscount = subtotal * (val / 100);
      setDiscount(calculatedDiscount);
    } else {
      setDiscount(val);
    }
  };

  return (
    <div className="p-4 border-t border-gray-800 bg-gray-900/50">
      <label className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">Apply Discount</label>
      <div className="flex gap-2">
        <div className="flex bg-gray-950 rounded-lg border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setDiscountType('amount')}
            className={`p-2 transition-colors ${discountType === 'amount' ? 'bg-neon-cyan text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <DollarSign size={16} />
          </button>
          <button
            type="button"
            onClick={() => setDiscountType('percent')}
            className={`p-2 transition-colors ${discountType === 'percent' ? 'bg-neon-cyan text-black' : 'text-gray-400 hover:text-white'}`}
          >
            <Percent size={16} />
          </button>
        </div>
        <input
          type="number"
          placeholder={discountType === 'percent' ? '0 %' : '0 MMK'}
          className="input-cyber flex-1 !py-1"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
        />
        <button 
          onClick={handleApply}
          className="px-3 bg-gray-800 text-neon-cyan text-xs font-bold rounded-lg border border-gray-700 hover:border-neon-cyan transition-colors"
        >
          APPLY
        </button>
      </div>
    </div>
  );
}
