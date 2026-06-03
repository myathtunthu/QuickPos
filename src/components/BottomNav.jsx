import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, PauseCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// 🌟 Menu များနှင့် သက်ဆိုင်ရာ Permission များကို ချိတ်ဆက်ထားပါသည်
const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dash', perm: 'view_reports' },
  { path: '/entry', icon: ShoppingCart, label: 'Entry', perm: 'create_sale' },
  { path: '/drafts', icon: PauseCircle, label: 'Hold', perm: 'create_sale' }, // 🌟 အသစ်
  { path: '/inventory', icon: Package, label: 'Stock', perm: 'view_inventory' },
  { path: '/customers', icon: Users, label: 'People', perm: 'accept_payment' }, // 🌟 လွယ်ကူစေရန် Customer သို့ ချိတ်ထားသည်
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth(); // 🌟 Permission စစ်ဆေးရန်

  return (
    <nav 
      className="fixed bottom-0 left-0 w-full bg-[#0d1120]/95 backdrop-blur border-t-2 border-cyan-500/10 z-40"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
    >
      <div className="flex justify-around items-end px-1 pt-1 pb-1 max-w-6xl mx-auto">
        {navItems.map(item => {
          // 🌟 Permission မရှိပါက ဤခလုတ်ကို ဖျောက်ထားမည် (null ပြန်ပေးမည်)
          if (item.perm && !hasPermission(item.perm)) {
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
