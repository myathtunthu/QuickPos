# POS / Entry Page Admin Guide

## Admin မှစီမံရမည့်အရာများ
1. Inventory ထဲတွင် base unit နှင့် package unit conversion များကိုမှန်ကန်စွာသတ်မှတ်ပါ။
2. Barcode များကို unit တစ်ခုချင်းစီအတွက် ထည့်သွင်းပါ။
3. Retail/Wholesale price များကို unit အလိုက်သတ်မှတ်ပါ။
4. Cashier permissions များကို create_sale, create_purchase, edit_price, discount_permission စသည်ဖြင့်ခွဲခြားပါ။

## Security Notes
- Cashier အား unit price ပြင်ခွင့်ကို လိုအပ်မှပေးပါ။
- Discount limit ကို business rule အဖြစ် သတ်မှတ်သင့်သည်။
- Checkout နောက်ဆုံးအဆင့်တွင် stock deduction ကို transaction ဖြင့်စစ်ရန်လိုအပ်သည်။
- Barcode collision မဖြစ်အောင် product/unit barcode များ unique ဖြစ်ရမည်။

## Myanmar UOM Control
အောက်ပါ conversion များကို product အမျိုးအစားအလိုက်မတူညီနိုင်သောကြောင့် hardcode မယုံဘဲ product-specific multiplier အဖြစ်ထားသင့်သည်။

- ဆန်၊ ပဲ၊ စပါး: တင်း / ပြည် / ဘူး
- အလေးချိန်: ပိဿာ / ကျပ်သား / ပဲ
- အရည်: L / ml / gallon
- အထည်/ကြိုး: yard / ft / meter / roll
