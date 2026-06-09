# POS / Entry Page အသုံးပြုသူလမ်းညွှန်

## ရည်ရွယ်ချက်
POS / Entry Page သည် နေ့စဉ်ရောင်းချခြင်း၊ ဝယ်ယူထည့်သွင်းခြင်း၊ Barcode Scan လုပ်ခြင်း၊ Cart စီမံခြင်း၊ Discount ထည့်ခြင်း၊ ငွေပေးချေခြင်းများအတွက် အဓိကအသုံးပြုသော စာမျက်နှာဖြစ်သည်။

## ပစ္စည်းရှာခြင်း
1. Product Search box ထဲတွင် ပစ္စည်းအမည်၊ barcode၊ SKU တို့ဖြင့်ရှာပါ။
2. Search result တွင် ပစ္စည်းအမည်၊ လက်ရှိ stock၊ base unit နှင့် default retail price ကိုကြည့်နိုင်သည်။
3. ပစ္စည်းကိုနှိပ်လျှင် default unit ဖြင့် Cart ထဲသို့ထည့်မည်။

## Barcode အသုံးပြုနည်း
1. Barcode icon ကိုနှိပ်ပါ။
2. Camera permission ခွင့်ပြုပါ။
3. Barcode ဖတ်ပြီးပါက ကိုက်ညီသော product/unit/price type ကိုရှာပြီး cart ထဲထည့်မည်။
4. Barcode မတွေ့လျှင် error message နှင့် beep ပြမည်။

## Myanmar UOM ဖြင့်ရောင်းနည်း
Inventory ထဲတွင် product unit conversion ကိုမှန်အောင်ထားရမည်။ ဥပမာ ဆန် base unit ကို kg ထားပြီး unit များကို အောက်ပါအတိုင်းသတ်မှတ်နိုင်သည်။

- 1 ပိဿာ = 1.633 kg
- 1 ကျပ်သား = 0.01633 kg
- 1 တင်း = 40.96 kg ခန့်
- 1 ပြည် = 2.56 kg/L ခန့်၊ ဆိုင်စနစ်အလိုက် ပြန်သတ်မှတ်နိုင်သည်

ရောင်းချရာတွင် quantity ကို decimal ထည့်နိုင်သည်။ ဥပမာ 0.5 ပိဿာ၊ 1.25 kg၊ 2.5 ပြည် စသည်ဖြင့်သုံးနိုင်သည်။

## Cart ထဲတွင်ပြင်ဆင်ခြင်း
Cart row တစ်ခုချင်းစီတွင်—

- Quantity ပြင်နိုင်သည်။
- Unit ပြောင်းနိုင်သည်။
- Retail / Wholesale A / Wholesale B / Wholesale C price type ပြောင်းနိုင်သည်။
- Unit price ပြင်နိုင်သည်။
- Item discount ထည့်နိုင်သည်။

Cart သည် base quantity ကိုလည်းပြပေးသည်။ ဥပမာ 2 ပိဿာ ရောင်းလျှင် base quantity ကို 3.266 kg အဖြစ်တွက်ပြနိုင်သည်။

## Stock မလုံလောက်ခြင်း
Sale mode တွင် ရောင်းမည့် base quantity သည် လက်ကျန် stock ထက်ကျော်သွားလျှင် warning ပြမည်။ Stock မလုံလောက်သော်လည်း server-side validation/checkout logic ဖြင့်ထပ်စစ်ရန် လိုအပ်သည်။

## သတိထားရန်
- Unit multiplier မှားလျှင် stock deduction မှားနိုင်သည်။
- ဆန်၊ ဆီ၊ အလေးချိန်၊ အရည် unit များအတွက် decimal quantity သုံးပါ။
- pcs/ခု စနစ်များအတွက် quantity ကို integer သုံးခြင်းကောင်းသည်။
