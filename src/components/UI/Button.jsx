export default function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  loading = false, 
  icon: Icon,
  ...props 
}) {
  const baseStyle = "flex items-center justify-center px-4 py-2 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-transparent border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_15px_rgba(0,255,255,0.6)]",
    danger: "bg-transparent border border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-black hover:shadow-[0_0_15px_rgba(255,0,255,0.6)]",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-gray-800"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`} 
      disabled={loading}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
      ) : Icon ? (
        <Icon size={18} className="mr-2" />
      ) : null}
      {children}
    </button>
  );
}
