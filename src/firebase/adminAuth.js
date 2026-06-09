import {
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { secondaryAuth } from './config';

const USERNAME_EMAIL_DOMAIN = 'gmail.com';
const MIN_PASSWORD_LENGTH = 8;

const normalizeText = (value) => String(value || '').trim();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidUsername = (value) => /^[a-z0-9._-]{3,64}$/i.test(value);

export function usernameToEmail(username) {
  const value = normalizeText(username).toLowerCase();

  if (!value) {
    throw new Error('Username or email is required');
  }

  if (value.includes('@')) {
    if (!isValidEmail(value)) {
      throw new Error('Please enter a valid email address');
    }

    return value;
  }

  if (!isValidUsername(value)) {
    throw new Error(
      'Username must be 3-64 characters and can only contain letters, numbers, dots, hyphens, or underscores'
    );
  }

  return `${value}@${USERNAME_EMAIL_DOMAIN}`;
}

const validateStaffPayload = ({ username, password, displayName }) => {
  usernameToEmail(username);

  if (!normalizeText(displayName)) {
    throw new Error('Staff display name is required');
  }

  if (String(password || '').length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
};

export async function createStaffAuthUser({ username, password, displayName }) {
  validateStaffPayload({ username, password, displayName });

  const email = usernameToEmail(username);
  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );

  const safeDisplayName = normalizeText(displayName);

  if (safeDisplayName) {
    await updateProfile(credential.user, {
      displayName: safeDisplayName,
    });
  }

  await signOut(secondaryAuth).catch((error) => {
    console.warn('[Admin Auth] Secondary auth sign-out failed after staff creation.', error);
  });

  return {
    uid: credential.user.uid,
    email: credential.user.email,
    displayName: safeDisplayName,
  };
}
