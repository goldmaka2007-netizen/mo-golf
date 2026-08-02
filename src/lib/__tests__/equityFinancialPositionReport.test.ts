import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { computeAccountBalances } from '../engine';
import { buildEquityStatementReport } from '../equityStatementReport';
import { buildFinancialPositionReport } from '../financialPositionReport';
import { buildIncomeStatementReport } from '../incomeStatementReport';

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', mainType: 'asset', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'capital', name: 'Capital', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', userId: 'u' },
  { id: 'drawings', name: 'Drawings', mainType: 'equity', subType: 'withdrawals', canonicalMainType: 'equity', canonicalSubType: 'withdrawals', balanceNature: 'cash', userId: 'u' },
  { id: 'revenue', name: 'Revenue', mainType: 'revenue', subType: 'revenue', canonicalMainType: 'revenue', canonicalSubType: 'revenue', balanceNature: 'cash', userId: 'u' },
  { id: 'expense', name: 'Expense', mainType: 'expense', subType: 'expense', canonicalMainType: 'expense', canonicalSubType: 'expense', balanceNature: 'cash', userId: 'u' },
];
const entries: Entry[] = [
  { id: 'capital', tx: 'opening', date: '2026-01-01', debit: 'Cash', debitAccountId: 'cash', credit: 'Capital', creditAccountId: 'capital', cash: '5000', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u' },
  { id: 'draw', tx: 'withdrawal', date: '2026-01-02', debit: 'Drawings', debitAccountId: 'drawings', credit: 'Cash', creditAccountId: 'cash', cash: '100', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u' },
  { id: 'sale', tx: 'sale', date: '2026-01-03', debit: 'Cash', debitAccountId: 'cash', credit: 'Revenue', creditAccountId: 'revenue', cash: '1000', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u' },
  { id: 'cost', tx: 'expense', date: '2026-01-04', debit: 'Expense', debitAccountId: 'expense', credit: 'Cash', creditAccountId: 'cash', cash: '100', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u' },
];
const computed = computeAccountBalances(entries, accounts);
const income = buildIncomeStatementReport(computed);
const equity = buildEquityStatementReport(computed, income);
const position = buildFinancialPositionReport(computed, equity);

describe('equity and financial-position central report regression', () => {
  it('derives equity additions, deductions, and profit from the same engine result', () => {
    expect(equity.cash).toEqual({ additions: { total: 5000, accounts: { Capital: 5000 } }, deductions: { total: 100, accounts: { Drawings: 100 } }, netProfit: 900, totalChange: 5800 });
  });

  it('keeps financial position and equity statement on the same engine version and values', () => {
    expect(position.balanceEngineVersion).toBe(computed.balanceEngineVersion);
    expect(position.cash.assets.total).toBe(computed.balances.get('cash')?.cashBalance);
    expect(position.cash.equity.total).toBe(5800);
  });
});