export default function Toggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <div className="min-w-0 pr-4">
        {label && <div className="text-sm font-black text-white">{label}</div>}
        {description && <div className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{description}</div>}
      </div>
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <div className={`h-7 w-[3.25rem] rounded-full border transition-colors duration-200 ${checked ? 'border-cyan-300/40 bg-cyan-400' : 'border-white/10 bg-slate-800'}`} />
        <div className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ${checked ? 'translate-x-6 bg-slate-950' : ''}`} />
      </div>
    </label>
  );
}
