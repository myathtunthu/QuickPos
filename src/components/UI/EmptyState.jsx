import React from 'react';
import { Database } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function EmptyState({ icon: Icon = Database, title, message, action = null }) {
  const { t } = useLanguage();
  const resolvedTitle = title || t('emptyStateTitle', 'No data yet');
  const resolvedMessage = message || t('emptyStateMessage', 'No records or data found to display.');

  return (
    <div className="app-card flex flex-col items-center justify-center px-4 py-14 text-center animate-fade-up">
      <div className="mb-5 rounded-[1.35rem] border border-cyan-400/20 bg-cyan-400/10 p-5 text-cyan-200">
        <Icon size={46} />
      </div>
      <h3 className="mb-2 text-xl font-black text-white">{resolvedTitle}</h3>
      <p className="mb-6 max-w-sm text-sm font-medium leading-relaxed text-slate-400">{resolvedMessage}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="ui-btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
