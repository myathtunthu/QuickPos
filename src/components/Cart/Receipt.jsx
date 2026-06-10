import React, { useMemo } from 'react';
import { formatMMK } from '../../utils/formatMMK';
import QRInvoice from './QRInvoice';
import Button from '../UI/Button';
import { Printer, Share2, FileText } from 'lucide-react';
import { generatePDFInvoice } from '../../utils/pdfGenerator';
import { shareReceiptData } from '../../utils/shareReceipt';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safeId = (value) => String(value || '-').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || '-';
const getUnitLabel = (item) => item?.selectedUnit || item?.unitName || item?.unit || 'pcs';
const formatQuantity = (value) => toNumber(value).toLocaleString('en-US', { maximumFractionDigits: 3 });

const normalizeReceipt = (receiptData = {}) => {
  const items = Array.isArray(receiptData.items) ? receiptData.items : [];
  const subtotal = toNumber(receiptData.subtotal ?? items.reduce((sum, item) => sum + toNumber(item.price) * toNumber(item.quantity), 0));
  const tax = toNumber(receiptData.tax);
  const discount = Math.min(Math.max(toNumber(receiptData.discount), 0), subtotal + tax);
  const total = Math.max(toNumber(receiptData.total ?? subtotal + tax - discount), 0);
  return {
    id: safeId(receiptData.id || receiptData.voucherNo || receiptData.receiptId),
    items,
    subtotal,
    tax,
    discount,
    total,
    timestamp: receiptData.timestamp || receiptData.createdAt || receiptData.date,
  };
};

const getDate = (timestamp) => {
  if (timestamp?.toDate) return timestamp.toDate();
  const date = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export default function Receipt({ receiptData = {}, storeName = 'Store', onPrintBluetooth }) {
  const receipt = useMemo(() => normalizeReceipt(receiptData), [receiptData]);
  const date = useMemo(() => getDate(receipt.timestamp), [receipt.timestamp]);
  const shortId = receipt.id === '-' ? '-' : receipt.id.slice(-8).toUpperCase();

  const handleShare = async () => {
    await shareReceiptData(receipt.id, receipt.total, storeName);
  };

  const handlePdf = () => {
    generatePDFInvoice(storeName, receipt.id, receipt.items, {
      subtotal: receipt.subtotal,
      tax: receipt.tax,
      discount: receipt.discount,
      total: receipt.total,
    }, date);
  };

  return (
    <div className="glass-panel p-6 rounded-xl max-w-sm mx-auto border border-gray-700 bg-gray-900/90">
      <div className="text-center mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold text-white break-words">{storeName || 'Store'}</h2>
        <p className="text-xs text-gray-400 font-mono mt-1">Official Receipt</p>
        <p className="text-xs text-gray-500 mt-2">ID: {shortId}</p>
        <p className="text-xs text-gray-500">{date.toLocaleString()}</p>
      </div>

      <div className="space-y-3 mb-6 font-mono text-sm">
        {receipt.items.length === 0 ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs text-amber-200">No receipt items found.</p>
        ) : receipt.items.map((item, index) => {
          const quantity = toNumber(item.quantity);
          const price = Math.max(toNumber(item.price), 0);
          const lineTotal = price * quantity;
          return (
            <div key={`${item.id || item.name || 'item'}-${index}`} className="flex justify-between gap-3 text-gray-300">
              <div className="min-w-0">
                <p className="break-words">{item.name || 'Unnamed product'}</p>
                <p className="text-xs text-gray-500">
                  {formatQuantity(quantity)} {getUnitLabel(item)} x {formatMMK(price)}
                </p>
              </div>
              <p className="shrink-0 text-right">{formatMMK(lineTotal)}</p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-800 pt-4 space-y-2 font-mono text-sm mb-6">
        <div className="flex justify-between text-gray-400">
          <span>Subtotal</span>
          <span>{formatMMK(receipt.subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Tax</span>
          <span>{formatMMK(receipt.tax)}</span>
        </div>
        {receipt.discount > 0 && (
          <div className="flex justify-between text-neon-pink">
            <span>Discount</span>
            <span>-{formatMMK(receipt.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-neon-cyan pt-2 border-t border-gray-800">
          <span>Total</span>
          <span>{formatMMK(receipt.total)}</span>
        </div>
      </div>

      <div className="flex justify-center mb-6 bg-white p-2 rounded-lg">
        <QRInvoice receiptId={shortId} total={receipt.total} storeName={storeName} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" onClick={handleShare} className="text-xs flex-col !p-2" icon={Share2}>
          <span className="mt-1">Share</span>
        </Button>
        <Button variant="ghost" onClick={handlePdf} className="text-xs flex-col !p-2" icon={FileText}>
          <span className="mt-1">PDF</span>
        </Button>
        <Button onClick={onPrintBluetooth} className="text-xs flex-col !p-2" icon={Printer} disabled={typeof onPrintBluetooth !== 'function'}>
          <span className="mt-1">Print</span>
        </Button>
      </div>
    </div>
  );
}
