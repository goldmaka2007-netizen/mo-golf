import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';
import { buildLegacyLedgerLegs, type LegacyLedgerLeg } from './legacyLedger';
import type { InventoryCostKind, InventoryCostTimeline } from './inventoryCostTypes';
import { buildAccountRegistry } from './accountRegistry';
import { getEntryArabicWeight } from './engine';
import { buildMerchantGoldLiabilityTimeline, type MerchantGoldLiabilityDiagnostic } from './merchantGoldLiability';

export interface FinancialStatementLine { id: string; label: string; amount: number; }
export type StatementDimensionKind = 'gold' | 'silver' | 'accessory' | 'cash';
export interface QuantifiedFinancialStatementLine extends FinancialStatementLine {
  accountId?: string;
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
  accountId: string;
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
  accountId: string;
  label: string;
  metal: 'gold' | 'silver' | null;
  equivalent21Weight: number;
  silverWeight: number;
  bookValue: number;
  cashPayable: number;
  cashReceivable: number;
  averageEgpPerGram: number | null;
  positionSide: 'payable' | 'receivable' | 'settled';
}
export interface ReconciliationWarning {
  code: 'merchant_metal_zero_weight_book_value';
  accountId: string;
  accountName: string;
  goldBalance: number;
  bookValueBalance: number;
}
export interface FinancialPositionDetailRow extends FinancialStatementLine { accountId?: string; }
export interface EgpBalanceSheet {
  assets: {
    cash: number;
    goldInventory: number;
    silverInventory: number;
    accessoriesInventory: number;
    receivables: number;
    ordinaryReceivables: number;
    merchantCashReceivables: number;
    merchantMetalReceivables: number;
    merchantGoldReceivables: number;
    merchantSilverReceivables: number;
    merchantReceivableDetails: MerchantLiabilityStatementRow[];
    cashDetails: FinancialPositionDetailRow[];
    ordinaryReceivableDetails: FinancialPositionDetailRow[];
    total: number;
  };
  liabilities: {
    merchant: number;
    merchantGold: number;
    merchantSilver: number;
    merchantCash: number;
    other: number;
    total: number;
    merchantDetails: MerchantLiabilityStatementRow[];
    otherDetails: FinancialPositionDetailRow[];
  };
  equity: { capital: number; retainedEarnings: number; currentProfit: number; total: number; capitalDetails: FinancialPositionDetailRow[]; retainedEarningsDetails: FinancialPositionDetailRow[]; currentProfitDetails: FinancialPositionDetailRow[] };
  inventory: InventoryStatementRow[];
  inventoryCategories: Record<InventoryCostKind, InventoryCategorySummary>;
  balances: { assetsLessLiabilitiesAndEquity: number };
  reconciliationWarnings: ReconciliationWarning[];
}
export interface FinancialStatementsEgp {
  incomeStatement: EgpIncomeStatement;
  balanceSheet: EgpBalanceSheet;
  costBasisAvailable: boolean;
  merchantLiabilityDiagnostics: MerchantGoldLiabilityDiagnostic[];
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
  accounts: Account[],
  timeline: InventoryCostTimeline | null,
  startDate?: string,
  endDate?: string,
): EgpIncomeStatement => {
  const allPeriodLegs = allLegs.filter(leg => !leg.isOpening && inPeriod(leg.date, startDate, endDate));
  const period = allPeriodLegs.filter(financialLeg);
  const revenueLegs = period.filter(leg => leg.group === 'revenue');
  const expenseLegs = period.filter(leg => leg.group === 'expenses');
  const isCogs = (leg: LegacyLedgerLeg): boolean =>
    leg.entityId.startsWith('system:income:cogs:')
    || leg.account.sourceAccount?.accountRole === 'cost_of_sales';
  const cogsLedgerLegs = expenseLegs.filter(isCogs);
  const operatingExpenses = groupLines(expenseLegs.filter(leg => !isCogs(leg)), 'debit');

  const saleResults = (timeline?.valid ? timeline.results : [])
    .filter(result => result.classification === 'sale' && inPeriod(result.entry.date, startDate, endDate));
  const saleByOperationId = new Map(saleResults.map(result => [
    result.operationId || result.entry.id || String(result.entry.seq ?? ''),
    result,
  ]));
  const measureFor = (result: typeof saleResults[number], kind: InventoryCostKind): number =>
    kind === 'accessory'
      ? (result.outgoingAccessoryQuantityUnits ?? 0) / 1000
      : kind === 'gold'
        ? (result.outgoingStandardizedQuantityUnits ?? 0) > 0
          ? (result.outgoingStandardizedQuantityUnits ?? 0) / 100
          : getEntryArabicWeight(
            result.entry,
            accounts.find(account => account.id === (result.sourceInventoryAccountId || result.inventoryAccountId)),
          )
        : (result.outgoingActualPhysicalWeightUnits ?? 0) / 100;
  const soldByInventory = new Map<string, { kind: InventoryCostKind; measure: number }>();
  saleResults.forEach(result => {
    const inventoryId = result.sourceInventoryAccountId || result.inventoryAccountId;
    const state = inventoryId ? timeline?.finalStates[inventoryId] : undefined;
    if (!inventoryId || !state) return;
    const current = soldByInventory.get(inventoryId);
    soldByInventory.set(inventoryId, {
      kind: state.kind,
      measure: (current?.measure ?? 0) + measureFor(result, state.kind),
    });
  });

  interface QuantifiedGroup {
    entityId: string;
    label: string;
    amount: number;
    account?: Account;
    inventoryId?: string;
    kind: StatementDimensionKind;
    operationIds: Set<string>;
  }
  const quantifyLegs = (
    legs: LegacyLedgerLeg[],
    role: 'sales' | 'cogs',
    normal: 'debit' | 'credit',
  ): QuantifiedFinancialStatementLine[] => {
    const grouped = new Map<string, QuantifiedGroup>();
    legs.forEach(leg => {
      const result = saleByOperationId.get(leg.sourceEntryId);
      const legAccount = leg.account.sourceAccount;
      const inventoryId = result?.sourceInventoryAccountId
        || result?.inventoryAccountId
        || legAccount?.linkedInventoryAccountId;
      const state = inventoryId ? timeline?.finalStates[inventoryId] : undefined;
      const virtualKind = leg.entityId.endsWith(':gold')
        ? 'gold'
        : leg.entityId.endsWith(':silver')
          ? 'silver'
          : leg.entityId.endsWith(':accessories')
            ? 'accessory'
            : null;
      const kind: StatementDimensionKind = state?.kind
        ?? (legAccount?.metal === 'gold'
          ? 'gold'
          : legAccount?.metal === 'silver'
            ? 'silver'
            : virtualKind ?? 'cash');
      const key = `${leg.entityId}|${inventoryId ?? kind}`;
      const linkedAccount = legAccount ?? (inventoryId
        ? accounts.find(account =>
          account.accountRole === (role === 'sales' ? 'sales' : 'cost_of_sales')
          && account.linkedInventoryAccountId === inventoryId)
        : undefined);
      const row = grouped.get(key) ?? {
        entityId: leg.entityId,
        label: leg.accountName,
        amount: 0,
        account: linkedAccount,
        inventoryId,
        kind,
        operationIds: new Set<string>(),
      };
      row.amount += leg.side === normal ? leg.amount : -leg.amount;
      if (result) row.operationIds.add(leg.sourceEntryId);
      grouped.set(key, row);
    });

    const entityCounts = new Map<string, number>();
    grouped.forEach(row => entityCounts.set(row.entityId, (entityCounts.get(row.entityId) ?? 0) + 1));
    return [...grouped.values()].map(row => {
      let measure = 0;
      row.operationIds.forEach(id => {
        const result = saleByOperationId.get(id);
        if (result && row.kind !== 'cash') measure += measureFor(result, row.kind);
      });
      if (measure === 0 && row.inventoryId) measure = soldByInventory.get(row.inventoryId)?.measure ?? 0;
      if (measure === 0 && row.kind !== 'cash') {
        const dimension = row.kind === 'accessory' ? 'quantity' : row.kind;
        measure = Math.abs(allPeriodLegs
          .filter(leg => leg.entityId === row.entityId && leg.dimension === dimension)
          .reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0));
      }
      const amount = roundMoney(row.amount);
      const weight = row.kind === 'gold' || row.kind === 'silver' ? measure : null;
      const quantity = row.kind === 'accessory' ? measure : null;
      const denominator = weight ?? quantity;
      const unitPriceLabel = row.kind === 'cash'
        ? null
        : role === 'sales'
          ? row.kind === 'gold'
            ? 'متوسط سعر بيع الجرام العربي'
            : row.kind === 'accessory'
              ? 'متوسط سعر بيع القطعة'
              : 'متوسط سعر بيع الجرام'
          : row.kind === 'gold'
            ? 'متوسط تكلفة الجرام العربي المباع'
            : row.kind === 'accessory'
              ? 'متوسط تكلفة القطعة المباعة'
              : 'متوسط تكلفة الجرام المباع';
      return {
        id: (entityCounts.get(row.entityId) ?? 0) === 1
          ? row.entityId
          : `${row.entityId}:${row.inventoryId ?? row.kind}`,
        label: row.label,
        amount,
        accountId: row.account?.id,
        kind: row.kind,
        weight,
        quantity,
        unitPrice: deriveUnitPrice(amount, denominator),
        unitPriceLabel,
      };
    }).filter(row => row.amount > 0.0001).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  };

  const revenueLines = quantifyLegs(revenueLegs, 'sales', 'credit');
  const cogsLines = quantifyLegs(cogsLedgerLegs, 'cogs', 'debit');
  const revenue = revenueLines.map(({ id, label, amount }) => ({ id, label, amount }));
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
    const weight = id === 'gold' || id === 'silver'
      ? matching.reduce((sum, line) => sum + (line.weight ?? 0), 0)
      : null;
    const quantity = id === 'accessories'
      ? matching.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
      : null;
    const denominator = weight ?? quantity;
    return {
      id,
      label,
      lines: matching,
      amount,
      weight,
      quantity,
      unitPrice: deriveUnitPrice(amount, denominator),
      unitPriceLabel: matching.find(line => line.unitPriceLabel)?.unitPriceLabel ?? null,
    };
  });
  const revenueCategories = categories(revenueLines, [
    { id: 'gold', label: 'مبيعات الذهب' },
    { id: 'silver', label: 'مبيعات الفضة' },
    { id: 'accessories', label: 'مبيعات الملحقات' },
    { id: 'other', label: 'إيرادات أخرى' },
  ]);
  const cogsCategories = categories(cogsLines, [
    { id: 'gold', label: 'تكلفة مبيعات الذهب' },
    { id: 'silver', label: 'تكلفة مبيعات الفضة' },
    { id: 'accessories', label: 'تكلفة مبيعات الملحقات' },
    { id: 'other', label: 'تكلفة مبيعات أخرى / غير موزعة' },
  ]).filter(category => category.id !== 'other' || category.amount !== 0);
  const revenueTotal = roundMoney(revenue.reduce((sum, line) => sum + line.amount, 0));
  const cogs = roundMoney(cogsLines.reduce((sum, line) => sum + line.amount, 0));
  const operatingExpensesTotal = roundMoney(operatingExpenses.reduce((sum, line) => sum + line.amount, 0));
  const soldWeight = {
    gold: revenueCategories.find(category => category.id === 'gold')?.weight ?? 0,
    silver: revenueCategories.find(category => category.id === 'silver')?.weight ?? 0,
  };
  const soldQuantity = {
    accessories: revenueCategories.find(category => category.id === 'accessories')?.quantity ?? 0,
  };
  const grossProfit = roundMoney(revenueTotal - cogs);
  return {
    revenue,
    revenueCategories,
    revenueTotal,
    cogsLines,
    cogsCategories,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingExpensesTotal,
    netProfit: roundMoney(grossProfit - operatingExpensesTotal),
    soldWeight,
    soldQuantity,
  };
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
  const canonicalDefinitions = options.canonicalDefinitions ?? [];
  const registry = buildAccountRegistry(rawAccounts.map(applyRuntimeAccountOverride), entries, canonicalDefinitions);
  const accounts = registry.expandedAccounts;
  const timeline = options.timeline?.valid ? options.timeline : null;
  const balanceEntries = entries.filter(entry => !options.balanceEndDate || entry.date <= options.balanceEndDate);
  const projectedLegs = buildLegacyLedgerLegs(balanceEntries, accounts, canonicalDefinitions, { enableFinancialProjection: true, costTimeline: timeline });
  const financialBalances = balanceMap(projectedLegs.filter(financialLeg));
  const cashBalances = balanceMap(projectedLegs, 'cash');
  const bookBalances = balanceMap(projectedLegs, 'book_value');
  const goldBalances = balanceMap(projectedLegs, 'gold');
  const silverBalances = balanceMap(projectedLegs, 'silver');
  const merchantLiabilityTimeline = buildMerchantGoldLiabilityTimeline(balanceEntries, accounts, timeline);
  const reconciliationWarnings: ReconciliationWarning[] = accounts.filter(account =>
    account.type === 'merchant' && (account.metal === 'gold' || account.metal === 'silver'
      || account.canonicalSubType === 'merchant_gold' || account.canonicalSubType === 'merchant_silver')).flatMap(account => {
    const entityId = account.id ? `merchant:${account.id}` : `legacy-name:${account.name}`;
    const metalBalance = roundMoney(account.metal === 'silver'
      ? silverBalances.get(entityId)?.balance ?? 0
      : goldBalances.get(entityId)?.balance ?? 0);
    const bookValueBalance = roundMoney(bookBalances.get(entityId)?.balance ?? 0);
    return Math.abs(metalBalance) <= 0.000001 && Math.abs(bookValueBalance) > 0.0001 ? [{
      code: 'merchant_metal_zero_weight_book_value' as const,
      accountId: account.id ?? entityId,
      accountName: account.name,
      goldBalance: account.metal === 'gold' ? metalBalance : 0,
      bookValueBalance,
    }] : [];
  });



  let cash = 0; let receivables = 0; let rawCapital = 0; let rawRetainedEarnings = 0; let otherLiabilities = 0;
  const cashDetails: FinancialPositionDetailRow[] = []; const ordinaryReceivableDetails: FinancialPositionDetailRow[] = []; const otherDetails: FinancialPositionDetailRow[] = []; const capitalDetails: FinancialPositionDetailRow[] = []; const retainedEarningsDetails: FinancialPositionDetailRow[] = [];
  const isMerchantMetalAccount = (account?: Account): boolean => !!account && account.type === 'merchant'
    && (account.metal === 'gold' || account.metal === 'silver'
      || account.canonicalSubType === 'merchant_gold' || account.canonicalSubType === 'merchant_silver');
  financialBalances.forEach(({ balance, leg }, entityId) => {
    const account = leg.account.sourceAccount;
    if (account?.is_inventory) return;
    // Metal merchants are classified below from the signed economic
    // projection, independently for metal carrying value and cash.
    if (isMerchantMetalAccount(account)) return;
    if (leg.group === 'assets') {
      const row = { id: entityId, label: leg.accountName, accountId: account?.id, amount: roundMoney(balance) };
      if (account?.type === 'cash') { cash += balance; cashDetails.push(row); } else { receivables += balance; ordinaryReceivableDetails.push(row); }
      return;
    }
    if (leg.group === 'liabilities') {
      otherLiabilities += -balance; otherDetails.push({ id: entityId, label: leg.accountName, accountId: account?.id, amount: roundMoney(-balance) });
      return;
    }
    if (leg.group === 'equity') {
      const value = -balance;
      const row = { id: entityId, label: leg.accountName, accountId: account?.id, amount: roundMoney(value) };
      if (account?.canonicalSubType === 'retained_earnings') { rawRetainedEarnings += value; retainedEarningsDetails.push(row); } else { rawCapital += value; capitalDetails.push(row); }
    }
  });

  const inventory = Object.values(timeline?.finalStates ?? {}).map((state): InventoryStatementRow => {
    const weight = state.kind === 'accessory' ? null : state.kind === 'gold' ? state.standardizedQuantityUnits / 100 : state.actualPhysicalWeightUnits / 100;
    const quantity = state.kind === 'accessory' ? state.accessoryQuantityUnits / 1000 : null;
    const entityId = `product:${state.inventoryAccountId}`;
    const bookValue = roundMoney(bookBalances.get(entityId)?.balance ?? state.remainingTotalCostMinor / 100);
    const marketPrice = state.kind === 'gold' ? options.goldPriceEgp : state.kind === 'silver' ? options.silverPriceEgp : null;
    const marketValue = weight !== null && marketPrice !== null && marketPrice !== undefined && Number.isFinite(marketPrice) ? roundMoney(weight * marketPrice) : null;
    const account = registry.expandedAccounts.find(item => item.id === state.inventoryAccountId);
    return { accountId: state.inventoryAccountId, kind: state.kind, label: account?.name ?? state.displayName, weight, quantity, bookValue, marketValue, unrealizedDifference: marketValue === null ? null : roundMoney(marketValue - bookValue), averageBookCost: deriveUnitPrice(bookValue, weight ?? quantity) };
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
  const currentIncome = buildIncomeFromProjection(projectedLegs, accounts, timeline, currentStart, currentEnd);
  const priorIncome = currentStart ? buildIncomeFromProjection(projectedLegs, accounts, timeline, undefined, previousDate(currentStart)) : { netProfit: 0 };
  const capital = roundMoney(rawCapital); const retainedEarnings = roundMoney(rawRetainedEarnings + priorIncome.netProfit); const currentProfit = currentIncome.netProfit;
  if (priorIncome.netProfit !== 0) retainedEarningsDetails.push({ id: 'derived:prior-profit', label: 'أرباح الفترات السابقة', amount: priorIncome.netProfit });
  const currentProfitDetails = [...currentIncome.revenue.map(row => ({ ...row, amount: row.amount })), ...currentIncome.cogsLines.map(row => ({ id: row.id, label: row.label, accountId: row.accountId, amount: -row.amount })), ...currentIncome.operatingExpenses.map(row => ({ ...row, amount: -row.amount }))];
  const payableRows: MerchantLiabilityStatementRow[] = [];
  const receivableRows: MerchantLiabilityStatementRow[] = [];
  const seenMerchantIds = new Set<string>();
  accounts.filter(isMerchantMetalAccount).forEach(account => {
    const accountId = account.id ?? `legacy-name:${account.name}`;
    if (seenMerchantIds.has(accountId)) return;
    seenMerchantIds.add(accountId);
    const entityId = account.id ? `merchant:${account.id}` : `legacy-name:${account.name}`;
    const state = merchantLiabilityTimeline.finalStates[accountId];
    const metal = state?.metal ?? (account.metal === 'silver' ? 'silver' : 'gold');
    const cashBalance = cashBalances.get(entityId)?.balance ?? 0;
    const base = {
      id: entityId,
      accountId,
      label: account.name,
      metal,
      equivalent21Weight: metal === 'gold' ? Math.abs(state?.signedQuantity ?? 0) : 0,
      silverWeight: metal === 'silver' ? Math.abs(state?.signedQuantity ?? 0) : 0,
      averageEgpPerGram: state?.currentWacMinorPerUnit ?? null,
    };
    const cashPayable = Math.max(0, -cashBalance);
    const cashReceivable = Math.max(0, cashBalance);
    if ((state?.payableBookValueMinor ?? 0) > 0 || cashPayable > 0) payableRows.push({
      ...base,
      bookValue: (state?.payableBookValueMinor ?? 0) / 100,
      cashPayable,
      cashReceivable: 0,
      positionSide: state?.positionSide ?? 'settled',
    });
    if ((state?.receivableBookValueMinor ?? 0) > 0 || cashReceivable > 0) receivableRows.push({
      ...base,
      bookValue: (state?.receivableBookValueMinor ?? 0) / 100,
      cashPayable: 0,
      cashReceivable,
      positionSide: state?.positionSide ?? 'settled',
    });
  });
  payableRows.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  receivableRows.sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  const merchantGoldReceivables = roundMoney(receivableRows.filter(row => row.metal === 'gold').reduce((sum, row) => sum + row.bookValue, 0));
  const merchantSilverReceivables = roundMoney(receivableRows.filter(row => row.metal === 'silver').reduce((sum, row) => sum + row.bookValue, 0));
  const merchantCashReceivables = roundMoney(receivableRows.reduce((sum, row) => sum + row.cashReceivable, 0));
  const merchantMetalReceivables = roundMoney(merchantGoldReceivables + merchantSilverReceivables);
  receivables = roundMoney(receivables + merchantMetalReceivables + merchantCashReceivables);
  const assets = {
    cash: roundMoney(cash), goldInventory, silverInventory, accessoriesInventory,
    receivables: roundMoney(receivables), ordinaryReceivables: roundMoney(receivables - merchantMetalReceivables - merchantCashReceivables), merchantCashReceivables, merchantMetalReceivables,
    merchantGoldReceivables, merchantSilverReceivables,
    merchantReceivableDetails: receivableRows, cashDetails, ordinaryReceivableDetails, total: 0,
  };
  assets.total = roundMoney(assets.cash + goldInventory + silverInventory + accessoriesInventory + assets.receivables);
  const details = payableRows;
  const merchantGold = roundMoney(details.filter(row => row.metal === 'gold').reduce((sum, row) => sum + row.bookValue, 0));
  const merchantSilver = roundMoney(details.filter(row => row.metal === 'silver').reduce((sum, row) => sum + row.bookValue, 0));
  const merchantCash = roundMoney(details.reduce((sum, row) => sum + row.cashPayable, 0));
  const merchant = roundMoney(merchantGold + merchantSilver + merchantCash);
  const liabilities = { merchant, merchantGold, merchantSilver, merchantCash, other: roundMoney(otherLiabilities), total: roundMoney(merchant + otherLiabilities), merchantDetails: details, otherDetails };
  const equity = { capital, retainedEarnings, currentProfit, total: roundMoney(capital + retainedEarnings + currentProfit), capitalDetails, retainedEarningsDetails, currentProfitDetails };
  return {
    incomeStatement: currentIncome,
    balanceSheet: { assets, liabilities, equity, inventory, inventoryCategories, reconciliationWarnings, balances: { assetsLessLiabilitiesAndEquity: roundMoney(assets.total - liabilities.total - equity.total) } },
    costBasisAvailable: !!timeline,
    merchantLiabilityDiagnostics: merchantLiabilityTimeline.diagnostics,
  };
};
