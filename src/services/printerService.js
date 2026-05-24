/**
 * Bluetooth Thermal Printer Service (Web Bluetooth API)
 * Specifically targeting 58mm/80mm ESC/POS thermal printers common in Myanmar
 */

export const connectPrinter = async () => {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Generic ESC/POS UUID
      optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']
    });

    const server = await device.gatt.connect();
    console.log("Connected to thermal printer:", device.name);
    return server;
  } catch (error) {
    console.error("Printer connection failed:", error);
    throw error;
  }
};

export const printReceipt = async (server, cartData, totals, tenantName) => {
  if (!server) throw new Error("No printer connected");
  
  // ESC/POS Commands
  const ESC = "\x1B";
  const GS = "\x1D";
  const INIT = ESC + "@";
  const ALIGN_CENTER = ESC + "a" + "\x01";
  const ALIGN_LEFT = ESC + "a" + "\x00";
  const BOLD_ON = ESC + "E" + "\x01";
  const BOLD_OFF = ESC + "E" + "\x00";
  const CUT = GS + "V" + "\x41" + "\x00";

  let receiptText = INIT;
  receiptText += ALIGN_CENTER + BOLD_ON + tenantName + "\n\n" + BOLD_OFF;
  receiptText += "--------------------------------\n";
  receiptText += ALIGN_LEFT;

  cartData.forEach(item => {
    receiptText += `${item.name}\n`;
    receiptText += `${item.quantity} x ${item.price} = ${item.quantity * item.price}\n`;
  });

  receiptText += "--------------------------------\n";
  receiptText += ALIGN_CENTER + BOLD_ON + `TOTAL: ${totals.total} MMK\n\n` + BOLD_OFF;
  receiptText += "Thank you for shopping!\n\n\n\n";
  receiptText += CUT;

  const encoder = new TextEncoder();
  const data = encoder.encode(receiptText);

  // Note: Finding the exact characteristic requires device-specific config.
  // This is a generic approach for the service UUID structure.
  const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
  const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
  
  await characteristic.writeValue(data);
};
