import React from 'react';
import CartItem from './CartItem';

const CartSection = ({ 
  cart, 
  products,
  onUpdateQty, 
  onUpdateUnit, 
  onUpdatePriceType, 
  onUpdateDiscount, 
  onRemove 
}) => {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
        <p className="text-xs font-bold">Cart is empty</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
      {cart.map(item => (
        <CartItem 
          key={item.id} 
          item={item} 
          products={products}
          onUpdateQty={onUpdateQty}
          onUpdateUnit={onUpdateUnit}
          onUpdatePriceType={onUpdatePriceType}
          onUpdateDiscount={onUpdateDiscount}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default CartSection;
