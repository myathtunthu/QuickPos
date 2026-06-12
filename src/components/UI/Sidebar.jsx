import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
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

export default function Sidebar({ collapsed = false, onToggleCollapse, onCloseMobile }) {
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
      <div className="relative flex min-h-[56px] items-center justify-end px-3 pt-3">
        {typeof onToggleCollapse === 'function' && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute -right-4 top-5 z-20 hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-200 shadow-xl shadow-black/20 transition hover:border-cyan-300/30 hover:bg-slate-800 hover:text-cyan-100 active:scale-95 md:inline-flex"
            aria-label={collapsed ? t('expandSidebar', 'Expand sidebar') : t('collapseSidebar', 'Collapse sidebar')}
            title={collapsed ? t('expandSidebar', 'Expand sidebar') : t('collapseSidebar', 'Collapse sidebar')}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

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
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`group relative flex min-h-[48px] items-center overflow-hidden rounded-2xl py-3 transition-all duration-200 active:scale-[0.99] ${collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'} ${
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
                  {!collapsed && <span className="truncate text-sm font-black">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`border-t border-white/10 bg-slate-950/70 safe-bottom-padding ${collapsed ? 'p-3' : 'p-4'}`}> 
        <div className={`mb-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-inner">
              <span className="text-sm font-black">
                {userData?.username?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{userData?.username || 'User'}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400">
                  {isAdmin ? t('roleAdmin') : t('roleStaff')}
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className={`flex min-h-[46px] w-full items-center justify-center rounded-2xl border ${collapsed ? 'gap-0 px-2' : 'gap-2 px-4'} border-rose-400/25 bg-rose-500/10 py-2.5 font-black text-rose-200 transition hover:bg-rose-500/20 active:scale-95`}
        >
          <LogOut size={17} />
          {!collapsed && <span>{t('logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
