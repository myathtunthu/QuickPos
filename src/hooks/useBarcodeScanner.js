import { useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function useBarcodeScanner(onScanSuccess) {
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);

  const startScanner = useCallback(() => {
    setShowScanner(true);
  }, []);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setShowScanner(false);
  }, []);

  const initScanner = useCallback(async (elementId) => {
    try {
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScanSuccess(decodedText);
          stopScanner();
        },
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      stopScanner();
    }
  }, [onScanSuccess, stopScanner]);

  return { showScanner, startScanner, stopScanner, initScanner };
}
