import { useState } from 'react';
import { ScanBarcode, X } from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

export default function BarcodeSection({ products, onBarcodeScanned, entryTab }) {
  const [manualInput, setManualInput] = useState('');

  const handleScan = (code) => {
    if (!code) return;
    // Search in all product's packageUnits barcodes
    for (const prod of products) {
      if (prod.packageUnits && Array.isArray(prod.packageUnits)) {
        for (const unit of prod.packageUnits) {
          const barcodes = unit.barcodes || {};
          for (const [priceType, barcodeVal] of Object.entries(barcodes)) {
            if (barcodeVal === code) {
              // Found product, unit, priceType
              onBarcodeScanned({
                product: prod,
                unit,
                priceType,
                tab: entryTab
              });
              return;
            }
          }
        }
      }
    }
    // Fallback: try product primary barcode (if any)
    const prod = products.find(p => p.barcode === code);
    if (prod) {
      const defaultUnit = prod.packageUnits?.[0];
      if (defaultUnit) {
        onBarcodeScanned({
          product: prod,
          unit: defaultUnit,
          priceType: entryTab === 'Sale' ? 'retail' : undefined,
          tab: entryTab
        });
        return;
      }
    }
    // Error beep
    playBeep('error');
  };

  const { showScanner, startScanner, stopScanner, initScanner } = useBarcodeScanner(handleScan);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleScan(manualInput);
    setManualInput('');
  };

  return (
    <>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <ScanBarcode className="absolute left-2.5 top-2 text-blue-500" size={14} />
          <input
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleManualSubmit(e); }}
            placeholder="Scan barcode or type"
            className="w-full bg-black/40 border border-blue-500/20 rounded-lg pl-8 pr-2 py-2 text-xs text-white outline-none"
          />
        </div>
        <button
          onClick={startScanner}
          className="px-2.5 bg-blue-600 rounded-lg flex items-center"
        >
          <ScanBarcode size={16} />
        </button>
      </div>
      {showScanner && (
        <BarcodeScannerModal
          onClose={stopScanner}
          initScanner={initScanner}
        />
      )}
    </>
  );
}

// Helper beep
function playBeep(type = 'success') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type === 'success' ? 'sine' : 'square';
    osc.frequency.value = type === 'success' ? 900 : 180;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}
