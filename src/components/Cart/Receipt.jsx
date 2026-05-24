import React from 'react';
import { formatMMK } from '../../utils/formatMMK';
import QRInvoice from './QRInvoice';
import Button from '../UI/Button';
import { Printer, Share2, FileText } from 'lucide-react';
import { generatePDFInvoice } from '../../utils/pdfGenerator';
import { shareReceiptData } from '../../utils/shareReceipt';

export default function Receipt({ receiptData, storeName, onPrintBluetooth }) {
  const { id, items, total, tax, subtotal, discount, timestamp } = receiptData;
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();

  const handleShare = async () => {
    await shareReceiptData(id, total, storeName);
  };

  return (
    <div className="glass-panel p-6 rounded-xl max-w-sm mx-auto border border-gray-700 bg-gray-900/90">
      <div className="text-center mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold text-white">{storeName}</h2>
        <p className="text-xs text-gray-400 font-mono mt-1">Official Receipt</p>
        <p className="text-xs text-gray-500 mt-2">ID: {id.slice(-8).toUpperCase()}</p>
        <p className="text-xs text-gray-500">{date.toLocaleString()}</p>
      </div>

      <div className="space-y-3 mb-6 font-mono text-sm">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between text-gray-300">
            <div>
              <p>{item.name}</p>
              <p className="text-xs text-gray-500">{item.quantity} x {formatMMK(item.price)}</p>
            </div>
            <p>{formatMMK(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-4 space-y-2 font-mono text-sm mb-6">
        <div className="flex justify-between text-gray-400">
          <span>Subtotal</span>
          <span>{formatMMK(subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Tax</span>
          <span>{formatMMK(tax)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-neon-pink">
            <span>Discount</span>
            <span>-{formatMMK(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-neon-cyan pt-2 border-t border-gray-800">
          <span>Total</span>
          <span>{formatMMK(total)}</span>
        </div>
      </div>

      <div className="flex justify-center mb-6 bg-white p-2 rounded-lg">
        <QRInvoice receiptId={id.slice(-8).toUpperCase()} total={total} storeName={storeName} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" onClick={handleShare} className="text-xs flex-col !p-2" icon={Share2}>
          <span className="mt-1">Share</span>
        </Button>
        <Button variant="ghost" onClick={() => generatePDFInvoice(storeName, id, items, {subtotal, tax, discount, total}, date)} className="text-xs flex-col !p-2" icon={FileText}>
          <span className="mt-1">PDF</span>
        </Button>
        <Button onClick={onPrintBluetooth} className="text-xs flex-col !p-2" icon={Printer}>
          <span className="mt-1">Print</span>
        </Button>
      </div>
    </div>
  );
}
