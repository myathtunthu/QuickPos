import { useMemo, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import ScannerModal from './ScannerModal';
import { findProductByBarcode, normalizeBarcode } from './entryUomHelpers';
import { useLanguage } from '../../context/LanguageContext';

export default function BarcodeSection({ products = [], onBarcodeScanned, entryTab }) {
  const { t } = useLanguage();
  const [manualInput, setManualInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [lastError, setLastError] = useState('');

  const productCount = useMemo(() => (Array.isArray(products) ? products.length : 0), [products]);

  const handleScan = (rawCode) => {
    const code = normalizeBarcode(rawCode);
    if (!code) return;

    const match = findProductByBarcode(products, code);
    if (!match) {
      setLastError(t('barcodeNotFound', 'Barcode not found'));
      playBeep('error');
      return;
    }

    setLastError('');
    playBeep('success');
    onBarcodeScanned?.({
      product: match.product,
      unit: match.unit,
      priceType: entryTab === 'Sale' ? match.priceType || 'retail' : undefined,
      tab: entryTab,
      barcode: code,
    });
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    handleScan(manualInput);
    setManualInput('');
  };

  return (
    <>
      <form onSubmit={handleManualSubmit} className="space-y-1.5">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-2.5 top-2.5 text-blue-500" size={14} />
            <input
              value={manualInput}
              onChange={(event) => setManualInput(event.target.value)}
              placeholder={t('scanBarcodePlaceholder', 'Scan barcode or type')}
              autoComplete="off"
              className="w-full bg-black/40 border border-blue-500/20 rounded-lg pl-8 pr-2 py-2 text-[16px] sm:text-xs text-white outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="px-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center transition-colors"
            aria-label={t('scanBarcode', 'Scan Barcode')}
            disabled={productCount === 0}
          >
            <ScanBarcode size={16} />
          </button>
        </div>
        {lastError && <p className="text-[10px] text-rose-400 font-bold">{lastError}</p>}
      </form>

      {showScanner && (
        <ScannerModal
          onClose={() => setShowScanner(false)}
          onScan={(code) => {
            handleScan(code);
            setShowScanner(false);
          }}
        />
      )}
    </>
  );
}

function playBeep(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type === 'success' ? 'sine' : 'square';
    osc.frequency.value = type === 'success' ? 900 : 180;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close?.(), 300);
  } catch {
    // Audio is optional.
  }
}
