const isBlank = (value) => String(value ?? '').trim().length === 0;
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const hasDuplicate = (values) => {
  const seen = new Set();
  return values.some((value) => {
    const key = String(value ?? '').trim().toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
};

export const validators = {
  validateProduct: (product = {}) => {
    const errors = {};

    if (isBlank(product.name)) errors.name = 'ကုန်ပစ္စည်းအမည် (Product name) ထည့်ရန် လိုအပ်ပါသည်။';
    if (isBlank(product.category)) errors.category = 'အမျိုးအစား (Category) ရွေးချယ်ရန် လိုအပ်ပါသည်။';
    if (toNumber(product.minStock, 0) < 0) errors.minStock = 'အနည်းဆုံးလက်ကျန် (Min Stock) သည် အနှုတ်မဖြစ်ရပါ။';
    if (toNumber(product.stockBase ?? product.stock, 0) < 0) errors.stock = 'လက်ကျန်ပမာဏသည် အနှုတ်မဖြစ်ရပါ။';
    if (toNumber(product.costPrice ?? product.cost, 0) < 0) errors.costPrice = 'ဝယ်ဈေးသည် အနှုတ်မဖြစ်ရပါ။';
    if (toNumber(product.price ?? product.salePrice, 0) < 0) errors.price = 'ရောင်းဈေးသည် အနှုတ်မဖြစ်ရပါ။';

    const units = Array.isArray(product.packageUnits) ? product.packageUnits : [];
    if (units.length === 0) {
      errors.packageUnits = 'အနည်းဆုံး Package Unit တစ်ခု ပါဝင်ရပါမည်။';
    } else {
      if (units.some((unit) => isBlank(unit.name))) errors.unitName = 'Package Unit အမည်များ အလွတ်ဖြစ်နေ၍ မရပါ။';
      if (units.some((unit) => toNumber(unit.multiplier, 1) <= 0)) errors.unitMultiplier = 'Package Unit multiplier သည် 0 ထက်ကြီးရပါမည်။';
      if (hasDuplicate(units.map((unit) => unit.name))) errors.unitDuplicate = 'Package Unit အမည်များ မထပ်ရပါ။';
    }

    return errors;
  },

  validateTransaction: (record = {}) => {
    const errors = {};
    const items = Array.isArray(record.itemsDetail) ? record.itemsDetail : Array.isArray(record.items) ? record.items : [];

    if (items.length === 0) {
      errors.itemsDetail = 'Cart ထဲတွင် အနည်းဆုံး ပစ္စည်းတစ်ခု ပါဝင်ရပါမည်။';
    } else {
      if (items.some((item) => toNumber(item.quantity, 0) <= 0)) errors.quantity = 'ပစ္စည်း အရေအတွက် မှားယွင်းနေပါသည်။';
      if (items.some((item) => toNumber(item.price ?? item.unitPrice, 0) < 0)) errors.price = 'ပစ္စည်းဈေးနှုန်း မှားယွင်းနေပါသည်။';
      if (items.some((item) => toNumber(item.itemDiscountAmt ?? item.itemDiscount, 0) < 0)) errors.discount = 'လျှော့ဈေးသည် အနှုတ်မဖြစ်ရပါ။';
    }

    if (toNumber(record.amount ?? record.total, 0) < 0) errors.amount = 'စုစုပေါင်း ကျသင့်ငွေ မှားယွင်းနေပါသည်။';
    if (toNumber(record.paidAmount, 0) < 0) errors.paidAmount = 'ပေးချေငွေသည် အနှုတ်မဖြစ်ရပါ။';
    if (record.paymentMethod === 'Credit' && isBlank(record.personId) && isBlank(record.personName)) {
      errors.customer = 'Credit ဖြင့်ရောင်းရန် Customer ရွေးရန်လိုအပ်ပါသည်။';
    }

    return errors;
  },
};

export const validateAndShowErrors = (data, validator, showToast) => {
  if (typeof validator !== 'function') {
    throw new TypeError('validator must be a function.');
  }

  const errors = validator(data);
  const errorKeys = Object.keys(errors);

  if (errorKeys.length > 0) {
    const errorMessage = Object.values(errors).join('\n');
    if (typeof showToast === 'function') {
      showToast(errorMessage, 'error');
    } else {
      window.alert?.(`အချက်အလက် မှားယွင်းနေပါသည်:\n\n${errorMessage}`);
    }
    return false;
  }

  return true;
};
