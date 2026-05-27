export default function EntryTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'Sale', label: 'Sale', color: 'cyan' },
    { id: 'Purchase', label: 'Purchase', color: 'amber' },
    { id: 'Expense', label: 'Expense', color: 'rose' }
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`py-3 rounded-xl font-black text-sm transition-all ${
            activeTab === tab.id
              ? `bg-${tab.color}-600 text-white shadow-lg`
              : 'bg-[#0f172a] text-slate-400 border border-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
