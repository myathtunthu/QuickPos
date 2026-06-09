import { useCallback, useState } from 'react';

export function useBarcodeScanner(initialOpen = false) {
  const [showScanner, setShowScanner] = useState(Boolean(initialOpen));

  const openScanner = useCallback(() => setShowScanner(true), []);
  const closeScanner = useCallback(() => setShowScanner(false), []);
  const toggleScanner = useCallback(() => setShowScanner((value) => !value), []);

  return { showScanner, setShowScanner, openScanner, closeScanner, toggleScanner };
}

export default useBarcodeScanner;
