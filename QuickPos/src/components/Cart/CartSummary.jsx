import { useState } from 'react';
import { CreditCard, Banknote, QrCode } from 'lucide-react';

const formatMMK = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', minimumFractionDigits: 0 }).format(amount);
};

export default function CartSummary({ subtotal, tax, discount, total, onCheckout }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');

  return (
    <div className="p-4 bg-gray-900 border-t border-gray-800">
      <div className="space-y-2 mb-4 text-sm font-mono">
        <div className="flex justify-between text-gray-400">
          <span>SUBTOTAL</span>
          <span>{formatMMK(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>TAX (5%)</span>
          <span>{formatMMK(tax)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-neon-pink">
            <span>DISCOUNT</span>
            <span>-{formatMMK(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-gray-800">
          <span>TOTAL</span>
          <span className="text-neon-cyan">{formatMMK(total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button 
          onClick={() => setPaymentMethod('cash')}
          className={`flex flex-col items-center p-2 rounded-lg border transition-all ${paymentMethod === 'cash' ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
        >
          <Banknote size={20} className="mb-1" />
          <span className="text-[10px] uppercase">Cash</span>
        </button>
        <button 
          onClick={() => setPaymentMethod('kpay')}
          className={`flex flex-col items-center p-2 rounded-lg border transition-all ${paymentMethod === 'kpay' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
        >
          <QrCode size={20} className="mb-1" />
          <span className="text-[10px] uppercase">KPay</span>
        </button>
        <button 
          onClick={() => setPaymentMethod('card')}
          className={`flex flex-col items-center p-2 rounded-lg border transition-all ${paymentMethod === 'card' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}
        >
          <CreditCard size={20} className="mb-1" />
          <span className="text-[10px] uppercase">Card</span>
        </button>
      </div>

      <button 
        onClick={() => onCheckout(paymentMethod)}
        disabled={total === 0}
        className="w-full py-3 bg-neon-cyan text-black font-bold uppercase tracking-widest rounded-lg hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Process Transaction
      </button>
    </div>
  );
}
