/**
 * Utility to generate and print PDF invoices
 * Opens a print dialog formatted for standard A4 or 80mm receipt printers
 */
import { formatMMK } from './formatMMK';

export const generatePDFInvoice = (storeName, receiptId, items, totals, date) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow pop-ups to generate PDF invoices.");
    return;
  }

  // Generate HTML content for the invoice
  const htmlContent = `
    <html>
      <head>
        <title>Invoice - ${receiptId}</title>
        <style>
          body { font-family: monospace; padding: 20px; color: #000; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .meta { font-size: 12px; margin-bottom: 20px; }
          table { w-full: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          th { background-color: #f8f9fa; }
          .totals { text-align: right; margin-top: 20px; }
          .totals p { margin: 5px 0; }
          .totals .grand-total { font-size: 18px; font-weight: bold; }
          @media print {
            body { padding: 0; }
            @page { margin: 0.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${storeName}</h1>
          <p>Official Receipt / Invoice</p>
        </div>
        
        <div class="meta">
          <p><strong>Receipt ID:</strong> ${receiptId}</p>
          <p><strong>Date:</strong> ${date.toLocaleString()}</p>
        </div>

        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatMMK(item.price)}</td>
                <td>${formatMMK(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <p>Subtotal: ${formatMMK(totals.subtotal)}</p>
          <p>Tax (5%): ${formatMMK(totals.tax)}</p>
          ${totals.discount > 0 ? `<p>Discount: -${formatMMK(totals.discount)}</p>` : ''}
          <p class="grand-total">Total: ${formatMMK(totals.total)}</p>
        </div>
        
        <div class="header" style="margin-top: 40px; font-size: 12px;">
          <p>Thank you for your business!</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
