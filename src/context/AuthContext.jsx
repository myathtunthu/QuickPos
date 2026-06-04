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
          // 🌟 ၁။ Firebase Auth ဖြင့် အောင်မြင်စွာ ဝင်ထားမှသာ လက်ခံမည် (Local Storage လုံးဝ မသုံးတော့ပါ)
          setUser(firebaseUser);
          
          await firebaseUser.getIdToken(true);

          // 🌟 ၂။ Firebase Auth ရဲ့ UID ဖြင့် Database ထဲမှ User Data ကို လှမ်းဆွဲမည်
          const userSnap = await getDoc(doc(db, 'pos_users', firebaseUser.uid));
          if (userSnap.exists()) {
            const userData = { id: userSnap.id, ...userSnap.data() };
            setProfile(userData);
            logger.log('Profile loaded successfully', userData.email || userData.username);
          } else {
            setProfile(null);
          }
        } else {
          // 🌟 ၃။ တရားဝင် Login ဝင်မထားပါက သေချာစွာ ရှင်းလင်းမည်
          setUser(null);
          setProfile(null);
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
      // Local Storage အဟောင်းများရှိနေသေးလျှင်ပါ တစ်ပါတည်း ရှင်းလင်းမည်
      localStorage.removeItem('pos_staff_session');
      
      setUser(null);
      setProfile(null);

      if (auth.currentUser) {
        await signOut(auth);
      }
      
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
