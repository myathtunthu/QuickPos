import CartItem from './CartItem';
import DiscountSection from './DiscountSection';
import PaymentSection from './PaymentSection';
import SummarySection from './SummarySection';
import { ShoppingCart, Loader2, Save } from 'lucide-react';

export default function CartSection({
  cart,
  cartActions,
  totals,
  globalDiscountAmt,
  setGlobalDiscountAmt,
  globalDiscountType,
  setGlobalDiscountType,
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  loading,
  onSubmit,
  onHold,
  fmt
}) {
  return (
    <div className="space-y-1.5">
      {cart.map(item => (
        <CartItem
          key={item.id}
          item={item}
          onRemove={cartActions.removeItem}
          onQuantityChange={cartActions.updateItemQuantity}
          onDiscountChange={cartActions.updateItemDiscount}
          onNotesChange={cartActions.updateItemNotes}
          fmt={fmt}
        />
      ))}

      <DiscountSection
        globalDiscountAmt={globalDiscountAmt}
        setGlobalDiscountAmt={setGlobalDiscountAmt}
        globalDiscountType={globalDiscountType}
        setGlobalDiscountType={setGlobalDiscountType}
      />

      <SummarySection totals={totals} fmt={fmt} />

      <PaymentSection
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paidAmount={paidAmount}
        setPaidAmount={setPaidAmount}
        total={totals.total}
        fmt={fmt}
      />

      <div className="flex gap-1.5">
        {cart.length > 0 && (
          <button
            onClick={onHold}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1"
          >
            <Save size={14} /> Hold
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={loading || cart.length === 0}
          className={`flex-1 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xs flex items-center justify-center gap-1.5 ${
            loading ? 'opacity-70' : ''
          }`}
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={14} /> Processing...</>
          ) : (
            <><ShoppingCart size={14} /> Complete</>
          )}
        </button>
      </div>
    </div>
  );
}
