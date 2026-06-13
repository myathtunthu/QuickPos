import React, { useCallback, useRef } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatMoney, formatQuantity, getAvailableBaseStock, getBaseUnitName, getDefaultUnit, getUnitName, getUnitPrice } from './entryUomHelpers';

const ProductGrid = React.memo(({ products = [], onSelect }) => {
  const { t } = useLanguage();
  const gridRef = useRef(null);
  const windowScrollRef = useRef(0);
  const gridScrollRef = useRef(0);

  const rememberScroll = useCallback(() => {
    windowScrollRef.current = window.scrollY || window.pageYOffset || 0;
    gridScrollRef.current = gridRef.current?.scrollTop || 0;
  }, []);

  const restoreScroll = useCallback(() => {
    const y = windowScrollRef.current;
    const gridY = gridScrollRef.current;

    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      if (gridRef.current) gridRef.current.scrollTop = gridY;
    });
  }, []);

  const handleProductClick = useCallback(
    (event, product) => {
      event.preventDefault();
      event.stopPropagation();
      rememberScroll();
      onSelect(product, {
        scrollPosition: {
          x: window.scrollX || window.pageXOffset || 0,
          y: windowScrollRef.current,
        },
      });
      restoreScroll();
    },
    [onSelect, rememberScroll, restoreScroll]
  );

  if (!products || products.length === 0) {
    return (
      <div className="text-center text-slate-500 text-xs py-6 border border-dashed border-white/5 rounded-xl">
        {t('noProductsFound', 'No products found.')}
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-2.5 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1 overscroll-contain"
      style={{ overflowAnchor: 'none', touchAction: 'manipulation' }}
    >
      {products.slice(0, 120).map((product) => {
        const defaultUnit = getDefaultUnit(product);
        const defaultPrice = getUnitPrice(defaultUnit, 'retail', 'Sale');
        const name = product.name || t('unknownItem', 'Unknown Item');
        const stockBase = getAvailableBaseStock(product);
        const baseUnitName = getBaseUnitName(product);

        return (
          <button
            type="button"
            key={product.id || name}
            onPointerDown={rememberScroll}
            onMouseDown={(event) => {
              event.preventDefault();
              rememberScroll();
            }}
            onTouchStart={rememberScroll}
            onClick={(event) => handleProductClick(event, product)}
            className="group bg-[#0d1120] border border-white/10 rounded-2xl p-2.5 text-left transition-all hover:border-cyan-500/50 active:scale-95 flex flex-col justify-between min-h-[128px] touch-manipulation select-none shadow-lg shadow-black/10"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/10">
                <Package size={16} className="text-cyan-400" />
              </div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${stockBase <= 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                {formatQuantity(stockBase)}
              </span>
            </div>

            <div className="w-full min-w-0">
              <p className="text-xs font-black text-white line-clamp-2 min-h-[32px]">{name}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-cyan-300 font-black truncate">{formatMoney(defaultPrice)} Ks</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 truncate">/ {getUnitName(defaultUnit)} · {baseUnitName}</p>
                </div>
                <span className="shrink-0 w-8 h-8 rounded-xl bg-cyan-500 text-[#06111f] flex items-center justify-center text-lg font-black group-active:scale-90">+</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;
