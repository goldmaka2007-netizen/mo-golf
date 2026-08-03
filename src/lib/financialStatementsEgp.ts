import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';
import { buildLegacyLedgerLegs, type LegacyLedgerLeg } from './legacyLedger';
import type { InventoryCostKind, InventoryCostTimeline } from './inventoryCostTypes';

export interface FinancialStatementLine { id: string; label: string; amount: number; }
export interface EgpIncomeStatement {
  revenue: FinancialStatementLine[];
  revenueTotal: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: FinancialStatementLine[];
  operatingExpensesTotal: number;
  netProfit: number;
  soldWeight: { gold: number; silver: number };
}
export interface InventoryStatementRow {
  kind: InventoryCostKind;
  label: string;
  weight: number | null;
  quantity: number | null;
  bookValue: number;
  marketValue: number | null;
  unrealizedDifference: number | null;
}
export interface MerchantLiabilityStatementRow {
  id: string;
  label: string;
  metal: 'gold' | 'silver' | null;
  equivalent21Weight: number;
  silverWeight: number;
  bookValue: number;
  cashPayable: number;
}
export interface EgpBalanceSheet {
  assets: { cash: number; goldInventory: number; silverInventory: number; accessoriesInventory: number; receivables: number; total: number };
  liabilities: {
    merchant: number;
    merchantGold: number;
    merchantSilver: number;
    merchantCash: number;
    other: number;
    total: number;
    merchantDetails: MerchantLiabilityStatementRow[];
  };
  equity: { capital: number; retainedEarnings: number; currentProfit: number; total: number };
  inventory: InventoryStatementRow[];
  balances: { assetsLessLiabilitiesAndEquity: number };
}
export interface FinancialStatementsEgp { incomeStatement: EgpIncomeStatement; balanceSheet: EgpBalanceSheet; costBasisAvailable: boolean; }
export interface BuildFinancialStatementsEgpOptions {
  canonicalDefinitions?: CanonicalAccountDefinition[];
  timeline?: InventoryCostTimeline | null;
  goldPriceEgp?: number | null;
  silverPriceEgp?: number | null;
  incomeStartDate?: string;
  incomeEndDate?: string;
  balanceEndDate?: string;
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const inPeriod = (date: string, start?: string, end?: string): boolean => (!start || date >= start) && (!end || date <= end);
const previousDate = (date: string): string => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10); };
const financialLeg = (leg: LegacyLedgerLeg): boolean => leg.dimension === 'cash' || leg.dimension === 'book_value';
const groupLines = (legs: LegacyLedgerLeg[], normal: 'debit' | 'credit'): FinancialStatementLine[] => {
  const grouped = new Map<string, FinancialStatementLine>();
  legs.forEach(leg => {
    const row = grouped.get(leg.entityId) ?? { id: leg.entityId, label: leg.accountName, amount: 0 };
    row.amount += leg.side === normal ? leg.amount : -leg.amount;
    grouped.set(leg.entityId, row);
  });
  return [...grouped.values()].map(row => ({ ...row, amount: roundMoney(row.amount) })).filter(row => row.amount > 0.0001).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

const buildIncomeFromProjection = (
  allLegs: LegacyLedgerLeg[],
  timeline: InventoryCostTimeline | null,
  startDate?: string,
  endDate?: string,
): EgpIncomeStatement => {
  const period = allLegs.filter(leg => financialLeg(leg) && !leg.isOpening && inPeriod(leg.date, startDate, endDate));
  const revenue = groupLines(period.filter(leg => leg.group === 'revenue'), 'credit');
  const expenseLines = groupLines(period.filter(leg => leg.group === 'expenses'), 'debit');
  const cogsLines = expenseLines.filter(line => line.id.startsWith('system:income:cogs:'));
  const operatingExpenses = expenseLines.filter(line => !line.id.startsWith('system:income:cogs:'));
  const revenueTotal = roundMoney(revenue.reduce((sum, line) => sum + line.amount, 0));
  const cogs = roundMoney(cogsLines.reduce((sum, line) => sum + line.amount, 0));
  const operatingExpensesTotal = roundMoney(operatingExpenses.reduce((sum, line) => sum + line.amount, 0));
  const soldWeight = (timeline?.valid ? timeline.results : []).filter(result => result.classification === 'sale' && inPeriod(result.entry.date, startDate, endDate)).reduce((total, result) => {
    const state = timeline?.finalStates[result.sourceInventoryAccountId || result.inventoryAccountId || ''];
    if (state?.kind === 'gold') total.gold += (result.outgoingStandardizedQuantityUnits ?? result.outgoingActualPhysicalWeightUnits ?? 0) / 100;
    if (state?.kind === 'silver') total.silver += (result.outgoingActualPhysicalWeightUnits ?? 0) / 100;
    return total;
  }, { gold: 0, silver: 0 });
  const grossProfit = roundMoney(revenueTotal - cogs);
  return { revenue, revenueTotal, cogs, grossProfit, operatingExpenses, operatingExpensesTotal, netProfit: roundMoney(grossProfit - operatingExpensesTotal), soldWeight };
};

const balanceMap = (legs: LegacyLedgerLeg[], dimension?: LegacyLedgerLeg['dimension']): Map<string, { balance: number; leg: LegacyLedgerLeg }> => {
  const rows = new Map<string, { balance: number; leg: LegacyLedgerLeg }>();
  legs.filter(leg => !dimension || leg.dimension === dimension).forEach(leg => {
    const row = rows.get(leg.entityId) ?? { balance: 0, leg };
    row.balance += leg.side === 'debit' ? leg.amount : -leg.amount;
    rows.set(leg.entityId, row);
  });
  return rows;
};

export const buildFinancialStatementsEgp = (entries: Entry[], rawAccounts: Account[], options: BuildFinancialStatementsEgpOptions = {}): FinancialStatementsEgp => {
  const accounts = rawAccounts.map(applyRuntimeAccountOverride);
  const canonicalDefinitions = options.canonicalDefinitions ?? [];
  const timeline = options.timeline?.valid ? options.timeline : null;
  const balanceEntries = entries.filter(entry => !options.balanceEndDate || entry.date <= options.balanceEndDate);
  const projectedLegs = buildLegacyLedgerLegs(balanceEntries, accounts, canonicalDefinitions, { enableFinancialProjection: true, costTimeline: timeline });
  const financialBalances = balanceMap(projectedLegs.filter(financialLeg));
  const cashBalances = balanceMap(projectedLegs, 'cash');
  const bookBalances = balanceMap(projectedLegs, 'book_value');
  const goldBalances = balanceMap(projectedLegs, 'gold');
  const silverBalances = balanceMap(projectedLegs, 'silver');

  let cash = 0; let receivables = 0; let rawCapital = 0; let rawRetainedEarnings = 0; let otherLiabilities = 0;
  const merchantRows = new Map<string, MerchantLiabilityStatementRow>();
  financialBalances.forEach(({ balance, leg }, entityId) => {
    const account = leg.account.sourceAccount;
    if (account?.is_inventory) return;
    if (leg.group === 'assets') {
      if (account?.type === 'cash') cash += balance; else receivables += balance;
      return;
    }
    if (leg.group === 'liabilities') {
      if (account?.type === 'merchant' || account?.metal === 'gold' || account?.metal === 'silver' || account?.canonicalSubType === 'merchant_gold' || account?.canonicalSubType === 'merchant_silver') {
        const metal = account.metal === 'silver' ? 'silver' : account.metal === 'gold' ? 'gold' : null;
        merchantRows.set(entityId, {
          id: entityId,
          label: leg.accountName,
          metal,
          equivalent21Weight: Math.max(0, -(goldBalances.get(entityId)?.balance ?? 0)),
          silverWeight: Math.max(0, -(silverBalances.get(entityId)?.balance ?? 0)),
          bookValue: Math.max(0, -(bookBalances.get(entityId)?.balance ?? 0)),
          cashPayable: Math.max(0, -(cashBalances.get(entityId)?.balance ?? 0)),
        });
      } else otherLiabilities += -balance;
      return;
    }
    if (leg.group === 'equity') {
      const value = -balance;
      if (account?.canonicalSubType === 'retained_earnings') rawRetainedEarnings += value; else rawCapital += value;
    }
  });

  const inventory = Object.values(timeline?.finalStates ?? {}).map((state): InventoryStatementRow => {
    const weight = state.kind === 'accessory' ? null : state.standardizedQuantityUnits / 100;
    const quantity = state.kind === 'accessory' ? state.accessoryQuantityUnits / 1000 : null;
    const entityId = `product:${state.inventoryAccountId}`;
    const bookValue = roundMoney(bookBalances.get(entityId)?.balance ?? state.remainingTotalCostMinor / 100);
    const marketPrice = state.kind === 'gold' ? options.goldPriceEgp : state.kind === 'silver' ? options.silverPriceEgp : null;
    const marketValue = weight !== null && marketPrice !== null && marketPrice !== undefined && Number.isFinite(marketPrice) ? roundMoney(weight * marketPrice) : null;
    return { kind: state.kind, label: state.displayName, weight, quantity, bookValue, marketValue, unrealizedDifference: marketValue === null ? null : roundMoney(marketValue - bookValue) };
  });
  const inventoryTotal = (kind: InventoryCostKind): number => roundMoney(inventory.filter(row => row.kind === kind).reduce((sum, row) => sum + row.bookValue, 0));
  const goldInventory = inventoryTotal('gold'); const silverInventory = inventoryTotal('silver'); const accessoriesInventory = inventoryTotal('accessory');

  const fiscalYear = (options.balanceEndDate || balanceEntries.map(entry => entry.date).sort().at(-1) || '').slice(0, 4);
  const currentStart = options.incomeStartDate ?? (fiscalYear ? `${fiscalYear}-01-01` : undefined);
  const currentEnd = options.incomeEndDate ?? options.balanceEndDate;
  const currentIncome = buildIncomeFromProjection(projectedLegs, timeline, currentStart, currentEnd);
  const priorIncome = currentStart ? buildIncomeFromProjection(projectedLegs, timeline, undefined, previousDate(currentStart)) : { netProfit: 0 };
  const capital = roundMoney(rawCapital); const retainedEarnings = roundMoney(rawRetainedEarnings + priorIncome.netProfit); const currentProfit = currentIncome.netProfit;
  const assets = { cash: roundMoney(cash), goldInventory, silverInventory, accessoriesInventory, receivables: roundMoney(receivables), total: 0 };
  assets.total = roundMoney(assets.cash + goldInventory + silverInventory + accessoriesInventory + assets.receivables);
  const details = [...merchantRows.values()].sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  const merchantGold = roundMoney(details.filter(row => row.metal === 'gold').reduce((sum, row) => sum + row.bookValue, 0));
  const merchantSilver = roundMoney(details.filter(row => row.metal === 'silver').reduce((sum, row) => sum + row.bookValue, 0));
  const merchantCash = roundMoney(details.reduce((sum, row) => sum + row.cashPayable, 0));
  const merchant = roundMoney(merchantGold + merchantSilver + merchantCash);
  const liabilities = { merchant, merchantGold, merchantSilver, merchantCash, other: roundMoney(otherLiabilities), total: roundMoney(merchant + otherLiabilities), merchantDetails: details };
  const equity = { capital, retainedEarnings, currentProfit, total: roundMoney(capital + retainedEarnings + currentProfit) };
  return { incomeStatement: currentIncome, balanceSheet: { assets, liabilities, equity, inventory, balances: { assetsLessLiabilitiesAndEquity: roundMoney(assets.total - liabilities.total - equity.total) } }, costBasisAvailable: !!timeline };
};
