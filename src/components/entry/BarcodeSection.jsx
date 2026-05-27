import { useState, useRef, useEffect } from 'react';
import { Barcode, Camera } from 'lucide-react';

export default function BarcodeSection({ products, addToCart }) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const inputRef = useRef(null);

  // Auto focus on barcode input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const found = products.find(p => 
        p.barcode === barcodeInput.trim() || 
        p.units?.some(u => u.barcode === barcodeInput.trim())
      );

      if (found) {
        setScannedProduct(found);
        
        // Auto add with default unit if found
        const defaultUnit = found.units?.[0]?.name || 'ဘူး';
        addToCart(found, defaultUnit, 'retail', 1);
        setBarcodeInput('');
      } else {
        alert("ပစ္စည်း မတွေ့ပါဘူး");
      }
    }
  };

  return (
    <div className="bg-[#0f172a] border border-cyan-500/20 rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Barcode size={28} className="text-cyan-400" />
        <h2 className="text-2xl font-black">Barcode Scanner</h2>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-400 mb-2">Barcode ရိုက်ပါ သို့မဟုတ် စကင်နာ သုံးပါ</p>
          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeScan}
            placeholder="Barcode ရိုက်ပါ..."
            className="w-full bg-black border-2 border-cyan-500/50 rounded-2xl px-6 py-5 text-xl font-mono focus:border-cyan-400 outline-none"
          />
        </div>

        {scannedProduct && (
          <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-4">
            <p className="text-emerald-400 font-bold">✅ တွေ့ရှိခဲ့ပါသည်</p>
            <p className="text-xl font-bold mt-1">{scannedProduct.name}</p>
          </div>
        )}

        <div className="text-center text-slate-500 text-sm py-8 border border-dashed border-slate-700 rounded-2xl">
          <Camera size={48} className="mx-auto mb-3 opacity-30" />
          <p>Hardware Barcode Scanner နဲ့ ချိတ်ဆက်ထားပါက အလိုအလျောက် ဖတ်ပေးပါမည်</p>
        </div>
      </div>
    </div>
  );
}
