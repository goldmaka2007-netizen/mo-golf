import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildCanonicalAccountRegistry, buildCanonicalAccountingLegs } from '../canonicalAccounting';
import { buildDailyJournalReport } from '../dailyJournalReport';
import { buildLedgerReport } from '../ledgerReport';
import { splitLegsByPeriod } from '../periodLegs';
import { buildTrialBalanceReport } from '../trialBalanceReport';

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
  it.each([['cash', 'cash'], ['gold', 'gold'], ['silver', 'silver']] as const)('uses date boundaries only for %s', (dimension, prefix) => {
    const split = splitLegsByPeriod(legs.filter(leg => leg.dimension === dimension), start, end);
    const openingIds = new Set(split.openingLegs.map(leg => leg.sourceEntryId));
    const periodIds = new Set(split.periodLegs.map(leg => leg.sourceEntryId));
    expect(openingIds).toEqual(new Set([`${prefix}-prior`]));
    expect(periodIds).toEqual(new Set([`${prefix}-start-opening`, `${prefix}-later-opening`]));
    expect([...openingIds].filter(id => periodIds.has(id))).toEqual([]);
  });

  it.each([['cash', accounts[0]], ['gold', accounts[2]], ['silver', accounts[4]]] as const)('reconciles Daily Journal, Ledger, and Trial Balance for %s', (dimension, account) => {
    const journal = buildDailyJournalReport(entries, accounts, start).dimensions[dimension];
    const oneDayTrial = buildTrialBalanceReport(entries, accounts, dimension, start, start);
    const wholePeriodTrial = buildTrialBalanceReport(entries, accounts, dimension, start, end);
    const ledger = buildLedgerReport(entries, accounts, account, dimension, start, end);
    const trialRow = wholePeriodTrial.groups.flatMap(group => group.rows).find(row => row.entityId.endsWith(`:${account.id}`));
    expect(journal.openingDebit).toBe(10);
    expect(journal.openingCredit).toBe(0);
    expect(journal.periodDebit).toBe(20);
    expect(journal.periodCredit).toBe(0);
    expect(ledger.openingBalance).toBe(10);
    expect(ledger.totalDebit).toBe(50);
    expect(ledger.rows.map(row => row.entry.id)).toEqual([`${dimension}-start-opening`, `${dimension}-later-opening`]);
    expect(trialRow).toMatchObject({ openingDebit: 10, periodDebit: 50, closingDebit: 60 });
  });
});
