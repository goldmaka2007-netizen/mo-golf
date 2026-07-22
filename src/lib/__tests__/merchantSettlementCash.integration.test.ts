import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildCanonicalAccountRegistry, buildCanonicalAccountingLegs } from '../canonicalAccounting';
import { buildDailyJournalReport } from '../dailyJournalReport';
import { buildLedgerReport } from '../ledgerReport';
import { buildTrialBalanceReport } from '../trialBalanceReport';

const date = '2026-07-22';
const merchantName = '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628';
const cashName = '\u0627\u0644\u062e\u0632\u0646\u0629';
const accounts: Account[] = [
  { id: 'merchant', name: merchantName, mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' },
  { id: 'cash', name: cashName, mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
];
const settlement = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'legacy-cash-settlement', seq: 590, tx: '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628', operationKind: 'merchant_settlement', date, debit: merchantName, credit: cashName,
  cash: '590', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...overrides,
});

describe('cash merchant settlement canonical posting', () => {
  it('posts two cash legs with the stored debit-to-credit direction when cash is positive and weight is zero', () => {
    const entry = settlement({ debitAccountId: 'merchant', creditAccountId: 'cash' });
    const legs = buildCanonicalAccountingLegs([entry], buildCanonicalAccountRegistry(accounts, [entry]));

    expect(legs.map(leg => [leg.accountName, leg.side, leg.dimension, leg.amount])).toEqual([
      [merchantName, 'debit', 'cash', 590], [cashName, 'credit', 'cash', 590],
    ]);
  });

  it('resolves the legacy names without Account IDs and reconciles Daily Journal, General Ledger, and Trial Balance', () => {
    const entry = settlement();
    const daily = buildDailyJournalReport([entry], accounts, date);
    const merchantLedger = buildLedgerReport([entry], accounts, accounts[0], 'cash', date, date);
    const cashLedger = buildLedgerReport([entry], accounts, accounts[1], 'cash', date, date);
    const trial = buildTrialBalanceReport([entry], accounts, 'cash', date, date);

    expect(daily.diagnostics.entries).toEqual([]);
    expect(daily.dimensions.cash.periodDebit).toBe(0);
    expect(daily.dimensions.cash.periodCredit).toBe(590);
    expect(merchantLedger.totalDebit).toBe(590);
    expect(cashLedger.totalCredit).toBe(590);
    expect(trial.periodDebit).toBe(590);
    expect(trial.periodCredit).toBe(590);
    expect(daily.dimensions.cash.closingDebit).toBe(0);
    expect(daily.dimensions.cash.closingCredit).toBe(590);
  });
});
