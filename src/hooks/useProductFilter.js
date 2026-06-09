import { useMemo, useState } from 'react';
import useDebounce from './useDebounce';

const normalizeText = (value) => String(value ?? '').trim().toLowerCase();
const ALL_CATEGORY = 'All';

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

export function useProductFilter(products = [], options = {}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORY);
  const debouncedSearch = useDebounce(search, options.delay ?? 300);
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : null;

  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      safeProducts
        .map((product) => String(product?.category || '').trim())
        .filter(Boolean)
    );
    return [ALL_CATEGORY, ...Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b))];
  }, [safeProducts]);

  const filtered = useMemo(() => {
    const query = normalizeText(debouncedSearch);
    let result = safeProducts;

    if (category !== ALL_CATEGORY) {
      result = result.filter((product) => String(product?.category || '').trim() === category);
    }

    if (query) {
      result = result.filter((product) => productMatchesSearch(product, query));
    }

    return limit ? result.slice(0, limit) : result;
  }, [safeProducts, debouncedSearch, category, limit]);

  const resetFilters = () => {
    setSearch('');
    setCategory(ALL_CATEGORY);
  };

  return {
    search,
    setSearch,
    category,
    setCategory,
    filtered,
    categories,
    resetFilters,
  };
}

export default useProductFilter;
