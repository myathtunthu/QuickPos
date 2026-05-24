import { TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import { formatMMK } from '../../utils/formatMMK';

const StatCard = ({ title, value, icon: Icon, trend, isCurrency = false }) => (
  <div className="glass-panel p-6 rounded-xl flex items-start justify-between">
    <div>
      <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-white">
        {isCurrency ? formatMMK(value) : value}
      </h3>
      {trend && (
        <p className="text-neon-cyan text-xs mt-2 flex items-center">
          <TrendingUp size={14} className="mr-1" /> {trend}
        </p>
      )}
    </div>
    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
      <Icon className="text-neon-cyan" size={24} />
    </div>
  </div>
);

export default function DashboardStats({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard 
        title="Today's Volume" 
        value={stats.todaySales} 
        icon={DollarSign} 
        trend="+12.5% vs yesterday"
        isCurrency={true}
      />
      <StatCard 
        title="Active Inventory" 
        value={stats.totalProducts} 
        icon={Package} 
      />
      <StatCard 
        title="Critical Stock" 
        value={stats.lowStock} 
        icon={TrendingUp} 
      />
      <StatCard 
        title="Registered Clients" 
        value={stats.activeCustomers} 
        icon={Users} 
      />
    </div>
  );
}
