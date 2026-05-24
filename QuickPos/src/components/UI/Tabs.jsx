export default function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="border-b border-gray-800">
      <nav className="-mb-px flex space-x-6 overflow-x-auto hide-scrollbar" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300
                ${isActive
                  ? 'border-neon-cyan text-neon-cyan drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                {tab.icon && <tab.icon size={16} />}
                <span className="font-mono uppercase tracking-wider">{tab.label}</span>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
