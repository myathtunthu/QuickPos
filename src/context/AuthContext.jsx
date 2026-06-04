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

        const userRef = doc(db, 'pos_users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          logger.warn('Login blocked: user profile not found', firebaseUser.uid);
          await signOut(auth);
          clearAuthState();
          setLoading(false);
          return;
        }

        const userData = {
          id: userSnap.id,
          ...userSnap.data(),
        };

        if (userData.active === false) {
          logger.warn('Login blocked: inactive account', firebaseUser.email);
          await signOut(auth);
          clearAuthState();
          setLoading(false);
          return;
        }

        if (!userData.role) {
          logger.warn('Login blocked: missing role', firebaseUser.email);
          await signOut(auth);
          clearAuthState();
          setLoading(false);
          return;
        }

        if (!userData.tenantId) {
          logger.warn('Login blocked: missing tenantId', firebaseUser.email);
          await signOut(auth);
          clearAuthState();
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        setProfile(userData);

        logger.log(
          'Profile loaded successfully',
          userData.email || userData.username || firebaseUser.email
        );
      } catch (error) {
        logger.error('Auth state change error:', error);
        await signOut(auth).catch(() => {});
        clearAuthState();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      logger.log('User logged in successfully', cleanEmail);
      return userCredential;
    } catch (error) {
      logger.error('Login failed', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      clearAuthState();

      if (auth.currentUser) {
        await signOut(auth);
      }

      window.location.replace('/login');
    } catch (error) {
      logger.error('Logout failed', error);
      clearAuthState();
      window.location.replace('/login');
    }
  };

  const hasPermission = (permission) => {
    if (!profile) return false;
    if (profile.role === 'admin' || profile.role === 'owner') return true;

    const permissions = Array.isArray(profile.permissions)
      ? profile.permissions
      : [];

    return permissions.includes(permission);
  };

  const isAdmin = () => {
    return profile?.role === 'admin' || profile?.role === 'owner';
  };

  const value = {
    user,
    profile,
    userData: profile,
    loading,
    login,
    logout,
    hasPermission,
    isAdmin,
    tenantId: profile?.tenantId || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
