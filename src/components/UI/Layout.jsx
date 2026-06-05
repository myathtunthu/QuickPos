import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from '../BottomNav';
import { Menu, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();

  return (
    <div className="flex h-screen w-screen bg-[#080c14] overflow-hidden">
      <div className="hidden md:block w-64 h-full flex-shrink-0">
        <Sidebar />
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
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
        <header className="flex md:hidden items-center justify-between px-3 py-2 bg-[#0d1120] border-b border-cyan-500/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.png"
              alt="NexPOS Logo"
              className="w-9 h-9 object-contain rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />

            <div className="leading-tight min-w-0">
              <h1 className="text-base font-black text-cyan-400 tracking-wider truncate">
                NexPOS
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Retail System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-black"
            >
              {language === 'mm' ? 'MM' : 'EN'}
            </button>

            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="text-slate-400 hover:text-white p-2"
            >
              <Menu size={22} />
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
