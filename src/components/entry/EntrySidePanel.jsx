import React from 'react';
import { PauseCircle, ReceiptText, ShoppingCart, Wallet } from 'lucide-react';
import CartSection from './CartSection';
import PaymentSection from './PaymentSection';
import ReceiptContent from './ReceiptContent';
import { PAYMENT_METHODS, formatMoney, toNumber } from '../../utils/entryHelpers';

export default function SidePanel({
  txt,
  cart,
  products,
  entryTab,
  cartTotals,
  globalDiscountAmt,
  setGlobalDiscountAmt,
  globalDiscountType,
  setGlobalDiscountType,
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  submitTransaction,
  loading,
  handleHoldInvoiceClick,
  receiptRecord,
  shopSettings,
  onUpdateQty,
  onUpdateUnit,
  onUpdatePriceType,
  onUpdateDiscount,
  onUpdatePrice,
  onRemove,
}) {
  const total = toNumber(cartTotals.total);
  const paid = paidAmount === '' ? total : toNumber(paidAmount);
  const balance = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const itemsCount = cart.reduce((sum, item) => sum + toNumber(item.quantity), 0);

  const handleDiscountChange = (event) => {
    const value = event.target.value;
    if (value === '' || toNumber(value) >= 0) setGlobalDiscountAmt(value);
  };

  return (
    <div className="space-y-4 xl:sticky xl:top-4">
      <section className="rounded-3xl border border-cyan-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-cyan-950/20">
        <div className="mb-3 flex items-center justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{txt.cartSummary}</p><h2 className="text-lg font-black text-white">{itemsCount} items</h2></div>
          {entryTab === 'Sale' && (
            <button type="button" onClick={handleHoldInvoiceClick} disabled={cart.length === 0 || loading} className="flex items-center gap-1 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"><PauseCircle size={14} /> Hold</button>
          )}
        </div>

        <CartSection cart={cart} products={products} onUpdateQty={onUpdateQty} onUpdateUnit={onUpdateUnit} onUpdatePriceType={onUpdatePriceType} onUpdateDiscount={onUpdateDiscount} onUpdatePrice={onUpdatePrice} onRemove={onRemove} />

        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center"><ShoppingCart className="mx-auto mb-2 text-slate-600" size={28} /><p className="font-bold text-slate-500">{txt.noCartItem}</p><p className="mt-1 text-xs text-slate-600">{txt.selectProductStart}</p></div>
        ) : (
          <div className="mt-3 space-y-2 rounded-2xl border border-cyan-500/10 bg-black/40 p-3 text-xs">
            <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{formatMoney(cartTotals.subtotal)} Ks</span></div>
            {toNumber(cartTotals.itemDiscounts) > 0 && <div className="flex justify-between text-amber-400"><span>Item Discounts</span><span>-{formatMoney(cartTotals.itemDiscounts)} Ks</span></div>}
            {entryTab === 'Sale' && (
              <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-amber-400">
                <div className="flex items-center gap-1"><span>{txt.invoiceDiscount}</span><select value={globalDiscountType} onChange={(event) => setGlobalDiscountType(event.target.value)} className="rounded border border-amber-500/20 bg-black/60 px-1 py-0.5 text-white outline-none" aria-label="Discount type"><option value="%">%</option><option value="flat">Ks</option></select></div>
                <input type="number" min="0" value={globalDiscountAmt} onChange={handleDiscountChange} placeholder="0" className="w-20 rounded border border-amber-500/30 bg-black/60 px-2 py-1 text-right text-amber-300 outline-none focus:border-amber-400" aria-label="Invoice discount" />
              </div>
            )}
            {toNumber(cartTotals.globalDisc) > 0 && <div className="flex justify-between text-amber-400"><span>{txt.appliedDiscount}</span><span>-{formatMoney(cartTotals.globalDisc)} Ks</span></div>}
            <div className="flex justify-between border-t border-cyan-500/20 pt-3 text-xl font-black text-cyan-300"><span>TOTAL</span><span>{formatMoney(cartTotals.total)} Ks</span></div>
          </div>
        )}
      </section>

      {cart.length > 0 && (
        <section className="rounded-3xl border border-emerald-500/20 bg-[#0d1120]/95 p-3 shadow-2xl shadow-emerald-950/10">
          <div className="mb-3 flex items-center gap-2"><Wallet size={18} className="text-emerald-400" /><h2 className="font-black text-white">{txt.payment}</h2></div>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3"><p className="text-xs font-black uppercase text-emerald-300">{txt.paid}</p><p className="text-lg font-black text-white">{formatMoney(paid)} Ks</p></div>
            <div className={`rounded-2xl border p-3 ${balance > 0 ? 'border-rose-500/20 bg-rose-500/10' : 'border-cyan-500/20 bg-cyan-500/10'}`}><p className="text-xs font-black uppercase text-slate-300">{balance > 0 ? txt.balance : txt.change}</p><p className={`text-lg font-black ${balance > 0 ? 'text-rose-300' : 'text-cyan-300'}`}>{formatMoney(balance > 0 ? balance : change)} Ks</p></div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHODS.map((method) => (
              <button key={method} type="button" onClick={() => { setPaymentMethod(method); if (method === 'Credit') setPaidAmount('0'); }} className={`rounded-2xl border px-3 py-2 text-xs font-black transition-all active:scale-95 ${paymentMethod === method ? 'border-cyan-400 bg-cyan-500 text-[#06111f]' : 'border-white/10 bg-black/30 text-slate-300 hover:border-cyan-500/40'}`}>{method}</button>
            ))}
          </div>
          <PaymentSection paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paidAmount={paidAmount} setPaidAmount={setPaidAmount} submitTransaction={submitTransaction} loading={loading} entryTab={entryTab} />
        </section>
      )}

      <section className="hidden rounded-3xl border border-white/10 bg-[#0d1120]/95 p-3 shadow-2xl xl:block">
        <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-black text-white"><ReceiptText size={18} className="text-cyan-400" />{txt.receiptPreview}</h2></div>
        <div className="mx-auto min-h-[360px] w-[80mm] max-w-full rounded-2xl bg-white p-3">
          {receiptRecord ? <ReceiptContent record={receiptRecord} shopSettings={shopSettings} compact /> : <div className="flex h-[330px] flex-col items-center justify-center text-center text-slate-400"><ReceiptText size={32} /><p className="mt-2 text-xs font-bold">Sale ပြီးရင် receipt preview ပေါ်မယ်</p></div>}
        </div>
      </section>
    </div>
  );
}

