import { User } from 'lucide-react';

export default function CustomerSection({ personName, setPersonName }) {
  return (
    <div className="bg-[#0f172a] rounded-xl p-4 mb-4 border border-cyan-500/20">
      <h3 className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-2">
        <User size={12} /> CUSTOMER INFO
      </h3>
      <input
        type="text"
        value={personName}
        onChange={(e) => setPersonName(e.target.value)}
        placeholder="Customer name"
        className="w-full bg-black/40 border border-cyan-500/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
      />
    </div>
  );
}
