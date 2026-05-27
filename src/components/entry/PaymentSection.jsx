import { Wallet, CreditCard } from 'lucide-react';

export default function PaymentSection({ 
  total, 
  paymentMethod, 
  setPaymentMethod, 
  paidAmount, 
  setPaidAmount, 
  onSubmit, 
  isLoading 
}) {
  const methods = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];
  const fmt = (n) => (Number(n) || 0).toLocaleString();

  return (
    <div className="bg-[#0f172a] rounded-2xl p-4 border border-cyan-500/20">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2">
        <CreditCard size={16} className="text-cyan-400" /> Payment
      </h3>
      
      <div className="grid grid-cols-5 gap-1 mb-4">
        {methods.map(m => (
          <button
            key={m}
            onClick={() => setPaymentMethod(m)}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              paymentMethod === m
                ? 'bg-cyan-600 text-white'
                : 'bg-black/40 text-slate-400 border border-white/5'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      
      <div className="relative mb-4">
        <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-400" />
        <input
          type="number"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          placeholder={paymentMethod === 'Credit' ? '0 (Credit Sale)' : `Enter amount (Total: ${fmt(total)} Ks)`}
          readOnly={paymentMethod === 'Credit'}
          className="w-full bg-black/40 border border-emerald-500/20 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-500"
        />
      </div>
      
      <button
        onClick={onSubmit}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : `Complete ${paymentMethod === 'Credit' ? 'Credit' : ''} Sale`}
      </button>
    </div>
  );
}
