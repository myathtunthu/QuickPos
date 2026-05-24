import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, BarChart3, Users, Settings, LogOut, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/entry', icon: ShoppingCart, label: 'POS Entry' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/records', icon: FileText, label: 'မှတ်တမ်းများ' }, // 🌟 ထည့်သွင်းထားသော စာမျက်နှာအသစ်
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/admin', icon: Users, label: 'Admin', adminOnly: true },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => {
            if (item.adminOnly && userData?.role !== 'admin') return null;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link to={item.path} onClick={onCloseMobile}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-gray-800 hover:text-white'}`}>
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
        <button onClick={handleLogout} className="flex items-center justify-center space-x-2 w-full py-3 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 transition-colors font-bold border border-rose-500/20">
          <LogOut size={18} />
          <span>Logout ထွက်မည်</span>
        </button>
      </div>
    </div>
  );
}
