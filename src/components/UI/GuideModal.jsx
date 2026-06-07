import { HelpCircle, X } from 'lucide-react';

export default function GuideModal({ open, onClose, guide, t }) {
  if (!open || !guide) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <button type="button" aria-label={t('close', 'Close')} className="absolute inset-0" onClick={onClose} />

      <section className="relative w-full sm:max-w-2xl max-h-[86vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border border-cyan-500/20 bg-[#0b1020] shadow-2xl shadow-cyan-950/40 text-white">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0b1020]/95 p-5 sm:p-6 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300 border border-cyan-500/20">
              <HelpCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">{guide.title}</h2>
              {guide.subtitle && <p className="mt-1 text-sm font-bold text-slate-400 leading-6">{guide.subtitle}</p>}
            </div>
          </div>

          <button type="button" onClick={onClose} className="rounded-xl bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {guide.steps.map((step, index) => (
            <article key={`${step.title}-${index}`} className="rounded-2xl border border-cyan-500/10 bg-black/25 p-4">
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-sm font-black text-cyan-300 border border-cyan-500/20">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-black text-white">{step.title}</h3>
                  {step.body && <p className="mt-1 text-sm font-bold leading-6 text-slate-400">{step.body}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
