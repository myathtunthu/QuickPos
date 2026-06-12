import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, FileText, LayoutDashboard, Package, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { t } = useLanguage();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('navDash', 'Dash'), perm: 'view_reports' },
    { path: '/entry', icon: ShoppingCart, label: t('navEntry', 'Entry'), perm: 'create_sale' },
    { path: '/inventory', icon: Package, label: t('navStock', 'Stock'), perm: 'view_inventory' },
    { path: '/records', icon: FileText, label: t('navRecords', 'Records'), perm: 'view_sales' },
    { path: '/reports', icon: BarChart3, label: t('navReports', 'Reports'), perm: 'view_reports' },
  ];

  const visibleItems = navItems.filter((item) => !item.perm || hasPermission(item.perm));

  return (
    <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-white/10 bg-slate-950/84 px-2 pt-2 shadow-2xl backdrop-blur-xl safe-bottom-padding">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-1">
        {visibleItems.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-2xl px-1 py-1.5 transition-all active:scale-95 ${
                active
                  ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.7 : 1.8} />
              <span className="mt-0.5 max-w-full truncate text-[9px] font-black uppercase tracking-wide">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
