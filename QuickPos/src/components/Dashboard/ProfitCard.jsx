import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { formatMMK } from '../../utils/formatMMK';

export default function ProfitCard({ grossProfit, netProfit, expenses, isGrowth = true }) {
  return (
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
      {/* Background glow effect */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-green-500/10 rounded-full blur-[40px] group-hover:bg-green-500/20 transition-all duration-500 pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 font-mono text-sm uppercase tracking-widest">Profit Margins</h3>
        <Activity size={18} className="text-green-400" />
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Net Profit</p>
          <div className="flex items-end gap-3">
            <h2 className="text-3xl font-bold text-white">{formatMMK(netProfit)}</h2>
            <span className={`flex items-center text-xs font-bold mb-1 ${isGrowth ? 'text-green-400' : 'text-red-400'}`}>
              {isGrowth ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {isGrowth ? '+8.2%' : '-2.4%'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500 mb-1">Gross Profit</p>
            <p className="font-mono text-sm text-gray-300">{formatMMK(grossProfit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Expenses</p>
            <p className="font-mono text-sm text-neon-pink">{formatMMK(expenses)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
