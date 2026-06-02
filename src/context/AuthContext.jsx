import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import logger from '../utils/logger'; // 🌟 Production-safe logger

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          
          // 🌟 အရေးကြီးသည် - Cloud Function မှပေးသော Custom Claims (tenantId, role) များကို ရယူရန် Token အား အတင်း Refresh လုပ်ခြင်း
          await firebaseUser.getIdToken(true);

          const userSnap = await getDoc(doc(db, 'pos_users', firebaseUser.uid));
          if (userSnap.exists()) {
            const userData = { id: userSnap.id, ...userSnap.data() };
            setProfile(userData);
            logger.log('User profile loaded successfully', userData.email);
          } else {
            setProfile(null);
            logger.warn('User profile not found in Firestore', firebaseUser.uid);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        // 🌟 Error ထွက်ခဲ့လျှင် မျက်နှာပြင်ဖြူမသွားစေရန်နှင့် State များ ရှင်းလင်းရန်
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
      throw error; // UI (LoginPage) ဘက်တွင် Alert ပြနိုင်ရန် Error ကို ပြန်ပစ်ပေးသည်
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      logger.log('User logged out');
    } catch (error) {
      logger.error('Logout failed', error);
      throw error;
    }
  };

  // 🌟 မူလ Permission စစ်ဆေးသည့်စနစ်ကို အပြည့်အစုံ ထိန်းသိမ်းထားပါသည်
  const hasPermission = (perm) => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return profile.permissions?.includes(perm) ?? false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      userData: profile, // 🌟 Backward compatibility အတွက် မူလအတိုင်း ထားရှိပါသည်
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
