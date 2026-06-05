import React from 'react';

export default function PromptModal({ value, onChange, onCancel, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-[#0d1120] p-6 shadow-2xl">
        <h3 className="mb-4 text-xl font-black text-cyan-400">Hold Bill အမည်</h3>
        <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} className="mb-5 w-full rounded-2xl border border-white/10 bg-black/50 p-3 text-white outline-none focus:border-cyan-400" placeholder="ဥပမာ - စားပွဲ ၃ / Customer Name" />
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onSubmit} className="rounded-2xl bg-cyan-500 py-3 font-black text-[#06111f] active:scale-95">Save</button>
          <button type="button" onClick={onCancel} className="rounded-2xl bg-slate-700 py-3 font-black text-white active:scale-95">Cancel</button>
        </div>
      </div>
    </div>
  );
}

