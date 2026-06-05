import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X } from 'lucide-react';
import logger from '../../utils/logger';

export default function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ]);

        const codeReader = new BrowserMultiFormatReader(hints);
        readerRef.current = codeReader;

        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        await codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (!result?.text) return;
          const now = Date.now();
          const text = result.text.trim();

          if (text === lastScannedRef.current.code && now - lastScannedRef.current.time < 1400) return;

          lastScannedRef.current = { code: text, time: now };
          setIsProcessing(true);
          onScanRef.current?.(text);
          window.setTimeout(() => setIsProcessing(false), 700);
        });
      } catch (error) {
        logger.error('Camera scanner error:', error);
        setCameraError('Camera access denied or not available.');
      }
    };

    startScanner();

    return () => {
      mounted = false;
      try {
        readerRef.current?.reset?.();
      } catch (error) {
        logger.error('Scanner cleanup error:', error);
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#0d1120] shadow-2xl shadow-cyan-950/40">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-4">
          <div>
            <h3 className="font-black text-white">Barcode Scanner</h3>
            <p className="text-xs text-slate-400">Camera ကို barcode ပေါ်ချိန်ပါ</p>
          </div>
          <button type="button" onClick={() => onCloseRef.current?.()} className="rounded-xl bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20" aria-label="Close scanner">
            <X size={20} />
          </button>
        </div>

        <div className="relative bg-black">
          {cameraError ? (
            <div className="p-8 text-center font-bold text-rose-400">{cameraError}</div>
          ) : (
            <video ref={videoRef} className="h-[320px] w-full object-cover" autoPlay playsInline muted />
          )}

          {!cameraError && <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />}

          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#06111f]/90">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <p className="font-black text-cyan-300">ပစ္စည်းထည့်နေပါသည်...</p>
            </div>
          )}
        </div>

        <div className="bg-emerald-500/10 px-5 py-3 text-center text-xs font-black text-emerald-400">Continuous scan ဖွင့်ထားသည်</div>
      </div>
    </div>
  );
}

