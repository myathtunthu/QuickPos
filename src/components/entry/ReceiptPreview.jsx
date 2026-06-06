import React from 'react';
import { ReceiptText } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ReceiptPreview({ record, shopSettings, title, compact = false }) {
  const { t } = useLanguage();
  const items = Array.isArray(record?.itemsDetail) ? record.itemsDetail : [];
  const logoSrc = shopSettings?.logoUrl || shopSettings?.logo || shopSettings?.shopLogo || '';
  const hasLogo = Boolean(logoSrc);
  const totalDiscount = Number(record?.itemDiscount || 0) + Number(record?.globalDiscount || 0);
  const isCredit = Number(record?.remainingDebt || 0) > 0;
  const footerText = shopSettings?.receiptFooter || shopSettings?.footerText || t('receiptFooterDefault', 'Thank you for your business!');
  const paymentMethod = record?.paymentMethod === 'Cash' ? t('cash', 'Cash') : record?.paymentMethod === 'Credit' ? t('credit', 'Credit') : record?.paymentMethod;

  return (
    <div className="bg-[#0d1120]/95 border border-cyan-500/20 rounded-3xl p-4 shadow-xl shadow-cyan-950/20">
      <div className="flex items-center justify-between mb-3 print:hidden">
        <div className="flex items-center gap-2">
          <ReceiptText size={18} className="text-cyan-400" />
          <h2 className="text-sm font-black text-slate-200">{title || t('receiptPreview', 'Receipt Preview')}</h2>
        </div>
        <span className="text-[10px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-1">
          {t('live', 'LIVE')}
        </span>
      </div>

      <div className={`mx-auto bg-white text-black shadow-inner ${compact ? 'max-w-[280px]' : 'max-w-sm'} rounded-sm p-3 font-mono text-[10px] leading-tight`}>
        <div className="text-center mb-2">
          {hasLogo && (
            <img src={logoSrc} alt={shopSettings.shopName || 'Shop Logo'} className="h-9 w-auto mx-auto mb-1 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          <div className="font-black text-[13px] uppercase tracking-wide">{shopSettings?.shopName || 'POS'}</div>
          {shopSettings?.address && <div className="text-[9px] mt-0.5">{shopSettings.address}</div>}
          {shopSettings?.phone && <div className="text-[9px]">{t('tel', 'Tel')}: {shopSettings.phone}</div>}
        </div>

        <div className="border-t border-b border-dashed border-black py-2 space-y-1">
          <div className="flex justify-between gap-3"><span>{t('voucher', 'Voucher')}:</span><b>{record?.voucherNo || 'PREVIEW'}</b></div>
          <div className="flex justify-between gap-3"><span>{t('dateLabel', 'Date')}:</span><span>{record?.date || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>{t('timeLabel', 'Time')}:</span><span>{record?.time || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>{t('cashierLabel', 'Cashier')}:</span><span>{record?.cashier || '-'}</span></div>
          <div className="flex justify-between gap-3"><span>{record?.type === 'Purchase' ? t('supplierLabel', 'Supplier') : t('customerLabel', 'Customer')}:</span><span className="text-right">{record?.personName || t('walkInCustomer', 'Walk-in')}</span></div>
        </div>

        <table className="w-full my-2 border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">{t('itemLabel', 'Item')}</th>
              <th className="text-right py-1">{t('amountLabel', 'Amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="2" className="py-5 text-center text-gray-400">{t('noItems', 'No items')}</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={`${item.name || 'item'}-${index}`}>
                  <td className="py-1 align-top pr-2">
                    <div className="font-bold break-words">{item.name || t('unknownItem', 'Item')}</div>
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
          <div className="flex justify-between"><span>{t('subtotalLabel', 'Subtotal')}:</span><span>{Number(record?.subtotal || 0).toLocaleString()}</span></div>
          {totalDiscount > 0 && <div className="flex justify-between"><span>{t('discountLabel', 'Discount')}:</span><span>-{totalDiscount.toLocaleString()}</span></div>}
        </div>

        <div className="flex justify-between border-t border-black pt-2 mt-2 text-[12px] font-black">
          <span>{t('totalLabel', 'TOTAL')}:</span><span>{Number(record?.amount || 0).toLocaleString()}</span>
        </div>

        <div className="border-t border-black pt-2 mt-2 space-y-1">
          <div className="flex justify-between"><span>{t('paidLabel', 'Paid')} ({paymentMethod || t('cash', 'Cash')}):</span><span>{Number(record?.paidAmount || 0).toLocaleString()}</span></div>
          {isCredit ? (
            <div className="flex justify-between font-bold"><span>{t('creditBalanceLabel', 'Credit Balance')}:</span><span>{Number(record?.remainingDebt || 0).toLocaleString()}</span></div>
          ) : (
            <div className="flex justify-between font-bold"><span>{t('changeLabel', 'Change')}:</span><span>{Number(record?.changeAmount || 0).toLocaleString()}</span></div>
          )}
        </div>

        <div className="text-center font-black mt-3">*** {isCredit ? t('creditStatus', 'CREDIT') : t('paidStatus', 'PAID')} ***</div>
        {footerText && <div className="text-center text-[9px] mt-1">{footerText}</div>}
      </div>
    </div>
  );
}
