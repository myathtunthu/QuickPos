import React from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const showToast = (message, type = 'info') => {
  useToastStore.getState().showToast(message, type);
};

const toastMeta = {
  success: {
    icon: CheckCircle,
    ring: 'border-emerald-400/40 shadow-emerald-950/50',
    iconWrap: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
    title: 'Success',
  },
  error: {
    icon: AlertCircle,
    ring: 'border-rose-400/45 shadow-rose-950/50',
    iconWrap: 'bg-rose-500/15 text-rose-300 border-rose-400/25',
    title: 'Error',
  },
  info: {
    icon: Info,
    ring: 'border-cyan-400/35 shadow-cyan-950/40',
    iconWrap: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/25',
    title: 'Notice',
  },
};

export default function Toast() {
  const { toasts, removeToast } = useToastStore();

  if (!toasts.length || typeof document === 'undefined') return null;

  const toast = toasts[toasts.length - 1];
  const meta = toastMeta[toast.type] || toastMeta.info;
  const Icon = meta.icon;

  const node = (
    <div
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: '12px',
      }}
      className="print:hidden"
    >
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        onWheel={(event) => event.preventDefault()}
        onTouchMove={(event) => event.preventDefault()}
        className={`pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-[26px] border bg-[#0b1020]/95 p-3.5 text-white shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-200 ${meta.ring}`}
        style={{ maxHeight: 'calc(100dvh - 28px)' }}
      >
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${meta.iconWrap}`}>
            <Icon size={22} />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{meta.title}</p>
            <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-100 line-clamp-4">{toast.message}</p>
          </div>

          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-white active:scale-95"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
