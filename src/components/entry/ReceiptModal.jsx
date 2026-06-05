import React from 'react';
import { Printer, ReceiptText, X } from 'lucide-react';
import ReceiptContent from './ReceiptContent';

export default function ReceiptModal({ record, shopSettings, onClose, onPrint, txt }) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm print:hidden">
      <div className="flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#0d1120] shadow-2xl">
        <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-3">
          <div className="flex items-center gap-2 text-cyan-300"><ReceiptText size={18} /><span className="font-black">{txt.receiptPreview}</span></div>
          <button type="button" onClick={onClose} aria-label="Close receipt" className="rounded-xl bg-white/5 p-2 text-slate-300 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4">
          <div className="mx-auto w-[80mm] max-w-full rounded bg-white p-4 shadow-xl"><ReceiptContent record={record} shopSettings={shopSettings} /></div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-cyan-500/20 bg-[#0d1120] p-3">
          <button type="button" onClick={onPrint} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-3 font-black text-[#06111f] active:scale-95"><Printer size={18} /> {txt?.print || 'Print'}</button>
          <button type="button" onClick={onClose} className="rounded-2xl bg-emerald-500/15 py-3 font-black text-emerald-300 active:scale-95">{txt?.newTransaction || 'New Transaction'}</button>
        </div>
      </div>
    </div>
  );
}

