import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut, FileText, Truck, PauseCircle, Globe
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; 
import { useLanguage } from '../../context/LanguageContext'; // 🌟 Language Context ကို ခေါ်ယူခြင်း

export default function Sidebar({ onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, logout, hasPermission } = useAuth();
  
  // 🌟 ဘာသာပြန်သည့် t function နှင့် ပြောင်းသည့် toggleLanguage ကို ယူပါသည်
  const { language, toggleLanguage, t } = useLanguage(); 

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  // 🌟 Menu Label များကို t('...') ဖြင့် ဘာသာပြန်ပေးထားပါသည်
  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('dashboard'), perm: 'view_reports' },
    { path: '/entry', icon: ShoppingCart, label: t('posEntry'), perm: 'create_sale' },
    { path: '/drafts', icon: PauseCircle, label: t('holdInvoices'), perm: 'create_sale' },
    { path: '/inventory', icon: Package, label: t('inventory'), perm: 'view_inventory' },
    { path: '/customers', icon: Users, label: t('customers'), perm: 'view_customers' },
    { path: '/suppliers', icon: Truck, label: t('suppliers'), perm: 'view_suppliers' },
    { path: '/records', icon: FileText, label: t('records'), perm: 'view_sales' },
    { path: '/admin', icon: Users, label: t('admin'), adminOnly: true },
    { path: '/settings', icon: Settings, label: t('settings'), perm: 'settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => {
            if (item.adminOnly && userData?.role !== 'admin') return null;
            if (item.perm && !hasPermission(item.perm)) return null;

            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link to={item.path} onClick={onCloseMobile}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]' : 'text-slate-400 hover:bg-gray-800 hover:text-white'}`}>
                  <item.icon size={20} />
                  <span className="font-bold">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile, Language Toggle & Logout */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50 space-y-3">
        
        {/* 🌟 Language Switcher Button */}
        <button 
          onClick={toggleLanguage} 
          className="w-full flex items-center justify-center space-x-2 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors font-bold border border-indigo-500/20 active:scale-95"
        >
          <Globe size={16} />
          <span>{language === 'mm' ? 'Switch to English' : 'မြန်မာစာသို့ ပြောင်းမည်'}</span>
        </button>

        <div className="flex items-center space-x-3 px-2 pt-1">
          <div className="w-10 h-10 rounded-full bg-cyan-900 flex items-center justify-center border border-cyan-500/30 shrink-0">
            <span className="text-sm font-black text-cyan-400">{userData?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{userData?.username || 'User'}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {userData?.role === 'admin' ? t('roleAdmin') : t('roleStaff')}
            </p>
          </div>
        </div>

        <button onClick={handleLogout} className="flex items-center justify-center space-x-2 w-full py-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-colors font-bold border border-rose-500/20 active:scale-95">
          <LogOut size={16} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  );
}
