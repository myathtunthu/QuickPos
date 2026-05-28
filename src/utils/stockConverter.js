/**
 * ဥပမာ - ၁ ဖာ (Multiplier: 24) ကို ဝယ်လျှင်, Qty 2 ဆိုပါက 48 ဘူး အဖြစ်ပြောင်းပေးမည်။
 */
export const calculateBaseQty = (quantity, multiplier) => {
  const qty = Number(quantity) || 0;
  const mult = Number(multiplier) || 1;
  return qty * mult;
};

/**
 * ဝယ်မည့်ပမာဏသည် လက်ကျန် Stock ထက် များနေသလား စစ်ဆေးရန်
 */
export const checkStockAvailability = (requestedQty, multiplier, currentStockBase) => {
  const neededBaseQty = calculateBaseQty(requestedQty, multiplier);
  const stock = Number(currentStockBase) || 0;
  
  return {
    isAvailable: neededBaseQty <= stock,
    needed: neededBaseQty,
    remaining: stock - neededBaseQty
  };
};

/**
 * Display ပြရန်အတွက် Helper (ဥပမာ - "240 ဘူး")
 */
export const formatStockDisplay = (stockBase, baseUnitName = 'ခု') => {
  return `${Number(stockBase).toLocaleString()} ${baseUnitName}`;
};
