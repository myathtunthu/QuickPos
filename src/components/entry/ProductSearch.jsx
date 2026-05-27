import { Search, X } from 'lucide-react';

export default function ProductSearch({ search, setSearch, categories, selCategory, setSelCategory }) {
  return (
    <>
      <div className="relative mb-1">
        <Search className="absolute left-2.5 top-2 text-cyan-500" size={14} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product..."
          className="w-full bg-black border border-cyan-500/20 rounded-lg pl-8 pr-8 py-2 text-xs text-white outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1.5 text-slate-500">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 mb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
              selCategory === cat ? 'bg-cyan-600 text-white' : 'bg-black/40 text-slate-400 border border-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </>
  );
}
