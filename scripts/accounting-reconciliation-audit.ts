import fs from 'node:fs';
import path from 'node:path';
import { SEED_ACCOUNTS } from '../src/migrationData';
import type { Account, Entry } from '../src/types';
import {
  buildCanonicalAccountRegistry,
  buildCanonicalAccountingLegs,
  diagnoseMetalPostings,
  isValidAccountingEntry,
} from '../src/lib/canonicalAccounting';
import { buildTrialBalanceReport } from '../src/lib/trialBalanceReport';
import { buildLedgerReport } from '../src/lib/ledgerReport';
import { getEntryArabicWeight, parseCash, processInventory, resolveOperationKind } from '../src/lib/engine';

type CsvRow = Record<string, string>;
type Dimension = 'cash' | 'gold' | 'silver';

const root = process.cwd();
const inputPath = path.join(root, 'approved_normalized_preview.csv');
const expectedCount = 2169;

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
  if (field.length || record.length) {
    record.push(field);
    records.push(record);
  }
  const headers = records.shift() ?? [];
  return records
    .filter(row => row.some(value => value !== ''))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const writeCsv = (fileName: string, rows: Array<Record<string, unknown>>, columns: string[]) => {
  const lines = [columns.map(csvEscape).join(',')];
  rows.forEach(row => lines.push(columns.map(column => csvEscape(row[column])).join(',')));
  fs.writeFileSync(path.join(root, fileName), `\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
};

const approvedRows = parseCsv(fs.readFileSync(inputPath, 'utf8'));
if (approvedRows.length !== expectedCount) throw new Error(`Expected ${expectedCount} approved rows, found ${approvedRows.length}`);

const rowByDocumentId = new Map(approvedRows.map(row => [row.document_id, row]));
const entries = approvedRows.map(row => {
  const entry = JSON.parse(row.proposed_import_document) as Entry;
  return { ...entry, id: row.document_id, importVersion: 'csv-2026-07-23-v1' } as Entry;
});
const accounts: Account[] = SEED_ACCOUNTS.map((account, index) => ({
  ...account,
  id: `audit-account-${index + 1}`,
  userId: 'audit-read-only',
  isActive: true,
} as Account));

const accountByName = new Map(accounts.map(account => [account.name, account]));
const dimensionFor = (entry: Entry): Exclude<Dimension, 'cash'> | null => {
  const sides = [accountByName.get(entry.debit), accountByName.get(entry.credit)];
  if (sides.some(account => account?.metal === 'silver' || account?.type === 'silver')) return 'silver';
  if (sides.some(account => account?.type === 'accessory')) return null;
  if (sides.some(account => account?.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(account?.type ?? ''))) return 'gold';
  if (Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0) return 'gold';
  return null;
};
const amountFor = (entry: Entry, dimension: Dimension) =>
  dimension === 'cash'
    ? parseCash(entry)
    : dimension === 'silver'
      ? Math.abs(Number(entry.weight) || 0)
      : Math.abs(getEntryArabicWeight(entry, accountByName.get(entry.debit) ?? accountByName.get(entry.credit)));
const rawStoredAmountFor = (entry: Entry, dimension: Dimension) =>
  dimension === 'cash'
    ? Math.abs(Number(entry.cash) || 0)
    : dimension === 'silver'
      ? Math.abs(Number(entry.weight) || 0)
      : Math.abs(Number(entry.arabicWeight) || 0);

const registry = buildCanonicalAccountRegistry(accounts, entries, []);
const legs = buildCanonicalAccountingLegs(entries, registry);
const validEntries = entries.filter(isValidAccountingEntry);
const dimensions: Dimension[] = ['cash', 'gold', 'silver'];
const legTotals = (selected: typeof legs) => {
  const result = Object.fromEntries(dimensions.map(dimension => [dimension, { debit: 0, credit: 0, net: 0, legs: 0 }])) as Record<Dimension, { debit: number; credit: number; net: number; legs: number }>;
  selected.forEach(leg => {
    if (!dimensions.includes(leg.dimension as Dimension)) return;
    const dimension = leg.dimension as Dimension;
    result[dimension][leg.side] += leg.amount;
    result[dimension].legs += 1;
  });
  dimensions.forEach(dimension => { result[dimension].net = result[dimension].debit - result[dimension].credit; });
  return result;
};
const canonicalTotals = legTotals(legs);

const rawTotals = Object.fromEntries(dimensions.map(dimension => [dimension, { debit: 0, credit: 0, net: 0, documents: 0 }])) as Record<Dimension, { debit: number; credit: number; net: number; documents: number }>;
validEntries.forEach(entry => {
  const cash = rawStoredAmountFor(entry, 'cash');
  if (cash > 0) {
    rawTotals.cash.debit += cash;
    rawTotals.cash.credit += cash;
    rawTotals.cash.documents += 1;
  }
  const metal = dimensionFor(entry);
  if (metal) {
    const amount = rawStoredAmountFor(entry, metal);
    if (amount > 0) {
      rawTotals[metal].debit += amount;
      rawTotals[metal].credit += amount;
      rawTotals[metal].documents += 1;
    }
  }
});

const trial = Object.fromEntries(dimensions.map(dimension => [
  dimension,
  buildTrialBalanceReport(entries, accounts, dimension, '0000-01-01', '9999-12-31', []),
])) as Record<Dimension, ReturnType<typeof buildTrialBalanceReport>>;

const ledgerTotals = Object.fromEntries(dimensions.map(dimension => [dimension, { debit: 0, credit: 0, net: 0, rows: 0 }])) as Record<Dimension, { debit: number; credit: number; net: number; rows: number }>;
accounts.forEach(account => dimensions.forEach(dimension => {
  const report = buildLedgerReport(entries, accounts, account, dimension, '0000-01-01', '9999-12-31', []);
  ledgerTotals[dimension].debit += report.totalDebit;
  ledgerTotals[dimension].credit += report.totalCredit;
  ledgerTotals[dimension].rows += report.rows.length;
}));
dimensions.forEach(dimension => { ledgerTotals[dimension].net = ledgerTotals[dimension].debit - ledgerTotals[dimension].credit; });

const inventory = processInventory(entries, accounts);
const physicalTotals = { gold: 0, silver: 0, quantity: 0 };
Object.entries(inventory.snapshots).forEach(([name, snapshot]) => {
  const account = accountByName.get(name);
  if (account?.metal === 'gold') physicalTotals.gold += snapshot.arabicWeight;
  if (account?.metal === 'silver') physicalTotals.silver += snapshot.weight;
  if (account?.type === 'accessory') physicalTotals.quantity += snapshot.count;
});

const home = {
  cashDebit: 0, cashCredit: 0, cashNet: 0,
  silverDebit: 0, silverCredit: 0, silverNet: 0,
};
const cashNames = new Set(accounts.filter(account => account.type === 'cash').map(account => account.name));
const silverInventoryNames = new Set(accounts.filter(account => account.is_inventory && account.metal === 'silver').map(account => account.name));
validEntries.forEach(entry => {
  const cash = Number(entry.cash) || 0;
  const weight = Number(entry.weight) || 0;
  if (cashNames.has(entry.debit)) home.cashDebit += cash;
  if (cashNames.has(entry.credit)) home.cashCredit += cash;
  if (silverInventoryNames.has(entry.debit)) home.silverDebit += weight;
  if (silverInventoryNames.has(entry.credit)) home.silverCredit += weight;
});
home.cashNet = home.cashDebit - home.cashCredit;
home.silverNet = home.silverDebit - home.silverCredit;

const inventoryMovement = { goldDebit: 0, goldCredit: 0, silverDebit: 0, silverCredit: 0 };
validEntries.forEach(entry => {
  const debit = accountByName.get(entry.debit);
  const credit = accountByName.get(entry.credit);
  if (debit?.is_inventory && debit.metal === 'gold') inventoryMovement.goldDebit += amountFor(entry, 'gold');
  if (credit?.is_inventory && credit.metal === 'gold') inventoryMovement.goldCredit += amountFor(entry, 'gold');
  if (debit?.is_inventory && debit.metal === 'silver') inventoryMovement.silverDebit += amountFor(entry, 'silver');
  if (credit?.is_inventory && credit.metal === 'silver') inventoryMovement.silverCredit += amountFor(entry, 'silver');
});

const pathRows: Array<Record<string, unknown>> = [
  {
    screen_or_engine: 'raw_imported_double_entry',
    cash_debit: rawTotals.cash.debit, cash_credit: rawTotals.cash.credit, cash_net: rawTotals.cash.net,
    gold_debit: rawTotals.gold.debit, gold_credit: rawTotals.gold.credit, gold_net: rawTotals.gold.net,
    silver_debit: rawTotals.silver.debit, silver_credit: rawTotals.silver.credit, silver_net: rawTotals.silver.net,
    document_count: validEntries.length, leg_count: rawTotals.cash.documents * 2 + rawTotals.gold.documents * 2 + rawTotals.silver.documents * 2,
  },
  {
    screen_or_engine: 'canonical_accounting_legs',
    cash_debit: canonicalTotals.cash.debit, cash_credit: canonicalTotals.cash.credit, cash_net: canonicalTotals.cash.net,
    gold_debit: canonicalTotals.gold.debit, gold_credit: canonicalTotals.gold.credit, gold_net: canonicalTotals.gold.net,
    silver_debit: canonicalTotals.silver.debit, silver_credit: canonicalTotals.silver.credit, silver_net: canonicalTotals.silver.net,
    document_count: new Set(legs.map(leg => leg.sourceEntryId)).size, leg_count: legs.length,
  },
  {
    screen_or_engine: 'general_ledger_all_accounts',
    cash_debit: ledgerTotals.cash.debit, cash_credit: ledgerTotals.cash.credit, cash_net: ledgerTotals.cash.net,
    gold_debit: ledgerTotals.gold.debit, gold_credit: ledgerTotals.gold.credit, gold_net: ledgerTotals.gold.net,
    silver_debit: ledgerTotals.silver.debit, silver_credit: ledgerTotals.silver.credit, silver_net: ledgerTotals.silver.net,
    document_count: validEntries.length, leg_count: ledgerTotals.cash.rows + ledgerTotals.gold.rows + ledgerTotals.silver.rows,
  },
  {
    screen_or_engine: 'trial_balance',
    cash_debit: trial.cash.closingDebit, cash_credit: trial.cash.closingCredit, cash_net: trial.cash.closingDebit - trial.cash.closingCredit,
    gold_debit: trial.gold.closingDebit, gold_credit: trial.gold.closingCredit, gold_net: trial.gold.closingDebit - trial.gold.closingCredit,
    silver_debit: trial.silver.closingDebit, silver_credit: trial.silver.closingCredit, silver_net: trial.silver.closingDebit - trial.silver.closingCredit,
    document_count: validEntries.length, leg_count: legs.length,
  },
  {
    screen_or_engine: 'home_named_metrics',
    cash_debit: home.cashDebit, cash_credit: home.cashCredit, cash_net: home.cashNet,
    gold_debit: inventory.goldPosition.physicalGoldInventory21, gold_credit: inventory.goldPosition.netGoldLiabilities21, gold_net: inventory.goldPosition.netShopGoldOwnership21,
    silver_debit: home.silverDebit, silver_credit: home.silverCredit, silver_net: home.silverNet,
    document_count: validEntries.length, leg_count: 0,
  },
  {
    screen_or_engine: 'physical_inventory_projection',
    cash_debit: '', cash_credit: '', cash_net: '',
    gold_debit: inventoryMovement.goldDebit, gold_credit: inventoryMovement.goldCredit, gold_net: physicalTotals.gold,
    silver_debit: inventoryMovement.silverDebit, silver_credit: inventoryMovement.silverCredit, silver_net: physicalTotals.silver,
    document_count: validEntries.length, leg_count: 0,
  },
];
const pathColumns = ['screen_or_engine','cash_debit','cash_credit','cash_net','gold_debit','gold_credit','gold_net','silver_debit','silver_credit','silver_net','document_count','leg_count'];
writeCsv('accounting_path_matrix.csv', pathRows, pathColumns);

const entityForName = (name: string) => registry.byLegacyName.get(name.trim());
const contributionRows = dimensions.flatMap(dimension => validEntries.flatMap(entry => {
  const entryLegs = legs.filter(leg => leg.sourceEntryId === entry.id && leg.dimension === dimension);
  const debit = entryLegs.filter(leg => leg.side === 'debit').reduce((sum, leg) => sum + leg.amount, 0);
  const credit = entryLegs.filter(leg => leg.side === 'credit').reduce((sum, leg) => sum + leg.amount, 0);
  const contribution = debit - credit;
  if (Math.abs(contribution) < 1e-9) return [];
  const preview = rowByDocumentId.get(entry.id!);
  const rule = preview?.matched_rule ? JSON.parse(preview.matched_rule) as Record<string, unknown> : {};
  const debitEntity = entityForName(entry.debit);
  const creditEntity = entityForName(entry.credit);
  const metal = dimensionFor(entry);
  const inventoryContribution = dimension === 'gold'
    ? (debitEntity?.isInventory ? amountFor(entry, 'gold') : 0) - (creditEntity?.isInventory ? amountFor(entry, 'gold') : 0)
    : dimension === 'silver'
      ? (debitEntity?.isInventory ? amountFor(entry, 'silver') : 0) - (creditEntity?.isInventory ? amountFor(entry, 'silver') : 0)
      : 0;
  const merchantContribution = dimension === 'gold' || dimension === 'silver'
    ? (debitEntity?.isMerchant ? -amountFor(entry, dimension) : 0) + (creditEntity?.isMerchant ? amountFor(entry, dimension) : 0)
    : 0;
  const generated = (side: 'debit' | 'credit', selected: Dimension) => entryLegs
    .filter(leg => leg.side === side && leg.dimension === selected)
    .map(leg => `${leg.accountName}:${leg.amount}`).join('|');
  const category = ['sale', 'purchase'].includes(resolveOperationKind(entry))
    ? 'omitted processing path'
    : (!debitEntity?.allowedDimensions.includes(dimension) || !creditEntity?.allowedDimensions.includes(dimension))
      ? 'wrong account metadata or dimension ownership'
      : 'sign/nature calculation error';
  return [{
    dimension,
    documentId: entry.id,
    sourceRow: entry.sourceRow ?? preview?.source_row,
    legacyOperationId: entry.legacyOperationId,
    legacyOperationNo: entry.legacyOperationNo ?? entry.invoiceNumber,
    date: entry.date,
    operation_type: entry.tx,
    operation_kind: resolveOperationKind(entry),
    debit_account_id: entry.debitAccountId ?? '',
    debit_account_name: entry.debit,
    debit_account_type: debitEntity?.entityType ?? '',
    debit_account_metal: debitEntity?.metal ?? '',
    credit_account_id: entry.creditAccountId ?? '',
    credit_account_name: entry.credit,
    credit_account_type: creditEntity?.entityType ?? '',
    credit_account_metal: creditEntity?.metal ?? '',
    raw_cash: entry.cash,
    raw_weight: entry.weight,
    raw_arabic_equivalent_weight: entry.arabicWeight,
    raw_quantity: entry.count,
    matched_rule_id: rule.key ?? '',
    rule_confidence_source: preview?.transaction_rule_status ?? '',
    generated_cash_debit_leg: dimension === 'cash' ? generated('debit', 'cash') : '',
    generated_cash_credit_leg: dimension === 'cash' ? generated('credit', 'cash') : '',
    generated_gold_debit_leg: dimension === 'gold' ? generated('debit', 'gold') : '',
    generated_gold_credit_leg: dimension === 'gold' ? generated('credit', 'gold') : '',
    generated_silver_debit_leg: dimension === 'silver' ? generated('debit', 'silver') : '',
    generated_silver_credit_leg: dimension === 'silver' ? generated('credit', 'silver') : '',
    inventory_movement: inventoryContribution,
    merchant_liability_movement: merchantContribution,
    discrepancy_contribution: contribution,
    root_cause_category: category,
    inferred_metal: metal ?? '',
  }];
}));
const contributionColumns = [
  'documentId','sourceRow','legacyOperationId','legacyOperationNo','date','operation_type','operation_kind',
  'debit_account_id','debit_account_name','debit_account_type','debit_account_metal',
  'credit_account_id','credit_account_name','credit_account_type','credit_account_metal',
  'raw_cash','raw_weight','raw_arabic_equivalent_weight','raw_quantity','matched_rule_id','rule_confidence_source',
  'generated_cash_debit_leg','generated_cash_credit_leg','generated_gold_debit_leg','generated_gold_credit_leg',
  'generated_silver_debit_leg','generated_silver_credit_leg','inventory_movement','merchant_liability_movement',
  'discrepancy_contribution','root_cause_category',
];
dimensions.forEach(dimension => writeCsv(`${dimension}_difference_rows.csv`, contributionRows.filter(row => row.dimension === dimension), contributionColumns));

const metalDiagnostics = diagnoseMetalPostings(entries, registry, legs);
const exceptionRows = metalDiagnostics
  .filter(item => item.amount > 0 && item.droppedReasons.length > 0)
  .map(item => {
    const entry = entries.find(candidate => candidate.id === item.sourceEntryId)!;
    return {
      documentId: item.sourceEntryId,
      sourceRow: entry.sourceRow,
      legacyOperationId: entry.legacyOperationId,
      legacyOperationNo: entry.legacyOperationNo ?? entry.invoiceNumber,
      date: entry.date,
      operation_type: entry.tx,
      operation_kind: item.operationKind,
      dimension: item.dimension,
      amount: item.amount,
      debit_account: item.debitAccount,
      credit_account: item.creditAccount,
      debit_entity: item.debitEntity,
      credit_entity: item.creditEntity,
      debit_group: item.debitGroup,
      credit_group: item.creditGroup,
      debit_allowed_dimensions: item.debitAllowedDimensions?.join('|'),
      credit_allowed_dimensions: item.creditAllowedDimensions?.join('|'),
      debit_leg: item.debitLeg ? `${item.debitLeg.accountName}:${item.debitLeg.amount}` : '',
      credit_leg: item.creditLeg ? `${item.creditLeg.accountName}:${item.creditLeg.amount}` : '',
      dropped_reasons: item.droppedReasons.join('|'),
    };
  });
writeCsv('canonical_leg_exceptions.csv', exceptionRows, [
  'documentId','sourceRow','legacyOperationId','legacyOperationNo','date','operation_type','operation_kind','dimension','amount',
  'debit_account','credit_account','debit_entity','credit_entity','debit_group','credit_group',
  'debit_allowed_dimensions','credit_allowed_dimensions','debit_leg','credit_leg','dropped_reasons',
]);

const silverTrace = validEntries.flatMap(entry => {
  const debit = accountByName.get(entry.debit);
  const credit = accountByName.get(entry.credit);
  if (![debit, credit].some(account => account?.metal === 'silver') && dimensionFor(entry) !== 'silver') return [];
  const weight = amountFor(entry, 'silver');
  const homeContribution =
    (silverInventoryNames.has(entry.debit) ? weight : 0) +
    (silverInventoryNames.has(entry.credit) ? -weight : 0);
  const inventoryContribution =
    (debit?.is_inventory && debit.metal === 'silver' ? weight : 0) -
    (credit?.is_inventory && credit.metal === 'silver' ? weight : 0);
  const merchantContribution =
    (debit?.type === 'merchant' && debit.metal === 'silver' ? -weight : 0) +
    (credit?.type === 'merchant' && credit.metal === 'silver' ? weight : 0);
  return [{
    documentId: entry.id,
    sourceRow: entry.sourceRow,
    date: entry.date,
    operation_type: entry.tx,
    debit: entry.debit,
    credit: entry.credit,
    weight,
    seq: entry.seq ?? '',
    is_deleted_void_reversed: !isValidAccountingEntry(entry),
    home_physical_silver_contribution: homeContribution,
    inventory_physical_silver_contribution: inventoryContribution,
    merchant_silver_liability_contribution: merchantContribution,
    home_inventory_difference_contribution: homeContribution - inventoryContribution,
    account_metal_inferred_or_explicit: [debit?.metal, credit?.metal].filter(Boolean).join('|'),
  }];
});
writeCsv('home_inventory_silver_trace.csv', silverTrace, [
  'documentId','sourceRow','date','operation_type','debit','credit','weight','seq','is_deleted_void_reversed',
  'home_physical_silver_contribution','inventory_physical_silver_contribution','merchant_silver_liability_contribution',
  'home_inventory_difference_contribution','account_metal_inferred_or_explicit',
]);

const summary = {
  source: 'approved_normalized_preview.csv',
  readOnly: true,
  historicalWrites: 0,
  historicalDeletes: 0,
  documentCount: entries.length,
  validDocumentCount: validEntries.length,
  excludedDocumentCount: entries.length - validEntries.length,
  dateRange: {
    min: [...entries].map(entry => entry.date).sort()[0],
    max: [...entries].map(entry => entry.date).sort().at(-1),
  },
  rawTotals,
  canonicalTotals,
  ledgerTotals,
  trial: Object.fromEntries(dimensions.map(dimension => [dimension, {
    debit: trial[dimension].closingDebit,
    credit: trial[dimension].closingCredit,
    net: trial[dimension].closingDebit - trial[dimension].closingCredit,
    difference: trial[dimension].difference,
    differenceSide: trial[dimension].differenceSide,
  }])),
  home,
  physicalInventory: physicalTotals,
  inventoryMovement,
  goldPosition: inventory.goldPosition,
  contributorCounts: Object.fromEntries(dimensions.map(dimension => [dimension, contributionRows.filter(row => row.dimension === dimension).length])),
  exceptionCount: exceptionRows.length,
  silverTraceCount: silverTrace.length,
};
fs.writeFileSync(path.join(root, 'accounting_reconciliation_audit.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
