import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({ label, error, options = [], className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`input-cyber cursor-pointer appearance-none pr-10 ${error ? 'border-rose-400 focus:border-rose-400' : ''} ${className}`}
          {...props}
        >
          {options.map((opt, index) => (
            <option key={`${opt.value}-${index}`} value={opt.value} className="bg-slate-950 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-cyan-300">
          <ChevronDown size={16} />
        </div>
      </div>
      {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
