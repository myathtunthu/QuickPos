import { forwardRef } from 'react';

const Input = forwardRef(({ label, error, ...props }, ref) => {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-400">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`input-cyber ${error ? 'border-neon-pink focus:ring-neon-pink' : ''}`}
        {...props}
      />
      {error && (
        <p className="text-neon-pink text-xs mt-1">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
