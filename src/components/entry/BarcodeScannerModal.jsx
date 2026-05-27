import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BarcodeScannerModal({ onClose, initScanner }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initScanner('barcode-reader');
    }
    return () => {
      initialized.current = false;
    };
  }, [initScanner]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d1120] border border-cyan-500/20 rounded-3xl p-6">
        <div className="flex justify-between mb-5">
          <h2 className="text-xl font-black text-cyan-400">Barcode Scanner</h2>
          <button onClick={onClose}><X size={20} className="text-white"/></button>
        </div>
        <div id="barcode-reader" className="overflow-hidden rounded-2xl" />
      </div>
    </div>
  );
}
