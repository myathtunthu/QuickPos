import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from '../BottomNav';
import { Menu, X } from 'lucide-react';

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-[#080c14] overflow-hidden">
      
      {/* ─── DESKTOP SIDEBAR ─── */}
      <div className="hidden md:block w-64 h-full flex-shrink-0">
        <Sidebar />
      </div>

      {/* ─── MOBILE SIDEBAR (Drawer) ─── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <div className="relative flex flex-col w-64 h-full bg-gray-950 animate-slide-in">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setIsMobileOpen(false)} className="text-slate-400 hover:text-white p-2">
                <X size={24} />
              </button>
            </div>
            <Sidebar onCloseMobile={() => setIsMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Mobile Top Header */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 bg-[#0d1120] border-b border-cyan-500/10 flex-shrink-0">
          <h1 className="text-lg font-black text-cyan-400 tracking-wider">QuickPOS</h1>
          <button onClick={() => setIsMobileOpen(true)} className="text-slate-400 hover:text-white p-2">
            <Menu size={24} />
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
        
      </div>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
