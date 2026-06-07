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

  return (
    <nav
      className="fixed bottom-0 left-0 w-full bg-[#0d1120]/95 backdrop-blur border-t-2 border-cyan-500/10 z-40"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
    >
      <div className="flex justify-around items-end px-1 pt-1 pb-1 max-w-6xl mx-auto">
        {navItems.map((item) => {
          if (item.perm && !hasPermission(item.perm)) return null;

          const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-0.5 px-2 rounded-lg transition-all active:scale-95 min-w-[48px] ${
                active ? 'text-cyan-400 scale-105' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[9px] font-bold uppercase mt-0.5 tracking-wider ${active ? 'text-cyan-400' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
