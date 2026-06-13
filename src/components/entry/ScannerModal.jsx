import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, X, Keyboard, CameraOff } from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import logger from '../../utils/logger';

export default function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const manualInputRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
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
    if (typeof document === 'undefined') return undefined;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    documentElement.style.overflow = 'hidden';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.touchAction = previousBodyTouchAction;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  const stopCamera = () => {
    if (readerRef.current) readerRef.current.reset();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
  };

  const closeModal = () => {
    stopCamera();
    onCloseRef.current?.();
  };

  const submitCode = (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code || isProcessing) return;

    const now = Date.now();
    if (code === lastScannedRef.current.code && now - lastScannedRef.current.time < 1200) return;

    lastScannedRef.current = { code, time: now };
    setIsProcessing(true);
    onScanRef.current?.(code);

    setManualCode('');
    setTimeout(() => {
      setIsProcessing(false);
      manualInputRef.current?.focus();
    }, 650);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeModal();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
      ?.getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        codeReader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (!result?.text) return;
          submitCode(result.text);
        });
      })
      .catch((err) => {
        logger.error('Camera error:', err);
        setCameraError(true);
        requestAnimationFrame(() => manualInputRef.current?.focus());
      });

    const focusTimer = window.setTimeout(() => manualInputRef.current?.focus(), 300);

    return () => {
      window.clearTimeout(focusTimer);
      stopCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-black/75 p-3 backdrop-blur-md print:hidden" onWheel={(event) => event.preventDefault()} onTouchMove={(event) => event.preventDefault()} onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeModal();
    }}>
      <div className="w-full max-w-[420px] max-h-[calc(100svh-24px)] overflow-hidden rounded-[26px] border border-cyan-400/30 bg-[#0b1020] text-white shadow-2xl shadow-cyan-950/40">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-500/15 text-cyan-300">
              <ScanLine size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Scan Barcode</p>
              <p className="text-[10px] font-bold text-slate-500">Camera or reader</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white active:scale-95"
            aria-label="Close scanner"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative bg-black">
          {cameraError ? (
            <div className="grid min-h-[158px] place-items-center px-5 py-6 text-center">
              <div>
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
                  <CameraOff size={26} />
                </div>
                <p className="text-sm font-black text-amber-200">Camera not available</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Use manual barcode input below.</p>
              </div>
            </div>
          ) : (
            <video ref={videoRef} className="block h-[178px] w-full object-cover sm:h-[220px]" autoPlay playsInline muted />
          )}

          {!cameraError && <div className="absolute inset-x-10 top-1/2 h-0.5 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.95)]" />}

          {isProcessing && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#07101f]/90 backdrop-blur-sm">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                <p className="text-sm font-black text-cyan-200">Adding item...</p>
              </div>
            </div>
          )}
        </div>

        <form
          className="space-y-2.5 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitCode(manualCode);
          }}
        >
          <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            <Keyboard size={14} />
            Manual barcode
          </label>
          <div className="flex gap-2">
            <input
              ref={manualInputRef}
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Scan or type barcode"
              className="min-w-0 flex-1 rounded-2xl border border-cyan-500/25 bg-black/40 px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-cyan-300"
              inputMode="numeric"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className="shrink-0 rounded-2xl bg-cyan-500 px-4 py-2.5 text-xs font-black text-[#06111f] transition active:scale-95 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="text-center text-[10px] font-bold text-slate-500">ESC / outside click to close</p>
        </form>
      </div>
    </div>
  );
}
