import { escapeAttribute, escapeHtml, formatReceiptNumber, getReceiptDate } from './receiptGenerator';

export const doPrint = (record = {}, settings = null) => {
  const fmt = formatReceiptNumber;
  const items = Array.isArray(record.items) && record.items.length > 0
    ? record.items
    : Array.isArray(record.itemsDetail) && record.itemsDetail.length > 0
      ? record.itemsDetail
      : [{ name: record.item || 'Item', quantity: 1, price: record.amount || 0, itemDiscountAmt: 0 }];

  const shopName = settings?.storeName || settings?.shopName || 'CyberPOS Store';
  const shopAddress = settings?.storeAddress || settings?.address || '';
  const shopPhone = settings?.storePhone || settings?.phone || '';
  const footerMessage = settings?.receiptFooter || settings?.footerText || 'ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်!';
  const receiptId = record.id || record.voucherNo || record.invoiceNo || 'receipt';
  const receiptShortId = String(receiptId).slice(-8).toUpperCase();
  const receiptDate = getReceiptDate(record.timestamp || record.createdAt || record.date);
  const dateStr = receiptDate.toLocaleDateString('en-GB');
  const timeStr = receiptDate.toLocaleTimeString('en-GB');
  const total = record.total ?? record.amount ?? 0;
  const qrText = `INV:${receiptShortId}\nDate:${dateStr}\nTotal:${Number(total) || 0} Ks`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrText)}`;

  const rows = items.map((item, idx) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price ?? item.unitPrice) || 0;
    const discount = Number(item.itemDiscountAmt ?? item.itemDiscount) || 0;
    const amount = Math.max(0, (price * quantity) - discount);
    const disc = discount > 0 ? `<br><small style="color:#888;">(-${fmt(discount)} Disc)</small>` : '';

    return `<tr>
      <td style="font-size:13px;color:#000;">${idx + 1}. ${escapeHtml(item.name || 'Item')}${disc}</td>
      <td align="center" style="color:#000;">${fmt(quantity)}</td>
      <td align="right" style="color:#000;">${fmt(amount)}</td>
    </tr>`;
  }).join('');

  const w = window.open('', '_blank', 'noopener,noreferrer');

  if (!w) {
    window.alert?.('Please allow popups to print receipts.');
    return;
  }

  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt - ${escapeHtml(receiptShortId)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #000; background: #e5e7eb; margin: 0; padding: 0; }
    .actions-bar { position: sticky; top: 0; background: #1f2937; padding: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    .btn { padding: 10px 20px; margin: 0 5px; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; }
    .btn-print { background: #06b6d4; color: #000; }
    .btn-close { background: #ef4444; color: #fff; }
    .receipt-box { width: 340px; margin: 20px auto; padding: 15px; background: #fff; border: 1px dashed #000; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
    .shop-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; color: #000; }
    .info { font-size: 12px; color: #555; margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { padding: 6px 0; border-bottom: 1px dotted #ccc; font-size: 13px; }
    th { border-bottom: 1px solid #000; color: #000; }
    .total-row { font-weight: bold; font-size: 16px; border-top: 1px solid #000; padding-top: 8px; color: #000; }
    .footer { text-align: center; margin-top: 15px; font-size: 11px; color: #555; }
    .qr { text-align: center; margin: 15px 0; }
    @media print { body { background: #fff; } .actions-bar { display: none !important; } .receipt-box { margin: 0; padding: 0; border: none; box-shadow: none; width: 100%; } }
  </style></head><body>
  <div class="actions-bar no-print"><button class="btn btn-print" type="button">🖨 Print</button><button class="btn btn-close" type="button">❌ Close</button></div>
  <div class="receipt-box">
    <div class="header">
      <div class="shop-name">${escapeHtml(shopName)}</div>
      ${shopAddress ? `<div class="info">📍 ${escapeHtml(shopAddress)}</div>` : ''}
      ${shopPhone ? `<div class="info">📞 ${escapeHtml(shopPhone)}</div>` : ''}
      <div class="info" style="margin-top:8px;">📅 ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</div>
      <div class="info">Invoice: ${escapeHtml(receiptShortId)}</div>
    </div>
    <table><thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Amt</th></tr></thead><tbody>${rows}</tbody></table>
    ${Number(record.discount ?? record.globalDiscount) > 0 ? `<div style="text-align:right;font-size:13px;margin:5px 0;">Global Disc: -${fmt(record.discount ?? record.globalDiscount)} Ks</div>` : ''}
    <div class="total-row" style="text-align:right;">TOTAL: ${fmt(total)} Ks</div>
    <div class="info" style="text-align:right;margin-top:4px;">${escapeHtml(record.paymentMethod === 'credit' ? '💳 Credit' : record.paymentMethod || '💵 Cash')}</div>
    <div class="info" style="text-align:right;">Cashier: ${escapeHtml(record.cashierName || record.cashier || '-')}</div>
    ${record.personName && record.personName !== 'Walk-in' ? `<div class="info" style="text-align:right;">Customer: ${escapeHtml(record.personName)}</div>` : ''}
    <div class="qr"><img src="${escapeAttribute(qrSrc)}" width="100" height="100" alt="QR"></div>
    <div class="footer">${escapeHtml(footerMessage).replace(/\n/g, '<br>')}</div>
  </div>
  <script>
    document.querySelector('.btn-print').addEventListener('click', () => window.print());
    document.querySelector('.btn-close').addEventListener('click', () => window.close());
    window.onload = () => setTimeout(() => window.print(), 500);
  </script>
  </body></html>`);
  w.document.close();
};
