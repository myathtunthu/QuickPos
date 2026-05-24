import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-neon-cyan hover:border-neon-cyan transition-all duration-300"
      title="Toggle Language (EN/MY)"
    >
      <Languages size={18} />
      <span className="text-xs font-bold uppercase">{language}</span>
    </button>
  );
}
