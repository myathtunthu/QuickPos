import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

export default function ProductSearch({ products, addToCart }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [priceType, setPriceType] = useState('retail');
  const [qty, setQty] = useState(1);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredProducts = useMemo(() => {
    if (!debouncedSearch.trim()) return products.slice(0, 50);

    return products
      .filter(p => 
        p.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
      .slice(0, 50);
  }, [products, debouncedSearch]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSelectedUnit(product.units?.[0]?.name || 'ဘူး');
    setQty(1);
  };

  const handleAdd = () => {
    if (!selectedProduct || !selectedUnit || qty < 1) return;
    addToCart(selectedProduct, selectedUnit, priceType, qty);
    
    // Clear selection after adding
    setSelectedProduct(null);
    setQty(1);
  };

  const priceTypes = ['retail', 'wholesaleA', 'wholesaleB', 'wholesaleC'];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-4 text-slate-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ပစ္စည်းနာမည် သို့ Barcode ရိုက်ပါ..."
          className="w-full bg-[#0f172a] border border-cyan-500/30 rounded-2xl pl-12 py-4 text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
        />
      </div>

      {/* Product List */}
      <div className="max-h-[420px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {filteredProducts.map(product => (
          <div
            key={product.id}
            onClick={() => handleSelectProduct(product)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedProduct?.id === product.id 
                ? 'border-cyan-400 bg-cyan-500/10' 
                : 'border-white/10 hover:border-white/20 bg-[#0f172a]'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">{product.name}</p>
                <p className="text-xs text-slate-400">Stock: {product.stockBase || 0} ဘူး</p>
              </div>
              <div className="text-right">
                <p className="text-cyan-400 font-bold text-sm">
                  {product.units?.[0]?.prices?.retail?.toLocaleString()} Ks
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selection Panel */}
      {selectedProduct && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f172a] border border-cyan-500/30 rounded-3xl p-5 space-y-4 mt-4"
        >
          <h3 className="font-bold text-lg text-white">{selectedProduct.name}</h3>

          {/* Units */}
          <div>
            <p className="text-xs text-slate-400 mb-2">ယူနစ်</p>
            <div className="flex flex-wrap gap-2">
              {selectedProduct.units?.map((unit, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedUnit(unit.name)}
                  className={`px-5 py-2.5 rounded-2xl text-sm transition-all ${
                    selectedUnit === unit.name 
                      ? 'bg-cyan-500 text-black font-bold' 
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {unit.name}
                </button>
              ))}
            </div>
          </div>

          {/* Price Type */}
          <div>
            <p className="text-xs text-slate-400 mb-2">စျေးနှုန်း အမျိုးအစား</p>
            <div className="flex flex-wrap gap-2">
              {priceTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setPriceType(type)}
                  className={`px-5 py-2.5 rounded-2xl text-sm transition-all ${
                    priceType === type ? 'bg-emerald-500 text-black' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <p className="text-xs text-slate-400 mb-2">အရေအတွက်</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setQty(q => Math.max(1, q-1))} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-2xl">-</button>
              <input 
                type="number" 
                value={qty} 
                onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 text-center bg-transparent border border-cyan-500/30 rounded-2xl py-4 text-2xl font-bold"
              />
              <button onClick={() => setQty(q => q+1)} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-2xl">+</button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="w-full py-5 bg-gradient-to-r from-cyan-500 to-teal-500 text-black font-black rounded-2xl text-lg mt-2 hover:scale-[1.02] transition-all"
          >
            <Plus className="inline mr-2" size={20} /> Cart ထဲ ထည့်မည်
          </button>
        </motion.div>
      )}
    </div>
  );
}
