import React from 'react';
import { Package } from 'lucide-react';

const ProductGrid = React.memo(({ products, onSelect }) => {
  if (products.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-6 border border-dashed border-white/5 rounded-xl">
        No products found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
      {/* Performance အတွက် အခု ၃၀ ပဲ အရင်ပြထားပါမယ် */}
      {products.slice(0, 30).map(prod => {
        const defaultPrice = prod.packageUnits?.[0]?.prices?.retail || 0;
        
        return (
          <button 
            key={prod.id} 
            onClick={() => onSelect(prod)} 
            className="bg-[#0d1120] border-2 border-white/5 rounded-xl p-2 text-center transition-all hover:border-cyan-500/50 active:scale-95 flex flex-col items-center justify-between min-h-[85px]"
          >
            <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-1">
              <Package size={14} className="text-cyan-400"/>
            </div>
            <div className="w-full">
              <p className="text-[10px] font-bold text-white truncate w-full">{prod.name}</p>
              <p className="text-[10px] text-cyan-400 font-bold mt-0.5">{Number(defaultPrice).toLocaleString()}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Stock: {prod.stockBase || 0}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
});

export default ProductGrid;
