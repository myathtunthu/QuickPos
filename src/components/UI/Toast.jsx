import React from 'react';
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

  if (!toasts.length) return null;

  const visibleToasts = toasts.slice(-3);

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center p-4 print:hidden">
      <div className="w-full max-w-sm space-y-3">
        {visibleToasts.map((toast) => {
          const meta = toastMeta[toast.type] || toastMeta.info;
          const Icon = meta.icon;

          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto w-full rounded-3xl border bg-[#0b1020]/95 backdrop-blur-2xl p-4 text-white shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${meta.ring}`}
            >
              <div className="flex items-start gap-3">
                <div className={`shrink-0 grid h-11 w-11 place-items-center rounded-2xl border ${meta.iconWrap}`}>
                  <Icon size={22} />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {meta.title}
                  </p>
                  <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-100">
                    {toast.message}
                  </p>
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
          );
        })}
      </div>
    </div>
  );
}
