import React, { useMemo, useState } from 'react';

const safeText = (value, fallback = '') => {
  const text = String(value ?? fallback).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return text.slice(0, 200);
};

/**
 * Privacy-safe receipt data card.
 * External QR APIs leak receipt/store data to a third party, so the default UI does not call any remote QR service.
 * If the shop later wants real QR generation, add an offline QR library and render it locally.
 */
export default function QRInvoice({ receiptId, total, storeName, allowExternalQr = false }) {
  const [copied, setCopied] = useState(false);
  const receiptData = useMemo(() => {
    const id = safeText(receiptId, '-');
    const store = safeText(storeName, 'Store');
    const amount = Number(total);
    return `RECEIPT\nStore: ${store}\nID: ${id}\nTotal: MMK ${Number.isFinite(amount) ? amount.toLocaleString('en-US') : '0'}`;
  }, [receiptId, storeName, total]);

  const encodedData = encodeURIComponent(receiptData);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodedData}&bgcolor=ffffff&color=000000`;

  const copyReceipt = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiptData);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg text-black">
      {allowExternalQr ? (
        <img
          src={qrUrl}
          alt="Receipt QR Code"
          className="w-32 h-32 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-400 p-2 text-center font-mono">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Receipt ID</span>
          <span className="mt-2 break-all text-lg font-black">{safeText(receiptId, '-')}</span>
        </div>
      )}
      <button type="button" onClick={copyReceipt} className="mt-2 text-center font-mono text-xs underline underline-offset-2">
        {copied ? 'Copied' : allowExternalQr ? 'Scan or copy receipt' : 'Copy digital receipt'}
      </button>
      {!allowExternalQr && (
        <p className="mt-1 max-w-[160px] text-center text-[10px] text-gray-500">
          External QR disabled for customer privacy.
        </p>
      )}
    </div>
  );
}
