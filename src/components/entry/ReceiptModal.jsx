import React from 'react';
import { Printer } from 'lucide-react';
import { formatMoney } from '../../utils/entryHelpers';

export default function ReceiptModal({ receiptModal, setReceiptModal, shopSettings, doPrint, printPageHeightMm }) {
  return (
    <>
          {receiptModal.show && receiptModal.record && (
            <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
              <div className="w-full max-w-sm bg-white text-black rounded-xl p-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar font-sans">
                <div className="text-center mb-4">
                  {shopSettings.logoUrl && (
                    <img
                      src={shopSettings.logoUrl}
                      alt={shopSettings.shopName}
                      className="h-16 w-auto mx-auto mb-2 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">
                    {shopSettings.shopName}
                  </h2>
                  {shopSettings.address && <p className="text-xs text-gray-500 mt-1">{shopSettings.address}</p>}
                  {shopSettings.phone && <p className="text-xs text-gray-500">Tel: {shopSettings.phone}</p>}
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Voucher No:</span>
                    <span className="text-gray-900">{receiptModal.record.voucherNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date & Time:</span>
                    <span className="text-gray-900">
                      {receiptModal.record.date} | {receiptModal.record.time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span className="text-gray-900">{receiptModal.record.cashier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{receiptModal.record.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span>
                    <span className="text-gray-900">{receiptModal.record.personName}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-300 text-gray-500">
                        <th className="text-left py-2 font-bold uppercase tracking-wider">Description</th>
                        <th className="text-right py-2 font-bold uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptModal.record.itemsDetail.map((item, i) => (
                        <tr key={`${item.name}-${i}`} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5">
                            <div className="font-bold text-gray-800">{item.name}</div>
                            <div className="text-gray-500 text-[10px] mt-0.5">
                              {item.quantity} {item.unitName} x {Number(item.unitPrice).toLocaleString()}
                              {item.itemDiscountAmt > 0 &&
                                ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-bold text-gray-800 align-top">
                            {Number(item.unitPrice * item.quantity - (item.itemDiscountAmt || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-dashed border-gray-300 pt-3 text-[11px] font-semibold text-gray-600 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-gray-900">{formatMoney(receiptModal.record.subtotal)}</span>
                  </div>

                  {(receiptModal.record.itemDiscount > 0 || receiptModal.record.globalDiscount > 0) && (
                    <div className="flex justify-between text-red-500">
                      <span>Discount:</span>
                      <span>
                        -{formatMoney(receiptModal.record.itemDiscount + receiptModal.record.globalDiscount)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between text-lg font-black text-gray-900">
                  <span>GRAND TOTAL</span>
                  <span>{formatMoney(receiptModal.record.amount)}</span>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mt-4 space-y-1.5 text-xs font-semibold text-gray-600 border border-gray-200">
                  <div className="flex justify-between">
                    <span>Paid ({receiptModal.record.paymentMethod}):</span>
                    <span className="text-gray-900">{formatMoney(receiptModal.record.paidAmount)}</span>
                  </div>

                  {receiptModal.record.remainingDebt > 0 ? (
                    <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                      <span>Credit Balance:</span>
                      <span>{formatMoney(receiptModal.record.remainingDebt)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-green-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                      <span>Change:</span>
                      <span>{formatMoney(receiptModal.record.changeAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="text-center mt-6 flex flex-col items-center gap-2">
                  <span
                    className={`font-black tracking-widest border-2 px-4 py-1 rounded-sm text-sm ${
                      receiptModal.record.remainingDebt > 0
                        ? 'text-red-500 border-red-500'
                        : 'text-green-500 border-green-500'
                    }`}
                  >
                    {receiptModal.record.remainingDebt > 0 ? 'CREDIT' : 'PAID'}
                  </span>
                  {shopSettings.receiptFooter && (
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">{shopSettings.receiptFooter}</p>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={doPrint}
                    className="w-full py-3 rounded-xl bg-cyan-600 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-cyan-600/30"
                  >
                    <Printer size={18} />
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptModal({ show: false, record: null })}
                    className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors"
                  >
                    New Transaction
                  </button>
                </div>
              </div>
            </div>
          )}

      <style>{`
        @media print {
          @page {
            size: 80mm ${printPageHeightMm}mm;
            margin: 0;
          }
          html, body {
            width: 80mm !important;
            min-width: 80mm !important;
            max-width: 80mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          .print\:hidden {
            display: none !important;
          }
          #root, #root * {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          #receipt-print-area, #receipt-print-area * {
            visibility: visible !important;
          }
          #receipt-print-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 3mm 4mm !important;
            box-sizing: border-box !important;
            background: white !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid-page !important;
          }
          #receipt-print-area table {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {receiptModal.show && receiptModal.record && (
        <div id="receipt-print-area" className="hidden print:block bg-white text-black font-sans text-[11px] leading-tight">
          <div className="text-center mb-3">
            {shopSettings.logoUrl && (
              <img
                src={shopSettings.logoUrl}
                alt={shopSettings.shopName}
                className="h-12 w-auto mx-auto mb-1 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h2 className="text-[18px] font-bold uppercase m-0">{shopSettings.shopName}</h2>
            {shopSettings.address && <p className="m-0 mt-1">{shopSettings.address}</p>}
            {shopSettings.phone && <p className="m-0">Tel: {shopSettings.phone}</p>}
          </div>

          <div className="border-t border-b border-dashed border-black py-2 mb-3 space-y-1">
            <div className="flex justify-between">
              <span>Voucher:</span>
              <span className="font-bold">{receiptModal.record.voucherNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>
                {receiptModal.record.date} {receiptModal.record.time}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{receiptModal.record.cashier}</span>
            </div>
            <div className="flex justify-between">
              <span>{receiptModal.record.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span>
              <span>{receiptModal.record.personName}</span>
            </div>
          </div>

          <table className="w-full border-collapse mb-3">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left pb-1 font-bold">Item</th>
                <th className="text-right pb-1 font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receiptModal.record.itemsDetail.map((item, i) => (
                <tr key={`${item.name}-${i}`}>
                  <td className="py-1.5 align-top">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-[10px] mt-0.5">
                      {item.quantity} {item.unitName} x {Number(item.unitPrice).toLocaleString()}
                      {item.itemDiscountAmt > 0 && ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                    </div>
                  </td>
                  <td className="text-right py-1.5 align-top font-bold">
                    {Number(item.unitPrice * item.quantity - (item.itemDiscountAmt || 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-black pt-2 mb-2 space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{Number(receiptModal.record.subtotal).toLocaleString()}</span>
            </div>
            {(receiptModal.record?.itemDiscount > 0 || receiptModal.record?.globalDiscount > 0) && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>
                  -{Number(receiptModal.record.itemDiscount + receiptModal.record.globalDiscount).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between font-bold border-t border-black pt-2 mb-3 text-[14px]">
            <span>TOTAL:</span>
            <span>{Number(receiptModal.record.amount).toLocaleString()}</span>
          </div>

          <div className="border-t border-black pt-2 mb-4 space-y-1">
            <div className="flex justify-between">
              <span>Paid ({receiptModal.record.paymentMethod}):</span>
              <span>{Number(receiptModal.record.paidAmount).toLocaleString()}</span>
            </div>

            {receiptModal.record.remainingDebt > 0 ? (
              <div className="flex justify-between font-bold">
                <span>Credit Balance:</span>
                <span>{Number(receiptModal.record.remainingDebt).toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex justify-between font-bold">
                <span>Change:</span>
                <span>{Number(receiptModal.record.changeAmount).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="text-center font-bold text-[14px] mb-2">
            {receiptModal.record.remainingDebt > 0 ? '*** CREDIT ***' : '*** PAID ***'}
          </div>
          {shopSettings.receiptFooter && <div className="text-center text-[10px]">{shopSettings.receiptFooter}</div>}
        </div>
      )}

    </>
  );
}
