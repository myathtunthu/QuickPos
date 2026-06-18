import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import logger from '../../utils/logger'; // 🌟 Add Custom Logger

export default function BarcodeScanner({ onScanSuccess, onScanFailure }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // 🌟 Added try-catch for scanner initialization
    try {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 100 }, rememberLastUsedCamera: true },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          try {
            scanner.clear();
            if (onScanSuccess) onScanSuccess(decodedText);
          } catch (clearErr) {
            logger.error('Error clearing scanner on success:', clearErr);
          }
        },
        (error) => {
          if (onScanFailure) onScanFailure(error);
        }
      );
    } catch (initErr) {
      logger.error('Error initializing Barcode Scanner:', initErr);
    }

    useEffect(()=>{document.body.style.overflow="hidden";return()=>{document.body.style.overflow="auto";};},[]);
  return () => {
      if (scannerRef.current) {
        // 🌟 Replaced console.error with logger.error
        scannerRef.current.clear().catch(err => {
          logger.error('Scanner cleanup error:', err);
        });
      }
    };
  }, [onScanSuccess, onScanFailure]);

  useEffect(()=>{document.body.style.overflow="hidden";return()=>{document.body.style.overflow="auto";};},[]);
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-700 bg-black">
      <div id="qr-reader" className="w-full"></div>
      <style>{`
        #qr-reader__scan_region { background-color: #000; }
        #qr-reader__dashboard { background-color: #111827; padding: 10px; color: white; }
        #qr-reader__dashboard_section_csr button { 
          background-color: transparent; 
          border: 1px solid #0ff; 
          color: #0ff; 
          padding: 5px 10px; 
          border-radius: 4px; 
          margin-top: 10px;
        }
        #qr-reader a { display: none; }
      `}</style>
    </div>
  );
}
