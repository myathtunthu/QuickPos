export default function Tabs({ tabs = [], activeTab, onTabChange }) {
  return (
    <div className="hide-scrollbar overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/45 p-1">
      <nav className="flex min-w-max gap-1" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-all active:scale-[0.98] ${
                isActive
                  ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {Icon && <Icon size={16} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
