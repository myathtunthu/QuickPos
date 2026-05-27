import { FixedSizeGrid as Grid } from 'react-window';
import { Package } from 'lucide-react';

export default function ProductDropdown({
  products,
  selectedId,
  onSelect,
  fmt // number formatting function
}) {
  const COL_COUNT = 4;
  const ROW_HEIGHT = 90;
  const GAP = 4;

  if (products.length === 0) {
    return <div className="text-center text-slate-500 text-xs py-6">No products found</div>;
  }

  const Cell = ({ columnIndex, rowIndex, style }) => {
    const idx = rowIndex * COL_COUNT + columnIndex;
    if (idx >= products.length) return null;
    const prod = products[idx];
    const isSelected = selectedId === prod.id;
    return (
      <div style={{ ...style, padding: GAP / 2 }}>
        <button
          onClick={() => onSelect(prod)}
          className={`h-full w-full bg-[#0d1120] border-2 rounded-lg p-1.5 text-center transition-all active:scale-95 ${
            isSelected ? 'border-cyan-400 bg-cyan-900/20' : 'border-white/5'
          }`}
        >
          <div className="w-7 h-7 mx-auto bg-cyan-500/10 rounded-md flex items-center justify-center mb-0.5">
            <Package size={12} className="text-cyan-400" />
          </div>
          <p className="text-[10px] font-bold text-white truncate">{prod.name}</p>
          <p className="text-[10px] text-cyan-400 font-bold">
            {fmt(prod.packageUnits?.[0]?.prices?.retail || 0)}
          </p>
          <p className="text-[9px] text-slate-500">({prod.stockBase})</p>
        </button>
      </div>
    );
  };

  const rowCount = Math.ceil(products.length / COL_COUNT);
  const height = rowCount * ROW_HEIGHT > 240 ? 240 : rowCount * ROW_HEIGHT; // max 240px height

  return (
    <Grid
      columnCount={COL_COUNT}
      columnWidth={100 / COL_COUNT + '%'}
      height={height}
      rowCount={rowCount}
      rowHeight={ROW_HEIGHT}
      width="100%"
      className="custom-scrollbar"
    >
      {Cell}
    </Grid>
  );
}
