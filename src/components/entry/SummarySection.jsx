export default function SummarySection({ totals }) {
  const fmt = (n) => (Number(n) || 0).toLocaleString();

  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-[#0f172a] rounded-2xl p-4 border border-cyan-500/20 mb-4">
      <h3 className="font-bold text-white mb-3">Order Summary</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Subtotal</span>
          <span className="text-white">{fmt(totals.subtotal)} Ks</span>
        </div>
        
        {totals.itemDiscounts > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Item Discounts</span>
            <span>-{fmt(totals.itemDiscounts)} Ks</span>
          </div>
        )}
        
        {totals.globalDiscount > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>Global Discount</span>
            <span>-{fmt(totals.globalDiscount)} Ks</span>
          </div>
        )}
        
        <div className="border-t border-cyan-500/20 pt-2 mt-2">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-cyan-400">TOTAL</span>
            <span className="text-white">{fmt(totals.total)} Ks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
