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
    if (!debouncedSearch) return products.slice(0, 30);

    return products
      .filter(p => 
        p.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.barcode?.includes(debouncedSearch)
      )
      .slice(0, 30);
  }, [products, debouncedSearch]);

  const handleAdd = () => {
    if (!selectedProduct || !selectedUnit || qty < 1) return;
    addToCart(selectedProduct, selectedUnit, priceType, qty);
    setQty(1);
  };

  const priceTypes = ['retail', 'wholesaleA', 'wholesaleB', 'wholesaleC'];

  return (
    <div className="space-y-4">
      {/* Search Bar */}
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
      <div className="max-h-[520px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {filteredProducts.map(product => (
          <div
            key={product.id}
            onClick={() => {
              setSelectedProduct(product);
              setSelectedUnit(product.units?.[0]?.name || 'ဘူး');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              selectedProduct?.id === product.id 
                ? 'border-cyan-400 bg-cyan-500/10' 
                : 'border-white/10 hover:border-white/20 bg-[#0f172a]'
            }`}
          >
            <div className="flex justify-between">
              <div>
                <p className="font-bold text-white">{product.name}</p>
                <p className="text-xs text-slate-400">Stock: {product.stockBase || 0} ဘူး</p>
              </div>
              <div className="text-right text-cyan-400 font-mono text-sm">
                {product.units?.[0]?.prices?.retail?.toLocaleString()} Ks
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Unit & Price Selection */}
      {selectedProduct && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f172a] border border-cyan-500/30 rounded-3xl p-5 space-y-4"
        >
          <h3 className="font-bold text-cyan-400">{selectedProduct.name}</h3>

          {/* Units */}
          <div>
            <p className="text-xs text-slate-400 mb-2">ယူနစ် ရွေးပါ</p>
            <div className="flex flex-wrap gap-2">
              {selectedProduct.units?.map((unit, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedUnit(unit.name)}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    selectedUnit === unit.name 
                      ? 'bg-cyan-500 text-black' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {unit.name} ({unit.factor})
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
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    priceType === type ? 'bg-emerald-500 text-black' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex gap-3 items-center">
            <button onClick={() => setQty(Math.max(1, qty-1))} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20">-</button>
            <input 
              type="number" 
              value={qty} 
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              className="w-20 text-center bg-transparent border border-cyan-500/30 rounded-xl py-3 text-xl font-bold"
            />
            <button onClick={() => setQty(qty+1)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20">+</button>
          </div>

          <button
            onClick={handleAdd}
            className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={20} /> Cart ထဲ ထည့်မည်
          </button>
        </motion.div>
      )}
    </div>
  );
}
