# Selected Items Cost Audit Summary

Generated at: 2026-07-25T17:05:44.456Z
Calculation version: phase5-wac-v1

Precision:
- Money: integer minor units (cents).
- Metal quantity: centigrams; gold cost unit is E21 centigram, silver cost unit is physical centigram.
- Accessory quantity: milli-piece; display unit is piece.
- Removal rounding: round_half_up_proportional_integer_minor.
- Rounding tolerance: 0 minor units.

| الصنف | الحساب | الرصيد النهائي | التكلفة الدفترية | متوسط التكلفة | فرق المطابقة | النتيجة |
|---|---|---:|---:|---:|---:|---|
| خاتم حريمي | seed-account-f7259c51816b3eca60b0 / seed-account-f7259c51816b3eca60b0 | 363.85 | 2099713.43 | 5770.821575 | 0.00 | PASS |
| خاتم أطفال | seed-account-960d86a1b65899e364b7 / seed-account-960d86a1b65899e364b7 | 86.35 | 572545.30 | 6630.518819 | 0.00 | PASS |
| خاتم عربي | seed-account-ea099bf0071894125ad3 / seed-account-ea099bf0071894125ad3 | 149.73 | 1073241.84 | 7167.847726 | 0.00 | PASS |
| كسر أفرنجي | seed-account-7ac32db4e3484ce2dc22 / seed-account-7ac32db4e3484ce2dc22 | 29.99 | 231253.03 | 7711.004668 | 0.00 | PASS |
| خاتم فضة | seed-account-feed1210d025ed84e443 / seed-account-feed1210d025ed84e443 | 1644.88 | 96394.74 | 58.602901 | 0.00 | PASS |
| كسر فضة | seed-account-2da1e46de570300127c6 / seed-account-2da1e46de570300127c6 | 423.75 | 37470.00 | 88.424779 | 0.00 | PASS |
| دبلة تنجستين | seed-account-93c8c8cf9d87c00e1e88 / seed-account-93c8c8cf9d87c00e1e88 | 78.000 | 7562.20 | 96.951282 | 0.00 | PASS |

## خاتم حريمي

- accountId: seed-account-f7259c51816b3eca60b0
- accountName: seed-account-f7259c51816b3eca60b0
- taxonomyKey: gold.product.ring_women
- metal: gold
- karat: 18
- inventory unit: g E21
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding gold.product.ring_women -> seed-account-f7259c51816b3eca60b0.

### Breakdown

- الرصيد الافتتاحي: 1970820.00 EGP
- المشتريات أو الحركات الداخلة: 29655.00 EGP
- المبيعات أو الحركات الخارجة: 1028202.60 EGP
- التفييت/التفتيت: +1250744.24 EGP
- التحويلات بين الأصناف: -123303.21 EGP
- تسويات العجز والزيادة: +0.00 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 1970820.00 + 29655.00 - 1028202.60 + -123303.21 + 1250744.24 + 0.00 + 0.00
bookCost = 2099713.43 EGP
averageCostPerGramE21 = 2099713.43 / 363.85 = 5770.821575 EGP
final balance = 363.85 g E21
rounding difference = 0.00 EGP
max sale average rounding drift = 0.000802 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS

## خاتم أطفال

- accountId: seed-account-960d86a1b65899e364b7
- accountName: seed-account-960d86a1b65899e364b7
- taxonomyKey: gold.product.ring_children
- metal: gold
- karat: 18
- inventory unit: g E21
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding gold.product.ring_children -> seed-account-960d86a1b65899e364b7.

### Breakdown

- الرصيد الافتتاحي: 536220.00 EGP
- المشتريات أو الحركات الداخلة: 0.00 EGP
- المبيعات أو الحركات الخارجة: 72694.07 EGP
- التفييت/التفتيت: +110979.89 EGP
- التحويلات بين الأصناف: +0.00 EGP
- تسويات العجز والزيادة: -1960.52 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 536220.00 + 0.00 - 72694.07 + 0.00 + 110979.89 + -1960.52 + 0.00
bookCost = 572545.30 EGP
averageCostPerGramE21 = 572545.30 / 86.35 = 6630.518819 EGP
final balance = 86.35 g E21
rounding difference = 0.00 EGP
max sale average rounding drift = 0.000111 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS

## خاتم عربي

- accountId: seed-account-ea099bf0071894125ad3
- accountName: seed-account-ea099bf0071894125ad3
- taxonomyKey: gold.product.ring_arabic
- metal: gold
- karat: 21
- inventory unit: g E21
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding gold.product.ring_arabic -> seed-account-ea099bf0071894125ad3.

### Breakdown

- الرصيد الافتتاحي: 1335120.00 EGP
- المشتريات أو الحركات الداخلة: 0.00 EGP
- المبيعات أو الحركات الخارجة: 1182208.59 EGP
- التفييت/التفتيت: +1047437.73 EGP
- التحويلات بين الأصناف: -127888.39 EGP
- تسويات العجز والزيادة: +781.09 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 1335120.00 + 0.00 - 1182208.59 + -127888.39 + 1047437.73 + 781.09 + 0.00
bookCost = 1073241.84 EGP
averageCostPerGramE21 = 1073241.84 / 149.73 = 7167.847726 EGP
final balance = 149.73 g E21
rounding difference = 0.00 EGP
max sale average rounding drift = 0.000032 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS

## كسر أفرنجي

- accountId: seed-account-7ac32db4e3484ce2dc22
- accountName: seed-account-7ac32db4e3484ce2dc22
- taxonomyKey: gold.raw.scrap_foreign
- metal: gold
- karat: 18
- inventory unit: g E21
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding gold.raw.scrap_foreign -> seed-account-7ac32db4e3484ce2dc22.

### Breakdown

- الرصيد الافتتاحي: 27900.00 EGP
- المشتريات أو الحركات الداخلة: 5753725.00 EGP
- المبيعات أو الحركات الخارجة: 1237675.87 EGP
- التفييت/التفتيت: -4716944.39 EGP
- التحويلات بين الأصناف: +387317.25 EGP
- تسويات العجز والزيادة: +16931.04 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 27900.00 + 5753725.00 - 1237675.87 + 387317.25 + -4716944.39 + 16931.04 + 0.00
bookCost = 231253.03 EGP
averageCostPerGramE21 = 231253.03 / 29.99 = 7711.004668 EGP
final balance = 29.99 g E21
rounding difference = 0.00 EGP
max sale average rounding drift = 0.015611 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS

## خاتم فضة

- accountId: seed-account-feed1210d025ed84e443
- accountName: seed-account-feed1210d025ed84e443
- taxonomyKey: silver.product.ring
- metal: silver
- karat: -
- inventory unit: g physical
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding silver.product.ring -> seed-account-feed1210d025ed84e443.

### Breakdown

- الرصيد الافتتاحي: 98796.00 EGP
- المشتريات أو الحركات الداخلة: 375.00 EGP
- المبيعات أو الحركات الخارجة: 2776.26 EGP
- التفييت/التفتيت: +0.00 EGP
- التحويلات بين الأصناف: +0.00 EGP
- تسويات العجز والزيادة: +0.00 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 98796.00 + 375.00 - 2776.26 + 0.00 + 0.00 + 0.00 + 0.00
bookCost = 96394.74 EGP
averageCostPerGram = 96394.74 / 1644.88 = 58.602901 EGP
final balance = 1644.88 g physical
rounding difference = 0.00 EGP
max sale average rounding drift = 0.000004 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS

## كسر فضة

- accountId: seed-account-2da1e46de570300127c6
- accountName: seed-account-2da1e46de570300127c6
- taxonomyKey: silver.raw.scrap
- metal: silver
- karat: -
- inventory unit: g physical
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding silver.raw.scrap -> seed-account-2da1e46de570300127c6.

### Breakdown

- الرصيد الافتتاحي: 18300.00 EGP
- المشتريات أو الحركات الداخلة: 19170.00 EGP
- المبيعات أو الحركات الخارجة: 0.00 EGP
- التفييت/التفتيت: +0.00 EGP
- التحويلات بين الأصناف: +0.00 EGP
- تسويات العجز والزيادة: +0.00 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 18300.00 + 19170.00 - 0.00 + 0.00 + 0.00 + 0.00 + 0.00
bookCost = 37470.00 EGP
averageCostPerGram = 37470.00 / 423.75 = 88.424779 EGP
final balance = 423.75 g physical
rounding difference = 0.00 EGP
max sale average rounding drift = 0.000000 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS

## دبلة تنجستين

- accountId: seed-account-93c8c8cf9d87c00e1e88
- accountName: seed-account-93c8c8cf9d87c00e1e88
- taxonomyKey: accessory.tungsten_band
- metal: accessory
- karat: -
- inventory unit: unit/قطعة
- duplicate-name candidates: No duplicate accountName in Phase 5 golden dataset.
- selection reason: Selected by approved Phase 5 runtime binding accessory.tungsten_band -> seed-account-93c8c8cf9d87c00e1e88.

### Breakdown

- الرصيد الافتتاحي: 8000.00 EGP
- المشتريات أو الحركات الداخلة: 550.00 EGP
- المبيعات أو الحركات الخارجة: 987.80 EGP
- التفييت/التفتيت: +0.00 EGP
- التحويلات بين الأصناف: +0.00 EGP
- تسويات العجز والزيادة: +0.00 EGP
- المرتجعات أو القيود العكسية: +0.00 EGP
- حركات أخرى: +0.00 EGP

### Final Equation

bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects
bookCost = 8000.00 + 550.00 - 987.80 + 0.00 + 0.00 + 0.00 + 0.00
bookCost = 7562.20 EGP
averageCostPerUnit = 7562.20 / 78.000 = 96.951282 EGP
final balance = 78.000 unit
rounding difference = 0.00 EGP
max sale average rounding drift = 0.000016 EGP/display unit
matching difference = 0.00 EGP
result = PASS

### Consistency Tests

- finalQuantityMatchesEngine: PASS
- finalBookCostMatchesEngine: PASS
- manualAverageMatchesEngine: PASS
- noMissingOrDuplicateMovements: PASS
- outgoingUsesBeforeWac: PASS
- saleDoesNotChangeAverageExceptRounding: PASS
- differentCostIncomingReweightsAverage: PASS
- transferOrTafkeetMovesCostWithoutProfit: PASS
- adjustmentsFollowCurrentEngineRules: PASS
- noMarketPriceCosting: PASS
- noPhysicalE21Mixing: PASS
- accessoryCalculatedByPiece: PASS
- roundingWithinTolerance: PASS
