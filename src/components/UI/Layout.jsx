import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

export default function Layout({ children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    // h-screen နှင့် overflow-hidden သုံးပြီး မျက်နှာပြင်ကို ပုံသေချုပ်ထားပါသည်
    <div className="flex h-screen w-screen bg-[#080c14] overflow-hidden">
      
      {/* ─── DESKTOP SIDEBAR ─── */}
      <div className="hidden md:block w-64 h-full flex-shrink-0">
        <Sidebar />
      </div>

      {/* ─── MOBILE SIDEBAR (Drawer) ─── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop အရိပ်မည်း */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)}></div>
          
          {/* Drawer Content */}
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
        
        {/* Mobile Top Navbar */}
        <header className="flex md:hidden items-center justify-between px-4 py-4 bg-gray-950 border-b border-cyan-500/10 flex-shrink-0">
          <h1 className="text-xl font-black text-cyan-400 tracking-wider">CyberPOS</h1>
          <button onClick={() => setIsMobileOpen(true)} className="text-slate-400 hover:text-white p-2">
            <Menu size={24} />
          </button>
        </header>

        {/* Dynamic Pages Area (ဒီနေရာက သီးသန့် Scroll ဆွဲလို့ရမည့်နေရာပါ) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
        
      </div>
    </div>
  );
}
