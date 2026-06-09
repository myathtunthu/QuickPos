import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  CACHE_SIZE_UNLIMITED,
  enableMultiTabIndexedDbPersistence,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth';

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingEnvKeys = requiredEnvKeys.filter((key) => !import.meta.env[key]);

if (missingEnvKeys.length > 0) {
  console.error(
    `[Firebase] Missing required environment variables: ${missingEnvKeys.join(', ')}`
  );
}

export const firebaseConfig = Object.freeze({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
});

const getOrCreateApp = (name, config) => {
  const existing = getApps().find((firebaseApp) => firebaseApp.name === name);
  return existing || initializeApp(config, name);
};

export const app = getApps().find((firebaseApp) => firebaseApp.name === '[DEFAULT]')
  || initializeApp(firebaseConfig);

export const secondaryApp = getOrCreateApp('Secondary', firebaseConfig);

const getOrCreateFirestore = () => {
  try {
    return initializeFirestore(app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      ignoreUndefinedProperties: true,
    });
  } catch (error) {
    return getFirestore(app);
  }
};

export const db = getOrCreateFirestore();
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[Firebase Auth] Unable to enable local persistence.', error);
});

setPersistence(secondaryAuth, browserLocalPersistence).catch((error) => {
  console.warn('[Firebase Auth] Unable to enable secondary local persistence.', error);
});

enableMultiTabIndexedDbPersistence(db).catch((error) => {
  if (error.code === 'failed-precondition') {
    console.warn('[Firestore] Offline persistence is already active in another tab.');
    return;
  }

  if (error.code === 'unimplemented') {
    console.warn('[Firestore] This browser does not support offline persistence.');
    return;
  }

  console.warn('[Firestore] Offline persistence could not be enabled.', error);
});
