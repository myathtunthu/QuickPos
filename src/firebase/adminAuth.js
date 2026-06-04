import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { secondaryAuth } from './config';

export function usernameToEmail(username) {
  const value = String(username || '').trim().toLowerCase();

  if (!value) {
    throw new Error('Username or email is required');
  }

  return value.includes('@') ? value : `${value}@gmail.com`;
}

export async function createStaffAuthUser({ username, password, displayName }) {
  const email = usernameToEmail(username);

  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );

  if (displayName) {
    await updateProfile(credential.user, {
      displayName,
    });
  }

  await signOut(secondaryAuth).catch(() => {});

  return {
    uid: credential.user.uid,
    email: credential.user.email,
  };
}
