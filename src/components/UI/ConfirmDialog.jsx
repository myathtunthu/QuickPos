import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title = "အတည်ပြုပါ",
  message = "ဤလုပ်ဆောင်ချက်ကို ဆက်လက်လုပ်ဆောင်ရန် သေချာပါသလား?",
  onConfirm,
  onCancel,
  isLoading = false,
  isDangerous = true // True ဆိုလျှင် အနီရောင်ခလုတ်ပြမည်
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0d1120] border border-cyan-500/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl scale-in-95 duration-200">
        
        <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-4">
          <div className={`p-3 rounded-full ${isDangerous ? 'bg-rose-500/10 text-rose-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
            {isDangerous ? <AlertTriangle size={24} /> : <Info size={24} />}
          </div>
          <h2 className="text-xl font-black text-white">{title}</h2>
        </div>

        <p className="text-slate-400 mb-8 leading-relaxed text-sm">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            မလုပ်တော့ပါ (Cancel)
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-3 font-black rounded-xl text-white transition-all active:scale-95 shadow-lg disabled:opacity-50 flex justify-center items-center gap-2
              ${isDangerous 
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                : 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/20'
              }
            `}
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              'အတည်ပြုမည်'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
