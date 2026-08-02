import type { AccountBalanceResult, AccountBalancesResult } from './engine';
import type { IncomeStatementMetric, IncomeStatementReport } from './incomeStatementReport';

export interface EquityStatementDimension {
  additions: { total: number; accounts: Record<string, number> };
  deductions: { total: number; accounts: Record<string, number> };
  netProfit: number;
  totalChange: number;
}

export type EquityStatementReport = Record<IncomeStatementMetric, EquityStatementDimension>;

const valueFor = (balance: AccountBalanceResult, metric: IncomeStatementMetric): number => {
  if (metric === 'cash') return balance.cashBalance;
  if (metric === 'gold') return balance.goldE21Balance;
  if (metric === 'silver') return balance.silverBalance;
  return balance.quantityBalance;
};

const buildDimension = (
  computed: AccountBalancesResult,
  metric: IncomeStatementMetric,
  netProfit: number,
): EquityStatementDimension => {
  const additions: Record<string, number> = {};
  const deductions: Record<string, number> = {};
  computed.balances.forEach(balance => {
    if (balance.mainType !== 'equity') return;
    const value = valueFor(balance, metric);
    if (Math.abs(value) <= 1e-12) return;
    if (value > 0) additions[balance.accountName] = value;
    else deductions[balance.accountName] = Math.abs(value);
  });
  const additionTotal = Object.values(additions).reduce((total, value) => total + value, 0);
  const deductionTotal = Object.values(deductions).reduce((total, value) => total + value, 0);
  return {
    additions: { total: additionTotal, accounts: additions },
    deductions: { total: deductionTotal, accounts: deductions },
    netProfit,
    totalChange: additionTotal - deductionTotal + netProfit,
  };
};

/** Pure projection over computeAccountBalances(); JournalEntry[] is intentionally not accepted. */
export const buildEquityStatementReport = (
  computed: AccountBalancesResult,
  incomeStatement: IncomeStatementReport,
): EquityStatementReport => ({
  cash: buildDimension(computed, 'cash', incomeStatement.cash.net),
  gold: buildDimension(computed, 'gold', incomeStatement.gold.net),
  silver: buildDimension(computed, 'silver', incomeStatement.silver.net),
  accs: buildDimension(computed, 'accs', incomeStatement.accs.net),
});