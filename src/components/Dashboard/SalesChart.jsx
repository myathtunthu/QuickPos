import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { formatMMK } from '../../utils/formatMMK';

export default function SalesChart({ data }) {
  return (
    <div className="mt-8 glass-panel p-6 rounded-xl">
      <h3 className="text-lg font-bold text-white mb-6">7-Day Revenue Matrix</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#4b5563" tick={{fill: '#9ca3af'}} />
            <YAxis stroke="#4b5563" tick={{fill: '#9ca3af'}} tickFormatter={(value) => `${value / 1000}k`} />
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
              itemStyle={{ color: '#0ff' }}
              formatter={(value) => [formatMMK(value), 'Revenue']}
            />
            <Area type="monotone" dataKey="sales" stroke="#0ff" fillOpacity={1} fill="url(#colorSales)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
