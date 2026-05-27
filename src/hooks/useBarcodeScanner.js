import { useState, useCallback } from 'react';

export function useBarcodeScanner(products, onProductFound) {
  const [isScanning, setIsScanning] = useState(false);

  const handleBarcodeScan = useCallback((barcode) => {
    if (!barcode || !products.length) return false;
    
    const foundProduct = products.find(product => {
      if (product.barcode === barcode) return true;
      if (product.packageUnits) {
        return product.packageUnits.some(unit => 
          unit.barcodes && Object.values(unit.barcodes).includes(barcode)
        );
      }
      return false;
    });
    
    if (foundProduct) {
      let scannedUnit = foundProduct.packageUnits?.[0];
      if (foundProduct.packageUnits) {
        for (const unit of foundProduct.packageUnits) {
          if (unit.barcodes && Object.values(unit.barcodes).includes(barcode)) {
            scannedUnit = unit;
            break;
          }
        }
      }
      onProductFound(foundProduct, scannedUnit);
      setIsScanning(true);
      setTimeout(() => setIsScanning(false), 500);
      return true;
    }
    return false;
  }, [products, onProductFound]);

  return { handleBarcodeScan, isScanning };
}
