import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildEquityStatementEgp } from '../equityStatementEgp';

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', mainType: 'assets', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'capital', name: 'Capital', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'drawings', name: 'Drawings', mainType: 'equity', subType: 'withdrawals', canonicalMainType: 'equity', canonicalSubType: 'withdrawals', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'prior', name: 'Prior years', mainType: 'equity', subType: 'retained earnings', canonicalMainType: 'equity', canonicalSubType: 'retained_earnings', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'revenue', name: 'Revenue', mainType: 'revenue', subType: 'revenue', canonicalMainType: 'revenue', canonicalSubType: 'revenue', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'seed-account-d1216eb4076ccdf40e20', name: 'Synthetic overlay inventory', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_raw', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' },
];
const entry = (patch: Partial<Entry>): Entry => ({ id: 'entry', tx: 'test', operationKind: 'transfer', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });

describe('EGP Statement of Changes in Equity', () => {
  it('includes a same-year opening once, excludes it from movements and profit, and reconciles ending equity', () => {
    const result = buildEquityStatementEgp({ entries: [
      entry({ id: 'opening', operationKind: 'opening', date: '2026-01-01', debit: 'Cash', debitAccountId: 'cash', credit: 'Capital', creditAccountId: 'capital', cash: '1000' }),
      entry({ id: 'addition', date: '2026-01-01', debit: 'Cash', debitAccountId: 'cash', credit: 'Capital', creditAccountId: 'capital', cash: '200' }),
      entry({ id: 'drawing', date: '2026-01-06', debit: 'Drawings', debitAccountId: 'drawings', credit: 'Cash', creditAccountId: 'cash', cash: '50' }),
      entry({ id: 'direct-prior', date: '2026-01-07', debit: 'Cash', debitAccountId: 'cash', credit: 'Prior years', creditAccountId: 'prior', cash: '25' }),
      entry({ id: 'revenue', date: '2026-01-08', debit: 'Cash', debitAccountId: 'cash', credit: 'Revenue', creditAccountId: 'revenue', cash: '100' }),
    ], accounts, canonicalDefinitions: [], openingCostConfig: [], cutoffDate: '2026-01-31' });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.report.openingEquity).toBe(1000);
    expect(result.report.openingDetails).toEqual([expect.objectContaining({ amount: 1000 })]);
    expect(result.report.openingDetails.some(row => row.amount === 200)).toBe(false);
    expect(result.report.capitalAdditions).toEqual([expect.objectContaining({ amount: 200 })]);
    expect(result.report.capitalAdditions.some(row => row.amount === 1000)).toBe(false);
    expect(result.report.drawings).toEqual([expect.objectContaining({ amount: -50 })]);
    expect(result.report.directMovements).toEqual([expect.objectContaining({ amount: 25 })]);
    expect(result.report.currentYtdProfit).toBe(100);
    expect(result.report.endingEquity).toBe(1275);
    expect(result.report.reconciliationDifference).toBe(0);
  });

  it('reports an approved post-year-start inventory overlay as a direct equity movement', () => {
    const inventoryId = 'seed-account-d1216eb4076ccdf40e20';
    const result = buildEquityStatementEgp({ entries: [
      entry({ id: 'opening-cash', operationKind: 'opening', date: '2026-01-01', debit: 'Cash', debitAccountId: 'cash', credit: 'Capital', creditAccountId: 'capital', cash: '1000' }),
      entry({ id: 'opening-inventory', operationKind: 'opening', date: '2026-01-01', debit: 'Synthetic overlay inventory', debitAccountId: inventoryId, credit: 'Capital', creditAccountId: 'capital', weight: '10', arabicWeight: '10' }),
      entry({ id: 'csvref-entry-8bac4f51c5f366affbcb8884610f549e', operationKind: 'sale', date: '2026-03-04', debit: 'Cash', debitAccountId: 'cash', credit: 'Synthetic overlay inventory', creditAccountId: inventoryId, weight: '10.02', arabicWeight: '10.02', cash: '1200' }),
    ], accounts, canonicalDefinitions: [], openingCostConfig: [{ year: 2026, gold21PriceMinorPerGram: 10000 }], cutoffDate: '2026-03-31' });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.report.openingEquity).toBe(2000);
    expect(result.report.directMovements).toContainEqual(expect.objectContaining({ amount: 2 }));
    expect(result.report.capitalAdditions).toEqual([]);
    expect(result.report.reconciliationDifference).toBe(0);
  });
});
