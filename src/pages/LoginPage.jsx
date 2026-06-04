import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MonitorPlay, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';

export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, user, profile } = useAuth();
  const navigate = useNavigate();

  // 🌟 (၁) Login Page စပွင့်တာနဲ့ မှတ်ထားတဲ့ Username/Password ရှိရင် အလိုအလျောက် ဖြည့်ပေးမည်
  useEffect(() => {
    const savedCreds = localStorage.getItem('pos_saved_creds');
    if (savedCreds) {
      try {
        const parsed = JSON.parse(savedCreds);
        if (parsed.u && parsed.p) {
          setUsernameOrEmail(parsed.u);
          setPassword(atob(parsed.p)); // Base64 မှ ပြန်ပြောင်းယူသည်
          setRememberMe(true);
        }
      } catch (e) {
        console.error('Failed to parse saved credentials');
      }
    }
  }, []);

  // 🌟 (၂) Login ဝင်ထားပြီးသားဆိုလျှင် သက်ဆိုင်ရာ Dashboard (သို့) အခြား Page သို့ ပို့ပေးမည်
  useEffect(() => {
    if (user && profile) {
      let target = '/dashboard';
      if (profile.role !== 'admin' && !(profile.permissions || []).includes('view_reports')) {
         const p = profile.permissions || [];
         if (p.includes('create_sale')) target = '/entry';
         else if (p.includes('view_inventory')) target = '/inventory';
         else if (p.includes('accept_payment')) target = '/customers';
         else target = '/entry';
      }
      navigate(target, { replace: true });
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      const input = usernameOrEmail.trim().toLowerCase();
      
      // 🌟 Smart Login: @ မပါခဲ့လျှင် @gmail.com ကို အလိုအလျောက် တပ်ပေးမည်
      const authEmail = input.includes('@') ? input : `${input}@gmail.com`;

      // 🌟 (၃) Remember Me ကို အမှန်ခြစ်ထားလျှင် Browser တွင် မှတ်သားထားပေးမည်
      if (rememberMe) {
        localStorage.setItem('pos_saved_creds', JSON.stringify({
          u: usernameOrEmail.trim(), 
          p: btoa(password) // လုံခြုံရေးအတွက် Base64 ဖြင့် ပြောင်း၍ သိမ်းမည်
        }));
      } else {
        localStorage.removeItem('pos_saved_creds'); // အမှန်မခြစ်ထားလျှင် ဖျက်ပစ်မည်
      }

      // 🌟 Firebase Auth ဖြင့်သာ တိုက်ရိုက် လုံခြုံစွာ Login ဝင်မည် (ကိုယ်တိုင် Logout မလုပ်မချင်း အကောင့်မထွက်ပါ)
      await login(authEmail, password);

    } catch (error) {
      console.error("Login Error:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErr('အကောင့်အမည် သို့မဟုတ် Password မှားနေပါသည်!');
      } else if (error.code === 'auth/invalid-email') {
        setErr('အကောင့်အမည် ပုံစံမှားနေပါသည်!');
      } else if (error.code === 'auth/too-many-requests') {
        setErr('အကောင့်ဝင်ရန် ကြိုးစားမှုများလွန်းနေပါသည်။ ခဏစောင့်ပြီး ပြန်ကြိုးစားပါ။');
      } else {
        setErr('Login မအောင်မြင်ပါ: ' + (error.message || 'Unknown Error'));
      }
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
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-gray-900 p-10 sm:p-12 rounded-3xl border-2 border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-lg animate-fade-in">
        <div className="text-center mb-10">
          <MonitorPlay size={64} className="mx-auto text-cyan-500 mb-6"/>
          <h2 className="text-4xl font-black text-white tracking-wider">QuickPos</h2>
          <p className="text-lg text-cyan-400 font-bold mt-3 uppercase tracking-widest">Enterprise POS</p>
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
            onChange={e => setUsernameOrEmail(e.target.value)} 
            placeholder="Email သို့မဟုတ် Username" 
            className="w-full px-6 py-5 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-colors"
          />
          <div className="relative">
            <input 
              required 
              type={show ? 'text' : 'password'} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password" 
              className="w-full px-6 py-5 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl pr-16 outline-none focus:border-cyan-400 transition-colors"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-6 top-5 text-slate-500 hover:text-cyan-400 transition-colors">
              {show ? <EyeOff size={28}/> : <Eye size={28}/>}
            </button>
          </div>

          <div className="flex items-center gap-3 py-1 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
            <div className={`transition-colors ${rememberMe ? 'text-cyan-400' : 'text-slate-500'}`}>
              {rememberMe ? <CheckSquare size={22} /> : <Square size={22} />}
            </div>
            <span className={`font-bold text-sm select-none transition-colors ${rememberMe ? 'text-cyan-100' : 'text-slate-500'}`}>
              မှတ်သားထားမည် (Remember Me)
            </span>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-5 rounded-xl text-xl transition-all active:scale-95 shadow-lg shadow-cyan-500/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'ဝင်ရောက်နေသည်...' : 'Login ဝင်မည်'}
          </button>
        </form>
      </div>
    </div>
  );
}
