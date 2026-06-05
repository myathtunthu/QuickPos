import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from '../BottomNav';
import { Menu, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { languageLabel, toggleLanguage } = useLanguage();

  return (
    <div className="flex h-screen w-screen bg-[#080c14] overflow-hidden">
      <div className="hidden md:block w-64 h-full flex-shrink-0">
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
        <header className="flex md:hidden items-center justify-between px-4 py-3 bg-[#0d1120] border-b border-cyan-500/10 flex-shrink-0">
          <img
            src="/logo.png"
            alt="NexPOS"
            className="h-12 w-auto max-w-[200px] object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-sm font-black"
            >
              {languageLabel}
            </button>

            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="text-slate-400 hover:text-white p-2"
            >
              <Menu size={26} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
