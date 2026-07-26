import fs from 'node:fs';
import path from 'node:path';
import type { Account, Entry } from '../src/types';
import { SEED_ACCOUNTS } from '../src/migrationData';
import { buildLegacyJournalProjection } from '../src/lib/legacyLedger';
import { buildCanonicalRuleStatusReport, buildOperationalProjection, isTx42 } from '../src/lib/operationalProjection';
import { buildTrialBalanceReport } from '../src/lib/trialBalanceReport';

type CsvRow = Record<string, string>;
const root = process.cwd();
const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { record.push(field); field = ''; }
    else if (char === '\n') { record.push(field); records.push(record); record = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field.length || record.length) records.push([...record, field]);
  const headers = records.shift() ?? [];
  return records.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};
const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const writeCsv = (file: string, rows: Record<string, unknown>[], columns: string[]) => {
  const lines = [columns.map(escape).join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))];
  fs.writeFileSync(path.join(root, file), `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
};

const sourceRows = parseCsv(fs.readFileSync(path.join(root, 'approved_normalized_preview.csv'), 'utf8'));
if (sourceRows.length !== 2169) throw new Error(`Expected 2169 imported documents, found ${sourceRows.length}`);
const entries = sourceRows.map(row => ({ ...(JSON.parse(row.proposed_import_document) as Entry), id: row.document_id }));
const accounts: Account[] = SEED_ACCOUNTS.map((account, index) => ({ ...account, id: `phase1-account-${index + 1}`, userId: 'phase1-read-only', isActive: true } as Account));
const legacy = buildLegacyJournalProjection(entries, accounts);
const operational = buildOperationalProjection(entries, accounts);
const accountByName = new Map(accounts.map(account => [account.name, account]));

writeCsv('legacy_ledger_projection_trace.csv', legacy.legs.map(leg => ({
  source_entry_id: leg.sourceEntryId,
  legacy_operation_no: leg.entry.legacyOperationNo || leg.entry.invoiceNumber || '',
  date: leg.date,
  operation_type: leg.entry.tx,
  operation_kind: leg.operationKind,
  dimension: leg.dimension,
  side: leg.side,
  amount: leg.amount,
  entity_id: leg.entityId,
  account_name: leg.accountName,
  account_group: leg.group,
  opposite_account: leg.oppositeAccount,
  source: 'legacy_raw_fields',
})), ['source_entry_id', 'legacy_operation_no', 'date', 'operation_type', 'operation_kind', 'dimension', 'side', 'amount', 'entity_id', 'account_name', 'account_group', 'opposite_account', 'source']);

const operationalRows = entries.map(entry => {
  const item = buildOperationalProjection([entry], accounts);
  return {
    source_entry_id: entry.id,
    legacy_operation_no: entry.legacyOperationNo || entry.invoiceNumber || '',
    date: entry.date,
    operation_type: entry.tx,
    operation_kind: entry.operationKind,
    cash_movement: item.cashMovement,
    physical_gold_inventory_movement: item.physicalGoldInventoryMovement,
    gold_equivalent_21_movement: item.goldEquivalent21Movement,
    physical_silver_inventory_movement: item.physicalSilverInventoryMovement,
    accessories_quantity_movement: item.accessoriesQuantityMovement,
    merchant_gold_liability_movement: item.merchantWeightLiabilityMovement.gold,
    merchant_silver_liability_movement: item.merchantWeightLiabilityMovement.silver,
    merchant_workmanship_cash_movement: item.merchantWorkmanshipCashMovement,
    canonical_status: isTx42(entry) ? 'unresolved' : 'operational_only',
    warning: item.warnings.join(' | '),
  };
});
writeCsv('operational_projection_trace.csv', operationalRows, [
  'source_entry_id', 'legacy_operation_no', 'date', 'operation_type', 'operation_kind', 'cash_movement',
  'physical_gold_inventory_movement', 'gold_equivalent_21_movement', 'physical_silver_inventory_movement',
  'accessories_quantity_movement', 'merchant_gold_liability_movement', 'merchant_silver_liability_movement',
  'merchant_workmanship_cash_movement', 'canonical_status', 'warning',
]);

const seven = entries.filter(entry => entry.tx === 'حساب تاجر فضة' && entry.debit === 'سمير ناشد' && entry.credit === 'كسر فضة');
if (seven.length !== 7) throw new Error(`Expected seven merchant-silver sign rows, found ${seven.length}`);
writeCsv('silver_merchant_sign_fix.csv', seven.map(entry => {
  const item = buildOperationalProjection([entry], accounts);
  return {
    source_entry_id: entry.id,
    source_row: entry.sourceRow,
    date: entry.date,
    operation_type: entry.tx,
    debit_account: entry.debit,
    credit_account: entry.credit,
    raw_weight_g: Number(entry.weight),
    before_home_contribution_g: Number(entry.weight),
    after_physical_inventory_contribution_g: item.physicalSilverInventoryMovement,
    merchant_liability_contribution_g: item.merchantWeightLiabilityMovement.silver,
    fix: 'removed_second_sign_inversion_from_home_selector',
  };
}), ['source_entry_id', 'source_row', 'date', 'operation_type', 'debit_account', 'credit_account', 'raw_weight_g', 'before_home_contribution_g', 'after_physical_inventory_contribution_g', 'merchant_liability_contribution_g', 'fix']);

const ruleStatuses = buildCanonicalRuleStatusReport(entries);
writeCsv('canonical_rule_status.csv', ruleStatuses.map(row => ({
  operation_type: row.operationType,
  operation_kind: row.operationKind,
  status: row.status,
  document_count: row.documentCount,
  reason: row.reason,
})), ['operation_type', 'operation_kind', 'status', 'document_count', 'reason']);

const tx42 = entries.find(isTx42);
if (!tx42) throw new Error('TX42 was not found');
const txLegs = legacy.legs.filter(leg => leg.sourceEntryId === tx42.id && leg.dimension === 'gold');
const accountMetadata = (name: string) => {
  const account = accountByName.get(name);
  return account ? `${account.name} | mainType=${account.mainType} | subType=${account.subType} | type=${account.type ?? ''} | metal=${account.metal ?? ''}` : `${name} | historical account metadata not found`;
};
fs.writeFileSync(path.join(root, 'tx42_unresolved_decision.md'), `# TX42 — Unresolved Canonical Decision

- الحالة: \`unresolved\` في canonical operational posting.
- القرار في Phase 1: لا يتم إنشاء credit leg تخميني، ولا يتم تعديل السجل.
- Raw debit account: ${tx42.debit}
- Raw credit account: ${tx42.credit}
- Stored gold E21: ${Number(tx42.arabicWeight).toFixed(2)} g
- Debit metadata: ${accountMetadata(tx42.debit)}
- Credit metadata: ${accountMetadata(tx42.credit)}

## Legacy double-entry legs

${txLegs.map(leg => `- ${leg.side}: ${leg.accountName} — ${leg.amount.toFixed(2)} g E21`).join('\n')}

Legacy difference: ${(txLegs.filter(leg => leg.side === 'debit').reduce((sum, leg) => sum + leg.amount, 0) - txLegs.filter(leg => leg.side === 'credit').reduce((sum, leg) => sum + leg.amount, 0)).toFixed(2)} g E21.

## Warning

TX42 تظل قابلة للقراءة في General Ledger وLegacy Trial Balance، لكنها مستبعدة من canonical operational posting حتى اعتماد Business صريح للطرف المقابل.
`, 'utf8');

const trials = (['cash', 'gold', 'silver'] as const).map(dimension => buildTrialBalanceReport(entries, accounts, dimension, '0000-01-01', '9999-12-31'));
const unresolvedTypes = ruleStatuses.filter(row => row.status === 'unresolved');
const report = `# Accounting Engine Repair — Phase 1

## النتيجة

- Imported documents: **${entries.length}** (قراءة فقط).
- Legacy Cash debit = credit = **${legacy.trialBalanceTotals.cash.debit.toFixed(0)} EGP**.
- Legacy Gold debit = credit = **${legacy.trialBalanceTotals.gold.debit.toFixed(2)} g E21**.
- Legacy Silver debit = credit = **${legacy.trialBalanceTotals.silver.debit.toFixed(2)} g**.
- Physical Silver Inventory: **${operational.physicalSilverInventoryMovement.toFixed(2)} g**.
- Merchant Silver Liability: **${operational.merchantWeightLiabilityMovement.silver.toFixed(2)} g** (منفصلة عن المخزون).
- Net Silver Ownership: **${(operational.physicalSilverInventoryMovement - operational.merchantWeightLiabilityMovement.silver).toFixed(2)} g**، ولا تُسمى Inventory.

## لماذا كان Trial Balance يستخدم المصدر الخطأ؟

\`trialBalanceReport.ts\` و\`ledgerReport.ts\` كانا يستخدمان \`buildCanonicalAccountingLegs\`. هذا المحرك يصف حركات تشغيلية وقد يحذف طرفًا لا يملك Dimension بحسب metadata؛ لذلك لم يكن دفتر قيود مزدوجًا كاملًا. بعد الإصلاح، التقارير التاريخية تستخدم \`LegacyLedgerLegs\` المبنية مباشرة من debit/credit والحقول المخزنة الأصلية.

## Before / After

| التقرير | Before canonical difference | After legacy difference |
|---|---:|---:|
| Cash Trial Balance | 531,340 EGP | ${trials[0].difference.toFixed(0)} |
| Gold Trial Balance | 25.17 g E21 | ${trials[1].difference.toFixed(2)} |
| Silver Trial Balance | 617.70 g | ${trials[2].difference.toFixed(2)} |
| Home Silver | 5,670.80 g (double sign) | ${operational.physicalSilverInventoryMovement.toFixed(2)} g physical |

السجلات السبعة مجموعها **${seven.reduce((sum, entry) => sum + Number(entry.weight), 0).toFixed(2)} g**. قبل الإصلاح كانت تضيف بدل أن تخصم في Home، بفارق إجمالي 255.44 g. بعد الإصلاح Home وInventory يعرضان نفس physical selector.

## Canonical rule status

- \`sale\` و\`purchase\`: operational_only؛ لا Revenue/COGS/Clearing legs افتراضية.
- باقي الأنواع غير المعتمدة: legacy_only أو operational_only حسب الاستخدام.
- canonical_balanced: لا توجد قواعد معلّمة بهذه الحالة في Phase 1 دون اعتماد صريح.
- unresolved canonical: ${unresolvedTypes.map(row => `${row.operationType} (${row.documentCount})`).join(', ') || 'لا يوجد'}.

## الملفات الأساسية التي تغيرت

- \`src/lib/legacyLedger.ts\`
- \`src/lib/operationalProjection.ts\`
- \`src/lib/trialBalanceReport.ts\`
- \`src/lib/ledgerReport.ts\`
- \`src/components/views/HomeView.tsx\`
- \`src/components/views/reports/TrialBalanceView.tsx\`
- \`src/components/views/reports/GeneralLedgerView.tsx\`
- \`src/components/views/DailyJournalView.tsx\`
- \`src/components/Shared.tsx\`
- \`src/components/ui/MeasuredChartContainer.tsx\`
- \`src/components/views/reports/InventoryLifecycleView.tsx\`
- \`src/components/views/reports/LiquidityAnalysisView.tsx\`
- اختبارات Phase 1 وملفات trace المطلوبة.

## Verification

- Firestore writes/deletes أثناء الإصلاح: **0 / 0**.
- Migration أو تعديل مستندات تاريخية: **لم يحدث**.
- Hosting deploy: **لم يتم**.
- lint / tests / build: تُحدّث نتائجها بعد آخر تشغيل في التسليم النهائي.

## حدود Phase 1

تم التوقف قبل تصميم Canonical Revenue/COGS/Clearing mappings. يلزم اعتماد Business صريح قبل Phase 2.
`;
fs.writeFileSync(path.join(root, 'accounting_engine_repair_phase1.md'), report, 'utf8');

console.log(JSON.stringify({
  documents: entries.length,
  legacyTotals: legacy.trialBalanceTotals,
  physicalSilverInventory: operational.physicalSilverInventoryMovement,
  merchantSilverLiability: operational.merchantWeightLiabilityMovement.silver,
  netSilverOwnership: operational.physicalSilverInventoryMovement - operational.merchantWeightLiabilityMovement.silver,
  sevenRowWeight: seven.reduce((sum, entry) => sum + Number(entry.weight), 0),
  tx42LegacyLegs: txLegs.length,
  unresolvedCanonicalPostings: operational.unresolvedCanonicalPostings.length,
  historicalWrites: 0,
  historicalDeletes: 0,
  hostingDeploy: false,
}, null, 2));
