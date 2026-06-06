import React, { useCallback, useRef } from 'react';
import { Package } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const restoreWindowScroll = (scrollY) => {
  const restore = () => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
  restore();
  requestAnimationFrame(() => {
    restore();
    setTimeout(restore, 0);
    setTimeout(restore, 60);
    setTimeout(restore, 180);
  });
};

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

    const restoreGrid = () => {
      if (gridRef.current) gridRef.current.scrollTop = gridY;
    };

    restoreWindowScroll(y);
    restoreGrid();
    requestAnimationFrame(() => {
      restoreGrid();
      setTimeout(restoreGrid, 60);
      setTimeout(restoreGrid, 180);
    });
  }, []);

  const handleProductPress = useCallback(
    (event, product) => {
      event.preventDefault();
      event.stopPropagation();

      rememberScroll();
      onSelect(product, { preserveScrollY: windowScrollRef.current });
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
          <div
            role="button"
            tabIndex={-1}
            key={product.id || name}
            onPointerDown={(event) => {
              event.preventDefault();
              rememberScroll();
            }}
            onTouchStart={() => rememberScroll()}
            onClick={(event) => handleProductPress(event, product)}
            className="bg-[#0d1120] border-2 border-white/5 rounded-xl p-2 text-center transition-all hover:border-cyan-500/50 active:scale-95 flex flex-col items-center justify-between min-h-[85px] touch-manipulation select-none cursor-pointer outline-none"
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
          </div>
        );
      })}
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';

export default ProductGrid;
