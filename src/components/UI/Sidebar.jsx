import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  LogOut,
  FileText,
  BarChart3,
  Truck,
  PauseCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Sidebar({ onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();

  const { userData, logout, hasPermission } = useAuth();
  const { t } = useLanguage();

  const isAdmin = userData?.role === 'admin' || userData?.role === 'owner';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout Error', error);
    }
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('dashboard'), perm: 'view_reports' },
    { path: '/entry', icon: ShoppingCart, label: t('posEntry'), perm: 'create_sale' },
    { path: '/drafts', icon: PauseCircle, label: t('holdInvoices'), perm: 'create_sale' },
    { path: '/inventory', icon: Package, label: t('inventory'), perm: 'view_inventory' },
    { path: '/customers', icon: Users, label: t('customers'), perm: 'view_customers' },
    { path: '/suppliers', icon: Truck, label: t('suppliers'), perm: 'view_suppliers' },
    { path: '/records', icon: FileText, label: t('records'), perm: 'view_sales' },
    { path: '/reports', icon: BarChart3, label: t('reports', 'Reports'), perm: 'view_reports' },
    { path: '/admin', icon: Users, label: t('admin'), adminOnly: true },
    { path: '/settings', icon: Settings, label: t('settings'), adminOnly: true },
  ];

  return (
    <aside className="flex flex-col h-full bg-gray-950 border-r border-cyan-500/10">
      <div className="p-5 border-b border-gray-800">
        <img
          src="/logo.png"
          alt="NexPOS"
          className="h-16 w-auto max-w-[180px] mx-auto object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            if (item.perm && !hasPermission(item.perm)) return null;

            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-bold">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-800 bg-gray-900/50 space-y-3">
        <div className="flex items-center space-x-3 px-2 pt-1">
          <div className="w-10 h-10 rounded-full bg-cyan-900 flex items-center justify-center border border-cyan-500/30 shrink-0">
            <span className="text-sm font-black text-cyan-400">
              {userData?.username?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>

          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">
              {userData?.username || 'User'}
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {isAdmin ? t('roleAdmin') : t('roleStaff')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center justify-center space-x-2 w-full py-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-colors font-bold border border-rose-500/20 active:scale-95"
        >
          <LogOut size={16} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
