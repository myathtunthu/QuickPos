import React, { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import logger from '../../utils/logger';

export default function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const lastScannedRef = useRef({ code: '', time: 0 });

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
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

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;

        if (videoRef.current) videoRef.current.srcObject = stream;

        codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (!result) return;

          const now = Date.now();
          if (result.text === lastScannedRef.current.code && now - lastScannedRef.current.time < 1500) {
            return;
          }

          lastScannedRef.current = { code: result.text, time: now };
          setIsProcessing(true);

          if (onScanRef.current) onScanRef.current(result.text);

          setTimeout(() => setIsProcessing(false), 900);
        });
      })
      .catch((err) => {
        logger.error('Camera error:', err);
        setCameraError(true);
      });

    return () => {
      if (readerRef.current) readerRef.current.reset();
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-sm bg-[#0d1120] border border-cyan-500/30 rounded-3xl overflow-hidden relative shadow-2xl shadow-cyan-950/40">
        <div className="p-4 bg-cyan-500/10 flex justify-between items-center text-white border-b border-cyan-500/20">
          <h3 className="font-black flex items-center gap-2">
            <ScanLine size={18} className="text-cyan-400" />
            Barcode Scanner
          </h3>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="text-rose-400 hover:text-rose-300 font-black text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="relative bg-black">
          {cameraError ? (
            <div className="p-8 text-center text-rose-400 font-bold">
              Camera access denied or not available.
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-auto min-h-[250px]" autoPlay playsInline muted />
          )}

          <div className="absolute inset-x-8 top-1/2 h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.9)]" />

          {isProcessing && (
            <div className="absolute inset-0 bg-[#0d1120]/90 flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-cyan-300 font-black text-base">ပစ္စည်းစာရင်းသွင်းနေပါသည်</p>
              <p className="text-sm font-bold text-slate-400 mt-1">ခဏစောင့်ပါ...</p>
            </div>
          )}
        </div>

        <div
          className={`p-4 text-center text-xs font-black transition-colors ${
            isProcessing ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {isProcessing
            ? 'စနစ်ထဲသို့ ထည့်သွင်းနေပါသည်...'
            : 'စကင်နာ ဖွင့်ထားဆဲဖြစ်သည် - ပစ္စည်းများ ဆက်တိုက်ဖတ်နိုင်ပါသည်'}
        </div>
      </div>
    </div>
  );
}
