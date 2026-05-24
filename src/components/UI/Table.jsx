export default function Table({ headers, children }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-800 glass-panel">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-900/80 text-xs uppercase text-gray-400 font-mono tracking-wider border-b border-gray-800">
            <tr>
              {headers.map((header, index) => (
                <th key={index} className={`px-6 py-4 ${header.align === 'right' ? 'text-right' : header.align === 'center' ? 'text-center' : 'text-left'}`}>
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}
