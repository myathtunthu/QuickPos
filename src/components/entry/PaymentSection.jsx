import React from 'react';
import { Wallet, Loader2, ShoppingCart } from 'lucide-react';

const PaymentSection = React.memo(({ 
  paymentMethod, 
  setPaymentMethod, 
  paidAmount, 
  setPaidAmount, 
  submitTransaction, 
  loading, 
  entryTab 
}) => {
  const methods = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];

  // 🌟 Credit ရွေးလျှင် Paid Amount ကို 0 ဟု သတ်မှတ်ပြီး အခြား Method ပြန်ရွေးလျှင် Placeholder ပေါ်စေရန် ရှင်းလင်းပေးခြင်း
  const handleMethodChange = (m) => {
    setPaymentMethod(m);
    if (m === 'Credit') {
      setPaidAmount('0');
    } else if (paidAmount === '0') {
      setPaidAmount(''); // Cash သို့ပြန်ပြောင်းပါက Full Payment အဖြစ် အလိုအလျောက် ပြန်ပြောင်းပေးခြင်း
    }
  };

  return (
    <div className="bg-[#0d1120] border border-cyan-500/20 rounded-xl p-3 space-y-3">
      {/* Payment Methods */}
      <div className="grid grid-cols-5 gap-1.5">
        {methods.map(m => (
          <button 
            type="button"
            key={m} 
            onClick={() => handleMethodChange(m)} 
            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
              paymentMethod === m 
                ? 'bg-cyan-600 border-cyan-400 text-white shadow-md shadow-cyan-900/20' 
                : 'bg-black/40 border-white/5 text-slate-400 hover:bg-white/5'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Paid Amount Input */}
      <div className="relative">
        <Wallet className="absolute left-3 top-2.5 text-emerald-400" size={14}/>
        <input 
          type="number"
          min="0"
          value={paidAmount} 
          onChange={e => {
            const val = e.target.value;
            // 🌟 Bug Fix: အနှုတ်ကိန်း (Negative Value) ရိုက်ထည့်ပြီး ဒေတာဘေ့စ်စာရင်းဖျက်ဆီးခြင်းကို လုံးဝခွင့်မပြုပါ
            if (Number(val) < 0) return;
            setPaidAmount(val);
          }} 
          placeholder={paymentMethod === 'Credit' ? '0' : 'Paid Amount (Empty = Full)'} 
          className="w-full bg-black/40 border border-emerald-500/30 focus:border-emerald-400 rounded-lg pl-9 pr-3 py-2 text-xs text-emerald-300 outline-none transition-colors"
          readOnly={paymentMethod === 'Credit'}
        />
      </div>

      {/* Submit Button */}
      <button 
        type="button"
        onClick={submitTransaction} 
        disabled={loading} 
        className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
          loading 
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 active:scale-[0.98]'
        }`}
      >
        {loading ? (
          <><Loader2 className="animate-spin" size={16}/> Processing...</>
        ) : (
          <><ShoppingCart size={16}/> Complete {entryTab === 'Sale' ? 'Sale' : 'Purchase'}</>
        )}
      </button>
    </div>
  );
});

export default PaymentSection;
