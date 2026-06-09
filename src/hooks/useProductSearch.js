import { useCallback, useMemo, useState } from 'react';

const ALL_CATEGORY = 'All';
const normalizeText = (value) => String(value ?? '').trim().toLowerCase();
const normalizePriceType = (value) => {
  const type = normalizeText(value || 'retail');
  return ['retail', 'wholesale', 'purchase'].includes(type) ? type : 'retail';
};

const getDefaultUnit = (product) => {
  if (Array.isArray(product?.packageUnits) && product.packageUnits.length > 0) {
    return product.packageUnits.find((unit) => Number(unit?.multiplier) === 1) || product.packageUnits[0];
  }

  return { name: 'ခု', multiplier: 1, prices: { retail: product?.price ?? 0 } };
};

const productMatchesSearch = (product, query) => {
  if (!query) return true;

  const searchableValues = [
    product?.name,
    product?.barcode,
    product?.sku,
    product?.category,
    ...(Array.isArray(product?.packageUnits)
      ? product.packageUnits.flatMap((unit) => [
          unit?.name,
          unit?.barcode,
          unit?.barcodes?.retail,
          unit?.barcodes?.wholesale,
        ])
      : []),
  ];

  return searchableValues.some((value) => normalizeText(value).includes(query));
};

export function useProductSearch(products = [], options = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedPriceType, setSelectedPriceTypeRaw] = useState('retail');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 100;

  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      safeProducts
        .map((product) => String(product?.category || '').trim())
        .filter(Boolean)
    );
    return [ALL_CATEGORY, ...Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b))];
  }, [safeProducts]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(searchTerm);
    let result = safeProducts;

    if (selectedCategory !== ALL_CATEGORY) {
      result = result.filter((product) => String(product?.category || '').trim() === selectedCategory);
    }

    if (query) {
      result = result.filter((product) => productMatchesSearch(product, query));
    }

    return result.slice(0, limit);
  }, [safeProducts, searchTerm, selectedCategory, limit]);

  const selectProduct = useCallback((product, unit = null) => {
    if (!product) {
      setSelectedProduct(null);
      setSelectedUnit(null);
      setSearchTerm('');
      return;
    }

    setSelectedProduct(product);
    setSelectedUnit(unit || getDefaultUnit(product));
    setSearchTerm(String(product.name || ''));
  }, []);

  const setSelectedPriceType = useCallback((priceType) => {
    setSelectedPriceTypeRaw(normalizePriceType(priceType));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedProduct(null);
    setSelectedUnit(null);
    setSelectedPriceTypeRaw('retail');
    setSearchTerm('');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    selectedProduct,
    selectedUnit,
    setSelectedUnit,
    selectedPriceType,
    setSelectedPriceType,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
    categories,
    selectProduct,
    clearSelection,
  };
}

export default useProductSearch;
