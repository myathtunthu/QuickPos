import { Search, Barcode, Clock } from 'lucide-react';

export default function EntryTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'products', label: 'Products', icon: Search },
    { id: 'barcode', label: 'Barcode', icon: Barcode },
    { id: 'hold', label: 'Hold Orders', icon: Clock },
  ];

  return (
    <div className="flex bg-[#0f172a] rounded-2xl p-1 border border-white/10">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all text-sm ${
              isActive 
                ? 'bg-cyan-500 text-black shadow-lg' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon size={18} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
