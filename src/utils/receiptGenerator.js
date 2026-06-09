export const escapeHtml = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const escapeAttribute = (value = '') => escapeHtml(value).replaceAll('`', '&#096;');

export const formatReceiptNumber = (value) => (Number(value) || 0).toLocaleString('en-US', {
  maximumFractionDigits: 2,
});

export const getReceiptDate = (value) => {
  if (!value) return new Date();
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export function generateReceiptHTML(record = {}, shopInfo = {}) {
  const items = Array.isArray(record.items) ? record.items : Array.isArray(record.itemsDetail) ? record.itemsDetail : [];
  const fmt = formatReceiptNumber;
  const invoiceNo = record.invoiceNo || record.voucherNo || record.id?.slice?.(-8) || 'INV-001';
  const date = record.date || getReceiptDate(record.timestamp).toLocaleDateString('en-GB');
  const shopName = shopInfo.name || shopInfo.shopName || shopInfo.storeName || 'QuickPOS';
  const shopPhone = shopInfo.phone || shopInfo.storePhone || '';
  const shopAddress = shopInfo.address || shopInfo.storeAddress || '';
  const footer = shopInfo.receiptFooter || shopInfo.footerText || 'ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်';

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Receipt - ${escapeHtml(invoiceNo)}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 13px; width: 360px; margin: 20px auto; padding: 20px; border: 2px dashed #000; background: #fff; color: #000; }
      .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
      .shop-name { font-size: 22px; font-weight: bold; }
      .shop-info { font-size: 11px; color: #555; margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
      td { padding: 5px 0; vertical-align: top; }
      td:last-child { text-align: right; }
      .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 10px; margin-top: 8px; text-align: right; }
      .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #555; border-top: 1px dashed #ccc; padding-top: 10px; }
      .debt-info { background: #f0f0f0; padding: 8px; margin-top: 10px; font-size: 12px; }
      @media print { body { margin: 0 auto; border: none; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="shop-name">${escapeHtml(shopName)}</div>
      ${shopPhone ? `<div class="shop-info">📞 ${escapeHtml(shopPhone)}</div>` : ''}
      ${shopAddress ? `<div class="shop-info">📍 ${escapeHtml(shopAddress)}</div>` : ''}
      <div class="shop-info">📅 ${escapeHtml(date)}</div>
      <div class="shop-info">🧾 ${escapeHtml(invoiceNo)}</div>
    </div>

    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map((item) => {
          const quantity = Number(item.quantity) || 0;
          const subtotal = item.subtotal ?? item.itemTotal ?? ((Number(item.price ?? item.unitPrice) || 0) * quantity - (Number(item.itemDiscount ?? item.itemDiscountAmt) || 0));
          const discount = Number(item.itemDiscount ?? item.itemDiscountAmt) || 0;
          return `<tr>
            <td>${escapeHtml(item.name || 'Item')}${discount > 0 ? `<br><small style="color:#888;">Disc: -${fmt(discount)}</small>` : ''}</td>
            <td>${escapeHtml(quantity)}</td>
            <td>${escapeHtml(item.unitName || '-')}</td>
            <td>${fmt(subtotal)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    ${Number(record.globalDiscount) > 0 ? `<p style="text-align:right;">Global Disc: -${fmt(record.globalDiscount)} Ks</p>` : ''}
    <div class="total-row">TOTAL: ${fmt(record.total ?? record.amount)} Ks</div>
    <p style="text-align:right;">Method: ${escapeHtml(record.paymentMethod || '-')}</p>
    <p style="text-align:right;">Paid: ${fmt(record.paidAmount)} Ks</p>
    ${Number(record.remainingDebt) > 0 ? `<div class="debt-info">⚠️ Remaining Debt: ${fmt(record.remainingDebt)} Ks</div>` : ''}
    <div class="footer">${escapeHtml(footer).replace(/\n/g, '<br>')}<br>Thank you for your purchase!</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
  </body>
  </html>`;
}
