export default function DiscountSection({
  globalDiscountAmt,
  setGlobalDiscountAmt,
  globalDiscountType,
  setGlobalDiscountType
}) {
  return (
    <div className="flex gap-1.5 items-end text-[10px]">
      <div className="flex-1">
        <label className="text-[9px] text-slate-500">Global Discount</label>
        <input
          value={globalDiscountAmt}
          onChange={e => setGlobalDiscountAmt(e.target.value)}
          placeholder="0"
          className="w-full bg-black/40 border border-amber-500/20 rounded-md px-2 py-1.5 text-amber-400"
        />
      </div>
      <button
        onClick={() => setGlobalDiscountType('%')}
        className={`px-2 py-1.5 rounded text-[10px] font-bold ${
          globalDiscountType === '%' ? 'bg-amber-600 text-white' : 'bg-black/40 text-slate-400'
        }`}
      >
        %
      </button>
      <button
        onClick={() => setGlobalDiscountType('flat')}
        className={`px-2 py-1.5 rounded text-[10px] font-bold ${
          globalDiscountType === 'flat' ? 'bg-amber-600 text-white' : 'bg-black/40 text-slate-400'
        }`}
      >
        Ks
      </button>
    </div>
  );
}
