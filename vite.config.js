import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React & UI Libraries များကို သီးသန့်ခွဲထုတ်ခြင်း
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Firebase ကို သီးသန့်ခွဲထုတ်ခြင်း (Size အကြီးဆုံးဖြစ်၍)
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Icons နှင့် Charts များကို သီးသန့်ခွဲထုတ်ခြင်း
          'vendor-ui': ['lucide-react', 'recharts', 'framer-motion'],
          // Barcode Scanner
          'vendor-scanner': ['@zxing/library']
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Warning Limit ကို တိုးပေးထားသည်
  }
});
