import { Wallet } from 'lucide-react';

export default function PaymentSection({
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  total,
  fmt
}) {
  const methods = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-5 gap-1">
        {methods.map(m => (
          <button
            key={m}
            onClick={() => {
              setPaymentMethod(m);
              if (m === 'Credit') setPaidAmount('0');
            }}
            className={`py-1.5 rounded-md text-[8px] font-bold border transition-all ${
              paymentMethod === m
                ? 'bg-cyan-600 border-cyan-400 text-white'
                : 'bg-black/40 border-white/5 text-slate-400'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="relative">
        <Wallet className="absolute left-2.5 top-1.5 text-emerald-400" size={12} />
        <input
          value={paidAmount}
          onChange={e => setPaidAmount(e.target.value)}
          placeholder={paymentMethod === 'Credit' ? '0' : `Paid (default ${fmt(total)})`}
          className="w-full bg-black/40 border border-emerald-500/20 rounded-md pl-8 pr-2 py-1.5 text-[10px] text-emerald-300"
          readOnly={paymentMethod === 'Credit'}
        />
        {paymentMethod === 'Credit' && (
          <p className="text-[9px] text-rose-400 mt-0.5">Credit: paid amount is 0</p>
        )}
      </div>
    </div>
  );
}
