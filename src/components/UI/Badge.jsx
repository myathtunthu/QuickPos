export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'border-slate-600/60 bg-slate-800/70 text-slate-200',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    danger: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    info: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  };

  return (
    <span className={`ui-badge ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}
