import React, { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Package } from 'lucide-react';

// React.memo ကိုသုံးထားသဖြင့် မလိုအပ်ဘဲ Re-render မဖြစ်တော့ပါ။
const ProductDropdown = React.memo(({ products, onSelect, isOpen }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard Control အတွက်
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % products.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + products.length) % products.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (products[selectedIndex]) {
          onSelect(products[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, products, selectedIndex, onSelect]);

  if (!isOpen || products.length === 0) return null;

  // Render လုပ်မည့် Row တစ်ကြောင်းချင်းစီ
  const Row = ({ index, style }) => {
    const prod = products[index];
    const isSelected = index === selectedIndex;
    const defaultPrice = prod.packageUnits?.[0]?.prices?.retail || 0;

    return (
      <div 
        style={style} 
        onClick={() => onSelect(prod)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`flex justify-between items-center px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
          isSelected ? 'bg-cyan-900/40 border-l-2 border-l-cyan-400' : 'hover:bg-cyan-900/20'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 bg-cyan-500/10 rounded flex items-center justify-center flex-shrink-0">
            <Package size={12} className="text-cyan-400"/>
          </div>
          <div className="truncate">
            <p className="text-[11px] font-bold text-white truncate">{prod.name}</p>
            <p className="text-[9px] text-slate-500">Stock: {prod.stockBase} {prod.baseUnit}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-cyan-400 font-bold">{Number(defaultPrice).toLocaleString()} Ks</p>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute z-50 w-full mt-1 bg-[#0d1120] border border-cyan-500/20 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
      <List 
        height={Math.min(products.length * 45, 225)} // 45px per row, max 5 rows visible
        itemCount={products.length} 
        itemSize={45} 
        width={'100%'}
      >
        {Row}
      </List>
      <div className="bg-black/40 text-[9px] text-slate-500 text-center py-1 border-t border-cyan-500/10">
        Use ⬆️ ⬇️ arrows to navigate, Enter to select
      </div>
    </div>
  );
});

export default ProductDropdown;
