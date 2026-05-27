export default function EntryTabs({ entryTab, setEntryTab }) {
  const tabs = ['Sale', 'Purchase', 'Expense'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => setEntryTab(tab)}
          className={`py-1.5 rounded-lg font-black text-xs border transition-all ${
            entryTab === tab
              ? 'bg-cyan-600 border-cyan-400 text-white'
              : 'bg-[#0d1120] border-white/5 text-slate-500'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
