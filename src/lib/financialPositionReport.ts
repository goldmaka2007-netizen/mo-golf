import type { Account, Entry } from '../types';
import { calculateGoldOwnershipPosition, type GoldOwnershipPosition } from './engine';
import type { EquityStatementReport } from './equityStatementReport';
import type { IncomeStatementMetric } from './incomeStatementReport';
import { belongsToMetric, getAccountTypeDetails, getMetricActualValue, getMetricValue } from '../utils/accountLogic';

export interface FinancialPositionDetail {
  name: string;
  val: number;
  actualVal: number;
  countVal: number;
}
export interface FinancialPositionCategory {
  total: number;
  totalCount: number;
  details: FinancialPositionDetail[];
}
export interface FinancialPositionSection {
  categories: Record<string, FinancialPositionCategory>;
  total: number;
  totalCount: number;
}
export interface FinancialPositionDimension {
  assets: FinancialPositionSection;
  liabilities: FinancialPositionSection;
  equity: FinancialPositionSection;
  uncategorized: FinancialPositionDetail[];
}
export interface FinancialPositionReport extends Record<IncomeStatementMetric, FinancialPositionDimension> {
  goldPosition: GoldOwnershipPosition;
}

type CategoryMap = Record<string, FinancialPositionCategory>;

const buildDimension = (
  entries: Entry[],
  accounts: Account[],
  metric: IncomeStatementMetric,
  equityResult: EquityStatementReport[IncomeStatementMetric],
): FinancialPositionDimension => {
  const assetsCats: CategoryMap = {};
  const liabilitiesCats: CategoryMap = {};
  const equityCats: CategoryMap = {};
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  const accountBalances: Record<string, number> = {};
  const actualBalances: Record<string, number> = {};

  entries.forEach(entry => {
    const value = getMetricValue(entry, metric, accounts);
    const actualValue = metric === 'cash' ? value : getMetricActualValue(entry, metric, accounts);
    if (value === 0 && actualValue === 0) return;
    if (belongsToMetric(entry.debit, metric, accounts)) {
      accountBalances[entry.debit] = (accountBalances[entry.debit] || 0) + value;
      actualBalances[entry.debit] = (actualBalances[entry.debit] || 0) + actualValue;
    }
    if (belongsToMetric(entry.credit, metric, accounts)) {
      accountBalances[entry.credit] = (accountBalances[entry.credit] || 0) - value;
      actualBalances[entry.credit] = (actualBalances[entry.credit] || 0) - actualValue;
    }
  });

  Object.entries(accountBalances).forEach(([accountName, balance]) => {
    const actualBalance = actualBalances[accountName] || 0;
    let correctedBalance = balance;
    if ((metric === 'gold' || metric === 'silver') && Math.abs(actualBalance) < 0.001) correctedBalance = 0;
    if (Math.abs(correctedBalance) < 0.00001 && Math.abs(actualBalance) < 0.00001) return;

    const details = getAccountTypeDetails(accountName, accounts);
    let target: CategoryMap | null = null;
    let value = 0;
    let actualValue = 0;
    if (details.main === 'assets') {
      target = assetsCats; value = correctedBalance; actualValue = actualBalance;
    } else if (details.main === 'liabilities') {
      target = liabilitiesCats; value = -correctedBalance; actualValue = -actualBalance;
    } else if (details.main === 'equity') {
      target = equityCats; value = -correctedBalance; actualValue = -actualBalance;
    }
    if (!target) return;
    if (!target[details.sub]) target[details.sub] = { total: 0, totalCount: 0, details: [] };
    target[details.sub].details.push({ name: accountName, val: value, actualVal: actualValue, countVal: 0 });
    target[details.sub].total += value;
    if (details.main === 'assets') totalAssets += value;
    else if (details.main === 'liabilities') totalLiabilities += value;
    else totalEquity += value;
  });

  const periodResult = equityResult.netProfit;
  if (Math.abs(periodResult) > 0.00001) {
    const label = periodResult >= 0 ? 'صافي نتائج أعمال الفترة (أرباح)' : 'صافي نتائج أعمال الفترة (خسائر)';
    if (!equityCats['نتائج الأعمال']) equityCats['نتائج الأعمال'] = { total: 0, totalCount: 0, details: [] };
    equityCats['نتائج الأعمال'].details.push({ name: label, val: periodResult, actualVal: periodResult, countVal: 0 });
    equityCats['نتائج الأعمال'].total += periodResult;
    totalEquity += periodResult;
  }

  [assetsCats, liabilitiesCats, equityCats].forEach(categories => {
    Object.values(categories).forEach(category => category.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val)));
  });

  return {
    assets: { categories: assetsCats, total: totalAssets, totalCount: 0 },
    liabilities: { categories: liabilitiesCats, total: totalLiabilities, totalCount: 0 },
    equity: { categories: equityCats, total: totalEquity, totalCount: 0 },
    uncategorized: [],
  };
};

export const buildFinancialPositionReport = (
  entries: Entry[],
  accounts: Account[],
  equityStatement: EquityStatementReport,
): FinancialPositionReport => ({
  cash: buildDimension(entries, accounts, 'cash', equityStatement.cash),
  gold: buildDimension(entries, accounts, 'gold', equityStatement.gold),
  silver: buildDimension(entries, accounts, 'silver', equityStatement.silver),
  accs: buildDimension(entries, accounts, 'accs', equityStatement.accs),
  goldPosition: calculateGoldOwnershipPosition(entries, accounts),
});