# Inventory Admin Guide

Inventory Admin သည် Product data မှန်ကန်မှု၊ Permission၊ Stock policy၊ Unit Conversion policy များကို ထိန်းချုပ်ရမည်။ POS စနစ်တွင် Inventory data မှားလျှင် ရောင်းအား၊ အမြတ်၊ Stock report အားလုံး မှားနိုင်သည်။

## Admin တာဝန်များ

- Product create/edit permission ကို မှန်ကန်သော staff များထံသာပေးရန်
- Cost Price ကို cashier မမြင်သင့်ပါက permission ဖြင့်ကန့်သတ်ရန်
- Stock adjustment ကို reason မရှိဘဲ မလုပ်စေရန်
- Duplicate barcode မဖြစ်အောင်စစ်ရန်
- Unit conversion rule များကို ဆိုင် policy အတိုင်းသတ်မှတ်ရန်
- Delete မလုပ်ဘဲ inactive/archive policy သုံးရန်

## Permission အကြံပြုချက်

### Owner / Admin

- Product create/edit/delete
- Stock adjustment
- Cost price view/edit
- Report view
- UOM template edit

### Manager

- Product edit
- Stock adjustment with reason
- Low stock review
- Purchase review

### Cashier

- Product search/read only
- Stock view only
- Cost price မမြင်သင့်

## UOM Policy

ဆိုင်တစ်ခုချင်းစီတွင် unit conversion rule မတူနိုင်သည်။ ဥပမာ ဆန် ၁ ပြည်၏ weight ကို ဆိုင် policy အတိုင်းသတ်မှတ်ရန်လိုသည်။ Admin သည် Product တစ်ခုချင်းစီတွင် multiplier ကိုစစ်ပြီးမှ active လုပ်သင့်သည်။

## Security Notes

- Staff အားလုံးကို product delete permission မပေးပါနှင့်။
- Stock adjustment ကို audit log နှင့်တွဲထားသင့်သည်။
- Cost price ကို လိုအပ်သူများသာမြင်သင့်သည်။
- Barcode ပြင်ခြင်းသည် Sale product မှားဝင်နိုင်သောကြောင့် permission ကန့်သတ်ပါ။

## Monthly Admin Checklist

1. Negative stock ရှိ/မရှိစစ်ပါ။
2. Low stock report စစ်ပါ။
3. Duplicate barcode စစ်ပါ။
4. Cost price မဖြည့်ထားသော Product စစ်ပါ။
5. Unit multiplier မမှန်သော Product စစ်ပါ။
6. Inactive product များကို review လုပ်ပါ။
