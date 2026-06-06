import React from 'react';
import { Search, ScanBarcode, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const ProductSearch = React.memo(({ 
  categories = [],
  selCategory, 
  setSelCategory, 
  prodSearch, 
  setProdSearch, 
  setShowScanner 
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
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {categories.map(category => (
          <button 
            type="button"
            key={category} 
            onClick={() => setSelCategory(category)} 
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
              selCategory === category 
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50' 
                : 'bg-[#0d1120] text-slate-400 border border-white/5 hover:bg-white/5'
            }`}
          >
            {translateCategory(category)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-cyan-500" size={14}/>
          <input 
            type="text"
            value={prodSearch} 
            onChange={handleSearchChange}
            placeholder={t('searchProductBarcode', 'Search products by name or barcode...')} 
            className="w-full bg-black border border-cyan-500/20 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white outline-none focus:border-cyan-400 transition-colors" 
          />
          {prodSearch && (
            <button 
              type="button"
              onClick={() => setProdSearch('')} 
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white transition-colors"
              aria-label={t('clearFilter', 'Clear')}
            >
              <X size={14}/>
            </button>
          )}
        </div>
        <button 
          type="button"
          onClick={() => setShowScanner(true)} 
          className="px-3.5 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30"
          aria-label={t('scanBarcode', 'Scan Barcode')}
        >
          <ScanBarcode size={18} className="text-white"/>
        </button>
      </div>
    </div>
  );
});

export default ProductSearch;
