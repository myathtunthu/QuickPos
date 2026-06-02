/**
 * Data Validators
 */
export const validators = {

  // Product validation (ကုန်ပစ္စည်း အသစ်သွင်း/ပြင် လျှင် စစ်ရန်)
  validateProduct: (product) => {
    const errors = {};
    if (!product.name || !product.name.trim()) {
      errors.name = 'ကုန်ပစ္စည်းအမည် (Product name) ထည့်ရန် လိုအပ်ပါသည်။';
    }
    if (!product.category || !product.category.trim()) {
      errors.category = 'အမျိုးအစား (Category) ရွေးချယ်ရန် လိုအပ်ပါသည်။';
    }
    if (product.minStock && Number(product.minStock) < 0) {
      errors.minStock = 'အနည်းဆုံးလက်ကျန် (Min Stock) သည် အနှုတ်မဖြစ်ရပါ။';
    }
    if (!product.packageUnits || product.packageUnits.length === 0) {
      errors.packageUnits = 'အနည်းဆုံး Package Unit တစ်ခု ပါဝင်ရပါမည်။';
    } else {
      // ယူနစ်တစ်ခုချင်းစီကို ထပ်စစ်မည်
      const invalidUnit = product.packageUnits.find(u => !u.name || !u.name.trim());
      if (invalidUnit) {
        errors.unitName = 'Package Unit အမည်များ အလွတ်ဖြစ်နေ၍ မရပါ။';
      }
    }
    return errors;
  },

  // Sale/Transaction validation (အရောင်း/အဝယ် ဘေလ်ဖြတ်လျှင် စစ်ရန်)
  validateTransaction: (record) => {
    const errors = {};
    if (!record.itemsDetail || record.itemsDetail.length === 0) {
      errors.itemsDetail = 'Cart ထဲတွင် အနည်းဆုံး ပစ္စည်းတစ်ခု ပါဝင်ရပါမည်။';
    } else {
      const invalidQty = record.itemsDetail.find(item => Number(item.quantity) <= 0);
      if (invalidQty) {
        errors.quantity = 'ပစ္စည်း အရေအတွက် မှားယွင်းနေပါသည်။';
      }
    }
    if (Number(record.amount) < 0) {
      errors.amount = 'စုစုပေါင်း ကျသင့်ငွေ မှားယွင်းနေပါသည်။';
    }
    return errors;
  }
};

/**
 * Validate and show errors (Error ရှိလျှင် Alert/Toast ပြပြီး False ပြန်ပေးမည်)
 * @param {Object} data The data object to validate
 * @param {Function} validator The specific validator function
 * @param {Function} showToast Function to show alert
 * @returns {Boolean} true if valid, false if invalid
 */
export const validateAndShowErrors = (data, validator, showToast) => {
  const errors = validator(data);
  const errorKeys = Object.keys(errors);
  
  if (errorKeys.length > 0) {
    const errorMessage = Object.values(errors).join('\n');
    if (showToast) {
      showToast(errorMessage, 'error');
    } else {
      alert(`အချက်အလက် မှားယွင်းနေပါသည်:\n\n${errorMessage}`);
    }
    return false;
  }
  return true;
};
