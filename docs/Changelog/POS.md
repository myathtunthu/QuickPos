# POS / Entry Page Changelog

## Phase 9

### Added
- POS entry folder အတွက် Myanmar UOM aware helper ထည့်ထားသည်။
- Cart row တွင် base quantity နှင့် stock warning ပြထားသည်။
- Product grid/dropdown တွင် base stock နှင့် unit price ကိုပိုရှင်းအောင်ပြထားသည်။
- Barcode search တွင် product barcode နှင့် unit barcode များကို normalize လုပ်ပြီးရှာနိုင်သည်။

### Improved
- Decimal quantity support ကို UI level တွင်ပိုကောင်းအောင်ပြင်ထားသည်။
- Stock မလုံလောက်မှုကို cart level မှာမြင်နိုင်အောင်ပြင်ထားသည်။
- Barcode scanner modal wiring bug ကိုပြင်ထားသည်။

### Security / Safety
- Barcode input ကို normalize လုပ်ပြီး empty/invalid value မသုံးအောင်ကာကွယ်ထားသည်။
- Quantity/price number parsing ကို safe helper ဖြင့်တွက်ထားသည်။
