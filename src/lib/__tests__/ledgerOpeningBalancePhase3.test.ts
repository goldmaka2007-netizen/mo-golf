import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildLedgerReport } from '../ledgerReport';

const accounts: Account[] = [
  { id: 'gold', name: 'gold', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
  { id: 'silver', name: 'silver', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', userId: 'u' },
  { id: 'counterpart', name: 'counterpart', mainType: 'equity', subType: '', balanceNature: 'cash', type: 'other', userId: 'u' },
];
const entry = (partial: Partial<Entry>): Entry => ({
  seq: 1, tx: 'test', operationKind: 'other', date: '2026-06-01', debit: '', credit: '',
  cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...partial,
});

describe('Phase 3 metal ledger opening balance regression', () => {
  it.each([
    ['gold', accounts[0], { arabicWeight: '10' }, { arabicWeight: '4' }],
    ['silver', accounts[1], { weight: '10' }, { weight: '4' }],
  ] as const)('uses only transactions before the range for %s opening balance', (dimension, account, priorValue, periodValue) => {
    const prior = entry({ id: `${dimension}-prior`, date: '2026-05-31', debit: account.name, debitAccountId: account.id, credit: accounts[2].name, creditAccountId: accounts[2].id, ...priorValue });
    const inPeriod = entry({ id: `${dimension}-period`, date: '2026-06-01', debit: account.name, debitAccountId: account.id, credit: accounts[2].name, creditAccountId: accounts[2].id, ...periodValue });
    const afterPeriod = entry({ id: `${dimension}-after`, date: '2026-07-01', debit: account.name, debitAccountId: account.id, credit: accounts[2].name, creditAccountId: accounts[2].id, ...periodValue });
    const report = buildLedgerReport([inPeriod, afterPeriod, prior], accounts, account, dimension, '2026-06-01', '2026-06-30');
    expect(report.openingBalance).toBe(10);
    expect(report.rows.map(row => row.entry.id)).toEqual([`${dimension}-period`]);
    expect(report.totalDebit).toBe(4);
    expect(report.totalCredit).toBe(0);
    expect(report.closingBalance).toBe(14);
  });
});