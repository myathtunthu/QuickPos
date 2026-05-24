/**
 * Receipt Sharing via Web Share API
 * Can be used for sharing receipts directly to Viber, Telegram, Messenger
 */
export const shareReceiptData = async (receiptId, totalAmount, storeName) => {
  const text = `🧾 Receipt from ${storeName}\nID: ${receiptId}\nTotal: MMK ${totalAmount}\nThank you for shopping with us!`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${storeName} Receipt`,
        text: text,
      });
      return true;
    } catch (error) {
      console.warn("Share failed:", error);
      return false;
    }
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(text);
    return false; // Indicating fallback was used
  }
};
