export default function Card({ children, className = '', title, action }) {
  return (
    <div className={`glass-panel rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,255,0.1)] ${className}`}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          {title && <h3 className="font-bold text-white tracking-wide">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
