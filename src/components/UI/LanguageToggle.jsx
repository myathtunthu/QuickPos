import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageToggle() {
  const { language, languageLabel, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/20 active:scale-95"
      title="Toggle Language"
      aria-label="Toggle Language"
    >
      <Languages size={18} />
      <span className="uppercase">{languageLabel || language}</span>
    </button>
  );
}
