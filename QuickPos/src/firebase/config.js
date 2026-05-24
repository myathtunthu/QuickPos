import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 🌟 Auth ကို Import လုပ်ပါသည်

const firebaseConfig = {
  apiKey: "AIzaSyAb8_JVi4jxnbBwu854XCkuNlm7CDVmLyY",
  authDomain: "posify-d62a1.firebaseapp.com",
  projectId: "posify-d62a1",
  storageBucket: "posify-d62a1.firebasestorage.app",
  messagingSenderId: "508633323720",
  appId: "1:508633323720:web:6ae6bf76e7ce574435edfd",
  measurementId: "G-11HFJJWSXW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Database နှင့် Auth ကို အခြားဖိုင်များမှ လှမ်းသုံးနိုင်ရန် Export လုပ်ပေးခြင်း
export const db = getFirestore(app);
export const auth = getAuth(app); // 🌟 ဒီနေရာမှာ auth ကို Export ထုတ်ပေးလိုက်ပါပြီ
