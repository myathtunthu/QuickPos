import React from 'react';
import { Wallet, Loader2, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const PAYMENT_METHOD_KEYS = {
  Cash: 'cash',
  Kpay: 'kpay',
  KPay: 'kpay',
  Wave: 'wavePay',
  WavePay: 'wavePay',
  AYAPay: 'ayaPay',
  Bank: 'bank',
  Credit: 'credit',
};

const PaymentSection = React.memo(({ 
  paymentMethod, 
  setPaymentMethod, 
  paidAmount, 
  setPaidAmount, 
  submitTransaction, 
  loading, 
  entryTab,
  disabled = false,
  disabledReason = ''
}) => {
  const { t } = useLanguage();
  const methods = ['Cash', 'Kpay', 'Wave', 'AYAPay', 'Credit'];

  const methodLabel = (method) => t(PAYMENT_METHOD_KEYS[method] || method, method);

  const handleMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === 'Credit') {
      setPaidAmount('0');
    } else if (paidAmount === '0') {
      setPaidAmount('');
    }
  };

  return (
    <div className="bg-[#0d1120] border border-cyan-500/20 rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {methods.map(method => (
          <button 
            type="button"
            key={method} 
            onClick={() => handleMethodChange(method)} 
            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
              paymentMethod === method 
                ? 'bg-cyan-600 border-cyan-400 text-white shadow-md shadow-cyan-900/20' 
                : 'bg-black/40 border-white/5 text-slate-400 hover:bg-white/5'
            }`}
          >
            {methodLabel(method)}
          </button>
        ))}
      </div>

      <div className="relative">
        <Wallet className="absolute left-3 top-2.5 text-emerald-400" size={14}/>
        <input 
          type="number"
          inputMode="decimal"
          min="0"
          value={paidAmount} 
          onChange={event => {
            const val = event.target.value;
            if (Number(val) < 0) return;
            setPaidAmount(val);
          }} 
          placeholder={paymentMethod === 'Credit' ? '0' : t('paidAmountPlaceholder', 'Paid Amount (Empty = Full)')} 
          className="w-full bg-black/40 border border-emerald-500/30 focus:border-emerald-400 rounded-lg pl-9 pr-3 py-2 text-[16px] sm:text-xs text-emerald-300 outline-none transition-colors"
          readOnly={paymentMethod === 'Credit'}
        />
      </div>

      <button 
        type="button"
        onClick={submitTransaction} 
        disabled={loading || disabled} 
        className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
          loading || disabled 
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 active:scale-[0.98]'
        }`}
      >
        {loading ? (
          <><Loader2 className="animate-spin" size={16}/> {t('processing', 'Processing...')}</>
        ) : disabled ? (
          <><ShoppingCart size={16}/> {disabledReason || t('checkCart', 'Check cart')}</>
        ) : (
          <><ShoppingCart size={16}/> {entryTab === 'Sale' ? t('completeSale', 'Complete Sale') : t('completePurchase', 'Complete Purchase')}</>
        )}
      </button>
    </div>
  );
});

export default PaymentSection;
