import { useState, useMemo } from 'react';
import { useDebounce } from './useDebounce';

export function useProductFilter(products) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const debouncedSearch = useDebounce(search, 300);

  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);

  const filtered = useMemo(() => {
    let result = products;
    if (category !== 'All') result = result.filter(p => p.category === category);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, debouncedSearch, category]);

  return {
    search,
    setSearch,
    category,
    setCategory,
    filtered,
    categories
  };
}
