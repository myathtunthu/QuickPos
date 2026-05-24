export default function Loader({ fullScreen = false, text = "LOADING..." }) {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-t-2 border-neon-cyan animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-r-2 border-neon-pink animate-spin-reverse"></div>
        <div className="absolute inset-4 rounded-full border-b-2 border-blue-500 animate-spin"></div>
      </div>
      <p className="text-neon-cyan font-mono text-sm tracking-[0.2em] animate-pulse">
        {text}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center">
      {content}
    </div>
  );
}
