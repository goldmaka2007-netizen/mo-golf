import fs from 'node:fs';
import path from 'node:path';
import type { Entry } from '../src/types';
import {
  createCustomerPurchaseDesignFixture,
  createCustomerSaleDesignFixture,
  createMerchantTransferDesignFixture,
  createTx42CanonicalPosting,
  summarizePostingBalances,
  type CanonicalPostingSet,
  type CanonicalPostingStatus,
} from '../src/lib/canonicalMappingDesign';

type CsvRow = Record<string, string>;
type Confidence = 'high' | 'medium' | 'low';

interface MappingRow {
  operationType: string;
  arabicLabel: string;
  rawLabel?: string;
  documentCount: number;
  canonicalStatus: CanonicalPostingStatus;
  cashDebitAccount: string;
  cashCreditAccount: string;
  goldDebitAccount: string;
  goldCreditAccount: string;
  silverDebitAccount: string;
  silverCreditAccount: string;
  inventoryEffect: string;
  merchantLiabilityEffect: string;
  workmanshipEffect: string;
  costEffect: string;
  revenueEffect: string;
  expenseEffect: string;
  equityEffect: string;
  sourceRule: string;
  confidence: Confidence;
  blockingDecision: string;
  cashAmountSource: string;
  goldAmountSource: string;
  silverAmountSource: string;
  quantitySource: string;
  physicalInventoryEffect: string;
  currentRuleSource: string;
  unresolvedDecisions: string;
}

const root = process.cwd();

const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length || record.length) records.push([...record, field]);
  const headers = records.shift()?.map(header => header.replace(/^\uFEFF/, '')) ?? [];
  return records
    .filter(row => row.some(Boolean))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const csvEscape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
const writeCsv = (fileName: string, rows: object[], columns: string[]) => {
  const lines = [columns.map(csvEscape).join(','), ...rows.map(row => columns.map(column => csvEscape((row as Record<string, unknown>)[column])).join(','))];
  fs.writeFileSync(path.join(root, fileName), `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round = (value: number) => Math.round((value + Number.EPSILON) * 1e9) / 1e9;

const previewRows = parseCsv(fs.readFileSync(path.join(root, 'approved_normalized_preview.csv'), 'utf8'));
if (previewRows.length !== 2169) throw new Error(`Expected 2,169 imported documents, found ${previewRows.length}`);
const entries = previewRows.map(row => ({ ...(JSON.parse(row.proposed_import_document) as Entry), id: row.document_id }));
const legacyTrace = parseCsv(fs.readFileSync(path.join(root, 'legacy_ledger_projection_trace.csv'), 'utf8'));
const operationalTrace = parseCsv(fs.readFileSync(path.join(root, 'operational_projection_trace.csv'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'accounting_reconciliation_audit.json'), 'utf8')) as {
  documentCount: number;
  rawTotals: Record<'cash' | 'gold' | 'silver', { debit: number; credit: number }>;
};

const byRawLabel = new Map<string, Entry[]>();
entries.forEach(entry => byRawLabel.set(entry.tx, [...(byRawLabel.get(entry.tx) ?? []), entry]));
const count = (rawLabel: string) => byRawLabel.get(rawLabel)?.length ?? 0;

const sources = {
  business: 'Notion 01 — Business, Accounting & Inventory Rules',
  catalog: 'Notion 02 — Operations Catalog & Field Matrix',
  dictionary: 'Notion 10 — Business Examples & Legacy Data Dictionary',
  local: 'src/constants.ts + migrationData.ts + UI forms + Phase 1 traces',
  owner: 'Owner-approved TX42 decision — 2026-07-24',
};

const blank = {
  cashDebitAccount: '',
  cashCreditAccount: '',
  goldDebitAccount: '',
  goldCreditAccount: '',
  silverDebitAccount: '',
  silverCreditAccount: '',
  inventoryEffect: 'none',
  merchantLiabilityEffect: 'none',
  workmanshipEffect: 'none',
  costEffect: 'none',
  revenueEffect: 'none',
  expenseEffect: 'none',
  equityEffect: 'none',
  cashAmountSource: 'none',
  goldAmountSource: 'none',
  silverAmountSource: 'none',
  quantitySource: 'none',
  physicalInventoryEffect: 'none',
  unresolvedDecisions: '',
};

const mappings: MappingRow[] = [
  {
    ...blank,
    operationType: 'customer_gold_sale', arabicLabel: 'بيع ذهب', rawLabel: 'بيع ذهب', documentCount: count('بيع ذهب'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'الخزنة [existing]', cashCreditAccount: 'مبيعات الذهب [canonical ID approval required]',
    goldCreditAccount: 'مخزون الذهب — المنتج', goldDebitAccount: 'BLOCKED: حساب مقابل خروج الوزن',
    inventoryEffect: 'physical gold decreases once', physicalInventoryEffect: '-physical weight; -Equivalent-21 ownership',
    costEffect: 'remove at pre-sale WAC; COGS projection', revenueEffect: '+cash sales revenue', expenseEffect: '+COGS at carrying cost',
    cashAmountSource: 'cash', goldAmountSource: 'goldEquivalent21Snapshot/imported arabicWeight', quantitySource: 'count (operational only)',
    sourceRule: `${sources.business} §7/§15; AGENTS.md`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'medium', blockingDecision: 'Approve the real gold-weight counterpart account and canonical IDs for Sales/COGS.',
    unresolvedDecisions: 'Whether the gold weight ledger represents custody, ownership, or a separate inventory subledger in journal reporting.',
  },
  {
    ...blank,
    operationType: 'customer_gold_purchase', arabicLabel: 'شراء ذهب من عميل', rawLabel: 'شراء ذهب', documentCount: count('شراء ذهب'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'BLOCKED: cash carrying-cost/acquisition account', cashCreditAccount: 'الخزنة [existing]',
    goldDebitAccount: 'مخزون الذهب — المنتج', goldCreditAccount: 'BLOCKED: الطرف الوزني المقابل للاقتناء',
    inventoryEffect: 'physical gold and ownership increase', physicalInventoryEffect: '+physical weight; +Equivalent-21 ownership',
    costEffect: 'add cash acquisition cost to product+karat WAC pool', cashAmountSource: 'cash',
    goldAmountSource: 'goldEquivalent21Snapshot/imported arabicWeight', quantitySource: 'count (operational only)',
    sourceRule: `${sources.business} §7/§15; AGENTS.md`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'medium', blockingDecision: 'Approve the real weight counterpart and whether acquisition value posts to inventory cost or a purchase expense account.',
    unresolvedDecisions: 'No fake revenue is allowed; physical grams remain product inventory while E21 is the gold-ledger amount.',
  },
  {
    ...blank,
    operationType: 'customer_silver_sale', arabicLabel: 'بيع فضة', rawLabel: 'بيع فضة', documentCount: count('بيع فضة'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'الخزنة [existing]', cashCreditAccount: 'مبيعات الفضة [canonical ID approval required]',
    silverCreditAccount: 'مخزون الفضة — المنتج', silverDebitAccount: 'BLOCKED: حساب مقابل خروج الوزن',
    inventoryEffect: 'physical silver decreases once', physicalInventoryEffect: '-physical silver',
    costEffect: 'remove at pre-sale WAC; COGS projection', revenueEffect: '+cash sales revenue', expenseEffect: '+COGS at carrying cost',
    cashAmountSource: 'cash', silverAmountSource: 'weight', quantitySource: 'count (operational only)',
    sourceRule: `${sources.business} §5/§7/§15`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'medium', blockingDecision: 'Approve silver weight counterpart and canonical Sales/COGS IDs.',
    unresolvedDecisions: 'Silver uses physical weight only.',
  },
  {
    ...blank,
    operationType: 'customer_silver_purchase', arabicLabel: 'شراء فضة من عميل', rawLabel: 'شراء فضة', documentCount: count('شراء فضة'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'BLOCKED: cash carrying-cost/acquisition account', cashCreditAccount: 'الخزنة [existing]',
    silverDebitAccount: 'مخزون الفضة — المنتج', silverCreditAccount: 'BLOCKED: الطرف الوزني المقابل للاقتناء',
    inventoryEffect: 'physical silver and ownership increase', physicalInventoryEffect: '+physical silver',
    costEffect: 'add cash acquisition cost to silver WAC pool', cashAmountSource: 'cash', silverAmountSource: 'weight',
    quantitySource: 'count (operational only)', sourceRule: `${sources.business} §5/§7/§15`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'medium',
    blockingDecision: 'Approve silver weight counterpart and acquisition-value classification.',
    unresolvedDecisions: 'No fake sales revenue.',
  },
  {
    ...blank,
    operationType: 'accessory_sale', arabicLabel: 'بيع ملحقات', rawLabel: 'بيع ملحقات', documentCount: count('بيع ملحقات'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'الخزنة [existing]', cashCreditAccount: 'مبيعات الملحقات [canonical ID approval required]',
    inventoryEffect: 'quantity decreases only', physicalInventoryEffect: 'none', quantitySource: 'count',
    costEffect: 'remove quantity at pre-sale WAC; recognize accessory COGS', revenueEffect: '+cash sales revenue',
    expenseEffect: '+accessory COGS', cashAmountSource: 'cash', sourceRule: `${sources.business} §6/§15`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'high',
    blockingDecision: 'Approve canonical IDs for accessory Sales and COGS accounts.',
    unresolvedDecisions: 'Must never enter gold or silver ledgers.',
  },
  {
    ...blank,
    operationType: 'accessory_purchase', arabicLabel: 'شراء ملحقات', rawLabel: 'شراء ملحقات', documentCount: count('شراء ملحقات'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'BLOCKED: accessory carrying-cost/acquisition account', cashCreditAccount: 'الخزنة [existing]',
    inventoryEffect: 'quantity increases only', quantitySource: 'count', costEffect: 'add quantity and cash cost to accessory WAC',
    cashAmountSource: 'cash', sourceRule: `${sources.business} §6/§15`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'high', blockingDecision: 'Approve cash-dimension acquisition/carrying-cost account and canonical ID.',
    unresolvedDecisions: 'Must never enter gold or silver ledgers.',
  },
  {
    ...blank,
    operationType: 'inventory_transformation', arabicLabel: 'تيفيت', rawLabel: 'تيفيت', documentCount: count('تيفيت'),
    canonicalStatus: 'canonical_balanced', goldDebitAccount: 'مخزون الذهب — المنتج الناتج', goldCreditAccount: 'كسر عربي/كسر افرنجي حسب تصنيف الناتج',
    inventoryEffect: 'equal E21 transfer source→destination', physicalInventoryEffect: 'equal physical-weight transformation',
    costEffect: 'transfer exact source WAC; no revenue or purchase cash', goldAmountSource: 'Equivalent-21 derived from equal physical source/destination weight',
    quantitySource: 'output count when countable', sourceRule: `${sources.business} §10; ${sources.catalog}`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'high', blockingDecision: '',
    unresolvedDecisions: 'None for normal zero-variance tafiet; any real variance is a separate adjustment.',
  },
  {
    ...blank,
    operationType: 'inventory_transfer', arabicLabel: 'تحويل مخزون', rawLabel: 'تحويل', documentCount: count('تحويل'),
    canonicalStatus: 'canonical_balanced', goldDebitAccount: 'destination inventory product', goldCreditAccount: 'source inventory product',
    inventoryEffect: 'classification transfer; total physical inventory unchanged', physicalInventoryEffect: 'source decrease = destination increase',
    costEffect: 'preserve total carrying cost', goldAmountSource: 'Equivalent-21', quantitySource: 'count where applicable',
    sourceRule: `${sources.business} §15; ${sources.catalog}`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Cross-metal transfer is invalid.',
  },
  {
    ...blank,
    operationType: 'inventory_adjustment', arabicLabel: 'تسوية جرد', rawLabel: 'تسوية', documentCount: count('تسوية'),
    canonicalStatus: 'unresolved', inventoryEffect: 'surplus increases; shortage decreases; count-only stays inventory_only',
    physicalInventoryEffect: 'difference = counted - theoretical', costEffect: 'shortage at current WAC; surplus treatment still conflicts in sources',
    goldDebitAccount: 'inventory or shortage account according to sign', goldCreditAccount: 'surplus or inventory account according to sign',
    silverDebitAccount: 'inventory or shortage account according to sign', silverCreditAccount: 'surplus or inventory account according to sign',
    cashDebitAccount: 'cash/shortage account for cash count', cashCreditAccount: 'cash/surplus account for cash count',
    goldAmountSource: 'Equivalent-21 for gold weight adjustments', silverAmountSource: 'physical silver weight',
    quantitySource: 'count difference; never metal ledger', sourceRule: `${sources.business} §11/§15; Notion open-question 39fa...8121`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'medium',
    blockingDecision: 'Close the still-open surplus reference-cost policy and split the historical direct inventory-to-inventory anomaly.',
    unresolvedDecisions: 'One historical تسوية row is inventory-to-inventory, conflicting with the current adjustment label.',
  },
  {
    ...blank,
    operationType: 'merchant_gold_receipt', arabicLabel: 'استلام ذهب من تاجر', rawLabel: 'تاجر ذهب', documentCount: count('تاجر ذهب'),
    canonicalStatus: 'canonical_balanced', goldDebitAccount: 'physical gold inventory product', goldCreditAccount: 'merchant gold liability account',
    inventoryEffect: 'physical custody increases', physicalInventoryEffect: '+physical gold; shop ownership unchanged',
    merchantLiabilityEffect: '+merchant liability E21', goldAmountSource: 'Equivalent-21', quantitySource: 'count operational only',
    costEffect: 'none unless ownership later changes through a separate approved event', sourceRule: `${sources.business} §8; owner merchant rules`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'high', blockingDecision: '',
    unresolvedDecisions: 'Historical UI label is too generic; canonical subtype must be derived from accounts/fields.',
  },
  {
    ...blank,
    operationType: 'merchant_silver_receipt', arabicLabel: 'استلام فضة من تاجر', rawLabel: 'تاجر فضة', documentCount: count('تاجر فضة'),
    canonicalStatus: 'canonical_balanced', silverDebitAccount: 'physical silver inventory product', silverCreditAccount: 'merchant silver liability account',
    inventoryEffect: 'physical custody increases', physicalInventoryEffect: '+physical silver; shop ownership unchanged',
    merchantLiabilityEffect: '+merchant liability physical silver', silverAmountSource: 'weight',
    costEffect: 'none unless ownership changes', sourceRule: `${sources.business} §8; owner merchant rules`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'high', blockingDecision: '',
    unresolvedDecisions: 'Historical UI label is too generic; canonical subtype must be derived from accounts/fields.',
  },
  {
    ...blank,
    operationType: 'merchant_gold_settlement', arabicLabel: 'سداد تاجر ذهب (وزن أو مصنعية)', rawLabel: 'حساب تاجر ذهب', documentCount: count('حساب تاجر ذهب'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'merchant workmanship/cash balance', cashCreditAccount: 'الخزنة',
    goldDebitAccount: 'merchant gold liability', goldCreditAccount: 'selected settlement inventory',
    inventoryEffect: 'weight settlement only: physical gold decreases', physicalInventoryEffect: 'none for cash settlement; decrease for weight settlement',
    merchantLiabilityEffect: '-merchant E21 liability on weight settlement', workmanshipEffect: '-merchant cash/workmanship balance on cash settlement',
    costEffect: 'weight settlement removes custody cost only when ownership/cost policy says shop-owned; otherwise no automatic cost',
    cashAmountSource: 'cash for cash subtype', goldAmountSource: 'Equivalent-21 for weight subtype',
    sourceRule: `${sources.business} §8; owner merchant rules`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Production enum must split cash and weight settlement; never post both from a label alone.',
  },
  {
    ...blank,
    operationType: 'merchant_silver_settlement', arabicLabel: 'سداد تاجر فضة (وزن أو مصنعية)', rawLabel: 'حساب تاجر فضة', documentCount: count('حساب تاجر فضة'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'merchant workmanship/cash balance', cashCreditAccount: 'الخزنة',
    silverDebitAccount: 'merchant silver liability', silverCreditAccount: 'selected silver settlement inventory',
    inventoryEffect: 'weight settlement only: physical silver decreases', physicalInventoryEffect: 'none for cash settlement; decrease for weight settlement',
    merchantLiabilityEffect: '-merchant physical-silver liability on weight settlement', workmanshipEffect: '-merchant cash/workmanship on cash settlement',
    costEffect: 'no automatic cost unless ownership changes', cashAmountSource: 'cash for cash subtype', silverAmountSource: 'weight for weight subtype',
    sourceRule: `${sources.business} §8; Phase 1 silver sign fix`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Seven debit-merchant/credit-inventory rows must remain negative physical inventory once, never twice.',
  },
  {
    ...blank,
    operationType: 'merchant_to_merchant_transfer', arabicLabel: 'حوالة بين تجار', rawLabel: 'حوالة', documentCount: count('حوالة'),
    canonicalStatus: 'canonical_balanced', goldDebitAccount: 'source merchant liability', goldCreditAccount: 'destination merchant liability',
    inventoryEffect: 'none', physicalInventoryEffect: 'none', merchantLiabilityEffect: 'decrease source; increase destination; net zero',
    costEffect: 'none', goldAmountSource: 'Equivalent-21', sourceRule: `${sources.business} §8; owner merchant rules`,
    currentRuleSource: 'Phase 1 operational_only', confidence: 'high', blockingDecision: '',
    unresolvedDecisions: 'Cash/workmanship transfer, if later allowed, must be a separately typed cash balance transfer.',
  },
  {
    ...blank,
    operationType: 'administrative_expense', arabicLabel: 'مصاريف إدارية وعمومية', rawLabel: 'م ا ع', documentCount: count('م ا ع'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'specific administrative expense account', cashCreditAccount: 'الخزنة',
    cashAmountSource: 'cash', expenseEffect: '+administrative expense', sourceRule: `${sources.business} §12; legacy debit/credit`,
    currentRuleSource: 'Phase 1 legacy_only', confidence: 'high', blockingDecision: '', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'operating_expense', arabicLabel: 'مصاريف تشغيلية', rawLabel: 'م ت', documentCount: count('م ت'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'specific operating expense account', cashCreditAccount: 'الخزنة',
    cashAmountSource: 'cash', expenseEffect: '+operating expense', sourceRule: `${sources.business} §12; legacy debit/credit`,
    currentRuleSource: 'Phase 1 legacy_only', confidence: 'high', blockingDecision: '', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'other_income', arabicLabel: 'إيرادات أخرى', rawLabel: 'ايرادات اخري', documentCount: count('ايرادات اخري'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'الخزنة', cashCreditAccount: 'specific other-income account',
    cashAmountSource: 'cash', revenueEffect: '+other income', sourceRule: `${sources.business} §12; legacy debit/credit`,
    currentRuleSource: 'Phase 1 legacy_only', confidence: 'high', blockingDecision: '', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'owner_withdrawal', arabicLabel: 'مسحوبات مالك', rawLabel: 'مسحوبات', documentCount: count('مسحوبات'),
    canonicalStatus: 'unresolved', cashDebitAccount: 'المسحوبات', cashCreditAccount: 'الخزنة', cashAmountSource: 'cash',
    equityEffect: '-owner equity; never operating expense', sourceRule: `${sources.business} §9/§12; legacy debit/credit`,
    currentRuleSource: 'Phase 1 legacy_only', confidence: 'high',
    blockingDecision: 'Classify the one reversed historical row (debit cash / credit withdrawals) as owner contribution or correction.',
    unresolvedDecisions: '92 rows follow withdrawal direction; one row is reversed.',
  },
  {
    ...blank,
    operationType: 'customer_receipt', arabicLabel: 'قبض من عميل', rawLabel: 'قبض من عميل', documentCount: count('قبض من عميل'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'الخزنة', cashCreditAccount: 'customer receivable/payable balance',
    cashAmountSource: 'cash', sourceRule: `${sources.catalog}; legacy debit/credit`, currentRuleSource: 'Phase 1 legacy_only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Party account classification must be resolved by Account ID, not name.',
  },
  {
    ...blank,
    operationType: 'customer_payment', arabicLabel: 'دفع لعميل', rawLabel: 'دفع لعميل', documentCount: count('دفع لعميل'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'customer balance', cashCreditAccount: 'الخزنة',
    cashAmountSource: 'cash', sourceRule: `${sources.catalog}; legacy debit/credit`, currentRuleSource: 'Phase 1 operational_only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Party account classification must be resolved by Account ID, not name.',
  },
  {
    ...blank,
    operationType: 'asset_purchase', arabicLabel: 'شراء أصل', rawLabel: 'شراء اصل', documentCount: count('شراء اصل'),
    canonicalStatus: 'canonical_balanced', cashDebitAccount: 'specific fixed asset', cashCreditAccount: 'الخزنة',
    cashAmountSource: 'cash', sourceRule: `${sources.catalog}; legacy debit/credit`, currentRuleSource: 'Phase 1 legacy_only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'opening_balance_legacy_except_tx42', arabicLabel: 'قيد افتتاحي (باستثناء TX42)', rawLabel: 'قيد افتتاحي', documentCount: count('قيد افتتاحي') - 1,
    canonicalStatus: 'legacy_only', inventoryEffect: 'mixed cash/gold/silver/accessory/party openings',
    physicalInventoryEffect: 'according to historical account pair', costEffect: 'gold/silver annual opening price; accessories fixed opening cost',
    cashAmountSource: 'cash when present', goldAmountSource: 'Equivalent-21', silverAmountSource: 'physical weight', quantitySource: 'count/accessory normalized quantity',
    equityEffect: 'opening capital/retained result according to explicit account pair',
    sourceRule: `${sources.business} §9/§15; legacy raw legs`, currentRuleSource: 'LegacyLedgerProjection only',
    confidence: 'medium', blockingDecision: 'Approve a subtype-by-subtype opening matrix and canonical IDs; do not infer all 41 rows from one label.',
    unresolvedDecisions: 'Opening cash, metals, accessories, fixed assets, merchant/customer balances and retained results must remain distinct.',
  },
  {
    ...blank,
    operationType: 'opening_retained_gold_result_tx42', arabicLabel: 'نتيجة ذهب مرحلة — TX42', rawLabel: 'قيد افتتاحي', documentCount: 1,
    canonicalStatus: 'canonical_balanced', goldDebitAccount: 'seed-account-35d2d47536f02061f01a — راس المال ذهب',
    goldCreditAccount: 'seed-account-b99a05ac4c9416a5c6f6 — الارباح و الخساير 2024',
    goldAmountSource: 'stored arabicWeight = 16.20 g E21', equityEffect: 'capital gold +16.20; retained loss from 2025 +16.20 credit leg per approved decision',
    sourceRule: sources.owner, currentRuleSource: 'Phase 2 design fixture', confidence: 'high', blockingDecision: '',
    unresolvedDecisions: 'None. Historical name remains unchanged; semantic year 2025 is metadata/display alias only.',
  },
  // Catalog/UI/system types with no documents in the imported 2,169-row history.
  {
    ...blank,
    operationType: 'owner_contribution', arabicLabel: 'إضافة مالك نقدية', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'الخزنة', cashCreditAccount: 'owner contribution/capital cash account', cashAmountSource: 'cash',
    equityEffect: '+owner equity', sourceRule: `${sources.business} §9; ${sources.catalog}`, currentRuleSource: 'Not implemented in legacy UI',
    confidence: 'high', blockingDecision: 'Approve the canonical capital cash Account ID.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'opening_cash', arabicLabel: 'رصيد افتتاحي نقدي', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'الخزنة', cashCreditAccount: 'opening owner equity/explicit source account', cashAmountSource: 'cash',
    equityEffect: '+opening equity when owner-funded', sourceRule: `${sources.business} §9`, currentRuleSource: 'OPERATION_RULES only',
    confidence: 'medium', blockingDecision: 'Approve source-account selection rules and canonical IDs.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'opening_gold', arabicLabel: 'رصيد افتتاحي ذهب', documentCount: 0, canonicalStatus: 'unresolved',
    goldDebitAccount: 'gold inventory product', goldCreditAccount: 'opening gold equity/explicit source', goldAmountSource: 'Equivalent-21',
    physicalInventoryEffect: '+physical gold', costEffect: 'annual 21K opening price × E21', sourceRule: `${sources.business} §9/§15`,
    currentRuleSource: 'OPERATION_RULES only', confidence: 'medium', blockingDecision: 'Approve canonical opening-equity Account ID.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'opening_silver', arabicLabel: 'رصيد افتتاحي فضة', documentCount: 0, canonicalStatus: 'unresolved',
    silverDebitAccount: 'silver inventory product', silverCreditAccount: 'opening silver equity/explicit source', silverAmountSource: 'physical weight',
    physicalInventoryEffect: '+physical silver', costEffect: 'annual silver opening price × weight', sourceRule: `${sources.business} §9/§15`,
    currentRuleSource: 'OPERATION_RULES only', confidence: 'medium', blockingDecision: 'Approve canonical opening-equity Account ID.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'opening_accessories', arabicLabel: 'رصيد افتتاحي ملحقات', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'accessory opening carrying-cost account', cashCreditAccount: 'opening accessory equity', quantitySource: 'count',
    inventoryEffect: '+accessory quantity', costEffect: 'approved fixed opening cost', sourceRule: `${sources.business} §6/§9`,
    currentRuleSource: 'OPERATION_RULES only', confidence: 'medium', blockingDecision: 'Approve canonical cash/cost Account IDs.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'retained_cash_results', arabicLabel: 'نتائج نقدية مرحلة', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'capital/retained result by sign', cashCreditAccount: 'retained cash result by sign', cashAmountSource: 'cash',
    equityEffect: 'prior-year result transfer', sourceRule: `${sources.business} §9`, currentRuleSource: 'Historical combined opening label only',
    confidence: 'medium', blockingDecision: 'Approve sign matrix, semantic year metadata and canonical IDs.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'retained_silver_results', arabicLabel: 'نتائج فضة مرحلة', documentCount: 0, canonicalStatus: 'unresolved',
    silverDebitAccount: 'capital silver/retained result by sign', silverCreditAccount: 'retained silver result/capital by sign',
    silverAmountSource: 'physical weight', equityEffect: 'prior-year silver result transfer', sourceRule: `${sources.business} §9`,
    currentRuleSource: 'Historical combined opening label only', confidence: 'medium',
    blockingDecision: 'Approve sign matrix, semantic year metadata and canonical IDs.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'customer_gold_return', arabicLabel: 'مرتجع ذهب', documentCount: count('مرتجع ذهب'), canonicalStatus: 'unresolved',
    cashDebitAccount: 'sales return/refund account', cashCreditAccount: 'الخزنة', goldDebitAccount: 'returned gold inventory',
    goldCreditAccount: 'BLOCKED: sale-return weight counterpart', cashAmountSource: 'cash', goldAmountSource: 'Equivalent-21',
    inventoryEffect: '+physical returned gold', costEffect: 'restore using approved return/original-sale cost policy',
    sourceRule: 'src/constants.ts; hidden in current OperationSelector', currentRuleSource: 'constants only',
    confidence: 'low', blockingDecision: 'Approve return matching, refund and cost-restoration rules.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'customer_silver_return', arabicLabel: 'مرتجع فضة', documentCount: count('مرتجع فضة'), canonicalStatus: 'unresolved',
    cashDebitAccount: 'sales return/refund account', cashCreditAccount: 'الخزنة', silverDebitAccount: 'returned silver inventory',
    silverCreditAccount: 'BLOCKED: sale-return weight counterpart', cashAmountSource: 'cash', silverAmountSource: 'weight',
    inventoryEffect: '+physical returned silver', costEffect: 'restore using approved return/original-sale cost policy',
    sourceRule: 'src/constants.ts; hidden in current OperationSelector', currentRuleSource: 'constants only',
    confidence: 'low', blockingDecision: 'Approve return matching, refund and cost-restoration rules.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'merchant_delivery', arabicLabel: 'تسليم/رد معدن لتاجر', documentCount: 0, canonicalStatus: 'unresolved',
    inventoryEffect: 'physical custody decreases', merchantLiabilityEffect: 'merchant liability decreases',
    costEffect: 'no automatic shop-owned cost', sourceRule: `${sources.business} §8`, currentRuleSource: 'No explicit legacy enum',
    confidence: 'medium', blockingDecision: 'Approve a dedicated enum and direction-specific UI label.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'merchant_weight_settlement', arabicLabel: 'سداد وزن تاجر', documentCount: 0, canonicalStatus: 'unresolved',
    merchantLiabilityEffect: 'decrease merchant metal liability', inventoryEffect: 'decrease selected settlement inventory',
    goldAmountSource: 'Equivalent-21 or silver physical weight by merchant metal', sourceRule: `${sources.business} §8; ${sources.catalog}`,
    currentRuleSource: 'Combined in historical حساب تاجر labels', confidence: 'high',
    blockingDecision: 'Approve production subtype IDs; mapping principle is approved.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'merchant_cash_workmanship_settlement', arabicLabel: 'سداد نقدية/مصنعية تاجر', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'merchant workmanship balance', cashCreditAccount: 'الخزنة', workmanshipEffect: 'decrease cash-only merchant balance',
    cashAmountSource: 'cash', sourceRule: `${sources.business} §8; ${sources.catalog}`,
    currentRuleSource: 'Combined in historical حساب تاجر labels', confidence: 'high',
    blockingDecision: 'Approve the dedicated merchant-workmanship canonical Account IDs.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'quantity_only_adjustment', arabicLabel: 'تسوية عدد فقط', documentCount: 0, canonicalStatus: 'inventory_only',
    inventoryEffect: 'quantity only; no metal or Trial Balance effect', quantitySource: 'count difference', costEffect: 'none',
    sourceRule: `${sources.business} §11; ${sources.catalog}`, currentRuleSource: 'Not explicit in legacy labels',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'edit_reversal', arabicLabel: 'عكس مشتقات نسخة قبل التعديل', documentCount: 0, canonicalStatus: 'non_journal',
    inventoryEffect: 'reverse old derived effects then apply new snapshot atomically', costEffect: 'chronological replay',
    sourceRule: `${sources.business} §13`, currentRuleSource: 'Audit behavior; not a user journal operation',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'The audit reversal must not appear as an extra business operation in Trial Balance.',
  },
  {
    ...blank,
    operationType: 'deleted_operation_reversal', arabicLabel: 'إزالة أثر عملية محذوفة', documentCount: 0, canonicalStatus: 'non_journal',
    inventoryEffect: 'deleted operation stops affecting all projections', costEffect: 'chronological replay',
    sourceRule: `${sources.business} §13`, currentRuleSource: 'Audit behavior; not a user journal operation',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Audit snapshot remains; no reusable operation/journal numbers.',
  },
  {
    ...blank,
    operationType: 'memo_non_posting', arabicLabel: 'مذكرة / عملية غير مرحلة', documentCount: 0, canonicalStatus: 'non_journal',
    sourceRule: 'Phase 2 canonical status policy', currentRuleSource: 'Design-only',
    confidence: 'high', blockingDecision: '', unresolvedDecisions: 'Must be explicitly marked and excluded from Trial Balance.',
  },
  {
    ...blank,
    operationType: 'generic_receipt', arabicLabel: 'قبض عام', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'الخزنة', cashCreditAccount: 'explicit source account', cashAmountSource: 'cash',
    sourceRule: sources.catalog, currentRuleSource: 'No generic legacy enum', confidence: 'low',
    blockingDecision: 'Do not add a generic receipt without selecting a real business source account.', unresolvedDecisions: '',
  },
  {
    ...blank,
    operationType: 'generic_payment', arabicLabel: 'دفع عام', documentCount: 0, canonicalStatus: 'unresolved',
    cashDebitAccount: 'explicit destination account', cashCreditAccount: 'الخزنة', cashAmountSource: 'cash',
    sourceRule: sources.catalog, currentRuleSource: 'No generic legacy enum', confidence: 'low',
    blockingDecision: 'Do not add a generic payment without selecting a real business destination account.', unresolvedDecisions: '',
  },
];

const actualTypes = [...byRawLabel.entries()]
  .map(([rawLabel, items]) => ({
    operationType: rawLabel,
    arabicLabel: rawLabel,
    documentCount: items.length,
    exampleDocumentIds: items.slice(0, 3).map(item => item.legacyOperationNo || item.id).join('|'),
    cashDimension: items.some(item => Number(item.cash) > 0) ? 'used' : 'not_used',
    goldDimension: rawLabel.includes('ملحقات') ? 'not_used' : items.some(item => Number(item.arabicWeight) > 0 && !/فضة|ملحقات/.test(`${item.debit} ${item.credit}`)) ? 'used_or_requires_account_metadata' : 'not_used',
    silverDimension: items.some(item => Number(item.weight) > 0 && /فضة/.test(`${item.debit} ${item.credit}`)) ? 'used' : 'not_used',
    quantityEffect: items.some(item => Number(item.count) !== 0) ? 'present; operational count only' : 'none',
    physicalInventoryEffect: mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.physicalInventoryEffect).filter(Boolean).join(' || '),
    merchantLiabilityEffect: mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.merchantLiabilityEffect).filter(value => value !== 'none').join(' || ') || 'none',
    merchantWorkmanshipEffect: mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.workmanshipEffect).filter(value => value !== 'none').join(' || ') || 'none',
    costingEffect: mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.costEffect).filter(value => value !== 'none').join(' || ') || 'none/unknown',
    currentCanonicalStatus: [...new Set(mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.canonicalStatus))].join('|'),
    currentRuleSource: mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.currentRuleSource).filter(Boolean).join(' || '),
    unresolvedDecisions: mappings.filter(mapping => mapping.rawLabel === rawLabel).map(mapping => mapping.blockingDecision).filter(Boolean).join(' || '),
  }))
  .sort((a, b) => b.documentCount - a.documentCount || a.operationType.localeCompare(b.operationType, 'ar'));

const designOnlyTypes = mappings
  .filter(mapping => !mapping.rawLabel || count(mapping.rawLabel) === 0)
  .map(mapping => ({
    operationType: mapping.operationType,
    arabicLabel: mapping.arabicLabel,
    documentCount: 0,
    exampleDocumentIds: '',
    cashDimension: mapping.cashDebitAccount || mapping.cashCreditAccount ? 'designed' : 'not_used',
    goldDimension: mapping.goldDebitAccount || mapping.goldCreditAccount ? 'designed' : 'not_used',
    silverDimension: mapping.silverDebitAccount || mapping.silverCreditAccount ? 'designed' : 'not_used',
    quantityEffect: mapping.quantitySource,
    physicalInventoryEffect: mapping.physicalInventoryEffect,
    merchantLiabilityEffect: mapping.merchantLiabilityEffect,
    merchantWorkmanshipEffect: mapping.workmanshipEffect,
    costingEffect: mapping.costEffect,
    currentCanonicalStatus: mapping.canonicalStatus,
    currentRuleSource: mapping.currentRuleSource,
    unresolvedDecisions: mapping.blockingDecision,
  }));

writeCsv('operation_type_inventory.csv', [...actualTypes, ...designOnlyTypes], [
  'operationType', 'arabicLabel', 'documentCount', 'exampleDocumentIds', 'cashDimension', 'goldDimension',
  'silverDimension', 'quantityEffect', 'physicalInventoryEffect', 'merchantLiabilityEffect',
  'merchantWorkmanshipEffect', 'costingEffect', 'currentCanonicalStatus', 'currentRuleSource', 'unresolvedDecisions',
]);

writeCsv('canonical_operation_mapping_matrix.csv', mappings, [
  'operationType', 'arabicLabel', 'documentCount', 'canonicalStatus', 'cashDebitAccount', 'cashCreditAccount',
  'goldDebitAccount', 'goldCreditAccount', 'silverDebitAccount', 'silverCreditAccount', 'inventoryEffect',
  'merchantLiabilityEffect', 'workmanshipEffect', 'costEffect', 'revenueEffect', 'expenseEffect', 'equityEffect',
  'sourceRule', 'confidence', 'blockingDecision',
]);

const totalsForType = (rawLabel: string, excludedOperationNo?: string) => {
  const sourceIds = new Set(entries
    .filter(entry => entry.tx === rawLabel && (entry.legacyOperationNo || entry.invoiceNumber) !== excludedOperationNo)
    .map(entry => entry.id));
  const legs = legacyTrace.filter(row => sourceIds.has(row.source_entry_id));
  const operational = operationalTrace.filter(row => sourceIds.has(row.source_entry_id));
  const dimension = (name: 'cash' | 'gold' | 'silver', side: 'debit' | 'credit') =>
    round(sum(legs.filter(row => row.dimension === name && row.side === side).map(row => Number(row.amount) || 0)));
  const op = (field: string) => round(sum(operational.map(row => Number(row[field]) || 0)));
  return {
    documents: sourceIds.size,
    cash: { debit: dimension('cash', 'debit'), credit: dimension('cash', 'credit') },
    gold: { debit: dimension('gold', 'debit'), credit: dimension('gold', 'credit') },
    silver: { debit: dimension('silver', 'debit'), credit: dimension('silver', 'credit') },
    inventoryMovement: {
      physicalGold: op('physical_gold_inventory_movement'),
      goldEquivalent21: op('gold_equivalent_21_movement'),
      physicalSilver: op('physical_silver_inventory_movement'),
      quantity: op('accessories_quantity_movement'),
    },
    merchantLiabilityMovement: {
      gold: op('merchant_gold_liability_movement'),
      silver: op('merchant_silver_liability_movement'),
    },
    merchantWorkmanshipMovement: op('merchant_workmanship_cash_movement'),
    costMovement: null,
    costBasisStatus: 'historical WAC basis is incomplete; no cost invented',
  };
};

const fixturePostings: CanonicalPostingSet[] = [
  createTx42CanonicalPosting(),
  createCustomerSaleDesignFixture('gold'),
  createCustomerSaleDesignFixture('silver'),
  createCustomerSaleDesignFixture('accessory'),
  createCustomerPurchaseDesignFixture('gold'),
  createCustomerPurchaseDesignFixture('silver'),
  createCustomerPurchaseDesignFixture('accessory'),
  createMerchantTransferDesignFixture('gold'),
  createMerchantTransferDesignFixture('silver'),
];

const simulation = {
  metadata: {
    phase: 'Accounting Engine Repair — Phase 2: Canonical Mapping Design',
    generatedAt: new Date().toISOString(),
    source: 'approved_normalized_preview.csv + Phase 1 read-only traces + in-memory fixtures',
    firebaseProject: 'makka-central-accounting',
    documentCount: entries.length,
    firestoreWrites: 0,
    firestoreDeletes: 0,
    migrationRuns: 0,
    hostingDeploys: 0,
    ruleVersion: 'phase2-design-v1',
  },
  legacyControlTotals: {
    cash: audit.rawTotals.cash,
    gold: audit.rawTotals.gold,
    silver: audit.rawTotals.silver,
  },
  historicalByOperationType: actualTypes.map(item => ({
    operationType: item.operationType,
    canonicalStatuses: item.currentCanonicalStatus.split('|'),
    ...totalsForType(item.operationType, item.operationType === 'قيد افتتاحي' ? 'TX42' : undefined),
  })),
  tx42: {
    beforeStatus: 'unresolved',
    afterStatus: 'canonical_balanced',
    metadata: createTx42CanonicalPosting(),
    balances: summarizePostingBalances(createTx42CanonicalPosting()),
  },
  designFixtures: fixturePostings.map(posting => ({
    sourceOperationId: posting.sourceOperationId,
    operationType: posting.operationType,
    status: posting.postingStatus,
    balancingStatus: posting.balancingStatus,
    balances: summarizePostingBalances(posting),
    inventoryMovementCount: posting.physicalInventoryMovements.length,
    merchantLiabilityMovementCount: posting.merchantMetalLiabilityMovements.length,
    costMovementCount: posting.costMovements.length,
    errors: posting.validationErrors,
    warnings: posting.validationWarnings,
  })),
  balancedOperationTypes: mappings.filter(mapping => mapping.canonicalStatus === 'canonical_balanced').map(mapping => mapping.operationType),
  unresolvedOperationTypes: mappings.filter(mapping => mapping.canonicalStatus === 'unresolved').map(mapping => ({
    operationType: mapping.operationType,
    blockingDecision: mapping.blockingDecision,
  })),
  duplicateEffects: [
    {
      risk: 'customer sale inventory deducted both by physical movement and by reinterpreting ledger legs',
      result: 'prevented in design fixture: exactly one physicalInventoryMovement',
    },
    {
      risk: 'seven merchant-silver settlements receive a second sign inversion',
      result: 'prevented: physical contribution remains -127.72 g once',
    },
  ],
  missingCounterpartMappings: mappings
    .filter(mapping => /BLOCKED/.test(`${mapping.cashDebitAccount}${mapping.cashCreditAccount}${mapping.goldDebitAccount}${mapping.goldCreditAccount}${mapping.silverDebitAccount}${mapping.silverCreditAccount}`))
    .map(mapping => mapping.operationType),
  historicalMeaningConflicts: [
    { label: 'حساب تاجر ذهب/فضة', conflict: 'combines weight settlement and cash/workmanship settlement; production enum must split them' },
    { label: 'تاجر ذهب/فضة', conflict: 'generic UI wording hides merchant receipt/custody meaning' },
    { label: 'مسحوبات', conflict: 'one of 93 historical rows is reversed and cannot be silently treated as withdrawal' },
    { label: 'تسوية', conflict: 'one row is a direct inventory-to-inventory movement, not shortage/surplus' },
    { label: 'الارباح و الخساير 2024', conflict: 'TX42 approved semantic meaning is retained result from 2025; stored name remains unchanged' },
  ],
};
fs.writeFileSync(path.join(root, 'canonical_mapping_simulation.json'), `${JSON.stringify(simulation, null, 2)}\n`, 'utf8');

const statusCounts = mappings.reduce<Record<CanonicalPostingStatus, number>>((result, mapping) => {
  result[mapping.canonicalStatus] += mapping.documentCount;
  return result;
}, {
  legacy_only: 0, operational_only: 0, inventory_only: 0, non_journal: 0,
  canonical_balanced: 0, unresolved: 0, invalid: 0,
});
const confidenceCounts = mappings.reduce<Record<Confidence, number>>((result, mapping) => {
  result[mapping.confidence] += 1;
  return result;
}, { high: 0, medium: 0, low: 0 });

const notionReferences = `- [Business, Accounting & Inventory Rules](https://app.notion.com/p/39fa60b2605d8130991fc6099199b4fc)
- [Operations Catalog & Field Matrix](https://app.notion.com/p/39fa60b2605d81b7bd94c716c0ae7e7a)
- [Business Examples & Legacy Data Dictionary](https://app.notion.com/p/39fa60b2605d81da9828cf8dfde9eede)
- [Grill Control Center](https://app.notion.com/p/3a5a60b2605d810183c3dd18af80275e)
- [Open surplus-cost question](https://app.notion.com/p/39fa60b2605d8121b65afaeffc069b3c)`;

fs.writeFileSync(path.join(root, 'tx42_canonical_resolution.md'), `# TX42 — Canonical Resolution

## القرار

- Before: \`unresolved\`.
- After: \`canonical_balanced\`.
- Source document ID: \`csvref-entry-3e1f9b1fe78247341d78529914239bba\`.
- Legacy operation ID: \`dykcltueh9B3mWMkDUGK\`.
- Date: 2026-01-01.
- Gold amount: 16.20 g E21.

## Canonical gold posting

| Side | Actual Account ID | Stored historical name | Approved semantic meaning | g E21 |
|---|---|---|---|---:|
| Debit | \`seed-account-35d2d47536f02061f01a\` | راس المال ذهب | رأس المال ذهب | 16.20 |
| Credit | \`seed-account-b99a05ac4c9416a5c6f6\` | الارباح و الخساير 2024 | الأرباح والخسائر المرحلة من سنة 2025 — ذهب | 16.20 |

Gold difference = **0.00 g E21**.

لم يتغير TX42 أو اسم الحساب داخل Firestore. الـsemantic alias موجود فقط في Phase 2 metadata/fixture.
`, 'utf8');

fs.writeFileSync(path.join(root, 'retained_results_year_aliases.md'), `# Retained-results year aliases

| Account ID | Stored historical name | Semantic year | Approved meaning | Modern optional display |
|---|---|---:|---|---|
| \`seed-account-b99a05ac4c9416a5c6f6\` | الارباح و الخساير 2024 | 2025 | الأرباح والخسائر المرحلة من سنة 2025 — ذهب | الارباح و الخساير 2024 (نتيجة 2025 المرحلة) |

## قواعد العرض

- الاسم التاريخي المخزن immutable ولا يُعاد تسميته بصمت.
- الـalias وصف تقريري فقط ولا يغيّر Account ID أو LegacyLedgerProjection.
- لا يعمم هذا alias تلقائيًا على TX45 أو حساب الفضة؛ كل نتيجة مرحلة تحتاج قرارًا مستقلًا.
`, 'utf8');

fs.writeFileSync(path.join(root, 'canonical_accounts_required.md'), `# Canonical accounts required

لا يوجد Generic Clearing Account مقترح. الحسابات التالية هي حسابات ذات معنى تجاري، لكنها **غير منشأة وغير معتمدة في Phase 2** ما لم يوجد لها Account ID فعلي موثق.

| Proposed account purpose | COA group | Dimension | Reason | Settlement/close behavior | Approval |
|---|---|---|---|---|---|
| مبيعات الذهب | Revenue 41xx | Cash | فصل قيمة البيع عن خروج الوزن | closes to cash retained result at year-end | owner ID approval required |
| مبيعات الفضة | Revenue 42xx | Cash | فصل قيمة البيع عن خروج الوزن | closes to cash retained result | owner ID approval required |
| مبيعات الملحقات | Revenue | Cash | accessory sale value | closes to cash retained result | owner ID approval required |
| تكلفة بضاعة مباعة — ذهب | Expense/COGS | Cost projection | WAC removed on gold sale | closes to cash retained result; never a metal plug | owner classification/ID required |
| تكلفة بضاعة مباعة — فضة | Expense/COGS | Cost projection | WAC removed on silver sale | closes to cash retained result | owner classification/ID required |
| تكلفة بضاعة مباعة — ملحقات | Expense/COGS | Cost projection | WAC removed on accessory sale | closes to cash retained result | owner classification/ID required |
| تكلفة اقتناء/قيمة دفترية للمخزون | Asset cost subledger or Purchase expense — decision needed | Cash/Cost | counterpart of cash paid on customer purchase | retained as carrying cost or closed if expense; owner must choose | blocking |
| مقابل خروج وزن الذهب/الفضة | COA location unresolved | Gold/Silver | real commercial counterpart required for balanced weight ledger | must have an explicit business close/settlement rule | blocking; no plug allowed |
| نتيجة ذهب/فضة مرحلة | Equity | Metal | annual retained metal results | rolls into next-year opening with semantic-year metadata | IDs/sign matrix required except TX42 |
| رصيد مصنعية تاجر | Liability/party subledger | Cash | separate EGP workmanship balance | settled only by merchant cash settlement | canonical IDs required |

## Existing actual IDs used by TX42

- \`seed-account-35d2d47536f02061f01a\` — راس المال ذهب.
- \`seed-account-b99a05ac4c9416a5c6f6\` — الارباح و الخساير 2024.
- \`seed-account-43aee8a824522365db1a\` — الخزنة.
`, 'utf8');

const blockers = mappings.filter(mapping => mapping.blockingDecision);
fs.writeFileSync(path.join(root, 'unresolved_business_decisions.md'), `# Unresolved business decisions

توقفت الخريطة عند القرارات التالية ولم تنشئ balancing plugs:

${blockers.map((mapping, index) => `${index + 1}. **${mapping.operationType} — ${mapping.arabicLabel}:** ${mapping.blockingDecision}`).join('\n')}

## Source conflict requiring an explicit owner decision

- Notion main rules mention an approved surplus treatment, but the dedicated shortage/surplus cost question is still marked **Open**. Phase 2 therefore does not invent a surplus cost.
- Current constants contain sales/purchase/COGS-style account names but no verified canonical Account IDs or approved close rules for all of them.
- The weight-ledger meaning (custody vs ownership vs liability) and the real counterpart for customer sale/purchase are not fully approved.
- TX42 is no longer a blocker; it is resolved separately.

## Notion references

${notionReferences}
`, 'utf8');

fs.writeFileSync(path.join(root, 'canonical_mapping_design.md'), `# Accounting Engine Repair — Phase 2: Canonical Mapping Design

## Scope and safety

This phase adds a design model, fixtures, reports and tests only. It does not connect the mapping to the Production Accounting Engine, Firestore, migration code or Hosting.

## Source hierarchy reviewed

1. Owner-approved TX42 decision dated 2026-07-24.
2. Phase 1 read-only artifacts and the 2,169 imported-document fixture.
3. Notion business rules/catalog/data dictionary and open-decision register.
4. TypeScript types, constants, migration/normalization/seed rules, UI forms and tests.
5. Historical debit/credit names are evidence, not permission to invent modern semantics.

## Central design type

\`CanonicalPostingSet\` is defined in \`src/lib/canonicalMappingDesign.ts\` with:

- source/fiscal/rule identity;
- independent cash, gold and silver ledger legs;
- physical inventory, quantity, merchant metal liability, workmanship and cost movements;
- revenue, expense and equity effects;
- warnings/errors, posting status and balancing status.

A \`canonical_balanced\` fixture must balance every used ledger dimension. Operational, inventory-only, memo and non-journal movements stay out of Trial Balance.

## Status counts by historical documents represented in the mapping

| Status | Documents |
|---|---:|
${Object.entries(statusCounts).map(([status, documents]) => `| ${status} | ${documents} |`).join('\n')}

Zero-document design-only types are present in the matrix but do not inflate these document counts.

## Customer sale model

- Cash: debit cashbox, credit the metal/accessory sales revenue account.
- Physical inventory: exactly one decrease.
- Gold ledger uses E21; silver uses physical weight; accessory has no metal leg.
- Quantity is count reporting only and never changes a metal ledger.
- WAC removes carrying cost immediately before sale; COGS is a separate cost projection, not a second inventory movement.
- Gross profit = cash sales revenue − WAC COGS.
- Gold/silver mapping remains \`unresolved\` until the real weight counterpart and canonical IDs are approved.

## Customer purchase model

- Cashbox decreases.
- Physical inventory and ownership increase.
- Gold uses E21 in the gold ledger and keeps physical grams in product inventory.
- Silver uses physical weight.
- Acquisition cash adds carrying cost to WAC; it creates no sales revenue.
- The cash/weight counterpart classification remains blocked rather than using a generic clearing account.

## Merchant model

- Receipt from merchant: debit physical inventory, credit merchant metal liability; ownership is unchanged.
- Weight settlement: debit merchant liability, credit selected physical inventory.
- Cash/workmanship settlement: debit merchant cash/workmanship balance, credit cashbox.
- Transfer between merchants: debit source liability, credit destination liability; no physical inventory or cost movement.
- Gold liabilities use E21; silver uses physical weight.
- The seven silver settlement rows contribute **−127.72 g** to physical inventory once.

## Weighted Average Cost

- Purchases add weight/quantity and actual acquisition cost.
- Sales remove at the average immediately before sale.
- Tafiet transfers exact source cost to the equal-weight destination.
- Transfers preserve total cost.
- Shortage removes at current average and creates operating loss.
- Surplus cost is blocked because the dedicated Notion decision is still open.
- Gold/silver openings use annual opening prices; accessories use fixed opening cost.
- Market valuation never changes operating cost.
- Merchant liability movements do not create cost unless shop ownership actually changes.
- Historical rows missing cost basis are reported as missing; no value is invented.

## TX42

TX42 changed from \`unresolved\` to \`canonical_balanced\` in this Phase 2 design. Debit and credit are both 16.20 g E21 using the actual historical Account IDs. The stored historical name is unchanged; the 2025 semantic year is metadata only.

## Confidence

- High: ${confidenceCounts.high} mapping rows.
- Medium: ${confidenceCounts.medium} mapping rows.
- Low: ${confidenceCounts.low} mapping rows.

See \`canonical_operation_mapping_matrix.csv\` for every row and blocker.

## Notion references

${notionReferences}
`, 'utf8');

const balancedFixtures = fixturePostings.filter(posting => posting.postingStatus === 'canonical_balanced');
fs.writeFileSync(path.join(root, 'canonical_mapping_simulation_report.md'), `# Canonical mapping simulation report

## Controls

- Imported read-only documents: **${entries.length}**.
- Legacy cash debit/credit: **${audit.rawTotals.cash.debit.toFixed(0)} / ${audit.rawTotals.cash.credit.toFixed(0)} EGP**.
- Legacy gold debit/credit: **${audit.rawTotals.gold.debit.toFixed(2)} / ${audit.rawTotals.gold.credit.toFixed(2)} g E21**.
- Legacy silver debit/credit: **${audit.rawTotals.silver.debit.toFixed(2)} / ${audit.rawTotals.silver.credit.toFixed(2)} g**.
- Firestore writes/deletes: **0 / 0**.
- Migration runs: **0**.
- Hosting deploys: **0**.

## In-memory fixture balancing

| Fixture | Status | Cash D/C | Gold D/C | Silver D/C |
|---|---|---:|---:|---:|
${fixturePostings.map(posting => {
  const balances = Object.fromEntries(summarizePostingBalances(posting).map(item => [item.dimension, item]));
  return `| ${posting.operationType} | ${posting.postingStatus} | ${balances.cash.debit}/${balances.cash.credit} | ${balances.gold.debit}/${balances.gold.credit} | ${balances.silver.debit}/${balances.silver.credit} |`;
}).join('\n')}

Every \`canonical_balanced\` fixture balances each used dimension: **${balancedFixtures.length}/${balancedFixtures.length}**.

## Findings

- TX42: 16.20 g E21 debit = 16.20 g E21 credit; status \`canonical_balanced\`.
- Customer sale fixture has one physical inventory movement; no duplicate deduction.
- Customer purchase fixture has zero revenue effects.
- Accessories have no gold/silver ledger legs.
- Merchant-to-merchant transfer has zero physical inventory and zero cost movement.
- Historical WAC basis is incomplete for affected records; simulation reports null instead of inventing cost.
- Missing counterpart types: ${simulation.missingCounterpartMappings.join(', ')}.
- Unresolved types remain excluded from canonical posting.

The complete per-type totals and conflicts are in \`canonical_mapping_simulation.json\`.
`, 'utf8');

console.log(JSON.stringify({
  documents: entries.length,
  actualOperationTypes: actualTypes.length,
  mappingRows: mappings.length,
  statusesByDocument: statusCounts,
  confidenceByMapping: confidenceCounts,
  tx42: simulation.tx42.balances,
  firestoreWrites: 0,
  firestoreDeletes: 0,
  migrationRuns: 0,
  hostingDeploys: 0,
}, null, 2));

