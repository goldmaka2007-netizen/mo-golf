import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { buildAccountRegistry } from './accountRegistry';
import { FINANCIAL_POSTING_ACCOUNT_IDS, type LegacyLedgerLeg } from './legacyLedger';
import { buildFinancialPostingProjection } from './postingProjection';
import type { InventoryCostKind, InventoryCostTimeline } from './inventoryCostTypes';
import { getMerchantMetadataMetal, processInventory } from './engine';

export interface FinancialStatementLine {
  id: string;
  label: string;
  amount: number;
}

export interface FinancialStatementNode extends FinancialStatementLine {
  children?: FinancialStatementNode[];
}

export interface EgpIncomeStatement {
  revenue: FinancialStatementLine[];
  revenueTree: FinancialStatementNode[];
  revenueTotal: number;
  cogs: number;
  cogsTree: FinancialStatementNode[];
  grossProfit: number;
  operatingExpenses: FinancialStatementLine[];
  operatingExpensesTree: FinancialStatementNode[];
  operatingExpensesTotal: number;
  otherIncome: FinancialStatementLine[];
  otherIncomeTree: FinancialStatementNode[];
  otherIncomeTotal: number;
  otherExpenses: FinancialStatementLine[];
  otherExpensesTree: FinancialStatementNode[];
  otherExpensesTotal: number;
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

export type FinancialPositionMeasureUnit = 'gold21' | 'silverGram' | 'piece';

export interface FinancialPositionNode extends FinancialStatementNode {
  measure?: { value: number; unit: FinancialPositionMeasureUnit };
  children?: FinancialPositionNode[];
}

export interface EgpBalanceSheet {
  assets: {
    cash: number;
    goldInventory: number;
    silverInventory: number;
    accessoriesInventory: number;
    fixedAssets: number;
    receivables: number;
    otherAssets: number;
    total: number;
  };
  liabilities: {
    merchant: number;
    merchantGoldWeight: number;
    goldValuationPrice: number;
    merchantCashSettlements: number;
    other: number;
    total: number;
  };
  equity: {
    capital: number;
    retainedEarnings: number;
    currentProfit: number;
    ownerWithdrawals: number;
    valuationReserve: number;
    total: number;
  };
  inventory: InventoryStatementRow[];
  tree: {
    assets: FinancialPositionNode[];
    liabilities: FinancialPositionNode[];
    equity: FinancialPositionNode[];
  };
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
export const valueWeightAtValuationPrice = (weight: number, goldValuationPrice: number): number =>
  roundMoney(weight * goldValuationPrice);
const inPeriod = (date: string, start?: string, end?: string): boolean =>
  (!start || date >= start) && (!end || date <= end);

const previousDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};

const sumLines = (lines: FinancialStatementLine[]): number =>
  roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));

const aggregateNetLines = (
  legs: LegacyLedgerLeg[],
  normalSide: 'debit' | 'credit',
): FinancialStatementLine[] => {
  const amounts = new Map<string, FinancialStatementLine>();
  legs.forEach(leg => {
    const existing = amounts.get(leg.entityId) ?? { id: leg.entityId, label: leg.accountName, amount: 0 };
    const increase = leg.side === normalSide ? leg.amount : -leg.amount;
    existing.amount += increase;
    amounts.set(leg.entityId, existing);
  });
  return [...amounts.values()]
    .map(line => ({ ...line, amount: roundMoney(line.amount) }))
    .filter(line => Math.abs(line.amount) > 0.0001)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

const otherExpensePattern = /تبرع|تبرعات|صدقة|صدقات|الصدقات|زكاة|ذكاة|غرام|عقوب|جزاء|استثنائ|غير\s*تشغيل|donation|charity|penalt|fine|extraordinary|non[ -]?operating/i;
const explicitOtherExpenseIds = new Set<string>([
  FINANCIAL_POSTING_ACCOUNT_IDS.merchantSettlementLoss,
  FINANCIAL_POSTING_ACCOUNT_IDS.manufacturingAbnormalLoss,
]);

const isOtherExpenseLeg = (leg: LegacyLedgerLeg): boolean => {
  if (leg.entityId === FINANCIAL_POSTING_ACCOUNT_IDS.cogs) return false;
  if (leg.entityId === FINANCIAL_POSTING_ACCOUNT_IDS.inventoryShortageLoss) return false;
  if (explicitOtherExpenseIds.has(leg.entityId)) return true;
  const account = leg.account.sourceAccount;
  return otherExpensePattern.test(`${leg.accountName} ${account?.subType ?? ''}`);
};

const inventoryKind = (account: Account | undefined): 'gold' | 'silver' | 'accessory' | 'other' => {
  if (!account) return 'other';
  if (account.type === 'accessory') return 'accessory';
  if (account.metal === 'silver' || account.type === 'silver') return 'silver';
  if (account.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type ?? '')) return 'gold';
  return 'other';
};

const inventoryKindLabel = (kind: ReturnType<typeof inventoryKind>, prefix: string): string => {
  if (kind === 'gold') return `${prefix} الذهب`;
  if (kind === 'silver') return `${prefix} الفضة`;
  if (kind === 'accessory') return `${prefix} الملحقات`;
  return `${prefix} أخرى`;
};

const node = (id: string, label: string, children: FinancialStatementNode[]): FinancialStatementNode => ({
  id,
  label,
  amount: roundMoney(children.reduce((sum, child) => sum + child.amount, 0)),
  children: children.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
});

const buildInventoryTree = (
  legs: LegacyLedgerLeg[],
  allPeriodLegs: LegacyLedgerLeg[],
  normalSide: 'debit' | 'credit',
  rootId: string,
  rootLabel: string,
  groupPrefix: string,
): FinancialStatementNode[] => {
  const operationInventory = new Map<string, Account>();
  allPeriodLegs.forEach(leg => {
    const account = leg.account.sourceAccount;
    if (account?.is_inventory && !operationInventory.has(leg.sourceEntryId)) {
      operationInventory.set(leg.sourceEntryId, account);
    }
  });

  const itemAmounts = new Map<string, { account: Account | undefined; amount: number }>();
  legs.forEach(leg => {
    const account = operationInventory.get(leg.sourceEntryId);
    const itemId = account?.id ?? account?.name ?? `unknown:${leg.sourceEntryId}`;
    const current = itemAmounts.get(itemId) ?? { account, amount: 0 };
    current.amount += leg.side === normalSide ? leg.amount : -leg.amount;
    itemAmounts.set(itemId, current);
  });

  const grouped = new Map<ReturnType<typeof inventoryKind>, FinancialStatementNode[]>();
  itemAmounts.forEach(({ account, amount }, itemId) => {
    const rounded = roundMoney(amount);
    if (Math.abs(rounded) <= 0.0001) return;
    const kind = inventoryKind(account);
    const children = grouped.get(kind) ?? [];
    children.push({ id: `${rootId}:item:${itemId}`, label: account?.name ?? 'صنف غير محدد', amount: rounded });
    grouped.set(kind, children);
  });

  const kindOrder: Array<ReturnType<typeof inventoryKind>> = ['gold', 'silver', 'accessory', 'other'];
  const groups = kindOrder
    .filter(kind => grouped.has(kind))
    .map(kind => node(`${rootId}:${kind}`, inventoryKindLabel(kind, groupPrefix), grouped.get(kind)!));
  return groups.length ? [node(rootId, rootLabel, groups)] : [];
};

const virtualExpenseGroupLabel = (id: string): string | null => {
  if (id === FINANCIAL_POSTING_ACCOUNT_IDS.inventoryShortageLoss) return 'خسائر وتسويات المخزون';
  if (id === FINANCIAL_POSTING_ACCOUNT_IDS.merchantSettlementLoss) return 'خسائر تسوية التزامات التجار';
  if (id === FINANCIAL_POSTING_ACCOUNT_IDS.manufacturingAbnormalLoss) return 'خسائر التصنيع غير الطبيعية';
  return null;
};

const virtualIncomeGroupLabel = (id: string): string | null => {
  if (id === FINANCIAL_POSTING_ACCOUNT_IDS.inventorySurplusGain) return 'مكاسب وتسويات المخزون';
  if (id === FINANCIAL_POSTING_ACCOUNT_IDS.merchantSettlementGain) return 'أرباح تسوية التزامات التجار';
  return null;
};

const buildAccountTree = (
  lines: FinancialStatementLine[],
  legs: LegacyLedgerLeg[],
  fallbackLabel: string,
  virtualLabel: (id: string) => string | null,
): FinancialStatementNode[] => {
  const accountByEntity = new Map(
    legs.flatMap(leg => leg.account.sourceAccount ? [[leg.entityId, leg.account.sourceAccount] as const] : []),
  );
  const groups = new Map<string, FinancialStatementNode[]>();
  lines.forEach(line => {
    const account = accountByEntity.get(line.id);
    const groupLabel = virtualLabel(line.id) || account?.subType?.trim() || fallbackLabel;
    const children = groups.get(groupLabel) ?? [];
    children.push({ ...line });
    groups.set(groupLabel, children);
  });
  return [...groups.entries()]
    .map(([label, children], index) => node(`group:${fallbackLabel}:${index}:${label}`, label, children))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

const buildIncome = (
  projectedLegs: LegacyLedgerLeg[],
  startDate?: string,
  endDate?: string,
): EgpIncomeStatement => {
  const periodLegs = projectedLegs.filter(leg => inPeriod(leg.date, startDate, endDate));
  const cashLegs = periodLegs.filter(leg => leg.dimension === 'cash');

  const salesRevenueLegs = cashLegs.filter(leg =>
    leg.entityId === FINANCIAL_POSTING_ACCOUNT_IDS.salesRevenue
    || (leg.group === 'revenue' && leg.operationKind === 'sale'));
  const revenue = aggregateNetLines(salesRevenueLegs, 'credit');
  const cogsLegs = cashLegs.filter(leg => leg.entityId === FINANCIAL_POSTING_ACCOUNT_IDS.cogs);
  const cogsLines = aggregateNetLines(cogsLegs, 'debit');
  const operatingExpenseLegs = cashLegs.filter(leg =>
    leg.group === 'expenses'
    && leg.entityId !== FINANCIAL_POSTING_ACCOUNT_IDS.cogs
    && !isOtherExpenseLeg(leg));
  const operatingExpenses = aggregateNetLines(operatingExpenseLegs, 'debit');
  const otherIncomeLegs = cashLegs.filter(leg =>
    leg.group === 'revenue' && !salesRevenueLegs.includes(leg));
  const otherIncome = aggregateNetLines(otherIncomeLegs, 'credit');
  const otherExpenseLegs = cashLegs.filter(leg => leg.group === 'expenses' && isOtherExpenseLeg(leg));
  const otherExpenses = aggregateNetLines(otherExpenseLegs, 'debit');

  const revenueTotal = sumLines(revenue);
  const cogs = sumLines(cogsLines);
  const operatingExpensesTotal = sumLines(operatingExpenses);
  const otherIncomeTotal = sumLines(otherIncome);
  const otherExpensesTotal = sumLines(otherExpenses);
  const grossProfit = roundMoney(revenueTotal - cogs);

  const soldWeight = periodLegs.reduce((totals, leg) => {
    if (leg.operationKind !== 'sale' || leg.side !== 'credit' || !leg.account.sourceAccount?.is_inventory) return totals;
    if (leg.dimension === 'gold') totals.gold += leg.amount;
    if (leg.dimension === 'silver') totals.silver += leg.amount;
    return totals;
  }, { gold: 0, silver: 0 });

  return {
    revenue,
    revenueTree: buildInventoryTree(salesRevenueLegs, periodLegs, 'credit', 'sales-revenue', 'إيرادات مبيعات المخزون', 'إيرادات مبيعات'),
    revenueTotal,
    cogs,
    cogsTree: buildInventoryTree(cogsLegs, periodLegs, 'debit', 'cogs', 'تكلفة البضاعة المباعة', 'تكلفة مبيعات'),
    grossProfit,
    operatingExpenses,
    operatingExpensesTree: buildAccountTree(operatingExpenses, operatingExpenseLegs, 'مصروفات تشغيل أخرى', virtualExpenseGroupLabel),
    operatingExpensesTotal,
    otherIncome,
    otherIncomeTree: buildAccountTree(otherIncome, otherIncomeLegs, 'إيرادات أخرى', virtualIncomeGroupLabel),
    otherIncomeTotal,
    otherExpenses,
    otherExpensesTree: buildAccountTree(otherExpenses, otherExpenseLegs, 'مصروفات أخرى', virtualExpenseGroupLabel),
    otherExpensesTotal,
    netProfit: roundMoney(grossProfit - operatingExpensesTotal + otherIncomeTotal - otherExpensesTotal),
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

interface PositionAccountLine {
  id: string;
  label: string;
  amount: number;
  subType: string;
  measure?: FinancialPositionNode['measure'];
}

const positionNode = (
  id: string,
  label: string,
  amount: number,
  children?: FinancialPositionNode[],
  measure?: FinancialPositionNode['measure'],
): FinancialPositionNode => ({
  id,
  label,
  amount: roundMoney(amount),
  ...(measure && Math.abs(measure.value) > 0.0001 ? { measure } : {}),
  ...(children?.length ? { children: children.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) } : {}),
});

const buildPositionAccountRoot = (
  id: string,
  label: string,
  total: number,
  lines: PositionAccountLine[],
  adjustmentLabel = 'تسوية محاسبية مجمعة',
): FinancialPositionNode => {
  const groups = new Map<string, PositionAccountLine[]>();
  lines.forEach(line => {
    const groupLabel = line.subType || 'حسابات أخرى';
    const rows = groups.get(groupLabel) ?? [];
    rows.push(line);
    groups.set(groupLabel, rows);
  });
  const children: FinancialPositionNode[] = [...groups.entries()].map(([groupLabel, rows]) => positionNode(
    `${id}:group:${groupLabel}`,
    groupLabel,
    rows.reduce((sum, row) => sum + row.amount, 0),
    rows.map(row => positionNode(`${id}:account:${row.id}`, row.label, row.amount, undefined, row.measure)),
  ));
  const detailedTotal = roundMoney(children.reduce((sum, child) => sum + child.amount, 0));
  const adjustment = roundMoney(total - detailedTotal);
  if (Math.abs(adjustment) > 0.0001) {
    children.push(positionNode(`${id}:adjustment`, adjustmentLabel, adjustment));
  }
  return positionNode(id, label, total, children);
};

const buildInventoryPositionRoot = (
  id: string,
  label: string,
  groupLabel: string,
  total: number,
  rows: InventoryStatementRow[],
  unit: FinancialPositionMeasureUnit,
): FinancialPositionNode => {
  const itemNodes = rows.flatMap((row, index) => {
    const amount = row.kind === 'gold' ? (row.marketValue ?? 0) : row.bookValue;
    const quantity = unit === 'piece' ? (row.quantity ?? 0) : (row.weight ?? 0);
    if (Math.abs(amount) <= 0.0001 && Math.abs(quantity) <= 0.0001) return [];
    return [positionNode(`${id}:item:${index}:${row.label}`, row.label, amount, undefined, { value: quantity, unit })];
  });
  const quantityTotal = itemNodes.reduce((sum, item) => sum + (item.measure?.value ?? 0), 0);
  const children = itemNodes.length
    ? [positionNode(`${id}:items`, groupLabel, itemNodes.reduce((sum, item) => sum + item.amount, 0), itemNodes, { value: quantityTotal, unit })]
    : [];
  const detailedTotal = roundMoney(children.reduce((sum, child) => sum + child.amount, 0));
  const adjustment = roundMoney(total - detailedTotal);
  if (Math.abs(adjustment) > 0.0001) {
    children.push(positionNode(`${id}:adjustment`, 'فرق تقييم مجمع', adjustment));
  }
  return positionNode(id, label, total, children, { value: quantityTotal, unit });
};
export const buildFinancialStatementsEgp = (
  entries: Entry[],
  accounts: Account[],
  options: BuildFinancialStatementsEgpOptions = {},
): FinancialStatementsEgp => {
  const canonicalDefinitions = options.canonicalDefinitions ?? [];
  const timeline = options.timeline?.valid && options.timeline.costDataComplete !== false ? options.timeline : null;
  const balanceEntries = entries.filter(entry => !options.balanceEndDate || entry.date <= options.balanceEndDate);
  const postingProjection = buildFinancialPostingProjection(
    balanceEntries,
    accounts,
    canonicalDefinitions,
    timeline,
  );
  const projectedLegs = postingProjection.legs.filter(leg => leg.dimension === 'cash');
  const balances = closingBalances(projectedLegs);
  const goldBalances = closingBalances(postingProjection.legs.filter(leg => leg.dimension === 'gold'));
  const silverBalances = closingBalances(postingProjection.legs.filter(leg => leg.dimension === 'silver'));
  const registry = buildAccountRegistry(accounts, balanceEntries, canonicalDefinitions);
  const inventoryEngine = processInventory(balanceEntries, accounts);

  let cash = 0;
  let fixedAssets = 0;
  let receivables = 0;
  let otherAssets = 0;
  let merchantCashSettlementLiabilities = 0;
  let otherLiabilities = 0;
  let otherMetalLiabilityValue = 0;
  let rawCapital = 0;
  let rawRetainedEarnings = 0;
  let ownerWithdrawals = 0;
  let projectedInventory = 0;
  const cashLines: PositionAccountLine[] = [];
  const fixedAssetLines: PositionAccountLine[] = [];
  const receivableLines: PositionAccountLine[] = [];
  const otherAssetLines: PositionAccountLine[] = [];
  const merchantCashSettlementLines: PositionAccountLine[] = [];
  const otherLiabilityLines: PositionAccountLine[] = [];
  const capitalLines: PositionAccountLine[] = [];
  const retainedEarningsLines: PositionAccountLine[] = [];
  const withdrawalLines: PositionAccountLine[] = [];
  const positionLine = (leg: LegacyLedgerLeg, amount: number): PositionAccountLine => ({
    id: leg.entityId,
    label: leg.accountName,
    amount: roundMoney(amount),
    subType: leg.account.sourceAccount?.subType?.trim() || leg.account.description || 'حسابات أخرى',
  });

  balances.forEach(({ balance, leg }) => {
    const account = leg.account.sourceAccount;
    const resolution = registry.resolve(account?.id, leg.accountName);
    const entityType = resolution.status === 'resolved' ? resolution.account.entityType : null;
    if (account?.is_inventory || ['gold_inventory', 'silver_inventory', 'accessory_inventory'].includes(entityType ?? '')) {
      projectedInventory += balance;
      return;
    }
    if (leg.group === 'assets') {
      if (account?.type === 'cash' || entityType === 'cash') {
        cash += balance;
        cashLines.push(positionLine(leg, balance));
      } else if (entityType === 'fixed_asset' || /أصول?\s*ثابتة|اصول?\s*ثابتة|fixed\s*assets?/i.test(account?.subType ?? '')) {
        fixedAssets += balance;
        fixedAssetLines.push(positionLine(leg, balance));
      } else if (entityType === 'debtor' || /ذمم\s*مدينة|receivables?/i.test(account?.subType ?? '')) {
        receivables += balance;
        receivableLines.push(positionLine(leg, balance));
      } else {
        otherAssets += balance;
        otherAssetLines.push(positionLine(leg, balance));
      }
      return;
    }
    if (leg.group === 'liabilities') {
      const value = -balance;
      if (account?.type === 'merchant' || entityType === 'merchant') {
        merchantCashSettlementLiabilities += value;
        merchantCashSettlementLines.push(positionLine(leg, value));
      } else {
        otherLiabilities += value;
        otherLiabilityLines.push(positionLine(leg, value));
      }
      return;
    }
    if (leg.group === 'equity') {
      const value = -balance;
      if (entityType === 'retained_earnings') {
        rawRetainedEarnings += value;
        retainedEarningsLines.push(positionLine(leg, value));
      } else if (entityType === 'withdrawals') {
        ownerWithdrawals += balance;
        withdrawalLines.push(positionLine(leg, balance));
      } else {
        rawCapital += value;
        capitalLines.push(positionLine(leg, value));
      }
    }
  });

  const inventory = Object.values(timeline?.finalStates ?? {}).map((state): InventoryStatementRow => {
    const weight = state.kind === 'accessory' ? null : state.standardizedQuantityUnits / 100;
    const quantity = state.kind === 'accessory' ? state.accessoryQuantityUnits / 1000 : null;
    const bookValue = roundMoney(state.remainingTotalCostMinor / 100);
    const marketPrice = state.kind === 'gold' ? options.goldPriceEgp : state.kind === 'silver' ? options.silverPriceEgp : null;
    const marketValue = weight !== null && marketPrice !== null && marketPrice !== undefined && Number.isFinite(marketPrice)
      ? valueWeightAtValuationPrice(weight, marketPrice)
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
  const goldInventoryBookValue = inventoryTotal('gold');
  const goldValuationPrice = Number.isFinite(options.goldPriceEgp) ? Number(options.goldPriceEgp) : 0;
  const goldInventoryWeight = inventory
    .filter(row => row.kind === 'gold')
    .reduce((sum, row) => sum + (row.weight ?? 0), 0);
  const goldInventory = valueWeightAtValuationPrice(goldInventoryWeight, goldValuationPrice);
  const silverValuationPrice = Number.isFinite(options.silverPriceEgp) ? Number(options.silverPriceEgp) : 0;
  const appendMeasuredLiabilities = (
    dimensionBalances: Map<string, { balance: number; leg: LegacyLedgerLeg }>,
    unit: FinancialPositionMeasureUnit,
    valuationPrice: number,
  ) => dimensionBalances.forEach(({ balance, leg }) => {
    if (leg.group !== 'liabilities' || leg.account.sourceAccount?.type === 'merchant') return;
    const weight = roundMoney(-balance);
    if (Math.abs(weight) <= 0.0001) return;
    const value = valueWeightAtValuationPrice(weight, valuationPrice);
    otherLiabilities += value;
    otherMetalLiabilityValue += value;
    otherLiabilityLines.push({
      ...positionLine(leg, value),
      id: `${leg.entityId}:${unit}`,
      measure: { value: weight, unit },
    });
  });
  appendMeasuredLiabilities(goldBalances, 'gold21', goldValuationPrice);
  appendMeasuredLiabilities(silverBalances, 'silverGram', silverValuationPrice);
  const merchantGoldWeight = Object.entries(inventoryEngine.merchantWeightLiabilities)
    .filter(([accountName]) => getMerchantMetadataMetal(accounts.find(account => account.name === accountName)) === 'gold')
    .reduce((sum, [, snapshot]) => sum + snapshot.arabicWeight, 0);
  const merchantGoldValue = valueWeightAtValuationPrice(merchantGoldWeight, goldValuationPrice);
  const silverInventory = inventoryTotal('silver');
  const accessoriesInventory = inventoryTotal('accessory');

  const fiscalYear = (options.balanceEndDate || balanceEntries.map(entry => entry.date).sort().at(-1) || '').slice(0, 4);
  const currentStart = options.incomeStartDate ?? (fiscalYear ? `${fiscalYear}-01-01` : undefined);
  const currentEnd = options.incomeEndDate ?? options.balanceEndDate;
  const currentIncome = buildIncome(postingProjection.legs, currentStart, currentEnd);
  const priorIncome = currentStart
    ? buildIncome(postingProjection.legs, undefined, previousDate(currentStart))
    : { netProfit: 0 };
  // The cost engine supplies opening inventory book value without changing old
  // journal rows. This report-only bridge puts that historical book basis in
  // capital before the explicit revaluation reserve is calculated below.
  const openingBookValueBridge = timeline ? roundMoney(
    timeline.results
      .filter(result => result.classification === 'opening')
      .reduce((sum, result) => sum + result.incomingTotalCostMinor / 100, 0)
    + (timeline.historicalInventoryOverlays ?? []).reduce((sum, overlay) => sum + overlay.totalCostMinor / 100, 0),
  ) : 0;
  const capital = roundMoney(rawCapital + openingBookValueBridge);
  const retainedEarnings = roundMoney(rawRetainedEarnings + priorIncome.netProfit);
  const currentProfit = currentIncome.netProfit;
  // Presentation-only revaluation: both sides use one gold price without
  // changing journal entries, merchant balances, inventory, or posting logic.
  const goldInventoryRevaluation = roundMoney(goldInventory - goldInventoryBookValue);
  // Merchant cash legs are workmanship/settlement balances, not the EGP book
  // value of the gold-weight obligation. The current model carries that gold
  // obligation only by weight, so its prior EGP carrying value is zero.
  const merchantGoldLiabilityBookValue = roundMoney(Object.values(
    timeline?.merchantGoldLiabilities ?? {},
  ).reduce((sum, liability) => sum + liability.bookValueMinor / 100, 0));
  const merchantGoldLiabilityRemeasurement = roundMoney(
    merchantGoldValue - merchantGoldLiabilityBookValue,
  );
  const valuationReserve = roundMoney(
    goldInventoryRevaluation - merchantGoldLiabilityRemeasurement - otherMetalLiabilityValue,
  );

  const assets = {
    cash: roundMoney(cash),
    goldInventory,
    silverInventory,
    accessoriesInventory,
    fixedAssets: roundMoney(fixedAssets),
    receivables: roundMoney(receivables),
    otherAssets: roundMoney(otherAssets),
    total: 0,
  };
  assets.total = roundMoney(assets.cash + goldInventory + silverInventory + accessoriesInventory + assets.fixedAssets + assets.receivables + assets.otherAssets);
  const liabilities = {
    merchant: merchantGoldValue,
    merchantGoldWeight,
    goldValuationPrice,
    merchantCashSettlements: roundMoney(merchantCashSettlementLiabilities),
    other: roundMoney(otherLiabilities),
    total: roundMoney(merchantGoldValue + otherLiabilities + merchantCashSettlementLiabilities),
  };
  const equity = {
    capital,
    retainedEarnings,
    currentProfit,
    ownerWithdrawals: roundMoney(ownerWithdrawals),
    valuationReserve,
    total: roundMoney(capital + retainedEarnings + currentProfit + valuationReserve - ownerWithdrawals),
  };

  const merchantGoldItems = Object.entries(inventoryEngine.merchantWeightLiabilities)
    .filter(([accountName, snapshot]) =>
      getMerchantMetadataMetal(accounts.find(account => account.name === accountName)) === 'gold'
      && Math.abs(snapshot.arabicWeight) > 0.0001)
    .map(([accountName, snapshot], index) => positionNode(
      `liabilities:merchant-gold:item:${index}:${accountName}`,
      accountName,
      valueWeightAtValuationPrice(snapshot.arabicWeight, goldValuationPrice),
      undefined,
      { value: snapshot.arabicWeight, unit: 'gold21' },
    ));
  const merchantGoldChildren = merchantGoldItems.length
    ? [positionNode(
      'liabilities:merchant-gold:accounts',
      'تجار الذهب',
      merchantGoldItems.reduce((sum, item) => sum + item.amount, 0),
      merchantGoldItems,
      { value: merchantGoldWeight, unit: 'gold21' },
    )]
    : [];

  const tree: EgpBalanceSheet['tree'] = {
    assets: [
      buildPositionAccountRoot('assets:cash', 'النقدية', assets.cash, cashLines),
      buildInventoryPositionRoot('assets:gold', 'مخزون الذهب', 'أصناف الذهب', assets.goldInventory, inventory.filter(row => row.kind === 'gold'), 'gold21'),
      buildInventoryPositionRoot('assets:silver', 'مخزون الفضة', 'أصناف الفضة', assets.silverInventory, inventory.filter(row => row.kind === 'silver'), 'silverGram'),
      buildInventoryPositionRoot('assets:accessories', 'مخزون الملحقات', 'أصناف الملحقات', assets.accessoriesInventory, inventory.filter(row => row.kind === 'accessory'), 'piece'),
      buildPositionAccountRoot('assets:fixed', 'الأصول الثابتة', assets.fixedAssets, fixedAssetLines),
      buildPositionAccountRoot('assets:receivables', 'الذمم المدينة', assets.receivables, receivableLines),
      buildPositionAccountRoot('assets:other', 'أصول أخرى', assets.otherAssets, otherAssetLines),
    ],
    liabilities: [
      positionNode(
        'liabilities:merchant-gold',
        'التزامات ذهب التجار',
        liabilities.merchant,
        merchantGoldChildren,
        { value: merchantGoldWeight, unit: 'gold21' },
      ),
      buildPositionAccountRoot('liabilities:merchant-cash', 'تسويات نقدية/مصنعية للتجار', liabilities.merchantCashSettlements, merchantCashSettlementLines),
      buildPositionAccountRoot('liabilities:other', 'خصوم أخرى', liabilities.other, otherLiabilityLines),
    ],
    equity: [
      buildPositionAccountRoot('equity:capital', 'رأس المال', equity.capital, capitalLines, 'تكلفة مخزون أول المدة'),
      buildPositionAccountRoot('equity:retained', 'الأرباح المحتجزة', equity.retainedEarnings, retainedEarningsLines, 'أرباح سنوات سابقة مجمعة'),
      positionNode('equity:current-profit', 'ربح الفترة الحالية', equity.currentProfit, [positionNode('equity:current-profit:value', 'صافي نتيجة قائمة الدخل', equity.currentProfit)]),
      buildPositionAccountRoot('equity:withdrawals', '(-) مسحوبات المالك', -equity.ownerWithdrawals, withdrawalLines.map(line => ({ ...line, amount: -line.amount }))),
      positionNode('equity:valuation-reserve', 'احتياطي إعادة تقييم الذهب', equity.valuationReserve, [positionNode('equity:valuation-reserve:value', 'فرق تقييم الذهب والتزامات التجار', equity.valuationReserve)]),
    ],
  };

  return {
    incomeStatement: currentIncome,
    balanceSheet: {
      assets,
      liabilities,
      equity,
      inventory,
      tree,
      balances: { assetsLessLiabilitiesAndEquity: roundMoney(assets.total - liabilities.total - equity.total) },
    },
    costBasisAvailable: !!timeline,
  };
};
