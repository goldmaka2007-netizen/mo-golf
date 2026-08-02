import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { BALANCE_ENGINE_VERSION, computeAccountBalances } from '../engine';
import { buildIncomeStatementExcelSheets } from '../incomeStatementExcel';
import { buildIncomeStatementReport } from '../incomeStatementReport';

const account = (patch: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  mainType: 'asset', subType: 'other', balanceNature: 'cash', userId: 'u', ...patch,
});
const accounts: Account[] = [
  account({ id: 'cash', name: 'Cash', canonicalMainType: 'assets', canonicalSubType: 'cash', type: 'cash' }),
  account({ id: 'gold-revenue', name: 'Gold Revenue', mainType: 'revenue', canonicalMainType: 'revenue', canonicalSubType: 'revenue', metal: 'gold' }),
  account({ id: 'silver-revenue', name: 'Silver Revenue', mainType: 'revenue', canonicalMainType: 'revenue', canonicalSubType: 'revenue', metal: 'silver' }),
  account({ id: 'accessory-revenue', name: 'Accessory Revenue', mainType: 'revenue', canonicalMainType: 'revenue', canonicalSubType: 'revenue', type: 'accessory', measurementDimension: 'quantity' }),
  account({ id: 'service-revenue', name: 'Service Revenue', mainType: 'revenue', canonicalMainType: 'revenue', canonicalSubType: 'revenue' }),
  account({ id: 'rent-expense', name: 'Rent Expense', mainType: 'expense', canonicalMainType: 'expense', canonicalSubType: 'expense' }),
];
const entry = (patch: Partial<Entry>): Entry => ({
  id: patch.id, tx: patch.tx ?? 'operation', date: patch.date ?? '2026-01-10', debit: 'Cash', debitAccountId: 'cash', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});
const dataset: Entry[] = [
  entry({ id: 'gold-sale', credit: 'Gold Revenue', creditAccountId: 'gold-revenue', cash: '1500', weight: '4', arabicWeight: '4', karat: 21 }),
  entry({ id: 'silver-sale', tx: 'silver sale', credit: 'Silver Revenue', creditAccountId: 'silver-revenue', cash: '450', weight: '12' }),
  entry({ id: 'accessory-sale', credit: 'Accessory Revenue', creditAccountId: 'accessory-revenue', cash: '180', count: '2' }),
  entry({ id: 'service', credit: 'Service Revenue', creditAccountId: 'service-revenue', cash: '75' }),
  entry({ id: 'rent', debit: 'Rent Expense', debitAccountId: 'rent-expense', credit: 'Cash', creditAccountId: 'cash', cash: '25' }),
  entry({ id: 'outside', date: '2026-02-01', credit: 'Service Revenue', creditAccountId: 'service-revenue', cash: '100' }),
];

const reportFor = (source: Entry[], startDate?: string, endDate?: string) => {
  const selected = source.filter(item => (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate));
  const dates = selected.map(item => item.date).sort();
  return buildIncomeStatementReport(computeAccountBalances(selected, accounts), startDate ?? dates[0] ?? null, endDate ?? dates.at(-1) ?? null);
};

describe('income statement central balance projection', () => {
  it('uses the central engine for requested period boundaries and every dimension', () => {
    const report = reportFor(dataset, '2026-01-01', '2026-01-31');
    expect(report.balanceEngineVersion).toBe(BALANCE_ENGINE_VERSION);
    expect(report.startDate).toBe('2026-01-01');
    expect(report.endDate).toBe('2026-01-31');
    expect(report.cash).toMatchObject({ revenue: { total: 2205 }, expenses: { total: 25 }, net: 2180 });
    expect(report.gold.net).toBe(4);
    expect(report.silver.net).toBe(12);
    expect(report.accs.net).toBe(2);
  });

  it('keeps all-period boundaries and includes the later explicit revenue balance', () => {
    const report = reportFor(dataset);
    expect(report.startDate).toBe('2026-01-10');
    expect(report.endDate).toBe('2026-02-01');
    expect(report.cash.net).toBe(2280);
  });

  it('derives metal averages and accessory quantities from account balances', () => {
    const revenue = reportFor(dataset, '2026-01-01', '2026-01-31').cash.revenue;
    expect(revenue).toMatchObject({ goldAmount: 1500, goldWeight: 4, goldAverage: 375, silverAmount: 450, silverWeight: 12, silverAverage: 37.5, accessoryCount: 2 });
    expect(revenue.categories.revenue.details.map(item => item.name)).toEqual(expect.arrayContaining(['Gold Revenue', 'Silver Revenue', 'Accessory Revenue', 'Service Revenue']));
  });

  it('matches the revenue and expense balances emitted by computeAccountBalances', () => {
    const computed = computeAccountBalances(dataset.slice(0, 5), accounts);
    const report = buildIncomeStatementReport(computed);
    expect(report.cash.revenue.total).toBe([...computed.balances.values()].filter(item => item.mainType === 'revenue').reduce((sum, item) => sum + item.cashBalance, 0));
    expect(report.cash.expenses.total).toBe(computed.balances.get('rent-expense')?.cashBalance);
  });

  it('exports the same central totals shown by the report', () => {
    const report = reportFor(dataset, '2026-01-01', '2026-01-31');
    const sheet = buildIncomeStatementExcelSheets(report)[0];
    expect(sheet.data.some(row => Object.values(row).includes(report.cash.revenue.total))).toBe(true);
    expect(sheet.data.some(row => Object.values(row).includes(report.cash.expenses.total))).toBe(true);
  });
});