import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // style={{ zIndex: 99999 }} ဖြင့် App ရဲ့ အပေါ်ဆုံးအလွှာမှာ အသေအချာ ပေါ်စေပါသည်
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
      {/* Background Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal Content Box */}
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-gray-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-800">
          <h3 className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-blue-500">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-neon-pink hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Form Container */}
        <div className="p-4 md:p-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
