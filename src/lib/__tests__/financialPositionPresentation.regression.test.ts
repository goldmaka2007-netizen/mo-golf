import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', mainType: 'assets', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'fixed', name: 'Fixed asset', mainType: 'assets', subType: 'other', canonicalMainType: 'assets', canonicalSubType: 'fixed_asset', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'other', name: 'Other asset', mainType: 'assets', subType: 'other', canonicalMainType: 'assets', canonicalSubType: 'customer', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'capital', name: 'Capital', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u' },
];
const entry = (patch: Partial<Entry>): Entry => ({ id: 'entry', tx: 'test', operationKind: 'transfer', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });

describe('Financial Position presentation regression', () => {
  it('classifies only canonical fixed assets separately and preserves total assets', () => {
    const report = buildFinancialStatementsEgp([
      entry({ id: 'opening', operationKind: 'opening', debit: 'Cash', debitAccountId: 'cash', credit: 'Capital', creditAccountId: 'capital', cash: '1000' }),
      entry({ id: 'fixed', debit: 'Fixed asset', debitAccountId: 'fixed', credit: 'Cash', creditAccountId: 'cash', cash: '200' }),
      entry({ id: 'other', debit: 'Other asset', debitAccountId: 'other', credit: 'Cash', creditAccountId: 'cash', cash: '100' }),
    ], accounts);
    expect(report.balanceSheet.assets.fixedAssets).toBe(200);
    expect(report.balanceSheet.assets.ordinaryReceivables).toBe(100);
    expect(report.balanceSheet.assets.fixedAssetDetails).toEqual([expect.objectContaining({ accountId: 'fixed' })]);
    expect(report.balanceSheet.assets.ordinaryReceivableDetails).toEqual([expect.objectContaining({ accountId: 'other' })]);
    expect(report.balanceSheet.assets.total).toBe(1000);
  });
});
