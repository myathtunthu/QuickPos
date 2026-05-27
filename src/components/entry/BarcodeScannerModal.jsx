import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

export default function BarcodeScannerModal({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode;
    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText);
            if (scannerRef.current) {
              scannerRef.current.stop().catch(() => {});
              scannerRef.current = null;
            }
            onClose();
          },
          () => {}
        );
      } catch (err) {
        console.error("Scanner error:", err);
        onClose();
      }
    };
    
    startScanner();
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0f172a] border border-cyan-500/20 rounded-3xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-cyan-500/20">
          <h2 className="text-lg font-bold text-white">Scan Barcode</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div id="barcode-reader" className="w-full p-4" style={{ minHeight: '300px' }} />
      </div>
    </div>
  );
}
