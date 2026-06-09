import logger from './logger';

const safeText = (value, fallback = '') => String(value ?? fallback).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();

export const buildReceiptShareText = (receiptId, totalAmount, storeName) => {
  const store = safeText(storeName, 'Store');
  const receipt = safeText(receiptId, '-');
  const total = Number(totalAmount) || 0;
  return `🧾 Receipt from ${store}\nID: ${receipt}\nTotal: MMK ${total.toLocaleString('en-US')}\nThank you for shopping with us!`;
};

export const shareReceiptData = async (receiptId, totalAmount, storeName) => {
  const text = buildReceiptShareText(receiptId, totalAmount, storeName);
  const title = `${safeText(storeName, 'Store')} Receipt`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') logger.warn('Share failed:', error);
    }
  }

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return false;
    } catch (error) {
      logger.warn('Clipboard fallback failed:', error);
    }
  }

  return false;
};
