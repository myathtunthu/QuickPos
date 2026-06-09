import { formatMMK } from './formatMMK';
import { escapeHtml } from './receiptGenerator';

const toDate = (value) => {
  if (value instanceof Date) return value;
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const generatePDFInvoice = (storeName, receiptId, items = [], totals = {}, date = new Date()) => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    window.alert?.('Please allow pop-ups to generate PDF invoices.');
    return false;
  }

  const safeItems = Array.isArray(items) ? items : [];
  const invoiceDate = toDate(date);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice - ${escapeHtml(receiptId)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .meta { font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; }
          .totals { text-align: right; margin-top: 20px; }
          .totals p { margin: 5px 0; }
          .totals .grand-total { font-size: 18px; font-weight: bold; }
          @media print { body { padding: 0; } @page { margin: 0.5cm; } }
        </style>
      </head>
      <body>
        <div class="header"><h1>${escapeHtml(storeName || 'Store')}</h1><p>Official Receipt / Invoice</p></div>
        <div class="meta"><p><strong>Receipt ID:</strong> ${escapeHtml(receiptId || '-')}</p><p><strong>Date:</strong> ${escapeHtml(invoiceDate.toLocaleString())}</p></div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>
            ${safeItems.map((item) => {
              const quantity = Number(item.quantity) || 0;
              const price = Number(item.price ?? item.unitPrice) || 0;
              return `<tr><td>${escapeHtml(item.name || 'Item')}</td><td>${escapeHtml(quantity)}</td><td>${formatMMK(price)}</td><td>${formatMMK(price * quantity)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>Subtotal: ${formatMMK(totals.subtotal)}</p>
          ${Number(totals.tax) > 0 ? `<p>Tax: ${formatMMK(totals.tax)}</p>` : ''}
          ${Number(totals.discount) > 0 ? `<p>Discount: -${formatMMK(totals.discount)}</p>` : ''}
          <p class="grand-total">Total: ${formatMMK(totals.total)}</p>
        </div>
        <div class="header" style="margin-top: 40px; font-size: 12px;"><p>Thank you for your business!</p></div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
      </body>
    </html>`;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
};
