import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
  isDangerous = true,
}) {
  const { t } = useLanguage();
  const dialogTitle = title || t('confirmDefaultTitle', 'Confirm');
  const dialogMessage = message || t('confirmDefaultMessage', 'Are you sure you want to continue?');

  if (!isOpen || typeof document === 'undefined') return null;

  const node = (
    <div
      className="print:hidden"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        padding: 16,
        background: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(14px)',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
      role="presentation"
    >
      <div
        className="app-card w-full max-w-sm overflow-hidden animate-fade-up"
        style={{ maxHeight: 'calc(100svh - 32px)' }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-white/10 bg-white/[0.035] p-5">
          <div className={`rounded-2xl p-3 ${isDangerous ? 'bg-rose-500/10 text-rose-200' : 'bg-cyan-500/10 text-cyan-200'}`}>
            {isDangerous ? <AlertTriangle size={24} /> : <Info size={24} />}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white">{dialogTitle}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">{dialogMessage}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <button type="button" onClick={onCancel} disabled={isLoading} className="ui-btn-secondary">
            {t('cancel', 'Cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={isLoading} className={isDangerous ? 'ui-btn-danger' : 'ui-btn-primary'}>
            {isLoading ? <span className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : t('confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
