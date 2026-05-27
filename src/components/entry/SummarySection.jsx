export default function SummarySection({ totals, fmt }) {
  return (
    <div className="bg-black/50 border border-cyan-500/20 rounded-lg p-2 space-y-1 text-[10px]">
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{fmt(totals.subtotal)} Ks</span>
      </div>
      {(totals.itemDiscounts + totals.globalDisc) > 0 && (
        <div className="flex justify-between text-amber-400">
          <span>Discount</span>
          <span>-{fmt(totals.itemDiscounts + totals.globalDisc)} Ks</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-black text-cyan-300 border-t border-cyan-500/20 pt-1.5">
        <span>TOTAL</span>
        <span>{fmt(totals.total)} Ks</span>
      </div>
    </div>
  );
}
