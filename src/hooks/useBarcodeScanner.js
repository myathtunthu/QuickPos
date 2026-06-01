import { useState } from 'react';

export function useBarcodeScanner() {
  const [showScanner, setShowScanner] = useState(false);

  const openScanner = () => setShowScanner(true);
  const closeScanner = () => setShowScanner(false);

  return { showScanner, openScanner, closeScanner };
}
