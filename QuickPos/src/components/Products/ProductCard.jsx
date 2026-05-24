import { Package } from 'lucide-react';

const formatMMK = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', minimumFractionDigits: 0 }).format(amount);
};

export default function ProductCard({ product, onAdd }) {
  const isOutOfStock = product.stock <= 0;

  return (
    <div 
      onClick={() => !isOutOfStock && onAdd(product)}
      className={`
        relative glass-panel rounded-xl p-4 cursor-pointer transition-all duration-300
        ${isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(0,255,255,0.3)] border border-gray-800 hover:border-neon-cyan'}
      `}
    >
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <span className="text-[10px] font-mono px-2 py-1 rounded bg-gray-800 text-gray-300">
          {product.stock} IN STOCK
        </span>
      </div>

      <div className="h-24 w-full flex items-center justify-center mb-3">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full object-contain drop-shadow-lg" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
            <Package size={24} className="text-neon-cyan" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-gray-100 text-sm truncate">{product.name}</h3>
        <p className="text-neon-cyan font-bold font-mono">{formatMMK(product.price)}</p>
      </div>
    </div>
  );
}
