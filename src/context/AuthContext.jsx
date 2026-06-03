import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import logger from '../utils/logger'; 

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // 🌟 အခြေအနေ ၁ - Firebase Admin Login ဝင်ထားပါက
          setUser(firebaseUser);
          
          await firebaseUser.getIdToken(true);

          const userSnap = await getDoc(doc(db, 'pos_users', firebaseUser.uid));
          if (userSnap.exists()) {
            const userData = { id: userSnap.id, ...userSnap.data() };
            setProfile(userData);
            logger.log('Admin profile loaded successfully', userData.email);
          } else {
            setProfile(null);
          }
        } else {
          // 🌟 အခြေအနေ ၂ - Firebase Admin မဟုတ်ပါက Local Storage မှ Staff ကို ရှာမည်
          const staffSession = localStorage.getItem('pos_staff_session');
          
          if (staffSession) {
            const staffData = JSON.parse(staffSession);
            setUser({ uid: staffData.id, email: staffData.username, isStaff: true });
            setProfile(staffData);
            logger.log('Staff profile loaded successfully', staffData.username);
          } else {
            // လုံးဝ Login မဝင်ထားပါက သေချာစွာ ရှင်းလင်းမည်
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error) {
        logger.error('Auth state change error:', error);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      logger.log('User logged in successfully', email);
      return userCredential;
    } catch (error) {
      logger.error('Login failed', error);
      throw error; 
    }
  };

  const logout = async () => {
    try {
      // ၁။ Local Storage ထဲက Staff မှတ်တမ်းကို အရင်ဆုံး ဖျက်ပစ်ပါမည်
      localStorage.removeItem('pos_staff_session');
      
      // ၂။ App Memory (State) ထဲမှ User Data များကို ချက်ချင်း ရှင်းလင်းပါမည်
      setUser(null);
      setProfile(null);

      // ၃။ Firebase Admin Account ဝင်ထားလျှင် ထွက်ပါမည်
      if (auth.currentUser) {
        await signOut(auth);
      }
      
      // ၄။ အရေးကြီးဆုံး: Login မျက်နှာပြင်သို့ အတင်း (Force) ပြန်ပို့ပြီး App အား အသစ်ပြန်ဖွင့်ပါမည် (Cache ရှင်းစေရန်)
      window.location.href = '/login';
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  };

  const hasPermission = (perm) => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return profile.permissions?.includes(perm) ?? false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      userData: profile, 
      loading, 
      login, 
      logout, 
      hasPermission 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
