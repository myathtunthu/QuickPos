import { Plus, Minus, Trash2 } from 'lucide-react';

const formatMMK = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', minimumFractionDigits: 0 }).format(amount);
};

export default function CartItem({ item, onUpdateQuantity, onRemove }) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/30">
      <div className="flex-1 min-w-0 pr-3">
        <h4 className="text-sm font-medium text-gray-200 truncate">{item.name}</h4>
        <p className="text-xs text-neon-cyan font-mono mt-1">{formatMMK(item.price)}</p>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center bg-gray-950 rounded-lg border border-gray-700">
          <button 
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="p-1 text-gray-400 hover:text-neon-cyan transition-colors"
          >
            <Minus size={16} />
          </button>
          <span className="w-8 text-center text-sm font-mono text-white">{item.quantity}</span>
          <button 
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="p-1 text-gray-400 hover:text-neon-cyan transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <button 
          onClick={() => onRemove(item.id)}
          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
