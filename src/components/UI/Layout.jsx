import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from '../BottomNav';
import { HelpCircle, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import GuideModal from './GuideModal';
import { getPageGuide } from '../../utils/pageGuides';

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('nexpos_desktop_sidebar_open');
    return saved === null ? true : saved === 'true';
  });

  const { language, languageLabel, toggleLanguage, t } = useLanguage();
  const currentGuide = getPageGuide(location.pathname, t, language);

  useEffect(() => {
    localStorage.setItem('nexpos_desktop_sidebar_open', String(sidebarOpen));
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen w-screen bg-[#080c14] overflow-hidden">
      <div
        className={`hidden md:block h-full flex-shrink-0 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <Sidebar />
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />

          <div className="relative flex flex-col w-64 h-full bg-gray-950 animate-slide-in">
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="text-slate-400 hover:text-white p-2"
              >
                <X size={24} />
              </button>
            </div>

            <Sidebar onCloseMobile={() => setIsMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 bg-[#0d1120] border-b border-cyan-500/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileOpen(true);
                } else {
                  setSidebarOpen((prev) => !prev);
                }
              }}
              className="p-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
            >
              <span className="md:hidden">
                <Menu size={24} />
              </span>

              <span className="hidden md:block">
                {sidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
              </span>
            </button>

            <img
              src="/logo.png"
              alt="NexPOS"
              className="h-12 w-auto max-w-[200px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-sm font-black hover:bg-emerald-500/20 active:scale-95"
              aria-label={t('openGuide', 'Open guide')}
            >
              <HelpCircle size={18} />
              <span className="hidden sm:inline">{t('guide', 'Guide')}</span>
            </button>

            <button
              type="button"
              onClick={toggleLanguage}
              className="px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-sm font-black"
            >
              {languageLabel}
            </button>
          </div>
        </header>

        <main data-app-scroll-container="true" className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 pb-20 md:pb-6 overscroll-contain">
          <Outlet />
        </main>
      </div>

      <div className="md:hidden">
        <BottomNav />
      </div>

      {guideOpen && <GuideModal guide={currentGuide} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
