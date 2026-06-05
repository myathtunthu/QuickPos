import React from 'react';

export default function PromptModal({ promptModal, setPromptModal, executeHoldInvoice }) {
  if (!promptModal?.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden">
      <div className="bg-[#0d1120] border-2 border-cyan-500/20 rounded-3xl p-6 w-full max-w-sm shadow-2xl shadow-cyan-950/40">
        <h3 className="text-xl font-black text-cyan-400 mb-4">ခဏဆိုင်းထားမည့် ဘေလ်အမည်</h3>
        <input
          autoFocus
          value={promptModal.name}
          onChange={(e) => setPromptModal({ ...promptModal, name: e.target.value })}
          className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-cyan-500 mb-6"
          placeholder="ဥပမာ - စားပွဲ ၃"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => executeHoldInvoice(promptModal.name)}
            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold"
          >
            သိမ်းမည်
          </button>
          <button
            type="button"
            onClick={() => setPromptModal({ isOpen: false, name: '' })}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold"
          >
            ပယ်ဖျက်မည်
          </button>
        </div>
      </div>
    </div>
  );
}
