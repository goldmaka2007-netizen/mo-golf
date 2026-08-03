import { describe, expect, it } from 'vitest';
import type { Entry } from '../../types';
import { combineLedgerDimensionReports, type LedgerReport } from '../ledgerReport';

const entry: Entry = { id: 'sale', tx: 'sale', operationKind: 'sale', debit: 'cash', credit: 'ring', date: '2026-01-01', cash: '1000', weight: '2', arabicWeight: '2', count: '0', notes: '', userId: 'u' };
const report = (debit: number, credit: number, balance: number): LedgerReport => ({
  balanceEngineVersion: 'test', source: 'balance_engine', normalBalance: 'debit', openingBalance: 0,
  totalDebit: debit, totalCredit: credit, closingBalance: balance,
  rows: [{ entry, date: entry.date, operationNumber: 'S1', operationType: 'sale', oppositeAccount: 'cash', debit, credit, balance }],
});

describe('multi-dimensional ledger projection', () => {
  it('groups the existing dimension reports without recalculating values', () => {
    const rows = combineLedgerDimensionReports([
      { dimension: 'cash', report: report(1000, 0, 1000) },
      { dimension: 'gold', report: report(0, 2, -2) },
      { dimension: 'book_value', report: report(0, 700, -700) },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].dimensions).toEqual({
      cash: { debit: 1000, credit: 0, balance: 1000 },
      gold: { debit: 0, credit: 2, balance: -2 },
      book_value: { debit: 0, credit: 700, balance: -700 },
    });
  });
});
