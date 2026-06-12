import React from 'react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-md">
      <div className="app-card w-full max-w-sm overflow-hidden animate-fade-up">
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
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="ui-btn-secondary"
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={isDangerous ? 'ui-btn-danger' : 'ui-btn-primary'}
          >
            {isLoading ? <span className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : t('confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
