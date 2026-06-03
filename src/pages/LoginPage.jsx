import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MonitorPlay, Eye, EyeOff } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

// 🌟 AdminPage တွင် သုံးထားသော Hash နှင့် အတိအကျတူညီရပါမည်။
const simpleHash = str => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'h_' + h.toString(16).padStart(8, '0');
};

export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Admin (Firebase Auth) သို့မဟုတ် Staff (Local Storage Session) ရှိနေပါက Dashboard သို့သွားမည်
    const staffSession = localStorage.getItem('pos_staff_session');
    if ((user && profile) || staffSession) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      const input = usernameOrEmail.trim();

      if (input.includes('@')) {
        // 🌟 အခြေအနေ ၁ - Admin ဝင်ရောက်ခြင်း (Email ပါဝင်ပါက)
        // AuthContext ၏ ပုံမှန် Firebase Login ကို အသုံးပြုမည်
        await login(input, password);
      } else {
        // 🌟 အခြေအနေ ၂ - Staff ဝင်ရောက်ခြင်း (Username ဖြင့်သာ)
        const q = query(collection(db, 'pos_users'), where('username', '==', input));
        const snap = await getDocs(q);

        if (snap.empty) {
          throw { code: 'auth/user-not-found' }; // Error code တူညီစေရန်
        }

        const staffData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        
        // Password ကို Hash လုပ်ပြီး တိုက်စစ်မည်
        if (staffData.password !== simpleHash(password)) {
          throw { code: 'auth/wrong-password' };
        }

        // Staff အတွက် Session ကို သိမ်းပြီး Dashboard သို့ ဝင်မည်
        localStorage.setItem('pos_staff_session', JSON.stringify(staffData));
        window.location.href = '/dashboard'; // App အား Reload လုပ်ပေးရန် (AuthContext မှ သိရှိစေရန်)
      }
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErr('Username/Email သို့မဟုတ် Password မှားနေပါသည်!');
      } else if (error.code === 'auth/invalid-email') {
        setErr('Email ပုံစံမှားနေပါသည်!');
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
          <p className="text-sm font-bold text-rose-400 bg-rose-500/10 border-2 border-rose-500/20 p-4 rounded-xl mb-8 text-center">
            {err}
          </p>
        )}
        
        <form onSubmit={handleLogin} className="space-y-6">
          {/* 🌟 Email အစား text ပြောင်းထားပြီး Username ပါ ဝင်ခွင့်ပြုထားသည် */}
          <input 
            required 
            type="text"
            value={usernameOrEmail} 
            onChange={e => setUsernameOrEmail(e.target.value)} 
            placeholder="Email သို့မဟုတ် Username" 
            className="w-full px-6 py-5 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400"
          />
          <div className="relative">
            <input 
              required 
              type={show ? 'text' : 'password'} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password" 
              className="w-full px-6 py-5 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl pr-16 outline-none focus:border-cyan-400"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-6 top-5 text-slate-500 hover:text-cyan-400">
              {show ? <EyeOff size={28}/> : <Eye size={28}/>}
            </button>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-5 rounded-xl text-xl transition-all active:scale-95 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? 'ဝင်ရောက်နေသည်...' : 'Login ဝင်မည်'}
          </button>
        </form>
      </div>
    </div>
  );
}
