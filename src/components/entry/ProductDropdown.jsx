import { useState, useMemo } from 'react';
import { Search, Package, X } from 'lucide-react';

export default function ProductDropdown({ 
  products, 
  searchTerm, 
  setSearchTerm, 
  onSelectProduct 
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const categories = useMemo(() => 
    ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  , [products]);
  
  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.barcode?.includes(term)
      );
    }
    return result.slice(0, 50);
  }, [products, searchTerm, selectedCategory]);

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id="product-search"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-[#0f172a] border border-cyan-500/20 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>
      
      {/* Categories */}
      <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-cyan-600 text-white'
                : 'bg-[#0f172a] text-slate-400 border border-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {/* Product List */}
      {filteredProducts.length > 0 && (
        <div className="mt-3 bg-[#0f172a] rounded-xl border border-cyan-500/20 max-h-80 overflow-y-auto">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => onSelectProduct(product)}
              className="flex items-center gap-3 p-3 hover:bg-cyan-500/10 cursor-pointer border-b border-white/5 transition-colors"
            >
              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{product.name}</p>
                <p className="text-xs text-slate-400">Stock: {product.stock || 0} {product.baseUnit || 'pcs'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-cyan-400">
                  {(product.packageUnits?.[0]?.prices?.retail || 0).toLocaleString()} Ks
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {filteredProducts.length === 0 && searchTerm && (
        <div className="mt-3 bg-[#0f172a] rounded-xl p-8 text-center border border-cyan-500/20">
          <p className="text-slate-400 text-sm">No products found for "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}
