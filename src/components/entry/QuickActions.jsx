import { Save, Archive, Trash2, Printer } from 'lucide-react';

export default function QuickActions({ onHold, onLoad, onClear, onPrint, disabled }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onHold}
        disabled={disabled}
        className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 rounded-lg text-amber-400 text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
      >
        <Save size={14} /> Hold
      </button>
      <button
        onClick={onLoad}
        className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 rounded-lg text-cyan-400 text-xs font-bold transition-colors flex items-center gap-1"
      >
        <Archive size={14} /> Load
      </button>
      <button
        onClick={onClear}
        disabled={disabled}
        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 rounded-lg text-rose-400 text-xs font-bold transition-colors disabled:opacity-50"
      >
        <Trash2 size={14} /> Clear
      </button>
      <button
        onClick={onPrint}
        className="px-3 py-1.5 bg-slate-600/20 hover:bg-slate-600/30 rounded-lg text-slate-300 text-xs font-bold transition-colors flex items-center gap-1"
      >
        <Printer size={14} /> Print
      </button>
    </div>
  );
}
