import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';

export const showToast = (message, type = 'info') => {
  useToastStore.getState().showToast(message, type);
};

export default function Toast() {
  const { toasts, removeToast } = useToastStore();

  const config = {
    success: {
      icon: CheckCircle,
      className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50',
      iconClass: 'text-emerald-300',
    },
    error: {
      icon: AlertCircle,
      className: 'border-rose-400/30 bg-rose-500/10 text-rose-50',
      iconClass: 'text-rose-300',
    },
    info: {
      icon: Info,
      className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50',
      iconClass: 'text-cyan-300',
    },
  };

  return (
    <div className="fixed bottom-24 right-3 z-[9999] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 print:hidden sm:bottom-4 sm:right-4 sm:w-auto">
      {toasts.map((toast) => {
        const item = config[toast.type] || config.info;
        const Icon = item.icon;

        return (
          <div
            key={toast.id}
            className={`flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-fade-up ${item.className}`}
          >
            <Icon size={20} className={`mt-0.5 flex-shrink-0 ${item.iconClass}`} />
            <span className="min-w-0 flex-1 text-sm font-bold leading-relaxed">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-1 text-slate-300/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
