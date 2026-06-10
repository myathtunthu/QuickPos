# Inventory / Stock အသုံးပြုသူလမ်းညွှန်

Inventory Page သည် ဆိုင်ထဲရှိ ကုန်ပစ္စည်း၊ ကုန်ကြမ်း၊ လက်ကျန်စတော့၊ Barcode၊ Unit Conversion၊ Reorder Alert များကို စီမံရန် အသုံးပြုသော အဓိကစာမျက်နှာဖြစ်သည်။ POS တွင် ရောင်းချခြင်း၊ ဝယ်ယူထည့်သွင်းခြင်း၊ အမြတ်တွက်ချက်ခြင်း၊ Low Stock Alert ပြခြင်းအားလုံးသည် Inventory data မှန်ကန်မှုအပေါ် မူတည်သည်။

## ၁။ Inventory Page ကို ဘာအတွက်သုံးလဲ

- Product အသစ်ထည့်ရန်
- Product အမည်၊ ဈေးနှုန်း၊ Cost Price၊ Barcode ပြင်ရန်
- လက်ကျန် Stock ကြည့်ရန်
- Minimum Stock / Reorder Level သတ်မှတ်ရန်
- Myanmar UOM များဖြင့် ရောင်းနိုင်အောင် Unit Conversion ထည့်ရန်
- Package Unit များဖြင့် ဝယ်/ရောင်းနိုင်အောင် ပြင်ရန်
- Low Stock ဖြစ်နေသောပစ္စည်းများကို အမြန်ရှာရန်

## ၂။ Product အသစ်ထည့်နည်း

1. Inventory Page သို့ဝင်ပါ။
2. Add Product / Product အသစ်ထည့်ရန် ခလုတ်ကိုနှိပ်ပါ။
3. Product Name ကိုရှင်းလင်းအောင်ရေးပါ။ ဥပမာ `ရွှေဘိုပေါ်ဆန်း ဆန်`, `ကြက်သား`, `ဆီ ၁ လီတာ`။
4. Category ရွေးပါ။ Category မရှိသေးလျှင် Category အသစ်ထည့်ပါ။
5. Cost Price ထည့်ပါ။ Cost Price မမှန်လျှင် Profit Report မှားနိုင်သည်။
6. Sale Price ထည့်ပါ။
7. Base Unit ရွေးပါ။ ဥပမာ pcs, kg, g, ပိဿာ, ကျပ်သား, L, ml, ပြည်, တင်း။
8. Opening Stock ထည့်ပါ။
9. Barcode ရှိလျှင် ဖြည့်ပါ။ Barcode တစ်ခုသည် Product တစ်ခုတည်းတွင်သာ အသုံးပြုသင့်သည်။
10. Save နှိပ်ပါ။

## ၃။ Field တစ်ခုချင်းစီ အဓိပ္ပာယ်

### Product Name
Cashier ရှာရလွယ်စေရန် နာမည်ရှင်းရမည်။ Brand, Size, Unit ကိုပါထည့်ရေးခြင်းကောင်းသည်။

### Category
ကုန်အမျိုးအစားခွဲရန်သုံးသည်။ ဥပမာ ဆန်၊ ဆီ၊ အချိုရည်၊ ဆေး၊ အထည်။

### Cost Price
ဆိုင်က ဝယ်ယူထားသော တန်ဖိုးဖြစ်သည်။ Profit တွက်ရာတွင် အရေးကြီးသည်။

### Sale Price
Customer ကို ရောင်းမည့် ဈေးဖြစ်သည်။

### Stock
လက်ရှိရှိနေသော လက်ကျန်ဖြစ်သည်။ Base Unit အတိုင်းတွက်သင့်သည်။

### Minimum Stock
လက်ကျန်နည်းလာလျှင် warning ပြရန် သတ်မှတ်သောအရေအတွက်ဖြစ်သည်။

### Barcode
Scanner ဖြင့်ရှာရန် သုံးသည်။ Duplicate Barcode မထားသင့်ပါ။

## ၄။ Myanmar UOM အသုံးပြုနည်း

မြန်မာဈေးကွက်တွင် pcs တစ်ခုတည်းမလုံလောက်ပါ။ အောက်ပါ Unit များကို အသုံးပြုနိုင်ရန် Product Unit Conversion ထည့်ထားသင့်သည်။

### အရေအတွက် Unit

- ၁ ဒါဇင် = ၁၂ ခု
- ၁ ဖာ = ပစ္စည်းအလိုက် သတ်မှတ်အရေအတွက်
- ၁ ပါကင် = ပစ္စည်းအလိုက် သတ်မှတ်အရေအတွက်
- ၁ စုံ = ပစ္စည်းအလိုက် သတ်မှတ်အရေအတွက်

### အလေးချိန် Unit

- ၁ ပိဿာ = ၁၀၀ ကျပ်သား
- ၁ အချိန် = ၅၀ ကျပ်သား
- ၁ ကျပ်သား = ၁၆ ပဲ
- ၁ ပိဿာ ≈ ၁.၆၃၃ kg
- ၁ ကျပ်သား ≈ ၁၆.၃၃ g
- ၁ kg = ၁၀၀၀ g

### ဆန် / ပဲ / စပါး Unit

- ၁ တင်း = ၁၆ ပြည်
- ၁ ပြည် = ၈ ဘူး
- ၁ ပြည် ≈ ၂.၅၆ L ခန့်

### အရည် Unit

- ၁ L = ၁၀၀၀ ml
- ၁ US Gallon ≈ ၃.၇၈၅ L
- ၁ UK / Myanmar Market Gallon ≈ ၄.၅၄၆ L

### အလျား Unit

- ၁ m = ၁၀၀ cm
- ၁ ft = ၁၂ inch
- ၁ yard = ၃ ft
- ၁ inch = ၂.၅၄ cm

## ၅။ Multi Unit Conversion ထည့်နည်း

Product တစ်ခုတွင် Base Unit တစ်ခုထားပြီး Sale Unit များကို multiplier ဖြင့်ထည့်ရမည်။

ဥပမာ ဆန်ကို kg အခြေခံထားလျှင်—

- Base Unit = kg
- ၁ ပိဿာ = ၁.၆၃၃ kg
- ၁ ကျပ်သား = ၀.၀၁၆၃၃ kg
- ၁ တင်း = ၄၀.၉၆ kg ခန့်
- ၁ ပြည် = ၂.၅၆ kg/L ခန့်၊ ဆိုင်သုံး rule အတိုင်းပြန်သတ်မှတ်နိုင်သည်

## ၆။ ဥပမာများ

### ဆန်ဆိုင်

Product Name = ရွှေဘိုပေါ်ဆန်း
Base Unit = kg
Sale Units = kg, ပိဿာ, ကျပ်သား, ပြည်, တင်း

Customer က ၁ ပြည် ဝယ်လျှင် POS မှ multiplier အတိုင်း base stock ကိုလျှော့မည်။

### ကုန်စုံဆိုင်

Product Name = ရေသန့်ဘူး
Base Unit = ဘူး
Sale Units = ဘူး, ဖာ
၁ ဖာ = ၂၄ ဘူး

### ဆေးဆိုင်

Product Name = Paracetamol
Base Unit = လုံး
Sale Units = လုံး, ကဒ်, ဘူး
ဥပမာ ၁ ကဒ် = ၁၀ လုံး

## ၇။ Stock ပြင်ဆင်ခြင်း

Stock ကို တိုက်ရိုက်ပြင်ရန် လိုအပ်ပါက Stock Adjustment ကိုသုံးပါ။ အကြောင်းပြချက်ကို အမြဲရေးပါ။

ဥပမာ—

- ပျက်စီးကုန်
- Stock count မှားနေခြင်း
- Supplier မှအပိုပေးခြင်း
- စာရင်းမဝင်ခဲ့သော opening stock

## ၈။ Low Stock Alert

Minimum Stock ကိုသတ်မှတ်ထားလျှင် လက်ကျန်နည်းလာသော Product များကို အမြန်သိနိုင်သည်။ Zero ဖြစ်မှ ဝယ်ယူမည့်အစား Minimum Stock ထိရောက်သည်နှင့် Purchase ပြန်လုပ်သင့်သည်။

## ၉။ Barcode Best Practice

- Barcode တစ်ခုကို Product တစ်ခုတည်းတွင်သာသုံးပါ။
- Package Unit barcode မတူလျှင် unit barcode သီးသန့်ထည့်ပါ။
- Barcode မှားထည့်လျှင် POS Sale မှာ Product မှားဝင်နိုင်သည်။

## ၁၀။ Cost Price သတိထားရန်

Cost Price မမှန်လျှင် Profit Report မမှန်ပါ။ Purchase ထည့်တိုင်း Cost Price ပြောင်းသင့်/မသင့်ကို ဆိုင် policy အတိုင်းဆုံးဖြတ်ပါ။

## ၁၁။ မဖျက်သင့်သော Product

Sale history ရှိပြီးသား Product ကို delete မလုပ်သင့်ပါ။ အစား `Inactive` သို့မဟုတ် `Hide from POS` လုပ်ခြင်းကောင်းသည်။ Delete လုပ်လျှင် report/history တွင် နာမည်ပျောက်နိုင်သည်။

## ၁၂။ နေ့စဉ်လုပ်သင့်သောအရာများ

1. Low Stock list စစ်ပါ။
2. Barcode မတွေ့သော Product များပြင်ပါ။
3. Cost Price မှားသော Product များပြင်ပါ။
4. Negative Stock ဖြစ်နေလျှင် Records/Purchase/Sale စစ်ပါ။
5. New Product ထည့်ပြီးပါက POS Page တွင်ရှာလို့ရမရစမ်းပါ။

## ၁၃။ သတိထားရန်

- Unit multiplier မှားလျှင် Stock deduction မှားမည်။
- ပိဿာ၊ ကျပ်သား၊ kg များသည် decimal quantity လိုအပ်နိုင်သည်။
- pcs / ခု / လုံး များတွင် decimal quantity မသုံးသင့်ပါ။
- Product name မရှင်းလင်းလျှင် cashier ရှာရခက်မည်။
- Cost Price မဖြည့်ထားလျှင် Profit report မမှန်နိုင်သည်။
