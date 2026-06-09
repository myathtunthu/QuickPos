import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, secondaryAuth } from './config';

const ALLOWED_ROLES = new Set(['staff', 'manager', 'admin']);
const MIN_PASSWORD_LENGTH = 8;

const normalizeText = (value) => String(value || '').trim();

const normalizeEmail = (email) => normalizeText(email).toLowerCase();

const assertValidEmail = (email) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address');
  }
};

const assertValidPassword = (password) => {
  if (String(password || '').length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
};

const assertValidTenant = (tenantId) => {
  if (!normalizeText(tenantId)) {
    throw new Error('Tenant ID is required');
  }
};

/**
 * Creates a tenant user through the secondary Firebase Auth instance so the
 * currently signed-in admin session is not replaced by the newly created user.
 */
export const registerTenantUser = async (
  email,
  password,
  name,
  tenantId,
  role = 'staff'
) => {
  const safeEmail = normalizeEmail(email);
  const safeName = normalizeText(name);
  const safeTenantId = normalizeText(tenantId);
  const safeRole = ALLOWED_ROLES.has(role) ? role : 'staff';

  assertValidEmail(safeEmail);
  assertValidPassword(password);
  assertValidTenant(safeTenantId);

  if (!safeName) {
    throw new Error('Name is required');
  }

  const userCredential = await createUserWithEmailAndPassword(
    secondaryAuth,
    safeEmail,
    password
  );
  const { user } = userCredential;

  try {
    await updateProfile(user, { displayName: safeName });

    await setDoc(doc(db, 'pos_users', user.uid), {
      email: user.email,
      name: safeName,
      tenantId: safeTenantId,
      role: safeRole,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return user;
  } finally {
    await signOut(secondaryAuth).catch((error) => {
      console.warn('[Auth] Secondary auth sign-out failed after tenant user creation.', error);
    });
  }
};

export const resetUserPassword = async (email) => {
  const safeEmail = normalizeEmail(email);
  assertValidEmail(safeEmail);
  return sendPasswordResetEmail(auth, safeEmail);
};
