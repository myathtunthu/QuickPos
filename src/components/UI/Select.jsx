import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(({ label, error, options, className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-400">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`input-cyber appearance-none pr-10 cursor-pointer ${error ? 'border-neon-pink focus:ring-neon-pink' : ''} ${className}`}
          {...props}
        >
          {options.map((opt, index) => (
            <option key={index} value={opt.value} className="bg-gray-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-neon-cyan">
          <ChevronDown size={16} />
        </div>
      </div>
      {error && (
        <p className="text-neon-pink text-xs mt-1">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
