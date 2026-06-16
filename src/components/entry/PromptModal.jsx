import React from 'react';
import { createPortal } from 'react-dom';

export default function PromptModal({ promptModal, setPromptModal, executeHoldInvoice }) {
  if (!promptModal?.isOpen || typeof document === 'undefined') return null;

  const node = (
    <div
      className="print:hidden"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(14px)',
        overscrollBehavior: 'none',
        touchAction: 'none',
      }}
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
      role="presentation"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-cyan-500/20 bg-[#0d1120] p-5 shadow-2xl shadow-cyan-950/40 sm:p-6"
        style={{ maxHeight: 'calc(100svh - 32px)' }}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-black text-cyan-400 sm:text-xl">ခဏဆိုင်းထားမည့် ဘေလ်အမည်</h3>
        <input
          autoFocus
          value={promptModal.name}
          onChange={(e) => setPromptModal({ ...promptModal, name: e.target.value })}
          className="mb-5 w-full rounded-xl border border-white/10 bg-black/50 p-3 text-[16px] text-white outline-none focus:border-cyan-500 sm:mb-6"
          placeholder="ဥပမာ - စားပွဲ ၃"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => executeHoldInvoice(promptModal.name)}
            className="rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500"
          >
            သိမ်းမည်
          </button>
          <button
            type="button"
            onClick={() => setPromptModal({ isOpen: false, name: '' })}
            className="rounded-xl bg-slate-700 py-3 font-bold text-white hover:bg-slate-600"
          >
            ပယ်ဖျက်မည်
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
