import React from 'react';

/**
 * QR Invoice Component
 * Generates a scannable QR code for the digital receipt using a free QR API
 * Useful for customers to scan and save their receipt to their phones.
 */
export default function QRInvoice({ receiptId, total, storeName }) {
  // Construct the data string that the QR code will hold
  const receiptData = `RECEIPT\nStore: ${storeName}\nID: ${receiptId}\nTotal: MMK ${total}`;
  
  // URL encode the data for the API
  const encodedData = encodeURIComponent(receiptData);
  
  // We use a public API to generate the QR code image on the fly to save bundle size
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodedData}&bgcolor=ffffff&color=000000`;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg">
      <img src={qrUrl} alt="Receipt QR Code" className="w-32 h-32 object-contain" />
      <p className="text-black font-mono text-xs mt-2 text-center">
        Scan to save digital receipt
      </p>
    </div>
  );
}
