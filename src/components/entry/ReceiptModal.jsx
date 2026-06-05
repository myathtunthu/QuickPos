import React from 'react';
import { Printer } from 'lucide-react';
import { formatMoney } from '../../utils/entryHelpers';

function getSafeItems(record) {
  return Array.isArray(record?.itemsDetail) ? record.itemsDetail : [];
}

function getItemLineTotal(item) {
  const qty = Number(item?.quantity) || 0;
  const price = Number(item?.unitPrice) || 0;
  const discount = Number(item?.itemDiscountAmt) || 0;
  return Math.max(0, qty * price - discount);
}

export default function ReceiptModal({
  receiptModal,
  setReceiptModal,
  shopSettings,
  doPrint,
}) {
  if (!receiptModal?.show || !receiptModal?.record) {
    return null;
  }

  const record = receiptModal.record;
  const items = getSafeItems(record);
  const isPurchase = record.type === 'Purchase';
  const personLabel = isPurchase ? 'Supplier:' : 'Customer:';
  const statusText = Number(record.remainingDebt) > 0 ? 'CREDIT' : 'PAID';

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
        <div className="w-full max-w-sm bg-white text-black rounded-xl shadow-2xl max-h-[90vh] overflow-hidden font-sans flex flex-col">
          <div className="overflow-y-auto custom-scrollbar p-4 pb-3">
            <div className="text-center mb-4">
              {shopSettings?.logoUrl && (
                <img
                  src={shopSettings.logoUrl}
                  alt={shopSettings?.shopName || 'Shop Logo'}
                  className="h-16 w-auto mx-auto mb-2 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}

              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-wider">
                {shopSettings?.shopName || 'NexPOS'}
              </h2>

              {shopSettings?.address && (
                <p className="text-xs text-gray-500 mt-1">{shopSettings.address}</p>
              )}

              {shopSettings?.phone && (
                <p className="text-xs text-gray-500">Tel: {shopSettings.phone}</p>
              )}
            </div>

            <div className="border-t border-b border-dashed border-gray-300 py-3 mb-4 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between gap-3">
                <span>Voucher No:</span>
                <span className="text-gray-900 text-right">{record.voucherNo || '-'}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span>Date & Time:</span>
                <span className="text-gray-900 text-right">
                  {record.date || '-'} {record.time ? `| ${record.time}` : ''}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span>Cashier:</span>
                <span className="text-gray-900 text-right">{record.cashier || '-'}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span>{personLabel}</span>
                <span className="text-gray-900 text-right">{record.personName || '-'}</span>
              </div>
            </div>

            <div className="mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="text-left py-2 font-bold uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right py-2 font-bold uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, i) => (
                    <tr key={`${item?.name || 'item'}-${i}`} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pr-2">
                        <div className="font-bold text-gray-800">
                          {item?.name || 'Unknown Item'}
                        </div>
                        <div className="text-gray-500 text-[10px] mt-0.5">
                          {Number(item?.quantity) || 0} {item?.unitName || 'ခု'} x{' '}
                          {Number(item?.unitPrice || 0).toLocaleString()}
                          {Number(item?.itemDiscountAmt) > 0 &&
                            ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                        </div>
                      </td>

                      <td className="py-2.5 text-right font-bold text-gray-800 align-top">
                        {getItemLineTotal(item).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-dashed border-gray-300 pt-3 text-[11px] font-semibold text-gray-600 space-y-1.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="text-gray-900">{formatMoney(record.subtotal)}</span>
              </div>

              {(Number(record.itemDiscount) > 0 || Number(record.globalDiscount) > 0) && (
                <div className="flex justify-between text-red-500">
                  <span>Discount:</span>
                  <span>
                    -{formatMoney((Number(record.itemDiscount) || 0) + (Number(record.globalDiscount) || 0))}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between text-lg font-black text-gray-900">
              <span>GRAND TOTAL</span>
              <span>{formatMoney(record.amount)}</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mt-4 space-y-1.5 text-xs font-semibold text-gray-600 border border-gray-200">
              <div className="flex justify-between gap-3">
                <span>Paid ({record.paymentMethod || 'Cash'}):</span>
                <span className="text-gray-900">{formatMoney(record.paidAmount)}</span>
              </div>

              {Number(record.remainingDebt) > 0 ? (
                <div className="flex justify-between gap-3 text-red-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                  <span>Credit Balance:</span>
                  <span>{formatMoney(record.remainingDebt)}</span>
                </div>
              ) : (
                <div className="flex justify-between gap-3 text-green-600 font-bold border-t border-gray-200 pt-1.5 mt-1.5">
                  <span>Change:</span>
                  <span>{formatMoney(record.changeAmount)}</span>
                </div>
              )}
            </div>

            <div className="text-center mt-6 flex flex-col items-center gap-2">
              <span
                className={`font-black tracking-widest border-2 px-4 py-1 rounded-sm text-sm ${
                  Number(record.remainingDebt) > 0
                    ? 'text-red-500 border-red-500'
                    : 'text-green-500 border-green-500'
                }`}
              >
                {statusText}
              </span>

              {shopSettings?.receiptFooter && (
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  {shopSettings.receiptFooter}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 pt-2 bg-white border-t border-gray-100 flex flex-col gap-2 shrink-0">
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

      <div id="receipt-print-area" className="receipt-print-area">
        <div className="receipt-header">
          {shopSettings?.logoUrl && (
            <img
              src={shopSettings.logoUrl}
              alt={shopSettings?.shopName || 'Shop Logo'}
              className="receipt-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}

          <div className="receipt-shop-name">{shopSettings?.shopName || 'NexPOS'}</div>

          {shopSettings?.address && (
            <div className="receipt-small">{shopSettings.address}</div>
          )}

          {shopSettings?.phone && (
            <div className="receipt-small">Tel: {shopSettings.phone}</div>
          )}
        </div>

        <div className="receipt-dash" />

        <div className="receipt-meta">
          <div>
            <span>Voucher:</span>
            <b>{record.voucherNo || '-'}</b>
          </div>
          <div>
            <span>Date:</span>
            <b>
              {record.date || '-'} {record.time || ''}
            </b>
          </div>
          <div>
            <span>Cashier:</span>
            <b>{record.cashier || '-'}</b>
          </div>
          <div>
            <span>{personLabel}</span>
            <b>{record.personName || '-'}</b>
          </div>
        </div>

        <div className="receipt-dash" />

        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, i) => (
              <tr key={`${item?.name || 'item'}-print-${i}`}>
                <td>
                  <div className="item-name">{item?.name || 'Unknown Item'}</div>
                  <div className="item-sub">
                    {Number(item?.quantity) || 0} {item?.unitName || 'ခု'} x{' '}
                    {Number(item?.unitPrice || 0).toLocaleString()}
                    {Number(item?.itemDiscountAmt) > 0 &&
                      ` (-${Number(item.itemDiscountAmt).toLocaleString()})`}
                  </div>
                </td>

                <td>{getItemLineTotal(item).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-dash" />

        <div className="receipt-row">
          <span>Subtotal:</span>
          <b>{Number(record.subtotal || 0).toLocaleString()}</b>
        </div>

        {(Number(record.itemDiscount) > 0 || Number(record.globalDiscount) > 0) && (
          <div className="receipt-row">
            <span>Discount:</span>
            <b>
              -{((Number(record.itemDiscount) || 0) + (Number(record.globalDiscount) || 0)).toLocaleString()}
            </b>
          </div>
        )}

        <div className="receipt-total">
          <span>TOTAL:</span>
          <b>{Number(record.amount || 0).toLocaleString()}</b>
        </div>

        <div className="receipt-dash" />

        <div className="receipt-row">
          <span>Paid ({record.paymentMethod || 'Cash'}):</span>
          <b>{Number(record.paidAmount || 0).toLocaleString()}</b>
        </div>

        {Number(record.remainingDebt) > 0 ? (
          <div className="receipt-row">
            <span>Credit Balance:</span>
            <b>{Number(record.remainingDebt || 0).toLocaleString()}</b>
          </div>
        ) : (
          <div className="receipt-row">
            <span>Change:</span>
            <b>{Number(record.changeAmount || 0).toLocaleString()}</b>
          </div>
        )}

        <div className="receipt-status">*** {statusText} ***</div>

        {shopSettings?.receiptFooter && (
          <div className="receipt-footer">{shopSettings.receiptFooter}</div>
        )}
      </div>

      <style>{`
        .receipt-print-area {
          display: none;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          #root,
          #root * {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible !important;
          }

          #receipt-print-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm 4mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;
          }

          .receipt-header {
            text-align: center !important;
            margin: 0 0 6px 0 !important;
          }

          .receipt-logo {
            display: block !important;
            height: 12mm !important;
            width: auto !important;
            max-width: 35mm !important;
            object-fit: contain !important;
            margin: 0 auto 2mm auto !important;
          }

          .receipt-shop-name {
            font-size: 16px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .receipt-small {
            font-size: 9px !important;
            line-height: 1.2 !important;
          }

          .receipt-dash {
            border-top: 1px dashed #000000 !important;
            height: 0 !important;
            margin: 5px 0 !important;
          }

          .receipt-meta {
            font-size: 10px !important;
          }

          .receipt-meta div,
          .receipt-row {
            display: flex !important;
            justify-content: space-between !important;
            gap: 8px !important;
            margin: 2px 0 !important;
          }

          .receipt-meta span,
          .receipt-row span {
            flex: 0 0 auto !important;
          }

          .receipt-meta b,
          .receipt-row b {
            text-align: right !important;
            font-weight: 700 !important;
            word-break: break-word !important;
          }

          .receipt-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 10px !important;
            margin: 0 !important;
          }

          .receipt-table th {
            font-weight: 800 !important;
            border-bottom: 1px solid #000000 !important;
            padding: 2px 0 !important;
          }

          .receipt-table th:first-child,
          .receipt-table td:first-child {
            text-align: left !important;
            width: 68% !important;
          }

          .receipt-table th:last-child,
          .receipt-table td:last-child {
            text-align: right !important;
            width: 32% !important;
          }

          .receipt-table td {
            vertical-align: top !important;
            padding: 3px 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .item-name {
            font-weight: 800 !important;
            font-size: 10px !important;
            word-break: break-word !important;
          }

          .item-sub {
            font-size: 9px !important;
            line-height: 1.15 !important;
            word-break: break-word !important;
          }

          .receipt-total {
            display: flex !important;
            justify-content: space-between !important;
            gap: 8px !important;
            border-top: 1px solid #000000 !important;
            padding-top: 5px !important;
            margin-top: 5px !important;
            font-size: 13px !important;
            font-weight: 900 !important;
          }

          .receipt-status {
            text-align: center !important;
            font-size: 13px !important;
            font-weight: 900 !important;
            margin-top: 8px !important;
          }

          .receipt-footer {
            text-align: center !important;
            font-size: 9px !important;
            margin-top: 3px !important;
          }

          button,
          input,
          select,
          textarea {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
