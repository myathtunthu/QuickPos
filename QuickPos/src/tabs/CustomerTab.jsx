import { formatMMK } from '../utils/formatMMK';

export default function CustomerTab({ data, onSettle, loading }) {
  if (loading) return <div className="p-8 text-center text-gray-500">Loading Customers...</div>;
  if (data.length === 0) return <div className="p-8 text-center text-gray-500">No customers found.</div>;

  return (
    <table className="w-full text-left text-sm text-gray-300">
      <thead className="bg-gray-900 text-xs uppercase text-gray-400 font-mono">
        <tr>
          <th className="px-6 py-4">Customer Name</th>
          <th className="px-6 py-4">Phone</th>
          <th className="px-6 py-4 text-right">Debt Amount</th>
          <th className="px-6 py-4 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {data.map(item => (
          <tr key={item.id} className="hover:bg-gray-800/50">
            <td className="px-6 py-4 font-medium text-white">{item.name}</td>
            <td className="px-6 py-4 font-mono text-xs">{item.phone || 'N/A'}</td>
            <td className={`px-6 py-4 text-right font-mono font-bold ${item.debt > 0 ? 'text-neon-pink' : 'text-gray-400'}`}>
              {formatMMK(item.debt)}
            </td>
            <td className="px-6 py-4 text-center">
              <button 
                onClick={() => onSettle(item.id, item.debt)}
                disabled={item.debt <= 0}
                className="bg-gray-800 hover:bg-neon-cyan hover:text-black text-neon-cyan border border-neon-cyan/50 px-3 py-1 rounded text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Receive
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
