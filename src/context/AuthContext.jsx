import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import logger from '../utils/logger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('pos_staff_session');
    localStorage.removeItem('pos_remembered_user');
    localStorage.removeItem('pos_remember_username');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        if (!firebaseUser) {
          clearAuthState();
          setLoading(false);
          return;
        }

        await firebaseUser.getIdToken(true);

        const userSnap = await getDoc(doc(db, 'pos_users', firebaseUser.uid));

        if (!userSnap.exists()) {
          logger.warn('Login blocked: profile not found', firebaseUser.uid);
          await signOut(auth);
          clearAuthState();
          return;
        }

        const userData = {
          id: userSnap.id,
          ...userSnap.data(),
        };

        if (userData.active === false || !userData.role || !userData.tenantId) {
          logger.warn('Login blocked: invalid profile', firebaseUser.email);
          await signOut(auth);
          clearAuthState();
          return;
        }

        setUser(firebaseUser);
        setProfile(userData);
      } catch (error) {
        logger.error('Auth error:', error);
        await signOut(auth).catch(() => {});
        clearAuthState();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('Email and password are required');
    }

    return signInWithEmailAndPassword(auth, cleanEmail, password);
  };

  const logout = async () => {
    clearAuthState();
    await signOut(auth).catch(() => {});
    window.location.replace('/login');
  };

  const hasPermission = (permission) => {
    if (!profile) return false;
    if (profile.role === 'admin' || profile.role === 'owner') return true;
    return Array.isArray(profile.permissions)
      ? profile.permissions.includes(permission)
      : false;
  };

  const isAdmin = () => {
    return profile?.role === 'admin' || profile?.role === 'owner';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        userData: profile,
        loading,
        login,
        logout,
        hasPermission,
        isAdmin,
        tenantId: profile?.tenantId || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
