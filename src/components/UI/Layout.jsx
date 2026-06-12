import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { HelpCircle, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import BottomNav from '../BottomNav';
import Sidebar from './Sidebar';
import GuideModal from './GuideModal';
import { useLanguage } from '../../context/LanguageContext';
import { getGuideConfig, getGuidePageKey } from './pageGuides';

export default function Layout() {
  const location = useLocation();
  const { languageLabel, toggleLanguage, t } = useLanguage();
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const currentGuide = useMemo(() => {
    const pageKey = getGuidePageKey(location.pathname);
    return getGuideConfig(t, pageKey);
  }, [location.pathname, t]);

  const toggleDesktopSidebar = () => setSidebarCollapsed((value) => !value);
  const openMobileSidebar = () => setMobileSidebarOpen(true);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <div className="app-shell-bg flex h-screen w-screen overflow-hidden text-slate-100">
      <div
        className={`sidebar-shell relative z-40 hidden h-full flex-shrink-0 overflow-visible transition-[width] duration-300 ease-out md:block ${
          sidebarCollapsed ? 'w-[88px]' : 'w-[280px]'
        }`}
      >
        <Sidebar collapsed={sidebarCollapsed} />

        <button
          type="button"
          onClick={toggleDesktopSidebar}
          className="sidebar-collapse-control absolute right-0 top-5 z-[90] flex h-10 w-10 translate-x-1/2 items-center justify-center rounded-full border border-cyan-300/25 bg-slate-900 text-cyan-100 shadow-2xl shadow-black/40 ring-4 ring-slate-950/70 transition hover:border-cyan-200/50 hover:bg-slate-800 active:scale-95"
          aria-label={sidebarCollapsed ? t('expandSidebar', 'Expand sidebar') : t('collapseSidebar', 'Collapse sidebar')}
          title={sidebarCollapsed ? t('expandSidebar', 'Expand sidebar') : t('collapseSidebar', 'Collapse sidebar')}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[120] flex md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t('closeSidebar', 'Close sidebar')}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            onClick={closeMobileSidebar}
          />

          <div className="relative z-[121] h-full w-[286px] max-w-[84vw] animate-slide-in overflow-visible shadow-2xl shadow-black/60">
            <Sidebar collapsed={false} onCloseMobile={closeMobileSidebar} />
            <button
              type="button"
              onClick={closeMobileSidebar}
              aria-label={t('closeSidebar', 'Close sidebar')}
              className="absolute right-3 top-3 z-[122] flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/90 text-slate-100 shadow-lg transition active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-[72px] flex-shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/70 px-3 shadow-lg shadow-black/10 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={openMobileSidebar}
              className="mobile-sidebar-open-control inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-100 shadow-lg shadow-cyan-950/25 transition active:scale-95 md:hidden"
              aria-label={t('openSidebar', 'Open sidebar')}
              title={t('openSidebar', 'Open sidebar')}
            >
              <Menu size={23} />
            </button>

            <div className="header-logo-full flex h-12 min-w-0 items-center overflow-hidden">
              <img
                src="/logo.png"
                alt="NexPOS"
                className="h-12 w-auto max-w-[170px] object-contain sm:max-w-[210px]"
              />
            </div>
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

      {guideOpen && currentGuide && <GuideModal guide={currentGuide} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
