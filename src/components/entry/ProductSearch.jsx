import React from 'react';
import { Search, ScanBarcode, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const ProductSearch = React.memo(({ 
  categories = [],
  selCategory, 
  setSelCategory, 
  prodSearch, 
  setProdSearch, 
  setShowScanner,
  categoryCounts = {}
}) => {
  const { t } = useLanguage();

  const translateCategory = (category) => {
    if (category === 'All') return t('allCategories', 'All Categories');
    return category;
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setProdSearch(value);
    if (value.trim() && selCategory !== 'All') setSelCategory('All');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar snap-x">
        {categories.map(category => (
          <button 
            type="button"
            key={category} 
            onClick={() => setSelCategory(category)} 
            className={`snap-start px-3.5 py-2 rounded-2xl text-[11px] font-black whitespace-nowrap transition-all flex items-center gap-2 ${
              selCategory === category 
                ? 'bg-cyan-500 text-[#06111f] shadow-md shadow-cyan-900/50 border border-cyan-300/40' 
                : 'bg-black/35 text-slate-300 border border-white/10 hover:border-cyan-500/30 hover:bg-white/5'
            }`}
          >
            <span>{translateCategory(category)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${selCategory === category ? 'bg-black/15 text-[#06111f]' : 'bg-white/5 text-slate-400'}`}>{categoryCounts[category] || 0}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 text-cyan-500" size={15}/>
          <input 
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="search"
            value={prodSearch} 
            onChange={handleSearchChange}
            placeholder={t('searchProductBarcode', 'Search products by name or barcode...')} 
            className="w-full bg-black/55 border border-cyan-500/20 rounded-2xl pl-10 pr-9 py-3 text-[16px] sm:text-sm text-white outline-none focus:border-cyan-400 transition-colors shadow-inner" 
          />
          {prodSearch && (
            <button 
              type="button"
              onClick={() => setProdSearch('')} 
              className="absolute right-3 top-3.5 text-slate-500 hover:text-white transition-colors"
              aria-label={t('clearFilter', 'Clear')}
            >
              <X size={14}/>
            </button>
          )}
        </div>
        <button 
          type="button"
          onClick={() => setShowScanner(true)} 
          className="px-4 bg-cyan-600 hover:bg-cyan-500 transition-colors rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-900/30 active:scale-95"
          aria-label={t('scanBarcode', 'Scan Barcode')}
        >
          <ScanBarcode size={18} className="text-white"/>
        </button>
      </div>
    </div>
  );
});

export default ProductSearch;
