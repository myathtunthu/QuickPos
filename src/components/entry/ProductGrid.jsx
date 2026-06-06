import React, { useCallback, useRef } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

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

      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'auto' });
        if (gridRef.current) gridRef.current.scrollTop = gridY;
      });
    });
  }, []);

  const handleProductClick = useCallback(
    (event, product) => {
      event.preventDefault();
      event.stopPropagation();

      rememberScroll();

      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }

      onSelect(product);
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
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1 overscroll-contain"
    >
      {products.slice(0, 100).map((product) => {
        const defaultPrice = product.packageUnits?.[0]?.prices?.retail || 0;
        const name = product.name || t('unknownItem', 'Unknown Item');

        return (
          <button
            type="button"
            key={product.id || name}
            onPointerDown={() => rememberScroll()}
            onMouseDown={(event) => {
              event.preventDefault();
              rememberScroll();
            }}
            onTouchStart={() => rememberScroll()}
            onClick={(event) => handleProductClick(event, product)}
            className="bg-[#0d1120] border-2 border-white/5 rounded-xl p-2 text-center transition-all hover:border-cyan-500/50 active:scale-95 flex flex-col items-center justify-between min-h-[85px] touch-manipulation select-none"
          >
            <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-1">
              <Package size={14} className="text-cyan-400" />
            </div>

            <div className="w-full">
              <p className="text-[10px] font-bold text-white truncate w-full">{name}</p>
              <p className="text-[10px] text-cyan-400 font-bold mt-0.5">
                {Number(defaultPrice).toLocaleString()}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">
                {t('stockLabel', 'Stock')}: {product.stockBase || 0}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;
