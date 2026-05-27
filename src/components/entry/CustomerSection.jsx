import { User, Calendar } from 'lucide-react';

export default function CustomerSection({
  personName,
  setPersonName,
  entryDate,
  setEntryDate
}) {
  return (
    <div className="flex gap-1.5 items-center">
      <div className="relative flex-1">
        <User className="absolute left-2.5 top-2 text-cyan-500" size={14} />
        <input
          value={personName}
          onChange={e => setPersonName(e.target.value)}
          placeholder="Customer"
          className="w-full bg-black/40 border border-cyan-500/20 rounded-lg pl-8 pr-2 py-2 text-xs text-white outline-none"
        />
      </div>
      <div className="flex items-center gap-1 bg-black/40 border border-cyan-500/20 rounded-2xl px-3 py-1">
        <Calendar size={14} className="text-cyan-400" />
        <input
          type="date"
          value={entryDate}
          onChange={e => setEntryDate(e.target.value)}
          className="bg-transparent text-xs font-bold text-cyan-300 outline-none w-28"
          style={{ colorScheme: 'dark' }}
        />
      </div>
    </div>
  );
}
