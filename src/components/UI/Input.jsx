import { forwardRef } from 'react';

const Input = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`input-cyber ${error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/15' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
