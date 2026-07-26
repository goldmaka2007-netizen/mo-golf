import type { Account, Entry } from '../types';
import { belongsToMetric, getAccountTypeDetails, getMetricValue } from '../utils/accountLogic';
import type { IncomeStatementMetric, IncomeStatementReport } from './incomeStatementReport';

export interface EquityStatementDimension {
  additions: { total: number; accounts: Record<string, number> };
  deductions: { total: number; accounts: Record<string, number> };
  netProfit: number;
  totalChange: number;
}

export type EquityStatementReport = Record<IncomeStatementMetric, EquityStatementDimension>;

const buildDimension = (
  entries: Entry[],
  accounts: Account[],
  metric: IncomeStatementMetric,
  netProfit: number,
): EquityStatementDimension => {
  let capitalAdditions = 0;
  const capitalAccounts: Record<string, number> = {};
  let drawings = 0;
  const drawingsAccounts: Record<string, number> = {};

  entries.forEach(entry => {
    const value = getMetricValue(entry, metric, accounts);
    if (value === 0) return;
    const debitDetails = getAccountTypeDetails(entry.debit, accounts);
    const creditDetails = getAccountTypeDetails(entry.credit, accounts);

    if (creditDetails.main === 'equity' && belongsToMetric(entry.credit, metric, accounts)) {
      capitalAdditions += value;
      capitalAccounts[entry.credit] = (capitalAccounts[entry.credit] || 0) + value;
    }
    if (debitDetails.main === 'equity' && belongsToMetric(entry.debit, metric, accounts)) {
      drawings += value;
      drawingsAccounts[entry.debit] = (drawingsAccounts[entry.debit] || 0) + value;
    }
  });

  return {
    additions: { total: capitalAdditions, accounts: capitalAccounts },
    deductions: { total: drawings, accounts: drawingsAccounts },
    netProfit,
    totalChange: (capitalAdditions - drawings) + netProfit,
  };
};

export const buildEquityStatementReport = (
  entries: Entry[],
  accounts: Account[],
  incomeStatement: IncomeStatementReport,
): EquityStatementReport => ({
  cash: buildDimension(entries, accounts, 'cash', incomeStatement.cash.net),
  gold: buildDimension(entries, accounts, 'gold', incomeStatement.gold.net),
  silver: buildDimension(entries, accounts, 'silver', incomeStatement.silver.net),
  accs: buildDimension(entries, accounts, 'accs', incomeStatement.accs.net),
});