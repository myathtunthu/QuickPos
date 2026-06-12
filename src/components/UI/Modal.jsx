import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, size = 'lg' }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[96vw]',
  };

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
      <button
        type="button"
        aria-label="Close modal overlay"
        className="absolute inset-0 bg-slate-950/78 backdrop-blur-md"
        onClick={onClose}
      />

      <div className={`app-card relative w-full ${sizes[size] || sizes.lg} overflow-hidden animate-fade-up`}>
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.035] px-4 py-4 sm:px-5">
          <h3 className="min-w-0 truncate text-lg font-black text-white sm:text-xl">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300 transition hover:bg-rose-500/15 hover:text-rose-200 active:scale-95"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="custom-scrollbar max-h-[80vh] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
