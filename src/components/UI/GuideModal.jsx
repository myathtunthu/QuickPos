import React from 'react';
import { BookOpen, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function GuideModal({ guide, onClose }) {
  const { t } = useLanguage();

  if (!guide) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <button type="button" aria-label={t('close')} className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl max-h-[88vh] overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-cyan-500/20 bg-[#0b1020] shadow-2xl shadow-cyan-950/30">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0b1020]/95 p-5 backdrop-blur">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300 border border-cyan-500/20 shrink-0">
              <BookOpen size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-300">{t('guide')}</p>
              <h2 className="mt-1 text-xl sm:text-2xl font-black text-white leading-tight">{guide.title}</h2>
              {guide.description && <p className="mt-2 text-sm leading-6 text-slate-400">{guide.description}</p>}
            </div>
          </div>

          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95">
            <X size={22} />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {(guide.steps || []).map((step, index) => (
            <div key={`${step.title}-${index}`} className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 font-black shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-white leading-snug">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400 whitespace-pre-line">{step.body}</p>
                </div>
              </div>
            </div>
          ))}

          {guide.tips?.length > 0 && (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <h3 className="flex items-center gap-2 text-emerald-300 font-black">
                <CheckCircle2 size={18} /> {t('guideTips')}
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {guide.tips.map((tip, index) => <li key={index}>• {tip}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
