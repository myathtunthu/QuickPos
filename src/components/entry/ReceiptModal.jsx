import { Printer, X } from 'lucide-react';
import QRCode from 'qrcode.react'; // ✅ ဒီစာကြောင်းထည့်

export default function ReceiptModal({ record, shop, onClose, onPrint, fmt }) {
  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white text-black rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center border-b border-dashed pb-4">
          {shop.logoUrl && (
            <img
              src={shop.logoUrl}
              alt="logo"
              className="w-12 h-12 mx-auto mb-2 rounded-full"
            />
          )}
          <h2 className="text-xl font-black">{shop.name}</h2>
          <p className="text-xs text-gray-500">📞 {shop.phone}</p>
          <p className="text-xs text-gray-500">📍 {shop.address}</p>
          <p className="text-xs text-gray-500 mt-1">Cashier: {shop.cashier}</p>
          <p className="text-xs text-gray-500">{record.date}</p>
          <p className="text-xs text-gray-500">
            Invoice: {record.invoiceNo || record.id?.slice(-8)}
          </p>
        </div>

        {/* Items */}
        <div className="py-3 text-sm space-y-1">
          {(record.itemsDetail || []).map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {item.name} × {item.quantity} ({item.unitName})
                {item.priceType !== 'retail' && (
                  <span className="text-[10px] ml-1">({item.priceType})</span>
                )}
                {item.itemDiscountAmt > 0 && (
                  <span className="text-rose-500 text-[10px]">
                    {' '}
                    -{fmt(item.itemDiscountAmt)}
                  </span>
                )}
              </span>
              <span>
                {fmt(item.unitPrice * item.quantity - (item.itemDiscountAmt || 0))}
              </span>
            </div>
          ))}
        </div>

        {/* Global Discount */}
        {record.globalDiscount > 0 && (
          <p className="text-right text-sm text-gray-500">
            Global Disc: -{fmt(record.globalDiscount)} Ks
          </p>
        )}

        {/* Total */}
        <div className="border-t pt-3 flex justify-between text-xl font-black">
          <span>TOTAL</span>
          <span>{fmt(record.amount)} Ks</span>
        </div>

        {/* Payment info */}
        <div className="text-xs mt-2 space-y-0.5">
          <p>Method: {record.paymentMethod}</p>
          <p>Paid: {fmt(record.paidAmount || 0)} Ks</p>
          <p>Balance: {fmt(record.remainingDebt || 0)} Ks</p>
          <p className="text-rose-600 font-bold">
            Debt:{' '}
            {record.remainingDebt > 0 ? fmt(record.remainingDebt) + ' Ks' : 'None'}
          </p>
        </div>

        {/* ✅ QR Code of Invoice ID */}
        <div className="flex justify-center my-3">
          <QRCode value={record.id || 'invoice'} size={80} />
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400 mt-2 border-t border-dashed pt-2">
          ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်
          <br />
          Thank you for your purchase!
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onPrint(record)}
            className="flex-1 py-3 rounded-2xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2"
          >
            <Printer size={18} /> Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-gray-200 text-black font-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
