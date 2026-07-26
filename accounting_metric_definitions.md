# Accounting Metric Definitions

## المبادئ المعتمدة

1. Cash وGold وSilver أبعاد مستقلة.
2. Quantity وصفي ولا يدخل دفتر الذهب أو الفضة.
3. Accessories: quantity + cash cost فقط؛ الوزن لا يدخل metal ledgers.
4. Merchant metal liabilities ليست physical inventory.
5. `Shop Gold Ownership = Physical Gold Inventory − Gold Weight Owed to Merchants`.
6. merchant cash/workmanship مستقل عن merchant metal.
7. Gold merchant metal يستخدم Equivalent-21 عند اعتماده للحركة.
8. Silver يستخدم physical weight.
9. نفس اسم metric يجب أن يأتي من selector واحد.
10. ممنوع balancing plug أو قيد مصنع أو تصحيح تاريخي صامت.

## Invariants

لكل dimension في canonical double-entry ledger:

```text
Σ canonical debit − Σ canonical credit = 0
```

| المصطلح | التعريف |
|---|---|
| Ledger imbalance | مجموع مدين كل الحسابات ناقص مجموع دائن كل الحسابات |
| Account ending balance | net لحساب واحد وفق debit/credit nature |
| Physical inventory | حركات حسابات `is_inventory` فقط |
| Merchant metal liability | وزن مستحق للتجار، خارج physical inventory |
| Shop net ownership | physical inventory ناقص merchant liability |
| Opening balance | رصيد بداية، وليس plug |
| P&L balance | revenue − expense حسب dimension |
| Quantity balance | عدد قطع؛ لا يوازن gold/silver |

## أسماء metrics المقترحة

- `physicalGoldInventory21`
- `goldMerchantLiability21`
- `netShopGoldOwnership21`
- `physicalSilverInventory`
- `silverMerchantLiability`
- `netShopSilverOwnership` إذا اعتُمد المفهوم
- `accessoryQuantityOnHand`
- `cashAccountBalance`
- `canonicalLedgerDifferenceByDimension`

لا يجوز استخدام عنوان “رصيد الفضة” لرقمين أحدهما physical inventory والآخر مفهوم مختلف.

## الوحدات

المطلوب: cash piasters integer، metal milligrams، quantity integer. الوضع الحالي مختلف: historical values decimal strings، وE21 يتحول إلى centigram units في `goldEquivalent.ts`. لم يتم تحويل التاريخ لأن ذلك يحتاج migration policy معتمدة.