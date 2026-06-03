import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// 🌟 EntryPage, SettingsPage တို့မှ လှမ်းခေါ်နိုင်ရန် showToast ကို export လုပ်ပေးခြင်း
export const showToast = (message, type = 'info') => {
  useToastStore.getState().showToast(message, type);
};

export default function Toast() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 print:hidden">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div 
            key={toast.id}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border min-w-[250px]
              animate-in slide-in-from-right-8 fade-in duration-300
              ${isSuccess ? 'bg-green-900/80 border-green-500 text-green-100' : ''}
              ${isError ? 'bg-red-900/80 border-red-500 text-red-100' : ''}
              ${!isSuccess && !isError ? 'bg-gray-800/90 border-gray-600 text-gray-100' : ''}
              backdrop-blur-md
            `}
          >
            {isSuccess && <CheckCircle size={20} className="text-green-400" />}
            {isError && <AlertCircle size={20} className="text-red-400" />}
            {!isSuccess && !isError && <Info size={20} className="text-blue-400" />}
            
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
