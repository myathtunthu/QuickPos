import React from 'react';
import { formatMoney, toNumber } from '../../utils/entryHelpers';

export default function ReceiptContent({ record, shopSettings, compact = false }) {
  if (!record) return null;

  const items = Array.isArray(record.itemsDetail) ? record.itemsDetail : [];
  const discount = toNumber(record.itemDiscount) + toNumber(record.globalDiscount);
  const logoSrc = shopSettings?.logoUrl || shopSettings?.logo || shopSettings?.shopLogo || '';
  const currencySymbol = shopSettings?.currencySymbol || shopSettings?.currency || 'Ks';
  const hasLogo = Boolean(logoSrc);

  return (
    <div className={`${compact ? 'text-[10px]' : 'text-[12px]'} leading-tight text-black`}>
      <div className="mb-2 text-center">
        {hasLogo && (
          <img
            src={logoSrc}
            alt={shopSettings.shopName || 'Shop Logo'}
            loading="lazy"
            className={`${compact ? 'h-9' : 'h-12'} mx-auto mb-1 w-auto object-contain`}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <h2 className={`${compact ? 'text-[14px]' : 'text-[18px]'} m-0 font-black uppercase`}>{shopSettings.shopName || 'Shop'}</h2>
        {shopSettings.address && <p className="m-0 mt-1">{shopSettings.address}</p>}
        {shopSettings.phone && <p className="m-0">Tel: {shopSettings.phone}</p>}
      </div>

      <div className="mb-2 border-y border-dashed border-black py-2">
        <div className="flex justify-between gap-3"><span>Voucher:</span><span className="font-bold">{record.voucherNo || record.invoiceNo || '-'}</span></div>
        <div className="flex justify-between gap-3"><span>Date:</span><span>{record.date || '-'} {record.time || ''}</span></div>
        <div className="flex justify-between gap-3"><span>Cashier:</span><span>{record.cashier || '-'}</span></div>
        <div className="flex justify-between gap-3"><span>{record.type === 'Purchase' ? 'Supplier:' : 'Customer:'}</span><span>{record.personName || '-'}</span></div>
      </div>

      <table className="mb-2 w-full border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="pb-1 text-left font-black">Item</th>
            <th className="pb-1 text-right font-black">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const amount = toNumber(item.itemTotal, toNumber(item.unitPrice) * toNumber(item.quantity, 1) - toNumber(item.itemDiscountAmt));
            return (
              <tr key={`${item.productId || item.name}-${index}`}>
                <td className="py-1 align-top">
                  <div className="font-bold">{item.name || 'Item'}</div>
                  <div className="text-[10px]">{formatMoney(item.quantity)} {item.unitName || ''} x {formatMoney(item.unitPrice)}{toNumber(item.itemDiscountAmt) > 0 ? ` (-${formatMoney(item.itemDiscountAmt)})` : ''}</div>
                </td>
                <td className="py-1 text-right align-top font-bold">{formatMoney(amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mb-2 border-t border-dashed border-black pt-2">
        <div className="flex justify-between"><span>Subtotal:</span><span>{formatMoney(record.subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-{formatMoney(discount)}</span></div>}
      </div>

      <div className="mb-2 flex justify-between border-t border-black pt-2 text-[14px] font-black"><span>TOTAL:</span><span>{formatMoney(record.amount)} {currencySymbol}</span></div>

      <div className="mb-3 border-t border-black pt-2">
        <div className="flex justify-between"><span>Paid ({record.paymentMethod || 'Cash'}):</span><span>{formatMoney(record.paidAmount)}</span></div>
        {toNumber(record.remainingDebt) > 0 ? (
          <div className="flex justify-between font-black"><span>Credit Balance:</span><span>{formatMoney(record.remainingDebt)}</span></div>
        ) : (
          <div className="flex justify-between font-black"><span>Change:</span><span>{formatMoney(record.changeAmount)}</span></div>
        )}
      </div>

      <div className="mb-1 text-center text-[13px] font-black">{toNumber(record.remainingDebt) > 0 ? '*** CREDIT ***' : '*** PAID ***'}</div>
      <div className="text-center text-[10px]">{shopSettings.footerText || shopSettings.receiptFooter || 'Thank you for your business!'}</div>
    </div>
  );
}

