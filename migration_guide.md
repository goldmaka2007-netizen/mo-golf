# Gold Shop Accounting System - Resume Prompt & Technical Spec

This document contains everything you need to reconstruct this application in a new account/project.

## 1. Resume Prompt (Copy & Paste this to Gemini)

"أنا أبدأ مشروعاً جديداً لنظام محاسبي لمحلات الذهب في مصر. لقد عملت مسبقاً على بناء نظام يعتمد على مبدأ 'Triple Ledger' (ثلاثة دفاتر متوازية: الذهب، الفضة، والسيولة النقدية). أريد منك بناء التطبيق بنفس القواعد المحاسبية والتقنية التالية:

### القواعد الأساسية (Triple Ledger Logic):
1. **تصنيف الحسابات بالـ Nature:** كل حساب له 'Balance Nature' تحدد هل هو (ذهب، فضة، سيولة، أو مختلط). الحسابات المختلطة تظهر في دفتري الذهب والسيولة معاً.
2. **تحليل الفجوة (Gap Analysis):** أي جرام ذهب يدخل أو يخرج من المحل دون أن يقابله حركة ذهب أخرى (مثل الشراء بالنقدية) يتم تسجيله فوراً كإيراد أو مصروف تشغيلي في قائمة الدخل.
3. **التوازن الذاتي (Self-Balancing):** في ميزان المراجعة، يتم حساب أي فرق بين المدين والدائن في الأوزان وإضافته آلياً لحساب تسويات (مكسب أو خسارة أوزان) لضمان اتزان الميزانية.
4. **المصنعية:** تُسجل مصنعية التاجر على الأساس النقدي فقط عند الدفع الفعلي.

### الهيكل التقني:
- **Frontend:** React + Tailwind CSS + Lucide Icons + Framer Motion.
- **Backend:** Firebase (Firestore + Auth).
- **State Management:** Zustand.
- **Types:** التأكد من وجود حقول `invoiceNumber`, `arabicWeight`, `weight`, `cash` في كل حركة (`Entry`).

### المطلوب الآن:
قم ببرمجة النظام الأساسي مع التركيز على التقارير المالية (ميزان المراجعة، المركز المالي، قائمة الدخل، قائمة حقوق الملكية) بحيث تضمن تطابق إجمالي حقوق الملكية مع (الأصول - الخصوم) بالملي في جميع الأوزان والسيولة. التزم باللغة العربية والواجهة الداكنة (Dark UI)."

---

## 2. Technical Specs for the Developer

### Firestore Structure:
- `entries`: `{ debit, credit, cash, weight, arabicWeight, tx, invoiceNumber, date }`
- `accounts`: `{ name, mainType, subType, balanceNature }`
- `categories`: Metadata stored in `accountCategories` in state.

### Key Accounting Algorithms:
- **Income & Equity Matching:** Final Equity = Capital + Operational Results (Revenue - Expenses).
- **Weight to Arabic Conversion:** 1 gram = 1 gram (Standard 21k context usually, but stored as weights).
- **Merchant Logic:** When trader gold moves, weight increases/decreases. Cash only moves when "مصنعية" is explicitly paid.

### Reference Files:
If you need to reproduce the exact logic, ensure `accountLogic.ts` contains:
- `belongsToMetric(account, metric)`: Checks if account nature matches (Gold/Cash/Silver).
- `getMetricValue(entry, metric)`: Correctly extracts the numeric field based on the transaction context.

---

## 3. Deployment Steps
1. Create a new project in AI Studio.
2. Run `set_up_firebase` tool and accept terms.
3. Copy the code from the generated files or paste the prompt above.
4. Add your accounts to the chart of accounts with the correct 'Balance Nature'.
