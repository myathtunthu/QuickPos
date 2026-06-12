export default function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  icon: Icon,
  disabled,
  type = 'button',
  ...props
}) {
  const baseStyle = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';

  const variants = {
    primary: 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-300',
    secondary: 'border border-slate-700 bg-slate-900/70 text-slate-100 hover:border-cyan-400/60 hover:bg-slate-800',
    danger: 'border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
    success: 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
    warning: 'border border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20',
    ghost: 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
  };

  return (
    <button
      type={type}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <span className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : Icon ? (
        <Icon size={18} />
      ) : null}
      {children}
    </button>
  );
}
