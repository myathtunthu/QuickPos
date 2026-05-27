import { ScanBarcode } from 'lucide-react';

export default function BarcodeSection({ onScan, onOpenScanner }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onScan(e.target.value);
      e.target.value = '';
    }
  };

  return (
    <div className="flex gap-2 flex-1 mb-4">
      <div className="relative flex-1">
        <ScanBarcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
        <input
          id="barcode-input"
          type="text"
          onKeyDown={handleKeyDown}
          placeholder="Scan or type barcode..."
          className="w-full bg-[#0f172a] border border-blue-500/20 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
        />
      </div>
      <button
        onClick={onOpenScanner}
        className="px-4 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-500 transition-colors"
      >
        <ScanBarcode className="w-5 h-5" />
      </button>
    </div>
  );
}
