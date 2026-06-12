export default function Loader({ fullScreen = false, text = 'LOADING...' }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-300/20 border-t-cyan-300 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-blue-300/20 border-r-blue-300 animate-spin-reverse" />
        <div className="absolute inset-5 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.55)]" />
      </div>
      <p className="text-sm font-black uppercase tracking-[0.26em] text-cyan-200 animate-pulse">{text}</p>
    </div>
  );

  if (fullScreen) {
    return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">{content}</div>;
  }

  return <div className="flex min-h-[220px] w-full items-center justify-center">{content}</div>;
}
