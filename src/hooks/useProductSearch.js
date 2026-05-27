import { useState, useMemo } from 'react';

export function useProductSearch(products) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState('retail');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => 
    ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  , [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.barcode?.includes(term)
      );
    }
    return result;
  }, [products, searchTerm, selectedCategory]);

  const selectProduct = (product, unit = null) => {
    setSelectedProduct(product);
    setSelectedUnit(unit || product.packageUnits?.[0]);
    setSearchTerm(product.name);
  };

  const clearSelection = () => {
    setSelectedProduct(null);
    setSelectedUnit(null);
    setSearchTerm('');
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedProduct,
    setSelectedProduct,
    selectedUnit,
    setSelectedUnit,
    selectedPriceType,
    setSelectedPriceType,
    selectedCategory,
    setSelectedCategory,
    filteredProducts,
    categories,
    selectProduct,
    clearSelection
  };
}
