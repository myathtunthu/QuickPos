import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, FileText, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dash' },
  { path: '/entry', icon: ShoppingCart, label: 'Entry' },
  { path: '/inventory', icon: Package, label: 'Stock' },
  { path: '/ledger', icon: FileText, label: 'Ledger' },
  { path: '/admin', icon: ShieldAlert, label: 'Admin' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  return (
    <nav 
      className="fixed bottom-0 left-0 w-full bg-[#0d1120]/95 backdrop-blur border-t-2 border-cyan-500/10 z-40"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
    >
      <div className="flex justify-around items-end px-1 pt-1 pb-1 max-w-6xl mx-auto">
        {navItems.map(item => {
          if (item.path === '/admin' && !hasPermission('manage_users') && !hasPermission('manage_products') && !hasPermission('manage_inventory')) {
            return null;
          }
          
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-0.5 px-2 rounded-lg transition-all active:scale-95 min-w-[48px] ${
                active 
                  ? 'text-cyan-400 scale-105' 
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <item.icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[9px] font-bold uppercase mt-0.5 tracking-wider ${
                active ? 'text-cyan-400' : 'text-slate-600'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
