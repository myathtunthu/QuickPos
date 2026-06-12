import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  PauseCircle,
  Settings,
  ShoppingCart,
  Truck,
  Users,
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
    { path: '/dashboard', icon: LayoutDashboard, label: t('dashboard'), perm: 'view_reports', accent: 'cyan' },
    { path: '/entry', icon: ShoppingCart, label: t('posEntry'), perm: 'create_sale', accent: 'emerald' },
    { path: '/drafts', icon: PauseCircle, label: t('holdInvoices'), perm: 'create_sale', accent: 'amber' },
    { path: '/inventory', icon: Package, label: t('inventory'), perm: 'view_inventory', accent: 'blue' },
    { path: '/customers', icon: Users, label: t('customers'), perm: 'view_customers', accent: 'violet' },
    { path: '/suppliers', icon: Truck, label: t('suppliers'), perm: 'view_suppliers', accent: 'orange' },
    { path: '/records', icon: FileText, label: t('records'), perm: 'view_sales', accent: 'slate' },
    { path: '/reports', icon: BarChart3, label: t('reports', 'Reports'), perm: 'view_reports', accent: 'cyan' },
    { path: '/admin', icon: Users, label: t('admin'), adminOnly: true, accent: 'rose' },
    { path: '/settings', icon: Settings, label: t('settings'), adminOnly: true, accent: 'slate' },
  ];

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.perm && !hasPermission(item.perm)) return false;
    return true;
  });

  return (
    <aside className="flex h-full flex-col border-r border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
      <div className="px-3 pt-6" />

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onCloseMobile}
                  className={`group relative flex min-h-[48px] items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 transition-all duration-200 active:scale-[0.99] ${
                    isActive
                      ? 'border border-cyan-400/30 bg-cyan-400/10 text-white shadow-lg shadow-cyan-950/20'
                      : 'border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.055] hover:text-slate-100'
                  }`}
                >
                  {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-cyan-300" />}
                  <span
                    className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition ${
                      isActive
                        ? 'border-cyan-300/30 bg-cyan-300/20 text-cyan-200'
                        : 'border-white/8 bg-white/[0.04] text-slate-400 group-hover:text-cyan-200'
                    }`}
                  >
                    <Icon size={19} />
                  </span>
                  <span className="truncate text-sm font-black">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 bg-slate-950/70 p-4 safe-bottom-padding">
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-inner">
              <span className="text-sm font-black">
                {userData?.username?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{userData?.username || 'User'}</p>
              <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400">
                {isAdmin ? t('roleAdmin') : t('roleStaff')}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 font-black text-rose-200 transition hover:bg-rose-500/20 active:scale-95"
        >
          <LogOut size={17} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
