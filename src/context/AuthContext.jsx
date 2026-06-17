import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import logger from '../utils/logger';

const AuthContext = createContext(null);

const ADMIN_ROLES = new Set(['admin', 'owner']);
const SUPER_ADMIN_ROLES = new Set(['superadmin', 'super_admin']);
const SESSION_STORAGE_KEYS = [
  'pos_staff_session',
  'pos_remembered_user',
  'pos_remember_username',
];

const safeLocalStorage = {
  removeItem: (key) => {
    try {
      window.localStorage?.removeItem(key);
    } catch (error) {
      logger.warn('Unable to remove local storage key:', { key, error });
    }
  },
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeEmail = (email) => normalizeText(email).toLowerCase();

const normalizeRole = (role) => normalizeText(role).toLowerCase();

const isPrivilegedAdminRole = (role) => ADMIN_ROLES.has(normalizeRole(role));

const isSuperAdminRole = (role) => SUPER_ADMIN_ROLES.has(normalizeRole(role));


const normalizeExpiryDate = (value) => {
  if (!value) return null;

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const clean = value.trim();
    if (!clean) return null;
    const date = clean.length <= 10 ? new Date(`${clean}T23:59:59.999`) : new Date(clean);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const isExpiredProfile = (profile = {}) => {
  if (isSuperAdminRole(profile.role)) return false;

  const expiry = normalizeExpiryDate(profile.expiryAt || profile.expiryDate);
  if (!expiry) return false;

  return expiry.getTime() < Date.now();
};

const isActiveProfile = (profile = {}) => {
  if (profile.active === false || profile.disabled === true) return false;
  if (typeof profile.status === 'string' && normalizeRole(profile.status) !== 'active') return false;
  return true;
};

const clearSessionStorage = () => {
  SESSION_STORAGE_KEYS.forEach((key) => safeLocalStorage.removeItem(key));
};

const buildProfile = (snapshot) => {
  if (!snapshot?.exists?.()) return null;

  const data = snapshot.data() || {};
  const role = normalizeRole(data.role);

  return {
    id: snapshot.id,
    ...data,
    role,
    tenantId: normalizeText(data.tenantId),
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    clearSessionStorage();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;
      setLoading(true);

      try {
        if (!firebaseUser) {
          clearAuthState();
          return;
        }

        const userSnap = await getDoc(doc(db, 'pos_users', firebaseUser.uid));
        const userProfile = buildProfile(userSnap);

        if (!userProfile) {
          logger.warn('Login blocked: profile not found', firebaseUser.uid);
          await signOut(auth);
          clearAuthState();
          return;
        }

        const isSuperAdmin = isSuperAdminRole(userProfile.role);

        if (!isActiveProfile(userProfile) || isExpiredProfile(userProfile) || !userProfile.role || (!isSuperAdmin && !userProfile.tenantId)) {
          logger.warn('Login blocked: invalid or inactive profile', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: userProfile.role,
            hasTenantId: Boolean(userProfile.tenantId),
            expired: isExpiredProfile(userProfile),
          });
          await signOut(auth);
          clearAuthState();
          return;
        }

        if (!isMounted) return;
        setUser(firebaseUser);
        setProfile(userProfile);
      } catch (error) {
        logger.error('Auth error:', error);
        await signOut(auth).catch(() => {});
        clearAuthState();
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [clearAuthState]);

  const login = useCallback(async (email, password) => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      throw new Error('Email and password are required');
    }

    return signInWithEmailAndPassword(auth, cleanEmail, password);
  }, []);

  const logout = useCallback(async () => {
    clearAuthState();
    await signOut(auth).catch((error) => {
      logger.warn('Sign out failed:', error);
    });

    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }, [clearAuthState]);

  const hasPermission = useCallback((permission) => {
    if (!profile || !permission) return false;
    if (isPrivilegedAdminRole(profile.role) || isSuperAdminRole(profile.role)) return true;

    return Array.isArray(profile.permissions) && profile.permissions.includes(permission);
  }, [profile]);

  const isAdmin = useCallback(() => {
    return Boolean(profile && (isPrivilegedAdminRole(profile.role) || isSuperAdminRole(profile.role)));
  }, [profile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      userData: profile,
      loading,
      login,
      logout,
      hasPermission,
      isAdmin,
      tenantId: profile?.tenantId || null,
    }),
    [user, profile, loading, login, logout, hasPermission, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
