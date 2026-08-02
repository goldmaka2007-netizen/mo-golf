import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { belongsToMetric, getAccountTypeDetails, getMetricActualValue, getMetricValue } from '../../utils/accountLogic';
import { buildEquityStatementReport } from '../equityStatementReport';
import { buildFinancialPositionReport } from '../financialPositionReport';
import { buildIncomeStatementReport, type IncomeStatementMetric } from '../incomeStatementReport';

const accounts: Account[] = [
  { name: 'خزنة', mainType: 'asset', subType: 'نقدية', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { name: 'ذهب', mainType: 'asset', subType: 'مخزون', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
  { name: 'فضة', mainType: 'asset', subType: 'مخزون', balanceNature: 'silver', type: 'silver', metal: 'silver', userId: 'u' },
  { name: 'ملحقات', mainType: 'asset', subType: 'مخزون', balanceNature: 'piece', type: 'accessory', userId: 'u' },
  { name: 'رأس مال نقدي', mainType: 'equity', subType: 'رأس المال', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { name: 'رأس مال ذهب', mainType: 'equity', subType: 'رأس المال', balanceNature: 'gold', metal: 'gold', userId: 'u' },
  { name: 'رأس مال فضة', mainType: 'equity', subType: 'رأس المال', balanceNature: 'silver', metal: 'silver', userId: 'u' },
  { name: 'رأس مال ملحقات', mainType: 'equity', subType: 'رأس المال', balanceNature: 'piece', type: 'accessory', userId: 'u' },
  { name: 'مسحوبات نقدية', mainType: 'equity', subType: 'مسحوبات', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { name: 'مسحوبات ذهب', mainType: 'equity', subType: 'مسحوبات', balanceNature: 'gold', metal: 'gold', userId: 'u' },
  { name: 'دائن نقدي', mainType: 'liability', subType: 'دائنون', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { name: 'إيراد نقدي', mainType: 'revenue', subType: 'إيرادات', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { name: 'مصروف نقدي', mainType: 'expense', subType: 'مصروفات', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { name: 'إيراد ملحقات', mainType: 'revenue', subType: 'إيرادات', balanceNature: 'piece', type: 'accessory', userId: 'u' },
  { name: 'مصروف ملحقات', mainType: 'expense', subType: 'مصروفات', balanceNature: 'piece', type: 'accessory', userId: 'u' },
];

const entry = (patch: Partial<Entry>): Entry => ({
  tx: patch.tx || 'عملية', date: '2026-01-10', debit: '', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});
const entries: Entry[] = [
  entry({ id: 'cash-capital', debit: 'خزنة', credit: 'رأس مال نقدي', cash: '5000' }),
  entry({ id: 'gold-capital', debit: 'ذهب', credit: 'رأس مال ذهب', weight: '20', arabicWeight: '20', karat: 21 }),
  entry({ id: 'silver-capital', tx: 'فضة افتتاحية', debit: 'فضة', credit: 'رأس مال فضة', weight: '40' }),
  entry({ id: 'acc-capital', debit: 'ملحقات', credit: 'رأس مال ملحقات', weight: '8', count: '8' }),
  entry({ id: 'cash-draw', debit: 'مسحوبات نقدية', credit: 'خزنة', cash: '100' }),
  entry({ id: 'gold-draw', debit: 'مسحوبات ذهب', credit: 'ذهب', weight: '1', arabicWeight: '1', karat: 21 }),
  entry({ id: 'cash-revenue', debit: 'خزنة', credit: 'إيراد نقدي', cash: '300' }),
  entry({ id: 'cash-expense', debit: 'مصروف نقدي', credit: 'خزنة', cash: '50' }),
  entry({ id: 'gold-buy', debit: 'ذهب', credit: 'خزنة', cash: '1000', weight: '5', arabicWeight: '5', karat: 21 }),
  entry({ id: 'gold-sale', debit: 'خزنة', credit: 'ذهب', cash: '1500', weight: '2', arabicWeight: '2', karat: 21 }),
  entry({ id: 'silver-buy', tx: 'شراء فضة', debit: 'فضة', credit: 'خزنة', cash: '200', weight: '10' }),
  entry({ id: 'silver-sale', tx: 'بيع فضة', debit: 'خزنة', credit: 'فضة', cash: '350', weight: '4' }),
  entry({ id: 'acc-revenue', debit: 'ملحقات', credit: 'إيراد ملحقات', weight: '3', count: '3' }),
  entry({ id: 'acc-expense', debit: 'مصروف ملحقات', credit: 'ملحقات', weight: '1', count: '1' }),
  entry({ id: 'loan', debit: 'خزنة', credit: 'دائن نقدي', cash: '400' }),
];

type Metric = IncomeStatementMetric;
const oldEquityDimension = (metric: Metric) => {
  let additions = 0;
  let deductions = 0;
  let revenue = 0;
  let expenses = 0;
  const additionAccounts: Record<string, number> = {};
  const deductionAccounts: Record<string, number> = {};
  entries.forEach(item => {
    const value = getMetricValue(item, metric, accounts);
    if (value === 0) return;
    const debit = getAccountTypeDetails(item.debit, accounts);
    const credit = getAccountTypeDetails(item.credit, accounts);
    if (credit.main === 'equity' && belongsToMetric(item.credit, metric, accounts)) {
      additions += value; additionAccounts[item.credit] = (additionAccounts[item.credit] || 0) + value;
    }
    if (debit.main === 'equity' && belongsToMetric(item.debit, metric, accounts)) {
      deductions += value; deductionAccounts[item.debit] = (deductionAccounts[item.debit] || 0) + value;
    }
    if (belongsToMetric(item.credit, metric, accounts) && credit.main === 'revenue') revenue += value;
    if (belongsToMetric(item.debit, metric, accounts) && debit.main === 'expenses') expenses += value;
    if (metric === 'cash') {
      const product = (name: string) => belongsToMetric(name, 'gold', accounts) || belongsToMetric(name, 'silver', accounts) || belongsToMetric(name, 'accs', accounts);
      if (belongsToMetric(item.debit, 'cash', accounts) && product(item.credit) && credit.main === 'assets') revenue += value;
      if (belongsToMetric(item.credit, 'cash', accounts) && product(item.debit) && debit.main === 'assets') expenses += value;
    } else if (metric === 'gold' || metric === 'silver') {
      if (belongsToMetric(item.debit, metric, accounts) && debit.main === 'assets' && !belongsToMetric(item.credit, metric, accounts)) revenue += value;
      if (belongsToMetric(item.credit, metric, accounts) && credit.main === 'assets' && !belongsToMetric(item.debit, metric, accounts)) expenses += value;
    }
  });
  const netProfit = revenue - expenses;
  return { additions: { total: additions, accounts: additionAccounts }, deductions: { total: deductions, accounts: deductionAccounts }, netProfit, totalChange: additions - deductions + netProfit };
};

type Detail = { name: string; val: number; actualVal: number; countVal: number };
type Category = { total: number; totalCount: number; details: Detail[] };
const oldPositionDimension = (metric: Metric) => {
  const assets: Record<string, Category> = {};
  const liabilities: Record<string, Category> = {};
  const equity: Record<string, Category> = {};
  const balances: Record<string, number> = {};
  const actualBalances: Record<string, number> = {};
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  entries.forEach(item => {
    const value = getMetricValue(item, metric, accounts);
    const actual = metric === 'cash' ? value : getMetricActualValue(item, metric, accounts);
    if (value === 0 && actual === 0) return;
    if (belongsToMetric(item.debit, metric, accounts)) { balances[item.debit] = (balances[item.debit] || 0) + value; actualBalances[item.debit] = (actualBalances[item.debit] || 0) + actual; }
    if (belongsToMetric(item.credit, metric, accounts)) { balances[item.credit] = (balances[item.credit] || 0) - value; actualBalances[item.credit] = (actualBalances[item.credit] || 0) - actual; }
  });
  Object.entries(balances).forEach(([name, rawBalance]) => {
    const rawActual = actualBalances[name] || 0;
    const balance = (metric === 'gold' || metric === 'silver') && Math.abs(rawActual) < 0.001 ? 0 : rawBalance;
    if (Math.abs(balance) < 0.00001 && Math.abs(rawActual) < 0.00001) return;
    const info = getAccountTypeDetails(name, accounts);
    const target = info.main === 'assets' ? assets : info.main === 'liabilities' ? liabilities : info.main === 'equity' ? equity : null;
    if (!target) return;
    const sign = info.main === 'assets' ? 1 : -1;
    const value = balance * sign;
    if (!target[info.sub]) target[info.sub] = { total: 0, totalCount: 0, details: [] };
    target[info.sub].details.push({ name, val: value, actualVal: rawActual * sign, countVal: 0 });
    target[info.sub].total += value;
    if (info.main === 'assets') totalAssets += value;
    else if (info.main === 'liabilities') totalLiabilities += value;
    else totalEquity += value;
  });
  const oldEquity = oldEquityDimension(metric);
  if (Math.abs(oldEquity.netProfit) > 0.00001) {
    const value = oldEquity.netProfit;
    if (!equity['نتائج الأعمال']) equity['نتائج الأعمال'] = { total: 0, totalCount: 0, details: [] };
    equity['نتائج الأعمال'].details.push({ name: value >= 0 ? 'صافي نتائج أعمال الفترة (أرباح)' : 'صافي نتائج أعمال الفترة (خسائر)', val: value, actualVal: value, countVal: 0 });
    equity['نتائج الأعمال'].total += value;
    totalEquity += value;
  }
  [assets, liabilities, equity].forEach(groups => Object.values(groups).forEach(group => group.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))));
  return {
    assets: { categories: assets, total: totalAssets, totalCount: 0 },
    liabilities: { categories: liabilities, total: totalLiabilities, totalCount: 0 },
    equity: { categories: equity, total: totalEquity, totalCount: 0 },
    uncategorized: [],
  };
};

describe('equity and financial-position central report regression', () => {
  const income = buildIncomeStatementReport(entries, accounts);
  const equity = buildEquityStatementReport(entries, accounts, income);
  const position = buildFinancialPositionReport(entries, accounts, equity);

  it('matches the old equity UI for every dimension and consumes income net results directly', () => {
    (['cash', 'gold', 'silver', 'accs'] as Metric[]).forEach(metric => {
      expect(equity[metric]).toEqual(oldEquityDimension(metric));
      expect(equity[metric].netProfit).toBe(income[metric].net);
    });
  });

  it('uses centralized balances and consumes the equity result without recalculating profit', () => {
    (['cash', 'gold', 'silver', 'accs'] as Metric[]).forEach(metric => {
      expect(position[metric].uncategorized).toBeDefined();
      const resultLine = position[metric].equity.categories['نتائج الأعمال']?.details[0];
      if (resultLine) expect(resultLine.val).toBe(equity[metric].netProfit);
    });
  });
});
