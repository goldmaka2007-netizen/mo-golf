import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';
import { buildLegacyLedgerLegs, type LegacyLedgerLeg } from './legacyLedger';
import type { InventoryCostKind, InventoryCostTimeline } from './inventoryCostTypes';

export interface FinancialStatementLine { id: string; label: string; amount: number; }
export type StatementDimensionKind = 'gold' | 'silver' | 'accessory' | 'cash';
export interface QuantifiedFinancialStatementLine extends FinancialStatementLine {
  kind: StatementDimensionKind;
  weight: number | null;
  quantity: number | null;
  unitPrice: number | null;
  unitPriceLabel: string | null;
}
export interface FinancialStatementCategory {
  id: 'gold' | 'silver' | 'accessories' | 'other';
  label: string;
  lines: QuantifiedFinancialStatementLine[];
  amount: number;
  weight: number | null;
  quantity: number | null;
  unitPrice: number | null;
  unitPriceLabel: string | null;
}
export interface EgpIncomeStatement {
  revenue: FinancialStatementLine[];
  revenueCategories: FinancialStatementCategory[];
  revenueTotal: number;
  cogsLines: QuantifiedFinancialStatementLine[];
  cogsCategories: FinancialStatementCategory[];
  cogs: number;
  grossProfit: number;
  operatingExpenses: FinancialStatementLine[];
  operatingExpensesTotal: number;
  netProfit: number;
  soldWeight: { gold: number; silver: number };
  soldQuantity: { accessories: number };
}
export interface InventoryStatementRow {
  kind: InventoryCostKind;
  label: string;
  weight: number | null;
  quantity: number | null;
  bookValue: number;
  marketValue: number | null;
  unrealizedDifference: number | null;
  averageBookCost: number | null;
}
export interface InventoryCategorySummary { kind: InventoryCostKind; bookValue: number; weight: number | null; quantity: number | null; averageBookCost: number | null; }
export interface MerchantLiabilityStatementRow {
  id: string;
  label: string;
  metal: 'gold' | 'silver' | null;
  equivalent21Weight: number;
  silverWeight: number;
  bookValue: number;
  cashPayable: number;
  averageEgpPerGram: number | null;
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
  inventoryCategories: Record<InventoryCostKind, InventoryCategorySummary>;
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
const DISPLAY_DENOMINATOR_PRECISION = 0.001;
export const deriveUnitPrice = (value: number, denominator: number | null | undefined): number | null =>
  Number.isFinite(value) && Number.isFinite(denominator) && Math.abs(denominator as number) >= DISPLAY_DENOMINATOR_PRECISION
    ? roundMoney(value / (denominator as number))
    : null;
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
  const allPeriodLegs = allLegs.filter(leg => !leg.isOpening && inPeriod(leg.date, startDate, endDate));
  const period = allPeriodLegs.filter(financialLeg);
  const revenue = groupLines(period.filter(leg => leg.group === 'revenue'), 'credit');
  const expenseLegs = period.filter(leg => leg.group === 'expenses');
  const isCogs = (leg: LegacyLedgerLeg): boolean => leg.entityId.startsWith('system:income:cogs:') || leg.account.sourceAccount?.accountRole === 'cost_of_sales';
  const rawCogsLines = groupLines(expenseLegs.filter(isCogs), 'debit');
  const operatingExpenses = groupLines(expenseLegs.filter(leg => !isCogs(leg)), 'debit');

  const soldByInventory = new Map<string, { kind: InventoryCostKind; measure: number }>();
  (timeline?.valid ? timeline.results : [])
    .filter(result => result.classification === 'sale' && inPeriod(result.entry.date, startDate, endDate))
    .forEach(result => {
      const inventoryId = result.sourceInventoryAccountId || result.inventoryAccountId;
      const state = inventoryId ? timeline?.finalStates[inventoryId] : undefined;
      if (!inventoryId || !state) return;
      const measure = state.kind === 'accessory'
        ? (result.outgoingAccessoryQuantityUnits ?? 0) / 1000
        : (result.outgoingActualPhysicalWeightUnits ?? 0) / 100;
      const current = soldByInventory.get(inventoryId);
      soldByInventory.set(inventoryId, { kind: state.kind, measure: (current?.measure ?? 0) + measure });
    });

  const quantify = (lines: FinancialStatementLine[], role: 'sales' | 'cogs'): QuantifiedFinancialStatementLine[] =>
    lines.map(line => {
      const entityLegs = allPeriodLegs.filter(leg => leg.entityId === line.id);
      const account = entityLegs.find(leg => leg.account.sourceAccount)?.account.sourceAccount;
      const inventoryId = account?.linkedInventoryAccountId;
      const sold = inventoryId ? soldByInventory.get(inventoryId) : undefined;
      const fallbackLeg = entityLegs.find(leg => ['gold', 'silver', 'quantity'].includes(leg.dimension));
      const fallbackMeasure = fallbackLeg
        ? Math.abs(entityLegs.filter(leg => leg.dimension === fallbackLeg.dimension).reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0))
        : 0;
      const kind: StatementDimensionKind = sold?.kind
        ?? (fallbackLeg?.dimension === 'gold' ? 'gold' : fallbackLeg?.dimension === 'silver' ? 'silver' : fallbackLeg?.dimension === 'quantity' ? 'accessory' : 'cash');
      const measure = sold?.measure ?? fallbackMeasure;
      const weight = kind === 'gold' || kind === 'silver' ? measure : null;
      const quantity = kind === 'accessory' ? measure : null;
      const denominator = weight ?? quantity;
      const unitPriceLabel = kind === 'cash'
        ? null
        : role === 'sales'
          ? (kind === 'accessory' ? '\u0645\u062a\u0648\u0633\u0637 \u0633\u0639\u0631 \u0628\u064a\u0639 \u0627\u0644\u0642\u0637\u0639\u0629' : '\u0645\u062a\u0648\u0633\u0637 \u0633\u0639\u0631 \u0628\u064a\u0639 \u0627\u0644\u062c\u0631\u0627\u0645')
          : (kind === 'accessory' ? '\u0645\u062a\u0648\u0633\u0637 \u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0642\u0637\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629' : '\u0645\u062a\u0648\u0633\u0637 \u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062c\u0631\u0627\u0645 \u0627\u0644\u0645\u0628\u0627\u0639');
      return { ...line, kind, weight, quantity, unitPrice: deriveUnitPrice(line.amount, denominator), unitPriceLabel };
    });

  const revenueLines = quantify(revenue, 'sales');
  const cogsLines = quantify(rawCogsLines, 'cogs');
  const categories = (
    lines: QuantifiedFinancialStatementLine[],
    labels: Array<{ id: FinancialStatementCategory['id']; label: string }>,
  ): FinancialStatementCategory[] => labels.map(({ id, label }) => {
    const matching = lines.filter(line =>
      id === 'gold' ? line.kind === 'gold'
        : id === 'silver' ? line.kind === 'silver'
          : id === 'accessories' ? line.kind === 'accessory'
            : line.kind === 'cash');
    const amount = roundMoney(matching.reduce((sum, line) => sum + line.amount, 0));
    const weight = id === 'gold' || id === 'silver' ? matching.reduce((sum, line) => sum + (line.weight ?? 0), 0) : null;
    const quantity = id === 'accessories' ? matching.reduce((sum, line) => sum + (line.quantity ?? 0), 0) : null;
    const denominator = weight ?? quantity;
    return {
      id, label, lines: matching, amount, weight, quantity,
      unitPrice: deriveUnitPrice(amount, denominator),
      unitPriceLabel: matching.find(line => line.unitPriceLabel)?.unitPriceLabel ?? null,
    };
  });
  const revenueCategories = categories(revenueLines, [
    { id: 'gold', label: '\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0630\u0647\u0628' },
    { id: 'silver', label: '\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0641\u0636\u0629' },
    { id: 'accessories', label: '\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0645\u0644\u062d\u0642\u0627\u062a' },
    { id: 'other', label: '\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0623\u062e\u0631\u0649' },
  ]);
  const cogsCategories = categories(cogsLines, [
    { id: 'gold', label: '\u062a\u0643\u0644\u0641\u0629 \u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0630\u0647\u0628' },
    { id: 'silver', label: '\u062a\u0643\u0644\u0641\u0629 \u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0641\u0636\u0629' },
    { id: 'accessories', label: '\u062a\u0643\u0644\u0641\u0629 \u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0645\u0644\u062d\u0642\u0627\u062a' },
  ]);
  const revenueTotal = roundMoney(revenue.reduce((sum, line) => sum + line.amount, 0));
  const cogs = roundMoney(rawCogsLines.reduce((sum, line) => sum + line.amount, 0));
  const operatingExpensesTotal = roundMoney(operatingExpenses.reduce((sum, line) => sum + line.amount, 0));
  const soldWeight = {
    gold: revenueCategories.find(category => category.id === 'gold')?.weight ?? 0,
    silver: revenueCategories.find(category => category.id === 'silver')?.weight ?? 0,
  };
  const soldQuantity = { accessories: revenueCategories.find(category => category.id === 'accessories')?.quantity ?? 0 };
  const grossProfit = roundMoney(revenueTotal - cogs);
  return { revenue, revenueCategories, revenueTotal, cogsLines, cogsCategories, cogs, grossProfit, operatingExpenses, operatingExpensesTotal, netProfit: roundMoney(grossProfit - operatingExpensesTotal), soldWeight, soldQuantity };
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
          averageEgpPerGram: deriveUnitPrice(Math.max(0, -(bookBalances.get(entityId)?.balance ?? 0)), metal === 'gold' ? Math.max(0, -(goldBalances.get(entityId)?.balance ?? 0)) : metal === 'silver' ? Math.max(0, -(silverBalances.get(entityId)?.balance ?? 0)) : null),
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
    const weight = state.kind === 'accessory' ? null : (state.actualPhysicalWeightUnits ?? state.standardizedQuantityUnits) / 100;
    const quantity = state.kind === 'accessory' ? state.accessoryQuantityUnits / 1000 : null;
    const entityId = `product:${state.inventoryAccountId}`;
    const bookValue = roundMoney(bookBalances.get(entityId)?.balance ?? state.remainingTotalCostMinor / 100);
    const marketPrice = state.kind === 'gold' ? options.goldPriceEgp : state.kind === 'silver' ? options.silverPriceEgp : null;
    const marketValue = weight !== null && marketPrice !== null && marketPrice !== undefined && Number.isFinite(marketPrice) ? roundMoney(weight * marketPrice) : null;
    return { kind: state.kind, label: state.displayName, weight, quantity, bookValue, marketValue, unrealizedDifference: marketValue === null ? null : roundMoney(marketValue - bookValue), averageBookCost: deriveUnitPrice(bookValue, weight ?? quantity) };
  });
  const inventoryTotal = (kind: InventoryCostKind): number => roundMoney(inventory.filter(row => row.kind === kind).reduce((sum, row) => sum + row.bookValue, 0));
  const goldInventory = inventoryTotal('gold'); const silverInventory = inventoryTotal('silver'); const accessoriesInventory = inventoryTotal('accessory');

  const fiscalYear = (options.balanceEndDate || balanceEntries.map(entry => entry.date).sort().at(-1) || '').slice(0, 4);
  const inventorySummary = (kind: InventoryCostKind): InventoryCategorySummary => {
    const rows = inventory.filter(row => row.kind === kind);
    const bookValue = roundMoney(rows.reduce((sum, row) => sum + row.bookValue, 0));
    const weight = kind === 'accessory' ? null : rows.reduce((sum, row) => sum + (row.weight ?? 0), 0);
    const quantity = kind === 'accessory' ? rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0) : null;
    return { kind, bookValue, weight, quantity, averageBookCost: deriveUnitPrice(bookValue, weight ?? quantity) };
  };
  const inventoryCategories = { gold: inventorySummary('gold'), silver: inventorySummary('silver'), accessory: inventorySummary('accessory') };
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
  return { incomeStatement: currentIncome, balanceSheet: { assets, liabilities, equity, inventory, inventoryCategories, balances: { assetsLessLiabilitiesAndEquity: roundMoney(assets.total - liabilities.total - equity.total) } }, costBasisAvailable: !!timeline };
};
