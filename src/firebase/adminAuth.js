import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { firebaseConfig } from './config';

export function usernameToEmail(username) {
  const value = String(username || '').trim().toLowerCase();
  return value.includes('@') ? value : `${value}@gmail.com`;
}

export async function createStaffAuthUser({ username, password, displayName }) {
  const secondaryApp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const email = usernameToEmail(username);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    return {
      uid: credential.user.uid,
      email: credential.user.email,
    };
  } finally {
    await deleteApp(secondaryApp);
  }
}
