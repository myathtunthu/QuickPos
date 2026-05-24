import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// 🔥 QuickPOS - Firebase Config (posify-9da39)
const firebaseConfig = {
  apiKey: "AIzaSyDA9pH289l016fOwDL02C89r0Nm8ir9px0",
  authDomain: "posify-9da39.firebaseapp.com",
  projectId: "posify-9da39",
  storageBucket: "posify-9da39.firebasestorage.app",
  messagingSenderId: "1018270993805",
  appId: "1:1018270993805:web:80bc741c8f22d547c881c4",
  measurementId: "G-P9VQNRJHDZ"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
