import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildCanonicalAccountRegistry, buildCanonicalAccountingLegs } from '../canonicalAccounting';
import { buildDailyJournalReport } from '../dailyJournalReport';
import { buildLedgerReport } from '../ledgerReport';
import { buildTrialBalanceReport } from '../trialBalanceReport';

const date = '2026-07-22';
const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'gold-product', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, userId: 'u' },
  { id: 'silver', name: 'silver-product', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
  { id: 'expense', name: 'cash-expense', mainType: 'expense', subType: 'expense', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'surplus', name: 'gold-surplus', mainType: 'revenue', subType: 'adjustment', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u' },
  { id: 'shortage', name: 'gold-shortage', mainType: 'expense', subType: 'adjustment', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u' },
  { id: 'merchant', name: 'gold-merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' },
];
const entry = (overrides: Partial<Entry>): Entry => ({ seq: 1, tx: 'operation', operationKind: 'other', date, debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...overrides });
const entries: Entry[] = [
  entry({ id: 'gold-sale', seq: 1, tx: 'gold sale', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold-product', creditAccountId: 'gold', cash: '100', weight: '2', arabicWeight: '2', karat: 21 }),
  entry({ id: 'gold-purchase', seq: 2, tx: 'gold purchase', operationKind: 'purchase', debit: 'gold-product', debitAccountId: 'gold', credit: 'cash', creditAccountId: 'cash', cash: '50', weight: '1', arabicWeight: '1', karat: 21 }),
  entry({ id: 'cash-expense', seq: 3, tx: 'cash expense', operationKind: 'expense', debit: 'cash-expense', debitAccountId: 'expense', credit: 'cash', creditAccountId: 'cash', cash: '10' }),
  entry({ id: 'gold-surplus', seq: 4, tx: 'gold surplus', operationKind: 'adjustment', debit: 'gold-product', debitAccountId: 'gold', credit: 'gold-surplus', creditAccountId: 'surplus', weight: '3', arabicWeight: '3', karat: 21 }),
  entry({ id: 'gold-shortage', seq: 5, tx: 'gold shortage', operationKind: 'adjustment', debit: 'gold-shortage', debitAccountId: 'shortage', credit: 'gold-product', creditAccountId: 'gold', weight: '1', arabicWeight: '1', karat: 21 }),
  entry({ id: 'silver-purchase', seq: 6, tx: 'silver purchase', operationKind: 'purchase', debit: 'silver-product', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', cash: '20', weight: '4' }),
  entry({ id: 'merchant-only-gold', seq: 7, tx: 'merchant gold movement', operationKind: 'adjustment', debit: 'gold-merchant', debitAccountId: 'merchant', credit: 'gold-surplus', creditAccountId: 'surplus', arabicWeight: '5', weight: '5', karat: 21 }),
];

describe('daily journal canonical integration', () => {
  it('summarizes operational cashbox and inventory legs while keeping non-operational legs out', () => {
    const journal = buildDailyJournalReport(entries, accounts, date);
    expect(journal.diagnostics.entries).toEqual([]);
    expect(journal.dimensions.gold).toMatchObject({ periodDebit: 4, periodCredit: 3, closingDebit: 1, closingCredit: 0 });
    expect(journal.dimensions.silver).toMatchObject({ periodDebit: 4, periodCredit: 0, closingDebit: 4, closingCredit: 0 });
    expect(journal.dimensions.cash).toMatchObject({ periodDebit: 100, periodCredit: 80, closingDebit: 20, closingCredit: 0 });
    expect(journal.dimensions.gold.periodDebit).not.toBe(9);
  });

  it('uses Equivalent-21 for gold inventory and actual grams for silver inventory', () => {
    const convertedGold = entry({ id: 'gold-18', operationKind: 'adjustment', debit: 'gold-product', debitAccountId: 'gold', credit: 'gold-surplus', creditAccountId: 'surplus', weight: '10.465', arabicWeight: '8.97', karat: 18 });
    const physicalSilver = entry({ id: 'silver-physical', operationKind: 'purchase', debit: 'silver-product', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '7.5', arabicWeight: '6.43', karat: 18 });
    const journal = buildDailyJournalReport([convertedGold, physicalSilver], accounts, date);
    expect(journal.dimensions.gold).toMatchObject({ periodDebit: 8.97, periodCredit: 0, closingDebit: 8.97 });
    expect(journal.dimensions.silver).toMatchObject({ periodDebit: 7.5, periodCredit: 0, closingDebit: 7.5 });
  });

  it('keeps every canonical leg exactly once in the journal period', () => {
    const journal = buildDailyJournalReport(entries, accounts, date);
    const expected = buildCanonicalAccountingLegs(entries, buildCanonicalAccountRegistry(accounts, entries)).filter(leg => !leg.isOpening && leg.date === date);
    const actual = Object.values(journal.dimensions).flatMap(report => report.periodLegs);
    const key = (leg: typeof actual[number]) => `${leg.sourceEntryId}:${leg.entityId}:${leg.dimension}:${leg.side}:${leg.amount}`;

    expect(actual.map(key).sort()).toEqual(expected.map(key).sort());
    expect(new Set(actual.map(key)).size).toBe(actual.length);
  });
  it('reports the stored fields, grouped reasons, and recommendations for a non-posted entry', () => {
    const broken = entry({ id: 'broken-entry', seq: 99, tx: 'broken', operationKind: 'other', debit: '', credit: '', cash: '25', weight: '0', arabicWeight: '0' });
    const journal = buildDailyJournalReport([broken], accounts, date);
    expect(journal.diagnostics.entries[0]).toMatchObject({ id: 'broken-entry', date, tx: 'broken', debit: '', credit: '', operationKind: 'other', cash: '25', weight: '0', arabicWeight: '0' });
    expect(journal.diagnostics.entries[0].reasons).toEqual(expect.arrayContaining(['missing_debit_account', 'missing_credit_account', 'cash_dimension_unavailable']));
    expect(journal.diagnostics.groups.map(group => group.reason)).toEqual(expect.arrayContaining(['missing_debit_account', 'missing_credit_account', 'cash_dimension_unavailable']));
    expect(journal.diagnostics.groups.every(group => group.recommendation.length > 0)).toBe(true);
  });
});
