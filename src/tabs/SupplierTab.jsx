import { formatMMK } from '../utils/formatMMK';

export default function SupplierTab({ data, onSettle, loading }) {
  if (loading) return <div className="p-8 text-center text-gray-500">Loading Suppliers...</div>;
  if (data.length === 0) return <div className="p-8 text-center text-gray-500">No suppliers found.</div>;

  return (
    <table className="w-full text-left text-sm text-gray-300">
      <thead className="bg-gray-900 text-xs uppercase text-gray-400 font-mono">
        <tr>
          <th className="px-6 py-4">Supplier Name</th>
          <th className="px-6 py-4">Company</th>
          <th className="px-6 py-4 text-right">Credit Amount</th>
          <th className="px-6 py-4 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {data.map(item => (
          <tr key={item.id} className="hover:bg-gray-800/50">
            <td className="px-6 py-4 font-medium text-white">{item.name}</td>
            <td className="px-6 py-4 text-xs">{item.address || 'N/A'}</td>
            <td className={`px-6 py-4 text-right font-mono font-bold ${item.debt > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {formatMMK(item.debt)}
            </td>
            <td className="px-6 py-4 text-center">
              <button 
                onClick={() => onSettle(item.id, item.debt)}
                disabled={item.debt <= 0}
                className="bg-gray-800 hover:bg-yellow-400 hover:text-black text-yellow-400 border border-yellow-400/50 px-3 py-1 rounded text-xs font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pay Credit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
