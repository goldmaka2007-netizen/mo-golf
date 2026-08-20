import type { Account, AnnualOpeningCostConfig, CanonicalAccountDefinition, Entry } from '../types';
import { buildOpeningCostConfig } from './openingCostConfig';
import { getPhase5OperationId } from './inventoryCostEngine';
import { approvedHistoricalInventoryOverlaysForAccounts } from './historicalInventoryOverlay';
import { prepareRuntimeInventoryCostInputs, rebuildRuntimeInventoryCostTimeline } from './costRecalculation';
import { buildFinancialStatementsEgp, type FinancialStatementsEgp } from './financialStatementsEgp';
import type { HistoricalInventoryOverlayDirective, InventoryCostDiagnostic } from './inventoryCostTypes';

export const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const;
export interface FinancialPositionMonth { month: number; label: string; cutoffDate: string; }
export interface FinancialPositionMetalSummary { goldAssetWeight: number; silverAssetWeight: number; goldLiabilityWeight: number; silverLiabilityWeight: number; netGoldWeight: number; netSilverWeight: number; }

export const visibleFinancialPositionMonths = (entries: readonly Entry[], year: number): FinancialPositionMonth[] => {
  const latest = entries.filter(entry => entry.date?.slice(0, 4) === String(year)).map(entry => entry.date).sort().at(-1);
  if (!latest) return [];
  const latestMonth = Number(latest.slice(5, 7));
  return Array.from({ length: latestMonth }, (_, index) => ({
    month: index + 1, label: ARABIC_MONTHS[index],
    cutoffDate: index + 1 === latestMonth ? latest : new Date(Date.UTC(year, index + 2, 0)).toISOString().slice(0, 10),
  }));
};

/** Approved overlays restricted to operations that exist in this historical read dataset. */
export const historicalOverlaysForCutoff = (entries: readonly Entry[], accounts: Account[], cutoffDate: string): readonly HistoricalInventoryOverlayDirective[] => {
  const cutoffEntries = entries.filter(entry => entry.date <= cutoffDate);
  const operationIds = new Set(cutoffEntries.map(getPhase5OperationId));
  const prepared = prepareRuntimeInventoryCostInputs(cutoffEntries, accounts);
  return approvedHistoricalInventoryOverlaysForAccounts(prepared.accounts).filter(overlay =>
    overlay.effectiveDate <= cutoffDate && operationIds.has(overlay.sourceDeficitOperationId));
};

export type MonthlyFinancialPositionResult = (FinancialStatementsEgp & { available: true; metalSummary: FinancialPositionMetalSummary }) | { available: false; diagnostic: InventoryCostDiagnostic };

export interface FinancialPositionCsvRow extends Record<string, string | number | null> {
  section: string;
  account: string;
  bookValue: number | null;
  goldEquivalent21Weight: number | null;
  silverWeight: number | null;
  cash: number | null;
}
type FinancialPositionCsvValues = Pick<FinancialPositionCsvRow, 'bookValue' | 'goldEquivalent21Weight' | 'silverWeight' | 'cash'>;

/** One detailed CSV for one already-built cutoff.  Presentation-only: no balances are recalculated here. */
export const financialPositionCsvRows = (result: MonthlyFinancialPositionResult): FinancialPositionCsvRow[] | null => {
  if (!result.available) return null;
  const { balanceSheet: sheet, metalSummary } = result;
  const row = (section: string, account: string, values: FinancialPositionCsvValues): FinancialPositionCsvRow => ({ section, account, ...values });
  const blank = { bookValue: null, goldEquivalent21Weight: null, silverWeight: null, cash: null };
  return [
    row('summary', 'total assets', { ...blank, bookValue: sheet.assets.total, goldEquivalent21Weight: metalSummary.goldAssetWeight, silverWeight: metalSummary.silverAssetWeight }),
    row('summary', 'total liabilities', { ...blank, bookValue: sheet.liabilities.total, goldEquivalent21Weight: metalSummary.goldLiabilityWeight, silverWeight: metalSummary.silverLiabilityWeight }),
    row('summary', 'total equity', { ...blank, bookValue: sheet.equity.total, goldEquivalent21Weight: metalSummary.netGoldWeight, silverWeight: metalSummary.netSilverWeight }),
    row('summary', 'balance difference', { ...blank, bookValue: sheet.balances.assetsLessLiabilitiesAndEquity }),
    ...sheet.assets.cashDetails.map(item => row('asset:cash', item.label, { ...blank, cash: item.amount })),
    ...sheet.inventory.map(item => row(`asset:inventory:${item.kind}`, item.label, { ...blank, bookValue: item.bookValue, goldEquivalent21Weight: item.kind === 'gold' ? item.weight : null, silverWeight: item.kind === 'silver' ? item.weight : null })),
    ...sheet.assets.ordinaryReceivableDetails.map(item => row('asset:ordinary-receivable', item.label, { ...blank, bookValue: item.amount })),
    ...sheet.assets.merchantReceivableDetails.filter(item => item.metal === 'gold' && item.bookValue > 0).map(item => row('asset:merchant-gold-receivable', item.label, { ...blank, bookValue: item.bookValue, goldEquivalent21Weight: item.equivalent21Weight })),
    ...sheet.assets.merchantReceivableDetails.filter(item => item.metal === 'silver' && item.bookValue > 0).map(item => row('asset:merchant-silver-receivable', item.label, { ...blank, bookValue: item.bookValue, silverWeight: item.silverWeight })),
    ...sheet.assets.merchantReceivableDetails.filter(item => item.cashReceivable > 0).map(item => row('asset:merchant-cash-receivable', item.label, { ...blank, cash: item.cashReceivable })),
    ...sheet.liabilities.merchantDetails.filter(item => item.metal === 'gold' && item.bookValue > 0).map(item => row('liability:merchant-gold-payable', item.label, { ...blank, bookValue: item.bookValue, goldEquivalent21Weight: item.equivalent21Weight })),
    ...sheet.liabilities.merchantDetails.filter(item => item.metal === 'silver' && item.bookValue > 0).map(item => row('liability:merchant-silver-payable', item.label, { ...blank, bookValue: item.bookValue, silverWeight: item.silverWeight })),
    ...sheet.liabilities.merchantDetails.filter(item => item.cashPayable > 0).map(item => row('liability:merchant-cash-payable', item.label, { ...blank, cash: item.cashPayable })),
    ...sheet.liabilities.otherDetails.map(item => row('liability:other', item.label, { ...blank, bookValue: item.amount })),
    ...sheet.equity.capitalDetails.map(item => row('equity:capital', item.label, { ...blank, bookValue: item.amount })),
    ...sheet.equity.retainedEarningsDetails.map(item => row('equity:retained-earnings', item.label, { ...blank, bookValue: item.amount })),
    ...sheet.equity.currentProfitDetails.map(item => row('equity:current-profit', item.label, { ...blank, bookValue: item.amount })),
  ];
};
export const buildMonthlyFinancialPosition = (args: {
  entries: Entry[]; accounts: Account[]; canonicalDefinitions: CanonicalAccountDefinition[];
  openingCostConfig: AnnualOpeningCostConfig[]; cutoffDate: string; goldPriceEgp?: number | null; silverPriceEgp?: number | null;
}): MonthlyFinancialPositionResult => {
  const cutoffEntries = args.entries.filter(entry => entry.date <= args.cutoffDate);
  const timeline = rebuildRuntimeInventoryCostTimeline(cutoffEntries, args.accounts, buildOpeningCostConfig(args.openingCostConfig, args.accounts), {
    historicalInventoryOverlayDirectives: historicalOverlaysForCutoff(cutoffEntries, args.accounts, args.cutoffDate),
  });
  if (!timeline.valid) return { available: false, diagnostic: timeline.diagnostics[0] ?? { code: 'unknown_inventory_operation', message: 'تعذر بناء Cost Timeline صالح.' } };
  const statements = buildFinancialStatementsEgp(cutoffEntries, args.accounts, {
    canonicalDefinitions: args.canonicalDefinitions, timeline, goldPriceEgp: args.goldPriceEgp, silverPriceEgp: args.silverPriceEgp,
    balanceEndDate: args.cutoffDate, incomeStartDate: `${args.cutoffDate.slice(0, 4)}-01-01`, incomeEndDate: args.cutoffDate,
  });
  const goldAssetWeight = (statements.balanceSheet.inventoryCategories.gold.weight ?? 0) + statements.balanceSheet.assets.merchantReceivableDetails.filter(row => row.metal === 'gold' && row.bookValue > 0).reduce((sum, row) => sum + row.equivalent21Weight, 0);
  const silverAssetWeight = (statements.balanceSheet.inventoryCategories.silver.weight ?? 0) + statements.balanceSheet.assets.merchantReceivableDetails.filter(row => row.metal === 'silver' && row.bookValue > 0).reduce((sum, row) => sum + row.silverWeight, 0);
  const goldLiabilityWeight = statements.balanceSheet.liabilities.merchantDetails.filter(row => row.metal === 'gold' && row.bookValue > 0).reduce((sum, row) => sum + row.equivalent21Weight, 0);
  const silverLiabilityWeight = statements.balanceSheet.liabilities.merchantDetails.filter(row => row.metal === 'silver' && row.bookValue > 0).reduce((sum, row) => sum + row.silverWeight, 0);
  return { available: true, ...statements, metalSummary: { goldAssetWeight, silverAssetWeight, goldLiabilityWeight, silverLiabilityWeight, netGoldWeight: goldAssetWeight - goldLiabilityWeight, netSilverWeight: silverAssetWeight - silverLiabilityWeight } };
};
