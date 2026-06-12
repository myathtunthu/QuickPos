export default function Card({ children, className = '', title, subtitle, action, compact = false }) {
  return (
    <section className={`app-card overflow-hidden ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title && <h3 className="truncate text-base font-black text-white sm:text-lg">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm font-medium text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={compact ? 'p-4' : 'p-4 sm:p-5 lg:p-6'}>{children}</div>
    </section>
  );
}
