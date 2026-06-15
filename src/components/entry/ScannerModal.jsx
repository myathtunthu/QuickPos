import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanLine, X, Keyboard, CameraOff, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import logger from '../../utils/logger';

function lockViewport() {
  if (typeof document === 'undefined') return () => {};

  const body = document.body;
  const html = document.documentElement;
  const scrollX = window.scrollX || html.scrollLeft || 0;
  const scrollY = window.scrollY || html.scrollTop || 0;

  const prev = {
    bodyStyle: body.getAttribute('style') || '',
    htmlStyle: html.getAttribute('style') || '',
  };

  body.dataset.nexposOverlayLock = '1';
  html.style.overflow = 'hidden';
  html.style.height = '100%';
  html.style.width = '100%';
  html.style.overscrollBehavior = 'none';
  html.style.touchAction = 'none';

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = `-${scrollX}px`;
  body.style.right = '0';
  body.style.bottom = '0';
  body.style.width = '100vw';
  body.style.height = '100dvh';
  body.style.overscrollBehavior = 'none';
  body.style.touchAction = 'none';

  const block = (event) => {
    const target = event.target;
    const tag = target?.tagName;
    const allowTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (!allowTyping) event.preventDefault();
  };

  window.addEventListener('scroll', () => window.scrollTo(scrollX, scrollY), { passive: false });
  document.addEventListener('touchmove', block, { passive: false, capture: true });
  document.addEventListener('wheel', block, { passive: false, capture: true });

  return () => {
    document.removeEventListener('touchmove', block, { capture: true });
    document.removeEventListener('wheel', block, { capture: true });
    delete body.dataset.nexposOverlayLock;
    body.setAttribute('style', prev.bodyStyle);
    html.setAttribute('style', prev.htmlStyle);
    window.scrollTo(scrollX, scrollY);
  };
}

export default function ScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const latestScanRef = useRef({ code: '', time: 0 });
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [processing, setProcessing] = useState(false);

  const hints = useMemo(() => {
    const map = new Map();
    map.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ]);
    return map;
  }, []);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => lockViewport(), []);

  const stopCamera = () => {
    try {
      readerRef.current?.reset?.();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
    } catch (err) {
      logger.warn?.('Scanner cleanup warning:', err);
    }
  };

  const close = () => {
    stopCamera();
    onCloseRef.current?.();
  };

  const submitCode = (raw) => {
    const code = String(raw || '').trim();
    if (!code || processing) return;

    const now = Date.now();
    if (latestScanRef.current.code === code && now - latestScanRef.current.time < 1300) return;

    latestScanRef.current = { code, time: now };
    setProcessing(true);
    onScanRef.current?.(code);
    setManualCode('');
    window.setTimeout(() => setProcessing(false), 650);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const codeReader = new BrowserMultiFormatReader(hints, 250);
    readerRef.current = codeReader;

    async function startCamera() {
      setManualOpen(false);
      setCameraError(false);
      setCameraReady(false);

      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          await videoRef.current.play().catch(() => undefined);
        }

        setCameraReady(true);
        await codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result?.text) submitCode(result.text);
        });
      } catch (err) {
        logger.error?.('Camera scanner error:', err);
        setCameraError(true);
        setCameraReady(false);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [hints]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Barcode scanner"
      onClick={close}
      onTouchMove={(event) => event.preventDefault()}
      onWheel={(event) => event.preventDefault()}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 2147483647,
        width: '100vw',
        height: '100dvh',
        maxWidth: '100vw',
        maxHeight: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
        background: 'rgba(0,0,0,0.86)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      className="print:hidden"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate3d(-50%, -50%, 0)',
          width: 'min(430px, calc(100vw - 28px))',
          maxHeight: 'min(680px, calc(100dvh - 116px))',
          overflow: 'hidden',
          borderRadius: 28,
          border: '1px solid rgba(34,211,238,0.38)',
          background: '#08101f',
          boxShadow: '0 26px 80px rgba(0,0,0,.75), 0 0 42px rgba(8,145,178,.22)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-500/15 text-cyan-300">
              <ScanLine size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Scan Barcode</p>
              <p className="text-[10px] font-bold text-cyan-300">Camera first</p>
            </div>
          </div>
          <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 active:scale-95" aria-label="Close scanner">
            <X size={19} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          {cameraError ? (
            <div className="grid h-[310px] max-h-[42dvh] place-items-center px-5 py-6 text-center">
              <div>
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
                  <CameraOff size={26} />
                </div>
                <p className="text-sm font-black text-amber-200">Camera unavailable</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Use manual only when camera cannot scan.</p>
              </div>
            </div>
          ) : (
            <video ref={videoRef} className="block h-[330px] max-h-[44dvh] w-full bg-black object-cover" autoPlay playsInline muted />
          )}

          {!cameraError && <div className="absolute inset-x-10 top-1/2 h-0.5 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,.95)]" />}

          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 grid place-items-center bg-black/75">
              <div className="text-center text-cyan-200">
                <Loader2 className="mx-auto mb-2 animate-spin" size={28} />
                <p className="text-xs font-black uppercase tracking-[0.16em]">Opening camera</p>
              </div>
            </div>
          )}

          {processing && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#07101f]/90 backdrop-blur-sm">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                <p className="text-sm font-black text-cyan-200">Adding item...</p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#0c1326] p-3">
          {!manualOpen ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 transition active:scale-[0.99]"
            >
              <Keyboard size={15} />
              Manual fallback
            </button>
          ) : (
            <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); submitCode(manualCode); }}>
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="Type barcode"
                  className="min-w-0 flex-1 rounded-2xl border border-cyan-500/25 bg-black/40 px-3 py-2.5 text-base font-bold text-white outline-none focus:border-cyan-300"
                  inputMode="numeric"
                  autoComplete="off"
                />
                <button type="submit" disabled={!manualCode.trim() || processing} className="shrink-0 rounded-2xl bg-cyan-500 px-4 py-2.5 text-xs font-black text-[#06111f] active:scale-95 disabled:opacity-50">
                  Add
                </button>
              </div>
              <button type="button" onClick={() => { setManualCode(''); setManualOpen(false); }} className="w-full rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500">
                Back to camera
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
