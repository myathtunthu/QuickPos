import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut, FileText, Truck, PauseCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; 

export default function Sidebar({ onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  // 🌟 hasPermission အား AuthContext မှ လှမ်းယူပါသည်
  const { userData, logout, hasPermission } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  // 🌟 Menu တစ်ခုချင်းစီကို သက်ဆိုင်ရာ Permission Key များနှင့် တွဲချိတ်ပေးထားပါသည်
  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: 'view_reports' },
    { path: '/entry', icon: ShoppingCart, label: 'POS Entry', perm: 'create_sale' },
    { path: '/drafts', icon: PauseCircle, label: 'Hold Invoices', perm: 'create_sale' },
    { path: '/inventory', icon: Package, label: 'Inventory', perm: 'view_inventory' },
    { path: '/customers', icon: Users, label: 'Customers', perm: 'accept_payment' },
    { path: '/suppliers', icon: Truck, label: 'Suppliers', perm: 'create_purchase' },
    { path: '/records', icon: FileText, label: 'Records', perm: 'view_sales' },
    { path: '/admin', icon: Users, label: 'Admin', adminOnly: true }, // Admin သီးသန့်
    { path: '/settings', icon: Settings, label: 'Settings', perm: 'settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => {
            // ၁။ Admin Only သီးသန့် Menu များအတွက် စစ်ဆေးခြင်း
            if (item.adminOnly && userData?.role !== 'admin') return null;
            
            // ၂။ Staff များအတွက် သက်ဆိုင်ရာ Permission ရှိ/မရှိ စစ်ဆေးခြင်း
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

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50">
        <div className="flex items-center space-x-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-cyan-900 flex items-center justify-center border border-cyan-500/30">
            <span className="text-sm font-black text-cyan-400">{userData?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{userData?.username || 'User'}</p>
            <p className="text-xs text-slate-400 capitalize">{userData?.role || 'Staff'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center justify-center space-x-2 w-full py-3 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-colors font-bold border border-rose-500/20 active:scale-95">
          <LogOut size={18} />
          <span>Logout ထွက်မည်</span>
        </button>
      </div>
    </div>
  );
}
