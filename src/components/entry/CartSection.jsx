import { Trash2, Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CartSection({
  cart,
  removeFromCart,
  subtotal,
  total,
  discount,
  setDiscount,
  customer,
  setCustomer,
  paymentMethod,
  setPaymentMethod,
  saveSale
}) {
  return (
    <div className="bg-[#0f172a] border border-cyan-500/20 rounded-3xl p-5 sticky top-4 h-fit">
      <h2 className="text-xl font-black text-white mb-4">🛒 Cart ({cart.length})</h2>

      <div className="max-h-[420px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Cart ဗလာဖြစ်နေပါတယ်
          </div>
        ) : (
          cart.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black/40 border border-white/10 rounded-2xl p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    {item.unit} × {item.quantity} • {item.priceType}
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-rose-400 hover:text-rose-500"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <p className="text-cyan-400 font-bold mt-2">
                {item.subtotal.toLocaleString()} Ks
              </p>
            </motion.div>
          ))
        )}
      </div>

      {/* Customer Info */}
      <div className="mt-6 space-y-3">
        <input
          type="text"
          placeholder="Customer Name (Optional)"
          value={customer.name}
          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm"
        />
      </div>

      {/* Payment Method */}
      <div className="mt-4">
        <p className="text-xs text-slate-400 mb-2">Payment Method</p>
        <div className="flex gap-2">
          {['cash', 'kpay', 'wave', 'credit'].map(method => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                paymentMethod === method 
                  ? 'bg-cyan-500 text-black' 
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              {method.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Subtotal</span>
          <span>{subtotal.toLocaleString()} Ks</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Discount</span>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="w-24 bg-black/50 text-right border border-white/10 rounded-lg px-3 py-1"
          />
        </div>

        <div className="flex justify-between text-lg font-bold border-t border-white/10 pt-4">
          <span>Total</span>
          <span className="text-cyan-400">{total.toLocaleString()} Ks</span>
        </div>
      </div>

      {/* Checkout Button */}
      <button
        onClick={saveSale}
        disabled={cart.length === 0}
        className="w-full mt-6 py-5 bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-black text-xl rounded-2xl disabled:opacity-50 transition-all hover:scale-[1.02]"
      >
        💰 Checkout & Save
      </button>
    </div>
  );
}
