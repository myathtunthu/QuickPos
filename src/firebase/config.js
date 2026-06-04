import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'; // 🌟 enableIndexedDbPersistence ကို ထပ်ခေါ်ထားပါသည်
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// 🌟 Offline Mode (အင်တာနက်မရှိချိန် အသုံးပြုနိုင်ရန်) ကို ဖွင့်ထားခြင်း
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // 💡 အကယ်၍ Tab (သို့) Window များစွာ ပြိုင်တူဖွင့်ထားပါက ပထမဆုံး Tab တွင်သာ Offline စနစ် အလုပ်လုပ်ပါမည်
    console.warn("Offline persistence only works in one tab at a time.");
  } else if (err.code === 'unimplemented') {
    // 💡 Browser အဟောင်းများဖြစ်၍ Offline စနစ်ကို လက်မခံနိုင်ပါက
    console.warn("Browser doesn't support offline persistence.");
  }
});
