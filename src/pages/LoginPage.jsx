import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  ShoppingCart,
  Package,
  BarChart3,
  Receipt,
  CreditCard,
  ScanBarcode,
} from 'lucide-react';
import { usernameToEmail } from '../firebase/adminAuth';

export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedLoginName = localStorage.getItem('pos_saved_login_name');

    if (savedLoginName) {
      setUsernameOrEmail(savedLoginName);
      setRememberMe(true);
    }

    localStorage.removeItem('pos_saved_creds');
    localStorage.removeItem('pos_staff_session');
  }, []);

  useEffect(() => {
    if (user && profile) {
      let target = '/dashboard';

      if (profile.role !== 'admin' && profile.role !== 'owner') {
        const permissions = profile.permissions || [];

        if (permissions.includes('view_reports')) target = '/dashboard';
        else if (permissions.includes('create_sale')) target = '/entry';
        else if (permissions.includes('view_inventory')) target = '/inventory';
        else if (permissions.includes('accept_payment')) target = '/customers';
        else target = '/entry';
      }

      navigate(target, { replace: true });
    }
  }, [user, profile, navigate]);

  const getLoginErrorMessage = (error) => {
    if (
      error.code === 'auth/invalid-credential' ||
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/wrong-password'
    ) {
      return 'Username or password is incorrect.';
    }

    if (error.code === 'auth/invalid-email') {
      return 'Invalid username or email format.';
    }

    if (error.code === 'auth/too-many-requests') {
      return 'Too many login attempts. Please wait and try again.';
    }

    return `Login failed: ${error.message || 'Unknown Error'}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      const loginName = usernameOrEmail.trim().toLowerCase();
      const authEmail = usernameToEmail(loginName);

      if (rememberMe) {
        localStorage.setItem('pos_saved_login_name', loginName);
      } else {
        localStorage.removeItem('pos_saved_login_name');
      }

      await login(authEmail, password);
    } catch (error) {
      console.error('Login Error:', error);
      setErr(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (user && profile) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#080c14] flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.2),transparent_40%)]" />
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#22d3ee_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[12%] left-[8%] w-56 rounded-2xl bg-white/[0.04] border border-cyan-400/20 p-4 shadow-2xl animate-[float_7s_ease-in-out_infinite]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-cyan-300 font-black text-sm">
              <ShoppingCart size={18} />
              Today Sales
            </div>
            <span className="text-emerald-400 text-xs font-black">+18%</span>
          </div>
          <div className="text-2xl font-black text-white">2,480,000 Ks</div>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-[72%] bg-cyan-400 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="absolute top-[18%] right-[9%] w-52 rounded-2xl bg-white/[0.04] border border-blue-400/20 p-4 shadow-2xl animate-[float_8s_ease-in-out_infinite_1s]">
          <div className="flex items-center gap-2 text-blue-300 font-black text-sm mb-3">
            <Package size={18} />
            Low Stock
          </div>
          <div className="space-y-2">
            <div className="h-2 w-full bg-slate-700 rounded" />
            <div className="h-2 w-[78%] bg-slate-700 rounded" />
            <div className="h-2 w-[45%] bg-rose-400/70 rounded animate-pulse" />
          </div>
        </div>

        <div className="absolute bottom-[14%] left-[10%] w-56 rounded-2xl bg-white/[0.04] border border-emerald-400/20 p-4 shadow-2xl animate-[float_9s_ease-in-out_infinite_0.5s]">
          <div className="flex items-center gap-2 text-emerald-300 font-black text-sm mb-3">
            <BarChart3 size={18} />
            Profit Trend
          </div>
          <div className="flex items-end gap-2 h-20">
            {[35, 55, 42, 75, 60, 88, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-emerald-400/60 rounded-t-md animate-pulse"
                style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="absolute bottom-[18%] right-[12%] w-56 rounded-2xl bg-white/[0.04] border border-cyan-400/20 p-4 shadow-2xl animate-[float_7.5s_ease-in-out_infinite_1.5s]">
          <div className="flex items-center gap-2 text-cyan-300 font-black text-sm mb-3">
            <Receipt size={18} />
            Latest Receipt
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Voucher</span>
              <span>#00082</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Total</span>
              <span>86,500 Ks</span>
            </div>
            <div className="flex justify-between text-emerald-300 font-black">
              <span>Status</span>
              <span>PAID</span>
            </div>
          </div>
        </div>

        <div className="absolute top-[48%] left-[5%] hidden sm:flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-cyan-400/20 px-4 py-3 animate-[float_6s_ease-in-out_infinite_0.8s]">
          <ScanBarcode className="text-cyan-300" size={24} />
          <div>
            <p className="text-white text-xs font-black">Barcode Scan</p>
            <p className="text-slate-500 text-[10px]">Ready</p>
          </div>
        </div>

        <div className="absolute top-[50%] right-[6%] hidden sm:flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-blue-400/20 px-4 py-3 animate-[float_6.5s_ease-in-out_infinite_1.2s]">
          <CreditCard className="text-blue-300" size={24} />
          <div>
            <p className="text-white text-xs font-black">Payments</p>
            <p className="text-slate-500 text-[10px]">Cash • KPay • Wave</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 bg-gray-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl border-2 border-cyan-500/25 shadow-[0_0_60px_rgba(6,182,212,0.22)] w-full max-w-lg animate-fade-in">
        <div className="text-center mb-9">
          <img
            src="/logo.png"
            alt="NexPOS"
            className="h-24 sm:h-28 mx-auto object-contain mb-5"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          <p className="text-sm text-cyan-400 font-black uppercase tracking-[0.3em]">
            Smart Retail System
          </p>
        </div>

        {err && (
          <p className="text-sm font-bold text-rose-400 bg-rose-500/10 border-2 border-rose-500/20 p-4 rounded-xl mb-8 text-center animate-fade-in">
            {err}
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <input
            required
            type="text"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            placeholder="Username or Email"
            className="w-full px-6 py-5 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-colors"
          />

          <div className="relative">
            <input
              required
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-6 py-5 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl pr-16 outline-none focus:border-cyan-400 transition-colors"
            />

            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-6 top-5 text-slate-500 hover:text-cyan-400 transition-colors"
            >
              {show ? <EyeOff size={28} /> : <Eye size={28} />}
            </button>
          </div>

          <div
            className="flex items-center gap-3 py-1 cursor-pointer"
            onClick={() => setRememberMe(!rememberMe)}
          >
            <div className={`transition-colors ${rememberMe ? 'text-cyan-400' : 'text-slate-500'}`}>
              {rememberMe ? <CheckSquare size={22} /> : <Square size={22} />}
            </div>

            <span className={`font-bold text-sm select-none transition-colors ${rememberMe ? 'text-cyan-100' : 'text-slate-500'}`}>
              Remember username/email only
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-5 rounded-xl text-xl transition-all active:scale-95 shadow-lg shadow-cyan-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-16px); }
        }
      `}</style>
    </div>
  );
}
