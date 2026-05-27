import { Printer, X } from 'lucide-react';
import { generateReceiptHTML } from '../../utils/receiptGenerator';

export default function ReceiptModal({ data, shopInfo, onPrint, onClose }) {
  const fmt = (n) => (Number(n) || 0).toLocaleString();

  const handlePrint = () => {
    const html = generateReceiptHTML(data, shopInfo);
    const win = window.open();
    win.document.write(html);
    win.document.close();
    onPrint();
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center border-b border-dashed pb-4 mb-4">
          <h2 className="text-xl font-black">{shopInfo.name || 'QuickPOS'}</h2>
          <p className="text-xs text-gray-500">{shopInfo.phone}</p>
          <p className="text-xs text-gray-500 mt-1">{data.date}</p>
          <p className="text-xs text-gray-500">Receipt: {data.invoiceNo}</p>
        </div>
        
        {/* Items */}
        <div className="space-y-2 mb-4">
          {data.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.name} × {item.quantity} ({item.unitName})
                {item.itemDiscount > 0 && <span className="text-xs text-amber-600 block">-{fmt(item.itemDiscount)}</span>}
              </span>
              <span>{fmt(item.subtotal)}</span>
            </div>
          ))}
        </div>
        
        {data.globalDiscount > 0 && (
          <p className="text-right text-sm text-amber-600">Discount: -{fmt(data.globalDiscount)} Ks</p>
        )}
        
        {/* Total */}
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between text-xl font-black">
            <span>TOTAL</span>
            <span>{fmt(data.total)} Ks</span>
          </div>
        </div>
        
        <p className="text-sm text-right mt-1">Method: {data.paymentMethod}</p>
        <p className="text-sm text-right">Paid: {fmt(data.paidAmount)} Ks</p>
        
        {data.remainingDebt > 0 && (
          <p className="text-sm text-right text-red-600 font-bold">
            Remaining Debt: {fmt(data.remainingDebt)} Ks
          </p>
        )}
        
        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-cyan-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <Printer size={18} /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 text-black rounded-2xl font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
