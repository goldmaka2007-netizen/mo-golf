import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import type { LedgerDimension } from './ledgerReport';
import { buildTrialBalanceReport, type TrialBalanceReport, type TrialBalanceRow } from './trialBalanceReport';

export interface IncomeStatementLine {
  entityId: string;
  accountName: string;
  amount: number;
}

export interface IncomeStatementReport {
  startDate: string;
  endDate: string;
  trialBalance: TrialBalanceReport;
  revenue: { total: number; lines: IncomeStatementLine[] };
  cogs: { total: number; lines: IncomeStatementLine[]; status: 'available' | 'missing_cost_timeline' };
  grossProfit: number | null;
  operatingExpenses: { total: number; lines: IncomeStatementLine[] };
  operatingProfit: number | null;
}

const COGS_ENTITY_ID = 'system:income:cogs';
const amountFromCreditNormalRow = (row: TrialBalanceRow): number => row.periodCredit - row.periodDebit;
const amountFromDebitNormalRow = (row: TrialBalanceRow): number => row.periodDebit - row.periodCredit;
const positiveLine = (row: TrialBalanceRow, amount: number): IncomeStatementLine | null =>
  amount > 0 ? { entityId: row.entityId, accountName: row.accountName, amount } : null;

export const buildIncomeStatementReport = (
  entries: Entry[],
  accounts: Account[],
  startDate: string,
  endDate: string,
  canonicalDefinitions: CanonicalAccountDefinition[] = [],
  costTimeline?: InventoryCostTimeline | null,
  dimension: LedgerDimension = 'cash',
): IncomeStatementReport => {
  const trialBalance = buildTrialBalanceReport(entries, accounts, dimension, startDate, endDate, canonicalDefinitions, {
    enableFinancialProjection: true,
    costTimeline,
  });
  const revenueRows = trialBalance.groups.find(group => group.id === 'revenue')?.rows ?? [];
  const expenseRows = trialBalance.groups.find(group => group.id === 'expenses')?.rows ?? [];
  const revenueLines = revenueRows.flatMap(row => {
    const line = positiveLine(row, amountFromCreditNormalRow(row));
    return line ? [line] : [];
  });
  const cogsLines = expenseRows.flatMap(row => {
    if (row.entityId !== COGS_ENTITY_ID) return [];
    const line = positiveLine(row, amountFromDebitNormalRow(row));
    return line ? [line] : [];
  });
  const operatingExpenseLines = expenseRows.flatMap(row => {
    if (row.entityId === COGS_ENTITY_ID) return [];
    const line = positiveLine(row, amountFromDebitNormalRow(row));
    return line ? [line] : [];
  });
  const revenueTotal = revenueLines.reduce((sum, line) => sum + line.amount, 0);
  const cogsTotal = cogsLines.reduce((sum, line) => sum + line.amount, 0);
  const operatingExpenseTotal = operatingExpenseLines.reduce((sum, line) => sum + line.amount, 0);
  const cogsStatus = dimension === 'cash' && !costTimeline?.valid ? 'missing_cost_timeline' : 'available';
  const grossProfit = cogsStatus === 'available' ? revenueTotal - cogsTotal : null;
  const operatingProfit = grossProfit === null ? null : grossProfit - operatingExpenseTotal;
  return {
    startDate,
    endDate,
    trialBalance,
    revenue: { total: revenueTotal, lines: revenueLines },
    cogs: { total: cogsTotal, lines: cogsLines, status: cogsStatus },
    grossProfit,
    operatingExpenses: { total: operatingExpenseTotal, lines: operatingExpenseLines },
    operatingProfit,
  };
};