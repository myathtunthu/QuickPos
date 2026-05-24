export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: "bg-gray-800 text-gray-300 border-gray-700",
    success: "bg-green-900/30 text-green-400 border-green-500/50",
    danger: "bg-neon-pink/10 text-neon-pink border-neon-pink/50",
    warning: "bg-yellow-900/30 text-yellow-400 border-yellow-500/50",
    info: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/50"
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border tracking-widest uppercase ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
