import type { Account, AnnualOpeningCostConfig, CanonicalAccountDefinition, Entry } from '../types';
import { buildLegacyLedgerLegs } from './legacyLedger';
import { buildOpeningCostConfig } from './openingCostConfig';
import { historicalOverlaysForCutoff, buildMonthlyFinancialPosition, type MonthlyFinancialPositionResult } from './monthlyFinancialPosition';
import { rebuildRuntimeInventoryCostTimeline } from './costRecalculation';

export interface EquityMovementDetail { id: string; label: string; amount: number; accountId?: string; }
export interface EquityStatementEgp {
  openingEquity: number;
  openingDetails: EquityMovementDetail[];
  capitalAdditions: EquityMovementDetail[];
  drawings: EquityMovementDetail[];
  directMovements: EquityMovementDetail[];
  currentYtdProfit: number;
  currentProfitDetails: EquityMovementDetail[];
  endingEquity: number;
  endingDetails: EquityMovementDetail[];
  ownership: { netGoldOwnership21: number; netSilverOwnershipGrams: number };
  reconciliationDifference: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (rows: readonly EquityMovementDetail[]) => roundMoney(rows.reduce((total, row) => total + row.amount, 0));
const aggregate = (rows: readonly EquityMovementDetail[]) => [...rows.reduce((map, row) => {
  const prior = map.get(row.id) ?? { ...row, amount: 0 };
  prior.amount += row.amount;
  map.set(row.id, prior);
  return map;
}, new Map<string, EquityMovementDetail>()).values()].map(row => ({ ...row, amount: roundMoney(row.amount) })).filter(row => Math.abs(row.amount) > 0.004);

export type EquityStatementEgpResult = { available: true; report: EquityStatementEgp } | { available: false; diagnostic: string };

/** EGP-only roll-forward over the same runtime Financial Position/WAC projection. */
export const buildEquityStatementEgp = (args: {
  entries: Entry[]; accounts: Account[]; canonicalDefinitions: CanonicalAccountDefinition[];
  openingCostConfig: AnnualOpeningCostConfig[]; cutoffDate: string; goldPriceEgp?: number | null; silverPriceEgp?: number | null;
}): EquityStatementEgpResult => {
  const ending = buildMonthlyFinancialPosition(args);
  if ('diagnostic' in ending) return { available: false, diagnostic: ending.diagnostic.message };
  const year = args.cutoffDate.slice(0, 4);
  const opening = buildMonthlyFinancialPosition({ ...args, cutoffDate: `${Number(year) - 1}-12-31` });
  if ('diagnostic' in opening) return { available: false, diagnostic: opening.diagnostic.message };
  const yearStart = `${year}-01-01`;
  const cutoffEntries = args.entries.filter(entry => entry.date <= args.cutoffDate);
  const timeline = rebuildRuntimeInventoryCostTimeline(cutoffEntries, args.accounts, buildOpeningCostConfig(args.openingCostConfig, args.accounts), {
    historicalInventoryOverlayDirectives: historicalOverlaysForCutoff(cutoffEntries, args.accounts, args.cutoffDate),
  });
  if (!timeline.valid) return { available: false, diagnostic: timeline.diagnostics[0]?.message ?? 'تعذر بناء Cost Timeline صالح.' };
  const movements = buildLegacyLedgerLegs(cutoffEntries, args.accounts, args.canonicalDefinitions, { enableFinancialProjection: true, costTimeline: timeline })
    .filter(leg => leg.dimension === 'cash' && leg.group === 'equity' && !leg.isOpening && leg.date >= yearStart && leg.date <= args.cutoffDate)
    .map(leg => ({ id: leg.entityId, label: leg.accountName, accountId: leg.accountId, amount: leg.side === 'credit' ? leg.amount : -leg.amount, subType: leg.account.sourceAccount?.canonicalSubType }));
  const capitalAdditions = aggregate(movements.filter(row => row.subType === 'capital'));
  const drawings = aggregate(movements.filter(row => row.subType === 'withdrawals'));
  const directMovements = aggregate(movements.filter(row => row.subType !== 'capital' && row.subType !== 'withdrawals').map(({ id, label, accountId, amount }) => ({ id, label, accountId, amount })));
  const openingDetails = [...opening.balanceSheet.equity.capitalDetails, ...opening.balanceSheet.equity.retainedEarningsDetails].map(row => ({ id: row.id, label: row.label, accountId: row.accountId, amount: row.amount }));
  const endingDetails = [...ending.balanceSheet.equity.capitalDetails, ...ending.balanceSheet.equity.retainedEarningsDetails].map(row => ({ id: row.id, label: row.label, accountId: row.accountId, amount: row.amount }));
  const currentProfitDetails = ending.balanceSheet.equity.currentProfitDetails.map(row => ({ id: row.id, label: row.label, accountId: row.accountId, amount: row.amount }));
  const reconciliationDifference = roundMoney(ending.balanceSheet.equity.total - (opening.balanceSheet.equity.total + sum(capitalAdditions) + sum(drawings) + sum(directMovements) + ending.incomeStatement.netProfit));
  if (Math.abs(reconciliationDifference) > 0.004) return { available: false, diagnostic: `فشل تطابق Equity roll-forward: فرق ${reconciliationDifference.toFixed(2)} ج.م.` };
  return { available: true, report: {
    openingEquity: opening.balanceSheet.equity.total, openingDetails, capitalAdditions, drawings, directMovements,
    currentYtdProfit: ending.incomeStatement.netProfit, currentProfitDetails,
    endingEquity: ending.balanceSheet.equity.total, endingDetails,
    ownership: { netGoldOwnership21: ending.ownership.netGoldOwnership21, netSilverOwnershipGrams: ending.ownership.netSilverOwnershipGrams }, reconciliationDifference,
  } };
};
