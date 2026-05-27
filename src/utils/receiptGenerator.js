export function generateReceiptHTML(record, shopInfo) {
  const items = record.items || [];
  const fmt = (n) => (Number(n) || 0).toLocaleString();
  
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Receipt</title>
    <style>
      body {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        width: 360px;
        margin: 20px auto;
        padding: 20px;
        border: 2px dashed #000;
        background: #fff;
      }
      .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
      .shop-name { font-size: 22px; font-weight: bold; }
      .shop-info { font-size: 11px; color: #555; margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
      td { padding: 5px 0; }
      td:last-child { text-align: right; }
      .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 10px; margin-top: 8px; text-align: right; }
      .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #555; border-top: 1px dashed #ccc; padding-top: 10px; }
      .debt-info { background: #f0f0f0; padding: 8px; margin-top: 10px; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="shop-name">${shopInfo.name || 'QuickPOS'}</div>
      <div class="shop-info">📞 ${shopInfo.phone || '09-123456789'}</div>
      <div class="shop-info">📍 ${shopInfo.address || 'Yangon'}</div>
      <div class="shop-info">📅 ${record.date || new Date().toLocaleDateString()}</div>
      <div class="shop-info">🧾 ${record.invoiceNo || record.id?.slice(-8) || 'INV-001'}</div>
    </div>
    
    <table>
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.name}${item.itemDiscount ? `<br><small style="color:#888;">Disc: -${fmt(item.itemDiscount)}</small>` : ''}</td>
            <td>${item.quantity}</td>
            <td>${item.unitName || '-'}</td>
            <td>${fmt(item.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    ${record.globalDiscount ? `<p class="discount-row" style="text-align:right;">Global Disc: -${fmt(record.globalDiscount)} Ks</p>` : ''}
    
    <div class="total-row">
      TOTAL: ${fmt(record.total)} Ks
    </div>
    
    <p style="text-align:right;">Method: ${record.paymentMethod}</p>
    <p style="text-align:right;">Paid: ${fmt(record.paidAmount)} Ks</p>
    
    ${record.remainingDebt > 0 ? `
      <div class="debt-info">
        ⚠️ Remaining Debt: ${fmt(record.remainingDebt)} Ks
      </div>
    ` : ''}
    
    <div class="footer">
      ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>
      Thank you for your purchase!
    </div>
    
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
  </body>
  </html>`;
}
