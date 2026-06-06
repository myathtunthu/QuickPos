import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const ProductDropdown = React.memo(({ products = [], onSelect, isOpen }) => {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownScrollRef = useRef(0);

  const rememberScroll = useCallback(() => {
    dropdownScrollRef.current = window.scrollY || window.pageYOffset || 0;
  }, []);

  const restoreScroll = useCallback(() => {
    const y = dropdownScrollRef.current;
    const restore = () => window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    restore();
    requestAnimationFrame(() => {
      restore();
      setTimeout(restore, 0);
      setTimeout(restore, 60);
      setTimeout(restore, 180);
    });
  }, []);

  const handleSelect = useCallback((event, product) => {
    event.preventDefault();
    event.stopPropagation();
    rememberScroll();
    onSelect(product, { preserveScrollY: dropdownScrollRef.current });
    restoreScroll();
  }, [onSelect, rememberScroll, restoreScroll]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [products.length, isOpen]);

  useEffect(() => {
    if (!isOpen || !products || products.length === 0) return undefined;

    const handleKeyDown = (event) => {
      if (!products.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % products.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + products.length) % products.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (products[selectedIndex]) onSelect(products[selectedIndex], { preserveScrollY: window.scrollY || window.pageYOffset || 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, products, selectedIndex, onSelect]);

  if (!isOpen || !products || products.length === 0) return null;

  const Row = ({ index, style }) => {
    const product = products[index];
    if (!product) return null;
    const isSelected = index === selectedIndex;
    const defaultPrice = product.packageUnits?.[0]?.prices?.retail || 0;
    const name = product.name || t('unknownItem', 'Unknown Item');

    return (
      <div 
        style={style} 
        onPointerDown={(event) => { event.preventDefault(); rememberScroll(); }}
        onMouseDown={(event) => { event.preventDefault(); rememberScroll(); }}
        onClick={(event) => handleSelect(event, product)}
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
            <p className="text-[11px] font-bold text-white truncate">{name}</p>
            <p className="text-[9px] text-slate-500">{t('stockLabel', 'Stock')}: {product.stockBase || 0} {product.baseUnit || ''}</p>
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
      <List height={Math.min(products.length * 45, 225)} itemCount={products.length} itemSize={45} width="100%">
        {Row}
      </List>
      <div className="bg-black/40 text-[9px] text-slate-500 text-center py-1 border-t border-cyan-500/10">
        {t('useArrowKeys', 'Use arrows to navigate, Enter to select')}
      </div>
    </div>
  );
});

export default ProductDropdown;
