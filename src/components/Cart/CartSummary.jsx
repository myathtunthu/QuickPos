import { useMemo, useState } from 'react';
import { CreditCard, Banknote, QrCode, AlertCircle } from 'lucide-react';
import { formatMMK } from '../../utils/formatMMK';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote, activeClass: 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan' },
  { id: 'kpay', label: 'KPay', icon: QrCode, activeClass: 'bg-blue-500/20 border-blue-500 text-blue-400' },
  { id: 'card', label: 'Card', icon: CreditCard, activeClass: 'bg-purple-500/20 border-purple-500 text-purple-400' },
];

const toMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export default function CartSummary({ subtotal = 0, tax = 0, discount = 0, total = 0, onCheckout }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const safeTotals = useMemo(() => {
    const safeSubtotal = toMoney(subtotal);
    const safeTax = toMoney(tax);
    const safeDiscount = Math.min(toMoney(discount), safeSubtotal + safeTax);
    const computedTotal = Math.max(toMoney(total || safeSubtotal + safeTax - safeDiscount), 0);
    return { subtotal: safeSubtotal, tax: safeTax, discount: safeDiscount, total: computedTotal };
  }, [subtotal, tax, discount, total]);

  const canCheckout = safeTotals.total > 0 && typeof onCheckout === 'function';

  const handleCheckout = () => {
    if (!canCheckout) return;
    onCheckout(paymentMethod);
  };

  return (
    <div className="p-4 bg-gray-900 border-t border-gray-800">
      <div className="space-y-2 mb-4 text-sm font-mono">
        <div className="flex justify-between text-gray-400">
          <span>SUBTOTAL</span>
          <span>{formatMMK(safeTotals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>TAX</span>
          <span>{formatMMK(safeTotals.tax)}</span>
        </div>
        {safeTotals.discount > 0 && (
          <div className="flex justify-between text-neon-pink">
            <span>DISCOUNT</span>
            <span>-{formatMMK(safeTotals.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-gray-800">
          <span>TOTAL</span>
          <span className="text-neon-cyan">{formatMMK(safeTotals.total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4" role="radiogroup" aria-label="Payment method">
        {PAYMENT_METHODS.map(({ id, label, icon: Icon, activeClass }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPaymentMethod(id)}
            role="radio"
            aria-checked={paymentMethod === id}
            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${paymentMethod === id ? activeClass : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
          >
            <Icon size={20} className="mb-1" />
            <span className="text-[10px] uppercase">{label}</span>
          </button>
        ))}
      </div>

      {!canCheckout && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle size={14} /> Cart ထဲမှာ ပစ္စည်းထည့်ပြီးမှ checkout လုပ်နိုင်ပါမယ်။
        </div>
      )}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={!canCheckout}
        className="w-full py-3 bg-neon-cyan text-black font-bold uppercase tracking-widest rounded-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Process Transaction
      </button>
    </div>
  );
}
