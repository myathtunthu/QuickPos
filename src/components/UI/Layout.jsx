import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import BottomNav from '../BottomNav';
import Sidebar from './Sidebar';
import GuideModal from './GuideModal';
import { useLanguage } from '../../context/LanguageContext';
import { getPageGuide } from '../../utils/pageGuides';

export default function Layout() {
  const location = useLocation();
  const { language, languageLabel, toggleLanguage, t } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentGuide = useMemo(
    () => getPageGuide(location.pathname, t, language),
    [language, location.pathname, t]
  );

  return (
    <div className="app-shell-bg flex h-screen w-screen overflow-hidden text-slate-100">
      <div
        className={`hidden h-full flex-shrink-0 transition-[width] duration-300 ease-out md:block ${
          sidebarCollapsed ? 'w-[88px]' : 'w-[280px]'
        }`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-[72px] flex-shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/70 px-3 shadow-lg shadow-black/10 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-11 w-auto max-w-[180px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20 active:scale-95"
              aria-label={t('openGuide', 'Open guide')}
            >
              <HelpCircle size={18} />
              <span className="hidden sm:inline">{t('guide', 'Guide')}</span>
            </button>

            <button
              type="button"
              onClick={toggleLanguage}
              className="h-11 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/20 active:scale-95"
              aria-label={t('toggleLanguage', 'Toggle language')}
            >
              {languageLabel}
            </button>
          </div>
        </header>

        <main
          data-app-scroll-container="true"
          className="custom-scrollbar flex-1 overflow-y-auto p-3 pb-24 sm:p-5 md:p-6 md:pb-6"
        >
          <div className="mx-auto w-full max-w-[1600px] animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <BottomNav />
      </div>

      {guideOpen && <GuideModal guide={currentGuide} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
