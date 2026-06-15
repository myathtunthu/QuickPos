import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanLine, X, Keyboard, CameraOff, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import logger from '../../utils/logger';

function lockPageScroll() {
  if (typeof document === 'undefined') return () => {};

  const body = document.body;
  const html = document.documentElement;
  const scrollY = window.scrollY || html.scrollTop || 0;

  const previous = {
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyHeight: body.style.height,
    bodyTouchAction: body.style.touchAction,
    bodyOverscroll: body.style.overscrollBehavior,
    htmlOverflow: html.style.overflow,
    htmlHeight: html.style.height,
    htmlTouchAction: html.style.touchAction,
    htmlOverscroll: html.style.overscrollBehavior,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.height = '100%';
  body.style.touchAction = 'none';
  body.style.overscrollBehavior = 'none';
  html.style.overflow = 'hidden';
  html.style.height = '100%';
  html.style.touchAction = 'none';
  html.style.overscrollBehavior = 'none';

  const preventMove = (event) => event.preventDefault();
  document.addEventListener('touchmove', preventMove, { passive: false, capture: true });
  document.addEventListener('wheel', preventMove, { passive: false, capture: true });

  return () => {
    document.removeEventListener('touchmove', preventMove, { capture: true });
    document.removeEventListener('wheel', preventMove, { capture: true });
    body.style.overflow = previous.bodyOverflow;
    body.style.position = previous.bodyPosition;
    body.style.top = previous.bodyTop;
    body.style.left = previous.bodyLeft;
    body.style.right = previous.bodyRight;
    body.style.width = previous.bodyWidth;
    body.style.height = previous.bodyHeight;
    body.style.touchAction = previous.bodyTouchAction;
    body.style.overscrollBehavior = previous.bodyOverscroll;
    html.style.overflow = previous.htmlOverflow;
    html.style.height = previous.htmlHeight;
    html.style.touchAction = previous.htmlTouchAction;
    html.style.overscrollBehavior = previous.htmlOverscroll;
    window.scrollTo(0, scrollY);
  };
}

export default function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const manualInputRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const lastScannedRef = useRef({ code: '', time: 0 });

  const [cameraError, setCameraError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useLayoutEffect(() => lockPageScroll(), []);

  const stopCamera = () => {
    try {
      if (readerRef.current) readerRef.current.reset();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    } catch (err) {
      logger.warn?.('Scanner cleanup warning:', err);
    }
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
    window.setTimeout(() => setIsProcessing(false), 700);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

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

    const codeReader = new BrowserMultiFormatReader(hints, 350);
    readerRef.current = codeReader;

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    async function startCameraFirst() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API not available');

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraReady(true);
        setCameraError(false);
        setManualOpen(false);

        await codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result?.text) submitCode(result.text);
        });
      } catch (err) {
        logger.error('Camera error:', err);
        setCameraReady(false);
        setCameraError(true);
        setManualOpen(false);
      }
    }

    startCameraFirst();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!manualOpen) return undefined;
    const timer = window.setTimeout(() => manualInputRef.current?.focus({ preventScroll: true }), 120);
    return () => window.clearTimeout(timer);
  }, [manualOpen]);

  const modal = (
    <div
      className="fixed left-0 top-0 z-[2147483647] h-[100svh] w-[100vw] overflow-hidden bg-black/85 backdrop-blur-md print:hidden"
      style={{ inset: 0, overscrollBehavior: 'none', touchAction: 'none' }}
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      <div
        className="absolute left-1/2 top-1/2 w-[min(92vw,430px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-cyan-400/35 bg-[#080d1b] text-white shadow-2xl shadow-cyan-950/60"
        style={{ maxHeight: 'min(86svh, 620px)' }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-500/15 text-cyan-300">
              <ScanLine size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Scan Barcode</p>
              <p className="text-[10px] font-bold text-slate-500">Camera first</p>
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
            <div className="grid h-[270px] place-items-center px-5 py-6 text-center">
              <div>
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
                  <CameraOff size={26} />
                </div>
                <p className="text-sm font-black text-amber-200">Camera not available</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Use manual barcode only when camera fails.</p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="block h-[300px] max-h-[42svh] w-full bg-black object-cover"
              autoPlay
              playsInline
              muted
            />
          )}

          {!cameraError && <div className="absolute inset-x-10 top-1/2 h-0.5 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.95)]" />}

          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 grid place-items-center bg-black/70">
              <div className="text-center text-cyan-200">
                <Loader2 className="mx-auto mb-2 animate-spin" size={28} />
                <p className="text-xs font-black uppercase tracking-[0.16em]">Opening camera</p>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#07101f]/90 backdrop-blur-sm">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                <p className="text-sm font-black text-cyan-200">Adding item...</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-[#0c1326] p-3">
          {!manualOpen ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400 transition hover:text-white active:scale-[0.99]"
            >
              <Keyboard size={15} />
              Type barcode manually
            </button>
          ) : (
            <form
              className="space-y-2.5"
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
                  placeholder="Type barcode"
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
              <button
                type="button"
                onClick={() => {
                  setManualCode('');
                  setManualOpen(false);
                }}
                className="w-full rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500"
              >
                Back to camera
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
