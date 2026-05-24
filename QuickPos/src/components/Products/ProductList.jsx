import { Package } from 'lucide-react';
import { formatMMK } from '../../utils/formatMMK';

export default function ProductList({ products, onAdd }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
        <Package size={48} className="mb-4 opacity-20" />
        <p className="font-mono text-sm">NO PRODUCTS FOUND</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {products.map(product => {
        const isOutOfStock = product.stock <= 0;
        return (
          <div 
            key={product.id}
            onClick={() => !isOutOfStock && onAdd(product)}
            className={`
              flex items-center justify-between p-3 rounded-xl border transition-all
              ${isOutOfStock 
                ? 'bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed' 
                : 'glass-panel border-gray-800 hover:border-neon-cyan hover:shadow-[0_0_10px_rgba(0,255,255,0.2)] cursor-pointer'
              }
            `}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700 shrink-0">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Package size={20} className="text-gray-400" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">{product.name}</h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5">Stock: {product.stock}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-neon-cyan font-bold font-mono text-sm">{formatMMK(product.price)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
