import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { buildAccountRegistry } from './accountRegistry';
import { buildLegacyLedgerLegs, type LegacyLedgerLeg } from './legacyLedger';
import type { InventoryCostKind, InventoryCostTimeline } from './inventoryCostTypes';

export interface FinancialStatementLine {
  id: string;
  label: string;
  amount: number;
}

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

export interface EgpBalanceSheet {
  assets: {
    cash: number;
    goldInventory: number;
    silverInventory: number;
    accessoriesInventory: number;
    receivables: number;
    total: number;
  };
  liabilities: { merchant: number; other: number; total: number };
  equity: {
    capital: number;
    retainedEarnings: number;
    currentProfit: number;
    total: number;
  };
  inventory: InventoryStatementRow[];
  balances: { assetsLessLiabilitiesAndEquity: number };
}

export interface FinancialStatementsEgp {
  incomeStatement: EgpIncomeStatement;
  balanceSheet: EgpBalanceSheet;
  costBasisAvailable: boolean;
}

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
const operationId = (entry: Entry): string =>
  entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '');

const inPeriod = (date: string, start?: string, end?: string): boolean =>
  (!start || date >= start) && (!end || date <= end);

const previousDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};

const sumLines = (lines: FinancialStatementLine[]): number =>
  roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));

const aggregateLines = (legs: LegacyLedgerLeg[], side: 'debit' | 'credit'): FinancialStatementLine[] => {
  const amounts = new Map<string, FinancialStatementLine>();
  legs.filter(leg => leg.side === side).forEach(leg => {
    const existing = amounts.get(leg.entityId) ?? { id: leg.entityId, label: leg.accountName, amount: 0 };
    existing.amount += leg.amount;
    amounts.set(leg.entityId, existing);
  });
  return [...amounts.values()]
    .map(line => ({ ...line, amount: roundMoney(line.amount) }))
    .filter(line => Math.abs(line.amount) > 0.0001)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

const buildIncome = (
  entries: Entry[],
  accounts: Account[],
  canonicalDefinitions: CanonicalAccountDefinition[],
  timeline: InventoryCostTimeline | null | undefined,
  startDate?: string,
  endDate?: string,
): EgpIncomeStatement => {
  const periodEntries = entries.filter(entry => inPeriod(entry.date, startDate, endDate));
  const saleResults = (timeline?.valid ? timeline.results : []).filter(result =>
    result.classification === 'sale' && inPeriod(result.entry.date, startDate, endDate));
  const saleIds = new Set(saleResults.map(result => result.operationId || operationId(result.entry)));
  const adjustmentResults = (timeline?.valid ? timeline.results : []).filter(result =>
    inPeriod(result.entry.date, startDate, endDate)
    && (result.adjustmentGainMinor > 0 || result.adjustmentLossMinor > 0));
  const adjustmentIds = new Set(adjustmentResults.map(result => result.operationId || operationId(result.entry)));
  const rawLegs = buildLegacyLedgerLegs(periodEntries, accounts, canonicalDefinitions)
    .filter(leg => leg.dimension === 'cash');

  const explicitRevenue = aggregateLines(
    rawLegs.filter(leg => leg.group === 'revenue' && !saleIds.has(leg.sourceEntryId) && !adjustmentIds.has(leg.sourceEntryId)),
    'credit',
  );
  const salesRevenue = roundMoney(saleResults.reduce((sum, result) => sum + result.saleAmountMinor / 100, 0));
  const adjustmentGain = roundMoney(adjustmentResults.reduce((sum, result) => sum + result.adjustmentGainMinor / 100, 0));
  const revenue = [
    ...(salesRevenue > 0 ? [{ id: 'system:income:sales-revenue', label: 'إيراد المبيعات', amount: salesRevenue }] : []),
    ...(adjustmentGain > 0 ? [{ id: 'system:income:inventory-surplus-gain', label: 'مكاسب زيادة المخزون', amount: adjustmentGain }] : []),
    ...explicitRevenue,
  ];

  const cogs = roundMoney(saleResults.reduce((sum, result) => sum + result.totalCogsMinor / 100, 0));
  const rawOperatingExpenses = aggregateLines(
    rawLegs.filter(leg => leg.group === 'expenses' && !saleIds.has(leg.sourceEntryId) && !adjustmentIds.has(leg.sourceEntryId)),
    'debit',
  );
    const adjustmentLoss = roundMoney(adjustmentResults.reduce((sum, result) => sum + result.adjustmentLossMinor / 100, 0));
  const operatingExpenses = adjustmentLoss > 0
    ? [...rawOperatingExpenses, { id: 'system:income:inventory-shortage-loss', label: 'خسائر عجز المخزون', amount: adjustmentLoss }]
    : rawOperatingExpenses;
  const revenueTotal = sumLines(revenue);
  const operatingExpensesTotal = sumLines(operatingExpenses);
  const grossProfit = roundMoney(revenueTotal - cogs);

  const stateKinds = new Map(Object.values(timeline?.finalStates ?? {})
    .map(state => [state.inventoryAccountId, state.kind] as const));
  const soldWeight = saleResults.reduce((totals, result) => {
    const kind = stateKinds.get(result.sourceInventoryAccountId || result.inventoryAccountId || '');
    const weight = result.outgoingActualPhysicalWeightUnits / 100;
    if (kind === 'gold') totals.gold += weight;
    if (kind === 'silver') totals.silver += weight;
    return totals;
  }, { gold: 0, silver: 0 });

  return {
    revenue,
    revenueTotal,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingExpensesTotal,
    netProfit: roundMoney(grossProfit - operatingExpensesTotal),
    soldWeight,
  };
};

const closingBalances = (legs: LegacyLedgerLeg[]): Map<string, { balance: number; leg: LegacyLedgerLeg }> => {
  const balances = new Map<string, { balance: number; leg: LegacyLedgerLeg }>();
  legs.forEach(leg => {
    const row = balances.get(leg.entityId) ?? { balance: 0, leg };
    row.balance += leg.side === 'debit' ? leg.amount : -leg.amount;
    balances.set(leg.entityId, row);
  });
  return balances;
};

export const buildFinancialStatementsEgp = (
  entries: Entry[],
  accounts: Account[],
  options: BuildFinancialStatementsEgpOptions = {},
): FinancialStatementsEgp => {
  const canonicalDefinitions = options.canonicalDefinitions ?? [];
  const timeline = options.timeline?.valid ? options.timeline : null;
  const balanceEntries = entries.filter(entry => !options.balanceEndDate || entry.date <= options.balanceEndDate);
  const projectedLegs = buildLegacyLedgerLegs(balanceEntries, accounts, canonicalDefinitions, {
    enableFinancialProjection: true,
    costTimeline: timeline,
  }).filter(leg => leg.dimension === 'cash');
  const balances = closingBalances(projectedLegs);
  const registry = buildAccountRegistry(accounts, balanceEntries, canonicalDefinitions);

  let cash = 0;
  let receivables = 0;
  let merchantLiabilities = 0;
  let otherLiabilities = 0;
  let rawCapital = 0;
  let rawRetainedEarnings = 0;
  let projectedInventory = 0;

  balances.forEach(({ balance, leg }) => {
    const account = leg.account.sourceAccount;
    const resolution = registry.resolve(account?.id, leg.accountName);
    const entityType = resolution.status === 'resolved' ? resolution.account.entityType : null;
    if (account?.is_inventory || ['gold_inventory', 'silver_inventory', 'accessory_inventory'].includes(entityType ?? '')) {
      projectedInventory += balance;
      return;
    }
    if (leg.group === 'assets') {
      if (account?.type === 'cash' || entityType === 'cash') cash += balance;
      else receivables += balance;
      return;
    }
    if (leg.group === 'liabilities') {
      const value = -balance;
      if (account?.type === 'merchant' || entityType === 'merchant') merchantLiabilities += value;
      else otherLiabilities += value;
      return;
    }
    if (leg.group === 'equity') {
      const value = -balance;
      if (entityType === 'retained_earnings') rawRetainedEarnings += value;
      else rawCapital += value;
    }
  });

  const inventory = Object.values(timeline?.finalStates ?? {}).map((state): InventoryStatementRow => {
    const weight = state.kind === 'accessory' ? null : state.standardizedQuantityUnits / 100;
    const quantity = state.kind === 'accessory' ? state.accessoryQuantityUnits / 1000 : null;
    const bookValue = roundMoney(state.remainingTotalCostMinor / 100);
    const marketPrice = state.kind === 'gold' ? options.goldPriceEgp : state.kind === 'silver' ? options.silverPriceEgp : null;
    const marketValue = weight !== null && marketPrice !== null && marketPrice !== undefined && Number.isFinite(marketPrice)
      ? roundMoney(weight * marketPrice)
      : null;
    return {
      kind: state.kind,
      label: state.displayName,
      weight,
      quantity,
      bookValue,
      marketValue,
      unrealizedDifference: marketValue === null ? null : roundMoney(marketValue - bookValue),
    };
  });
  const inventoryTotal = (kind: InventoryCostKind): number =>
    roundMoney(inventory.filter(row => row.kind === kind).reduce((sum, row) => sum + row.bookValue, 0));
  const goldInventory = inventoryTotal('gold');
  const silverInventory = inventoryTotal('silver');
  const accessoriesInventory = inventoryTotal('accessory');
  const totalInventoryBook = goldInventory + silverInventory + accessoriesInventory;

  const fiscalYear = (options.balanceEndDate || balanceEntries.map(entry => entry.date).sort().at(-1) || '').slice(0, 4);
  const currentStart = options.incomeStartDate ?? (fiscalYear ? `${fiscalYear}-01-01` : undefined);
  const currentEnd = options.incomeEndDate ?? options.balanceEndDate;
  const currentIncome = buildIncome(entries, accounts, canonicalDefinitions, timeline, currentStart, currentEnd);
  const priorIncome = currentStart
    ? buildIncome(entries, accounts, canonicalDefinitions, timeline, undefined, previousDate(currentStart))
    : { netProfit: 0 };
  // The cost engine supplies opening inventory book value without changing old
  // journal rows. This report-only bridge puts that historical book basis in
  // capital; market values never enter this reconciliation.
  const openingBookValueBridge = timeline ? roundMoney(
    timeline.results
      .filter(result => result.classification === 'opening')
      .reduce((sum, result) => sum + result.incomingTotalCostMinor / 100, 0)
    + (timeline.historicalInventoryOverlays ?? []).reduce((sum, overlay) => sum + overlay.totalCostMinor / 100, 0),
  ) : 0;
  const capital = roundMoney(rawCapital + openingBookValueBridge);
  const retainedEarnings = roundMoney(rawRetainedEarnings + priorIncome.netProfit);
  const currentProfit = currentIncome.netProfit;

  const assets = {
    cash: roundMoney(cash),
    goldInventory,
    silverInventory,
    accessoriesInventory,
    receivables: roundMoney(receivables),
    total: 0,
  };
  assets.total = roundMoney(assets.cash + goldInventory + silverInventory + accessoriesInventory + assets.receivables);
  const liabilities = {
    merchant: roundMoney(merchantLiabilities),
    other: roundMoney(otherLiabilities),
    total: roundMoney(merchantLiabilities + otherLiabilities),
  };
  const equity = {
    capital,
    retainedEarnings,
    currentProfit,
    total: roundMoney(capital + retainedEarnings + currentProfit),
  };

  return {
    incomeStatement: currentIncome,
    balanceSheet: {
      assets,
      liabilities,
      equity,
      inventory,
      balances: { assetsLessLiabilitiesAndEquity: roundMoney(assets.total - liabilities.total - equity.total) },
    },
    costBasisAvailable: !!timeline,
  };
};
