import React from 'react';
import { Search, ScanBarcode, X } from 'lucide-react';

const ProductSearch = React.memo(({ 
  categories, 
  selCategory, 
  setSelCategory, 
  prodSearch, 
  setProdSearch, 
  setShowScanner 
}) => {
  return (
    <div className="space-y-2">
      {/* Categories Horizontal Scroll */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setSelCategory(cat)} 
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
              selCategory === cat 
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50' 
                : 'bg-[#0d1120] text-slate-400 border border-white/5 hover:bg-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Input & Scanner Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-cyan-500" size={14}/>
          <input 
            value={prodSearch} 
            onChange={e => setProdSearch(e.target.value)} 
            placeholder="Search products by name or barcode..." 
            className="w-full bg-black border border-cyan-500/20 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white outline-none focus:border-cyan-400 transition-colors" 
          />
          {prodSearch && (
            <button onClick={() => setProdSearch('')} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white transition-colors">
              <X size={14}/>
            </button>
          )}
        </div>
        <button 
          onClick={() => setShowScanner(true)} 
          className="px-3.5 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30"
        >
          <ScanBarcode size={18} className="text-white"/>
        </button>
      </div>
    </div>
  );
});

export default ProductSearch;
