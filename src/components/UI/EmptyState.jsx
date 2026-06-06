import React from 'react';
import { Database } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function EmptyState({
  icon: Icon = Database,
  title,
  message,
  action = null
}) {
  const { t } = useLanguage();
  const resolvedTitle = title || t('emptyStateTitle', 'No data yet');
  const resolvedMessage = message || t('emptyStateMessage', 'No records or data found to display.');

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-300">
      <div className="bg-slate-800/50 p-6 rounded-full mb-6 border border-white/5">
        <Icon className="text-cyan-500/50" size={56} />
      </div>
      <h3 className="text-xl font-black text-white mb-2">{resolvedTitle}</h3>
      <p className="text-slate-400 text-sm mb-6 text-center max-w-sm leading-relaxed">
        {resolvedMessage}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-600/20 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
