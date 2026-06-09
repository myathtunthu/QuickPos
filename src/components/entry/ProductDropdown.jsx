import React, { useEffect, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatMoney, formatQuantity, getAvailableBaseStock, getBaseUnitName, getDefaultUnit, getUnitName, getUnitPrice } from './entryUomHelpers';

const ProductDropdown = React.memo(({ products = [], onSelect, isOpen }) => {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollPositionRef = useRef({ x: 0, y: 0 });

  const rememberScroll = () => {
    scrollPositionRef.current = {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0,
    };
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [products.length, isOpen]);

  useEffect(() => {
    if (!isOpen || !products || products.length === 0) return undefined;

    const handleKeyDown = (event) => {
      if (!products.length) return;
      const target = event.target;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping && event.key !== 'Enter') return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % products.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + products.length) % products.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (products[selectedIndex]) {
          onSelect(products[selectedIndex], {
            scrollPosition: {
              x: window.scrollX || window.pageXOffset || 0,
              y: window.scrollY || window.pageYOffset || 0,
            },
          });
        }
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
    const defaultUnit = getDefaultUnit(product);
    const defaultPrice = getUnitPrice(defaultUnit, 'retail', 'Sale');
    const name = product.name || t('unknownItem', 'Unknown Item');
    const stockBase = getAvailableBaseStock(product);
    const baseUnitName = getBaseUnitName(product);

    return (
      <div
        style={style}
        onPointerDown={rememberScroll}
        onTouchStart={rememberScroll}
        onMouseDown={(event) => {
          event.preventDefault();
          rememberScroll();
        }}
        onClick={() => onSelect(product, { scrollPosition: scrollPositionRef.current })}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`flex justify-between items-center px-3 py-2 cursor-pointer border-b border-white/5 transition-colors ${
          isSelected ? 'bg-cyan-900/40 border-l-2 border-l-cyan-400' : 'hover:bg-cyan-900/20'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <div className="w-6 h-6 bg-cyan-500/10 rounded flex items-center justify-center flex-shrink-0">
            <Package size={12} className="text-cyan-400" />
          </div>
          <div className="truncate">
            <p className="text-[11px] font-bold text-white truncate">{name}</p>
            <p className="text-[9px] text-slate-500 truncate">
              {t('stockLabel', 'Stock')}: {formatQuantity(stockBase)} {baseUnitName} · {getUnitName(defaultUnit)}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-cyan-400 font-bold">{formatMoney(defaultPrice)} Ks</p>
        </div>
      </div>
    );
  };

  return (
    <div className="absolute z-50 w-full mt-1 bg-[#0d1120] border border-cyan-500/20 rounded-lg shadow-xl shadow-black/50 overflow-hidden">
      <List height={Math.min(products.length * 52, 260)} itemCount={products.length} itemSize={52} width="100%">
        {Row}
      </List>
      <div className="bg-black/40 text-[9px] text-slate-500 text-center py-1 border-t border-cyan-500/10">
        {t('useArrowKeys', 'Use arrows to navigate, Enter to select')}
      </div>
    </div>
  );
});

ProductDropdown.displayName = 'ProductDropdown';

export default ProductDropdown;
