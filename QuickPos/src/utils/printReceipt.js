export const doPrint = (record, settings = null) => {
  const fmt = n => (Number(n) || 0).toLocaleString();
  const items = record.items || [{ name: record.item, quantity: 1, price: record.amount, itemDiscountAmt: 0 }];
  
  const shopName = settings?.storeName || 'CyberPOS Store';
  const shopAddress = settings?.storeAddress || '';
  const shopPhone = settings?.storePhone || '';
  const footerMessage = settings?.receiptFooter || 'ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်!';

  const qrText = `INV:${record.id.slice(-8)}\nDate:${new Date(record.timestamp?.toDate()).toLocaleDateString()}\nTotal:${record.total} Ks`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrText)}`;
  
  const rows = items.map((i, idx) => {
    const disc = i.itemDiscountAmt > 0 ? `<br><small style="color:#888;">(-${fmt(i.itemDiscountAmt)} Disc)</small>` : '';
    return `<tr><td style="font-size:13px;color:#000;">${idx+1}. ${i.name}${disc}</td><td align="center" style="color:#000;">${i.quantity}</td><td align="right" style="color:#000;">${fmt((i.price * i.quantity) - (i.itemDiscountAmt || 0))}</td></tr>`;
  }).join('');
  
  const now = new Date(); 
  const timeStr = now.toLocaleTimeString('en-GB');
  const dateStr = now.toLocaleDateString('en-GB');
  
  // Tab အသစ်ဖွင့်မည်
  const w = window.open('', '_blank');
  
  if (!w) {
    alert("Please allow popups to print receipts.");
    return;
  }

  // HTML ရေးဆွဲခြင်း (အပေါ်ဆုံးတွင် Print နှင့် Close ခလုတ်များ ထည့်သွင်းထားသည်)
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt - ${record.id.slice(-8)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #000; background: #e5e7eb; margin: 0; padding: 0; }
    
    /* အပေါ်က Print/Close ခလုတ်များ (Print ထုတ်ချိန်တွင် မပေါ်အောင် ဖျောက်ထားမည်) */
    .actions-bar { position: sticky; top: 0; background: #1f2937; padding: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    .btn { padding: 10px 20px; margin: 0 5px; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; }
    .btn-print { background: #06b6d4; color: #000; }
    .btn-close { background: #ef4444; color: #fff; }
    
    /* ပြေစာဒီဇိုင်း */
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

    @media print {
      body { background: #fff; }
      .actions-bar { display: none !important; }
      .receipt-box { margin: 0; padding: 0; border: none; box-shadow: none; width: 100%; }
    }
  </style></head><body>
  
  <div class="actions-bar no-print">
    <button class="btn btn-print" onclick="window.print()">🖨 Print</button>
    <button class="btn btn-close" onclick="window.close()">❌ Close</button>
  </div>

  <div class="receipt-box">
    <div class="header">
      <div class="shop-name">${shopName}</div>
      ${shopAddress ? `<div class="info">📍 ${shopAddress}</div>` : ''}
      ${shopPhone ? `<div class="info">📞 ${shopPhone}</div>` : ''}
      <div class="info" style="margin-top:8px;">📅 ${dateStr} ${timeStr}</div>
      <div class="info">Invoice: ${record.id.slice(-8).toUpperCase()}</div>
    </div>
    <table><thead><tr><th align="left">Item</th><th>Qty</th><th align="right">Amt</th></tr></thead><tbody>${rows}</tbody></table>
    ${record.discount > 0 ? `<div style="text-align:right;font-size:13px;margin:5px 0;">Global Disc: -${fmt(record.discount)} Ks</div>` : ''}
    <div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.total)} Ks</div>
    <div class="info" style="text-align:right;margin-top:4px;">${record.paymentMethod === 'credit' ? '💳 Credit' : '💵 Cash'}</div>
    <div class="info" style="text-align:right;">Cashier: ${record.cashierName || '-'}</div>
    ${record.personName && record.personName !== 'Walk-in' ? `<div class="info" style="text-align:right;">Customer: ${record.personName}</div>` : ''}
    <div class="qr"><img src="${qrSrc}" width="100" height="100" alt="QR"/></div>
    <div class="footer">${footerMessage.replace(/\n/g, '<br>')}</div>
  </div>
  
  <script>
    window.onload = () => {
      // ပြေစာ ပွင့်လာတာနဲ့ Print Dialog ကို Auto ခေါ်ပေးမည်
      // သို့သော် Auto ပိတ်ခြင်း (window.close) ကို လုံးဝ ဖြုတ်ထားပါသည်
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
  </body></html>`);
  w.document.close();
};
