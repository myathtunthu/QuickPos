import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { HelpCircle, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import BottomNav from '../BottomNav';
import Sidebar from './Sidebar';
import GuideModal from './GuideModal';
import { useLanguage } from '../../context/LanguageContext';
import { getPageGuide } from '../../utils/pageGuides';

const getPageTitleKey = (pathname) => {
  const first = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  const map = {
    dashboard: 'dashboard',
    entry: 'posEntry',
    drafts: 'holdInvoices',
    inventory: 'inventory',
    customers: 'customers',
    suppliers: 'suppliers',
    records: 'records',
    reports: 'reports',
    ledger: 'ledger',
    admin: 'admin',
    settings: 'settings',
  };
  return map[first] || 'dashboard';
};

export default function Layout() {
  const location = useLocation();
  const { language, languageLabel, toggleLanguage, t } = useLanguage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('nexpos_desktop_sidebar_open');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const currentGuide = useMemo(
    () => getPageGuide(location.pathname, t, language),
    [language, location.pathname, t]
  );

  const pageTitle = t(getPageTitleKey(location.pathname));

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem('nexpos_desktop_sidebar_open', String(sidebarOpen));
    } catch {
      // localStorage may be unavailable in private mode; UI should still work.
    }
  }, [sidebarOpen]);

  return (
    <div className="app-shell-bg flex h-screen w-screen overflow-hidden text-slate-100">
      <div
        className={`hidden md:block h-full flex-shrink-0 transition-[width] duration-300 ease-out ${
          sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'
        }`}
      >
        <Sidebar />
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label={t('closeMenu', 'Close menu')}
            className="fixed inset-0 bg-slate-950/72 backdrop-blur-md"
            onClick={() => setIsMobileOpen(false)}
          />

          <div className="relative flex h-full w-[86vw] max-w-[320px] flex-col animate-slide-in border-r border-cyan-400/20 bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label={t('close', 'Close')}
            >
              <X size={22} />
            </button>

            <Sidebar onCloseMobile={() => setIsMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-[72px] flex-shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/70 px-3 shadow-lg shadow-black/10 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileOpen(true);
                } else {
                  setSidebarOpen((prev) => !prev);
                }
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/20 active:scale-95"
              aria-label={t('toggleNavigation', 'Toggle navigation')}
            >
              <span className="md:hidden">
                <Menu size={23} />
              </span>
              <span className="hidden md:inline">
                {sidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
              </span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="NexPOS"
                  className="hidden h-10 w-auto max-w-[150px] object-contain sm:block"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="hidden h-7 w-px bg-white/10 sm:block" />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/80">NexPOS</p>
                  <h1 className="truncate text-base font-black text-white sm:text-lg">{pageTitle}</h1>
                </div>
              </div>
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

      {guideOpen && <GuideModal guide={currentGuide} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
