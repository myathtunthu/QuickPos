import React from 'react';
import { ReceiptText } from 'lucide-react';

export default function ReceiptPreview({ record, shopSettings, title = 'Receipt Preview', compact = false }) {
  const items = Array.isArray(record?.itemsDetail) ? record.itemsDetail : [];
  const hasLogo = Boolean(shopSettings?.logoUrl);
  const totalDiscount = Number(record?.itemDiscount || 0) + Number(record?.globalDiscount || 0);
  const isCredit = Number(record?.remainingDebt || 0) > 0;
  const footerText = shopSettings?.receiptFooter || 'Thank you for your business!';

  return (
    <div className="bg-[#0d1120]/95 border border-cyan-500/20 rounded-3xl p-4 shadow-xl shadow-cyan-950/20">
      <div className="flex items-center justify-between mb-3 print:hidden">
        <div className="flex items-center gap-2">
          <ReceiptText size={18} className="text-cyan-400" />
          <h2 className="text-sm font-black text-slate-200">{title}</h2>
        </div>
        <span className="text-[10px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-1">
          LIVE
        </span>
      </div>

      <div className={`mx-auto bg-white text-black shadow-inner ${compact ? 'max-w-[280px]' : 'max-w-sm'} rounded-sm p-3 font-mono text-[10px] leading-tight`}>
        <div className="text-center mb-2">
          {hasLogo && (
            <img
              src={shopSettings.logoUrl}
              alt={shopSettings.shopName || 'Shop Logo'}
              className="h-9 w-auto mx-auto mb-1 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="font-black text-[13px] uppercase tracking-wide">{shopSettings?.shopName || 'POS'}</div>
          {shopSettings?.address && <div className="text-[9px] mt-0.5">{shopSettings.address}</div>}
          {shopSettings?.phone && <div className="text-[9px]">Tel: {shopSettings.phone}</div>}
        </div>

        <div className="border-t border-b border-dashed border-black py-2 space-y-1">
          <div className="flex justify-between gap-3"><span>Voucher:</span><b>{record?.voucherNo || 'PREVIEW'}</b></div>
          <div className="flex justify-between gap-3"><span>Date:</span><span>{record?.date || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>Time:</span><span>{record?.time || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>Cashier:</span><span>{record?.cashier || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>{record?.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span><span className="text-right">{record?.personName || 'Walk-in'}</span></div>
        </div>

        <table className="w-full my-2 border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="2" className="py-5 text-center text-gray-400">No items</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.name || 'item'}-${index}`}>
                  <td className="py-1 align-top pr-2">
                    <div className="font-bold break-words">{item.name || 'Item'}</div>
                    <div className="text-[9px] text-gray-600">
                      {Number(item.quantity || 0)} {item.unitName || ''} x {Number(item.unitPrice || 0).toLocaleString()}
                      {Number(item.itemDiscountAmt || 0) > 0 && ` (-${Number(item.itemDiscountAmt || 0).toLocaleString()})`}
                    </div>
                  </td>
                  <td className="py-1 align-top text-right font-bold whitespace-nowrap">
                    {Number(item.itemTotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 0) - Number(item.itemDiscountAmt || 0))).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black pt-2 space-y-1">
          <div className="flex justify-between"><span>Subtotal:</span><span>{Number(record?.subtotal || 0).toLocaleString()}</span></div>
          {totalDiscount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{totalDiscount.toLocaleString()}</span></div>}
        </div>

        <div className="flex justify-between border-t border-black pt-2 mt-2 text-[12px] font-black">
          <span>TOTAL:</span><span>{Number(record?.amount || 0).toLocaleString()}</span>
        </div>

        <div className="border-t border-black pt-2 mt-2 space-y-1">
          <div className="flex justify-between"><span>Paid ({record?.paymentMethod || 'Cash'}):</span><span>{Number(record?.paidAmount || 0).toLocaleString()}</span></div>
          {isCredit ? (
            <div className="flex justify-between font-bold"><span>Credit Balance:</span><span>{Number(record?.remainingDebt || 0).toLocaleString()}</span></div>
          ) : (
            <div className="flex justify-between font-bold"><span>Change:</span><span>{Number(record?.changeAmount || 0).toLocaleString()}</span></div>
          )}
        </div>

        <div className="text-center font-black mt-3">{isCredit ? '*** CREDIT ***' : '*** PAID ***'}</div>
        {footerText && <div className="text-center text-[9px] mt-1">{footerText}</div>}
      </div>
    </div>
  );
}
