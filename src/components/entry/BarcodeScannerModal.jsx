import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

export default function BarcodeScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    codeReader
      .decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.text);   // barcode number as text
          codeReader.reset();
          onClose();
        }
        // ignore errors when nothing is detected
      })
      .catch((err) => {
        console.error('Camera error:', err);
        setCameraError(true);
      });

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d1120] border border-cyan-500/20 rounded-3xl p-6">
        <div className="flex justify-between mb-5">
          <h2 className="text-xl font-black text-cyan-400">Barcode Scanner</h2>
          <button onClick={onClose}><X size={20} className="text-white" /></button>
        </div>
        {cameraError ? (
          <div className="text-center text-red-400 py-10">Camera access denied or not available.</div>
        ) : (
          <video ref={videoRef} className="w-full rounded-2xl" style={{ minHeight: '250px' }} />
        )}
      </div>
    </div>
  );
}
