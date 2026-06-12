export default function Table({ headers = [], children, className = '' }) {
  return (
    <div className={`app-card w-full overflow-hidden ${className}`}>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm text-slate-300">
          <thead className="border-b border-white/10 bg-white/[0.035] text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={`${header.label}-${index}`}
                  className={`px-4 py-4 sm:px-5 ${
                    header.align === 'right' ? 'text-right' : header.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.07]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
