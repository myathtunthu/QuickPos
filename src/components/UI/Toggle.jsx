export default function Toggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="pr-4">
        {label && <div className="text-sm font-medium text-white">{label}</div>}
        {description && <div className="text-xs text-gray-500 mt-1 font-mono">{description}</div>}
      </div>
      <div className="relative">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={checked} 
          onChange={onChange}
          disabled={disabled}
        />
        <div className={`block w-12 h-6 rounded-full transition-colors duration-300 ${checked ? 'bg-neon-cyan' : 'bg-gray-800 border border-gray-700'}`}></div>
        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${checked ? 'transform translate-x-6 bg-black shadow-[0_0_10px_rgba(255,255,255,0.8)]' : ''}`}></div>
      </div>
    </label>
  );
}
