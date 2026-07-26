import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildCanonicalAccountRegistry, buildCanonicalAccountingLegs } from '../canonicalAccounting';
import { buildDailyJournalReport } from '../dailyJournalReport';
import { buildLedgerReport } from '../ledgerReport';
import { splitLegsByPeriod } from '../periodLegs';
import { buildTrialBalanceReport } from '../trialBalanceReport';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import { isOpeningEntry } from '../openingEntry';

const start = '2026-06-01';
const end = '2026-06-30';
const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: '', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'cash-equity', name: 'cash-equity', mainType: 'equity', subType: '', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'gold', name: 'gold', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, userId: 'u' },
  { id: 'gold-revenue', name: 'gold-revenue', mainType: 'revenue', subType: '', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u' },
  { id: 'silver', name: 'silver', mainType: 'asset', subType: '', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
  { id: 'silver-revenue', name: 'silver-revenue', mainType: 'revenue', subType: '', balanceNature: 'silver', type: 'other', metal: 'silver', userId: 'u' },
];
const entry = (partial: Partial<Entry>): Entry => ({ seq: 1, tx: 'test', operationKind: 'other', date: start, debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...partial });
const entries: Entry[] = [
  entry({ id: 'cash-prior', date: '2026-05-31', debit: 'cash', debitAccountId: 'cash', credit: 'cash-equity', creditAccountId: 'cash-equity', cash: '10' }),
  entry({ id: 'cash-start-opening', operationKind: 'opening', debit: 'cash', debitAccountId: 'cash', credit: 'cash-equity', creditAccountId: 'cash-equity', cash: '20' }),
  entry({ id: 'cash-later-opening', operationKind: 'opening', date: '2026-06-02', debit: 'cash', debitAccountId: 'cash', credit: 'cash-equity', creditAccountId: 'cash-equity', cash: '30' }),
  entry({ id: 'gold-prior', date: '2026-05-31', operationKind: 'adjustment', debit: 'gold', debitAccountId: 'gold', credit: 'gold-revenue', creditAccountId: 'gold-revenue', arabicWeight: '10' }),
  entry({ id: 'gold-start-opening', operationKind: 'opening', debit: 'gold', debitAccountId: 'gold', credit: 'gold-revenue', creditAccountId: 'gold-revenue', arabicWeight: '20' }),
  entry({ id: 'gold-later-opening', operationKind: 'opening', date: '2026-06-02', debit: 'gold', debitAccountId: 'gold', credit: 'gold-revenue', creditAccountId: 'gold-revenue', arabicWeight: '30' }),
  entry({ id: 'silver-prior', date: '2026-05-31', operationKind: 'adjustment', debit: 'silver', debitAccountId: 'silver', credit: 'silver-revenue', creditAccountId: 'silver-revenue', weight: '10' }),
  entry({ id: 'silver-start-opening', operationKind: 'opening', debit: 'silver', debitAccountId: 'silver', credit: 'silver-revenue', creditAccountId: 'silver-revenue', weight: '20' }),
  entry({ id: 'silver-later-opening', operationKind: 'opening', date: '2026-06-02', debit: 'silver', debitAccountId: 'silver', credit: 'silver-revenue', creditAccountId: 'silver-revenue', weight: '30' }),
];

describe('period leg split', () => {
  const legs = buildCanonicalAccountingLegs(entries, buildCanonicalAccountRegistry(accounts, entries));
  it.each([['cash', 'cash'], ['gold', 'gold'], ['silver', 'silver']] as const)('keeps opening-kind legs in opening balance for %s', (dimension, prefix) => {
    const split = splitLegsByPeriod(legs.filter(leg => leg.dimension === dimension), start, end);
    const openingIds = new Set(split.openingLegs.map(leg => leg.sourceEntryId));
    const periodIds = new Set(split.periodLegs.map(leg => leg.sourceEntryId));
    expect(openingIds).toEqual(new Set([`${prefix}-prior`, `${prefix}-start-opening`, `${prefix}-later-opening`]));
    expect(periodIds).toEqual(new Set());
    expect([...openingIds].filter(id => periodIds.has(id))).toEqual([]);
  });

  it.each([['cash', accounts[0]], ['gold', accounts[2]], ['silver', accounts[4]]] as const)('reconciles Daily Journal, Ledger, and Trial Balance for %s', (dimension, account) => {
    const journal = buildDailyJournalReport(entries, accounts, start).dimensions[dimension];
    const wholePeriodTrial = buildTrialBalanceReport(entries, accounts, dimension, start, end);
    const ledger = buildLedgerReport(entries, accounts, account, dimension, start, end);
    const trialRow = wholePeriodTrial.groups.flatMap(group => group.rows).find(row => row.entityId.endsWith(`:${account.id}`));
    expect(journal.openingDebit).toBe(30);
    expect(journal.openingCredit).toBe(0);
    expect(journal.periodDebit).toBe(0);
    expect(journal.periodCredit).toBe(0);
    expect(ledger.openingBalance).toBe(60);
    expect(ledger.totalDebit).toBe(0);
    expect(ledger.rows).toHaveLength(0);
    expect(trialRow).toMatchObject({ openingDebit: 60, periodDebit: 0, closingDebit: 60 });
  });
});
const realSchemaAccounts: Account[] = [
  { id: 'uV1kRL6EMkqAo8xvwRXN', name: '\u0627\u0644\u062e\u0632\u0646\u0629', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'YW9vgtbGUIUz803p76Jc', name: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0646\u0642\u062f\u0627', mainType: 'equity', subType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: '0TZN9o9A2qoZhtdzOVU3', name: '\u062d\u0644\u0642 \u0639\u0631\u0628\u064a', mainType: 'asset', subType: 'gold inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' },
  { id: 'Ql7a5WGAqYdugAHMy4Cx', name: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0630\u0647\u0628', mainType: 'equity', subType: 'capital', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u' },
  { id: 'ALgcjH5wXjKnFjDUOJyR', name: '\u0643\u0633\u0631 \u0641\u0636\u0629', mainType: 'asset', subType: 'silver inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
  { id: 'pOuUxRElJaIwoRLUFtHw', name: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0641\u0636\u0629', mainType: 'equity', subType: 'capital', balanceNature: 'silver', type: 'other', metal: 'silver', userId: 'u' },
  { id: 'silver-surplus', name: '\u0632\u064a\u0627\u062f\u0629-\u0627\u0644\u0641\u0636\u0629', mainType: 'revenue', subType: 'adjustment', balanceNature: 'silver', type: 'other', metal: 'silver', userId: 'u' },
];
const realEntry = (partial: Partial<Entry>): Entry => ({
  seq: null,
  tx: '',
  date: '2026-01-01',
  debit: '',
  credit: '',
  cash: '0',
  weight: '0',
  arabicWeight: '0',
  count: '0',
  notes: '',
  userId: 'u',
  imported: true,
  importVersion: 'csv-2026-07-23-v1',
  ...partial,
});

describe('legacy imported opening entries without operationKind', () => {
  const realEntries: Entry[] = [
    realEntry({ id: 'csvref-entry-7496cb491f5653ca979a56898300bf8c', tx: '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a', legacyOperationNo: 'TX1', sourceRow: 2121, debit: '\u0627\u0644\u062e\u0632\u0646\u0629', debitAccountId: 'uV1kRL6EMkqAo8xvwRXN', credit: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0646\u0642\u062f\u0627', creditAccountId: 'YW9vgtbGUIUz803p76Jc', cash: '558750' }),
    realEntry({ id: 'csvref-entry-b409864f20924429758c24fe9afb620d', tx: '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a', legacyOperationNo: 'TX18', sourceRow: 2160, debit: '\u062d\u0644\u0642 \u0639\u0631\u0628\u064a', debitAccountId: '0TZN9o9A2qoZhtdzOVU3', credit: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0630\u0647\u0628', creditAccountId: 'Ql7a5WGAqYdugAHMy4Cx', weight: '121.57', arabicWeight: '121.57', count: '29', karat: 21, multiplier: 1 }),
    realEntry({ id: 'legacy-subtx-gold-opening', subTx: '\u0631\u0635\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a \u0630\u0647\u0628', legacyOperationNo: 'TX19', sourceRow: 2161, debit: '\u062d\u0644\u0642 \u0639\u0631\u0628\u064a', debitAccountId: '0TZN9o9A2qoZhtdzOVU3', credit: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0630\u0647\u0628', creditAccountId: 'Ql7a5WGAqYdugAHMy4Cx', weight: '1', arabicWeight: '1', karat: 21, multiplier: 1 }),
    realEntry({ id: 'csvref-entry-1a9cade1308c36f5c382520b6ade558f', tx: '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a', legacyOperationNo: 'TX25', sourceRow: 2166, debit: '\u0643\u0633\u0631 \u0641\u0636\u0629', debitAccountId: 'ALgcjH5wXjKnFjDUOJyR', credit: '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644 \u0641\u0636\u0629', creditAccountId: 'pOuUxRElJaIwoRLUFtHw', weight: '305', arabicWeight: '305' }),
    realEntry({ id: 'period-cash-gold-sale', tx: '\u0628\u064a\u0639 \u0630\u0647\u0628', date: '2026-01-06', debit: '\u0627\u0644\u062e\u0632\u0646\u0629', debitAccountId: 'uV1kRL6EMkqAo8xvwRXN', credit: '\u062d\u0644\u0642 \u0639\u0631\u0628\u064a', creditAccountId: '0TZN9o9A2qoZhtdzOVU3', cash: '100', weight: '3', arabicWeight: '3', karat: 21, multiplier: 1 }),
    realEntry({ id: 'period-silver-adjustment', tx: '\u062a\u0633\u0648\u064a\u0629', date: '2026-01-07', debit: '\u0643\u0633\u0631 \u0641\u0636\u0629', debitAccountId: 'ALgcjH5wXjKnFjDUOJyR', credit: '\u0632\u064a\u0627\u062f\u0629-\u0627\u0644\u0641\u0636\u0629', creditAccountId: 'silver-surplus', weight: '5', arabicWeight: '5' }),
  ];

  it('keeps tx and subTx legacy opening classification aligned with the inventory cost engine', () => {
    const legacyOpenings = realEntries.filter(candidate => [
      'csvref-entry-b409864f20924429758c24fe9afb620d',
      'legacy-subtx-gold-opening',
    ].includes(candidate.id || ''));
    expect(legacyOpenings.every(isOpeningEntry)).toBe(true);

    const timeline = rebuildInventoryCostTimeline(
      legacyOpenings,
      [realSchemaAccounts[2], realSchemaAccounts[3]],
      { gold21PriceByYearMinor: { '2026': 10000 } },
      { bindings: [{ inventoryAccountId: '0TZN9o9A2qoZhtdzOVU3', taxonomyKey: 'gold.product.ring_arabic' }] },
    );

    expect(timeline.valid).toBe(true);
    expect(timeline.results.map(result => result.classification)).toEqual(['opening', 'opening']);
    expect(timeline.finalStates['0TZN9o9A2qoZhtdzOVU3'].standardizedQuantityUnits).toBe(12257);
  });

  it('uses tx-derived opening classification for Cash, Gold, and Silver in Ledger and Trial Balance', () => {
    const cashLedger = buildLedgerReport(realEntries, realSchemaAccounts, realSchemaAccounts[0], 'cash', '2026-01-01', '2026-12-31');
    const goldLedger = buildLedgerReport(realEntries, realSchemaAccounts, realSchemaAccounts[2], 'gold', '2026-01-01', '2026-12-31');
    const silverLedger = buildLedgerReport(realEntries, realSchemaAccounts, realSchemaAccounts[4], 'silver', '2026-01-01', '2026-12-31');
    expect(cashLedger.openingBalance).toBe(558750);
    expect(cashLedger.rows.map(row => row.entry.id)).toEqual(['period-cash-gold-sale']);
    expect(goldLedger.openingBalance).toBe(122.57);
    expect(goldLedger.totalCredit).toBe(3);
    expect(goldLedger.rows.map(row => row.entry.id)).toEqual(['period-cash-gold-sale']);
    expect(silverLedger.openingBalance).toBe(305);
    expect(silverLedger.rows.map(row => row.entry.id)).toEqual(['period-silver-adjustment']);

    const cashTrialRow = buildTrialBalanceReport(realEntries, realSchemaAccounts, 'cash', '2026-01-01', '2026-12-31').groups.flatMap(group => group.rows).find(row => row.entityId === 'account:uV1kRL6EMkqAo8xvwRXN');
    const goldTrialRow = buildTrialBalanceReport(realEntries, realSchemaAccounts, 'gold', '2026-01-01', '2026-12-31').groups.flatMap(group => group.rows).find(row => row.entityId === 'product:0TZN9o9A2qoZhtdzOVU3');
    const silverTrialRow = buildTrialBalanceReport(realEntries, realSchemaAccounts, 'silver', '2026-01-01', '2026-12-31').groups.flatMap(group => group.rows).find(row => row.entityId === 'product:ALgcjH5wXjKnFjDUOJyR');
    expect(cashTrialRow).toMatchObject({ openingDebit: 558750, periodDebit: 100, closingDebit: 558850 });
    expect(goldTrialRow).toMatchObject({ openingDebit: 122.57, periodCredit: 3, closingDebit: 119.57 });
    expect(silverTrialRow).toMatchObject({ openingDebit: 305, periodDebit: 5, closingDebit: 310 });
  });
});
