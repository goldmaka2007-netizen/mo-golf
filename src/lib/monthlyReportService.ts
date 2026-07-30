import type { Account, Entry } from '../types';
import { parseWeight } from './accounting';
import {
  buildAccountIndex,
  getEntryArabicWeight,
  getMerchantMetadataMetal,
  isAccessoryAccount,
  isCashAccount,
  isGoldAccount,
  isSilverAccount,
  parseCash,
  processInventory,
  resolveAccount,
  resolveOperationKind,
} from './engine';
import { buildEquityStatementReport } from './equityStatementReport';
import { buildFinancialPositionReport } from './financialPositionReport';
import { buildIncomeStatementReport } from './incomeStatementReport';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import { buildTrialBalanceReport } from './trialBalanceReport';
import { getAccountTypeDetails } from '../utils/accountLogic';
import { buildMonthlyDecisionInsights, deriveMonthlyHealthStatus } from './monthlyDecisionInsights';
import type {
  MonthlyComparison,
  MonthlyInventoryMovement,
  MonthlyKpi,
  MonthlyMetric,
  MonthlyMetricUnit,
  MonthlyReportData,
  MonthlyReportPeriod,
  MonthlySnapshot,
  MonthlyTrendPoint,
} from './monthlyReportTypes';

export interface BuildMonthlyReportInput {
  entries: Entry[];
  accounts: Account[];
  year: number;
  month: number;
  costTimeline?: InventoryCostTimeline | null;
  goldPrice?: number | null;
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateString = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();

export const createMonthlyReportPeriod = (year: number, month: number): MonthlyReportPeriod => {
  const previous = new Date(year, month - 2, 1);
  return {
    year,
    month,
    startDate: dateString(year, month, 1),
    endDate: dateString(year, month, lastDay(year, month)),
    previousStartDate: dateString(previous.getFullYear(), previous.getMonth() + 1, 1),
    previousEndDate: dateString(previous.getFullYear(), previous.getMonth() + 1, lastDay(previous.getFullYear(), previous.getMonth() + 1)),
    ytdStartDate: dateString(year, 1, 1),
  };
};

const available = (value: number): MonthlyMetric => ({ value: Number.isFinite(value) ? value : 0, status: 'available' });
const unavailable = (reason: string, status: MonthlyMetric['status'] = 'data_issue'): MonthlyMetric => ({ value: null, status, reason });
const safePercent = (part: number, total: number): MonthlyMetric =>
  total === 0 ? unavailable('غير قابلة للمقارنة', 'insufficient_data') : available((part / total) * 100);

const operationKey = (entry: Entry, index: number): string =>
  entry.operationNo || entry.invoiceNumber || entry.legacyOperationId || entry.id || `${entry.date}:${entry.tx}:${index}`;

const cashBalance = (entries: Entry[], accounts: Account[]): number => {
  const accountIndex = buildAccountIndex(accounts);
  return entries.reduce((total, entry) => {
    const cash = parseCash(entry);
    if (!cash) return total;
    const debit = resolveAccount(entry, 'debit', accountIndex);
    const credit = resolveAccount(entry, 'credit', accountIndex);
    return total + (isCashAccount(debit) ? cash : 0) - (isCashAccount(credit) ? cash : 0);
  }, 0);
};

type MovementKey = 'gold' | 'gold21' | 'silver' | 'accessories';
type MovementAccumulator = Record<MovementKey, { inflows: number; outflows: number; internalTransfers: number }>;

const emptyMovementAccumulator = (): MovementAccumulator => ({
  gold: { inflows: 0, outflows: 0, internalTransfers: 0 },
  gold21: { inflows: 0, outflows: 0, internalTransfers: 0 },
  silver: { inflows: 0, outflows: 0, internalTransfers: 0 },
  accessories: { inflows: 0, outflows: 0, internalTransfers: 0 },
});

const inventoryTotals = (entries: Entry[], accounts: Account[]) => {
  const result = processInventory(entries, accounts);
  let goldWeight = 0;
  let gold21 = 0;
  let silverWeight = 0;
  let accessoryCount = 0;
  Object.entries(result.snapshots).forEach(([name, snapshot]) => {
    const account = accounts.find(item => item.name === name);
    if (isAccessoryAccount(account)) accessoryCount += snapshot.count;
    else if (isGoldAccount(account)) {
      goldWeight += snapshot.weight;
      gold21 += snapshot.arabicWeight;
    } else if (isSilverAccount(account)) silverWeight += snapshot.weight;
  });

  let merchantGold21 = 0;
  let merchantSilver = 0;
  let supportsMerchantSilver = false;
  Object.entries(result.merchantWeightLiabilities).forEach(([name, snapshot]) => {
    const account = accounts.find(item => item.name === name);
    const metal = getMerchantMetadataMetal(account);
    if (metal === 'gold') merchantGold21 += snapshot.arabicWeight;
    if (metal === 'silver') {
      supportsMerchantSilver = true;
      merchantSilver += snapshot.weight;
    }
  });

  return { goldWeight, gold21, silverWeight, accessoryCount, merchantGold21, merchantSilver, supportsMerchantSilver };
};

const movement = (
  opening: number,
  closing: number,
  flow: { inflows: number; outflows: number; internalTransfers: number },
  unit: MonthlyInventoryMovement['unit'],
): MonthlyInventoryMovement => ({
  opening,
  inflows: flow.inflows,
  outflows: flow.outflows,
  adjustments: closing - opening - flow.inflows + flow.outflows,
  internalTransfers: flow.internalTransfers,
  closing,
  unit,
});

const buildSnapshot = (
  entries: Entry[],
  accounts: Account[],
  startDate: string,
  endDate: string,
  costTimeline?: InventoryCostTimeline | null,
): MonthlySnapshot => {
  const index = buildAccountIndex(accounts);
  const openingEntries = entries.filter(entry =>
    !!entry.date && (entry.date < startDate || (resolveOperationKind(entry) === 'opening' && entry.date <= endDate)));
  const closingEntries = entries.filter(entry => !!entry.date && entry.date <= endDate);
  const periodEntries = entries.filter(entry =>
    !!entry.date && entry.date >= startDate && entry.date <= endDate && resolveOperationKind(entry) !== 'opening');
  const openingInventory = inventoryTotals(openingEntries, accounts);
  const closingInventory = inventoryTotals(closingEntries, accounts);
  const flows = emptyMovementAccumulator();
  const saleOperations = new Set<string>();
  const purchaseOperations = new Set<string>();

  let sales = 0;
  let goldSales = 0;
  let silverSales = 0;
  let purchases = 0;
  let goldSalesWeight = 0;
  let goldSalesWeight21 = 0;
  let silverSalesWeight = 0;
  let goldPurchaseWeight = 0;
  let silverPurchaseWeight = 0;
  let workmanshipRevenue = 0;
  let operatingExpenses = 0;
  let personalWithdrawals = 0;
  let cashIn = 0;
  let cashOut = 0;

  periodEntries.forEach((entry, entryIndex) => {
    const kind = resolveOperationKind(entry);
    const debit = resolveAccount(entry, 'debit', index);
    const credit = resolveAccount(entry, 'credit', index);
    const cash = parseCash(entry);
    const weight = parseWeight(entry.weight);
    const count = parseWeight(entry.weight) || (parseFloat(entry.count || '0') || 0);
    const debitCash = isCashAccount(debit);
    const creditCash = isCashAccount(credit);
    const debitInventory = debit?.is_inventory ? debit : undefined;
    const creditInventory = credit?.is_inventory ? credit : undefined;

    if (debitCash) cashIn += cash;
    if (creditCash) cashOut += cash;

    if (kind === 'sale') {
      sales += cash;
      saleOperations.add(operationKey(entry, entryIndex));
      if (isGoldAccount(creditInventory)) {
        goldSales += cash;
        goldSalesWeight += weight;
        goldSalesWeight21 += getEntryArabicWeight(entry, creditInventory);
      } else if (isSilverAccount(creditInventory)) {
        silverSales += cash;
        silverSalesWeight += weight;
      }
    }

    if (kind === 'purchase') {
      purchases += cash;
      purchaseOperations.add(operationKey(entry, entryIndex));
      if (isGoldAccount(debitInventory)) goldPurchaseWeight += weight;
      if (isSilverAccount(debitInventory)) silverPurchaseWeight += weight;
    }

    const debitDetails = getAccountTypeDetails(entry.debit, accounts);
    const creditDetails = getAccountTypeDetails(entry.credit, accounts);
    if (debitDetails.main === 'expenses' && kind !== 'personal_withdrawal') operatingExpenses += cash;
    if (creditDetails.main === 'revenue' && kind !== 'sale') workmanshipRevenue += cash;
    if (kind === 'personal_withdrawal') personalWithdrawals += cash;

    const applyInventoryFlow = (account: Account | undefined, side: 1 | -1) => {
      if (!account?.is_inventory) return;
      const keys: Array<[MovementKey, number]> = [];
      if (isAccessoryAccount(account)) keys.push(['accessories', count]);
      else if (isGoldAccount(account)) {
        keys.push(['gold', weight], ['gold21', getEntryArabicWeight(entry, account)]);
      } else if (isSilverAccount(account)) keys.push(['silver', weight]);

      keys.forEach(([key, quantity]) => {
        if (kind === 'purchase' && side === 1) flows[key].inflows += quantity;
        else if (kind === 'sale' && side === -1) flows[key].outflows += quantity;
        else if (kind === 'transfer' || kind === 'tifeet') flows[key].internalTransfers += Math.abs(quantity);
      });
    };
    applyInventoryFlow(debitInventory, 1);
    applyInventoryFlow(creditInventory, -1);
  });

  const incomeStatement = buildIncomeStatementReport(periodEntries, accounts, startDate, endDate);
  const costResults = costTimeline?.valid
    ? costTimeline.results.filter(result =>
      result.classification === 'sale' && result.entry.date >= startDate && result.entry.date <= endDate)
    : null;
  const cogs = costResults
    ? available(costResults.reduce((sum, result) => sum + result.totalCogsMinor, 0) / 100)
    : unavailable('غير متاح مؤقتًا بسبب مشكلة في مصدر بيانات التكلفة');
  const grossProfit = cogs.value === null ? unavailable(cogs.reason || 'تكلفة المبيعات غير متاحة') : available(sales - cogs.value);
  const netOperatingProfit = grossProfit.value === null
    ? unavailable(grossProfit.reason || 'الربح الإجمالي غير متاح')
    : available(grossProfit.value + workmanshipRevenue - operatingExpenses);

  const maxEntryDate = entries.reduce((max, entry) => entry.date > max ? entry.date : max, '');
  const isLatestClosing = !maxEntryDate || endDate >= maxEntryDate;
  const accessoryCost = costTimeline?.valid && isLatestClosing
    ? available(Object.values(costTimeline.finalStates)
      .filter(state => state.kind === 'accessory')
      .reduce((sum, state) => sum + state.remainingTotalCostMinor, 0) / 100)
    : unavailable(isLatestClosing ? 'مصدر التكلفة غير صالح' : 'التكلفة التاريخية للملحقات غير مدعومة', isLatestClosing ? 'data_issue' : 'unsupported');

  const merchantGoldFlow = {
    inflows: Math.max(0, closingInventory.merchantGold21 - openingInventory.merchantGold21),
    outflows: Math.max(0, openingInventory.merchantGold21 - closingInventory.merchantGold21),
    internalTransfers: 0,
  };
  const merchantSilverFlow = {
    inflows: Math.max(0, closingInventory.merchantSilver - openingInventory.merchantSilver),
    outflows: Math.max(0, openingInventory.merchantSilver - closingInventory.merchantSilver),
    internalTransfers: 0,
  };

  return {
    month: startDate.slice(0, 7),
    hasActivity: periodEntries.length > 0,
    sales,
    goldSales,
    silverSales,
    purchases,
    goldSalesWeight,
    goldSalesWeight21,
    silverSalesWeight,
    goldPurchaseWeight,
    silverPurchaseWeight,
    saleCount: saleOperations.size,
    purchaseCount: purchaseOperations.size,
    workmanshipRevenue,
    operatingExpenses,
    personalWithdrawals,
    cashIn,
    cashOut,
    openingCash: cashBalance(openingEntries, accounts),
    closingCash: cashBalance(closingEntries, accounts),
    cashLiabilities: 0,
    cogs,
    grossProfit,
    netOperatingProfit,
    grossMargin: grossProfit.value === null ? unavailable(grossProfit.reason || 'غير متاح') : safePercent(grossProfit.value, sales),
    netMargin: netOperatingProfit.value === null ? unavailable(netOperatingProfit.reason || 'غير متاح') : safePercent(netOperatingProfit.value, sales + workmanshipRevenue),
    goldInventoryWeight: closingInventory.goldWeight,
    goldInventory21: closingInventory.gold21,
    silverInventoryWeight: closingInventory.silverWeight,
    merchantGoldLiabilities21: closingInventory.merchantGold21,
    merchantSilverLiabilities: closingInventory.supportsMerchantSilver ? closingInventory.merchantSilver : null,
    netOwnedGold21: closingInventory.gold21 - closingInventory.merchantGold21,
    netOwnedSilver: closingInventory.supportsMerchantSilver ? closingInventory.silverWeight - closingInventory.merchantSilver : null,
    accessoryCount: closingInventory.accessoryCount,
    accessoryCost,
    goldProfitWeight: incomeStatement.gold.net,
    goldProfitWeight21: incomeStatement.gold.net,
    silverProfitWeight: incomeStatement.silver.net,
    inventory: {
      gold: movement(openingInventory.goldWeight, closingInventory.goldWeight, flows.gold, 'gram'),
      gold21: movement(openingInventory.gold21, closingInventory.gold21, flows.gold21, 'gold21'),
      silver: movement(openingInventory.silverWeight, closingInventory.silverWeight, flows.silver, 'gram'),
      accessories: movement(openingInventory.accessoryCount, closingInventory.accessoryCount, flows.accessories, 'count'),
      merchantGold: movement(openingInventory.merchantGold21, closingInventory.merchantGold21, merchantGoldFlow, 'gold21'),
      merchantSilver: closingInventory.supportsMerchantSilver
        ? movement(openingInventory.merchantSilver, closingInventory.merchantSilver, merchantSilverFlow, 'gram')
        : null,
    },
  };
};

const comparison = (current: MonthlyMetric, previous: MonthlyMetric): MonthlyComparison => {
  if (current.value === null || previous.value === null) {
    return { previousValue: previous.value, change: null, changePercent: null, comparable: false };
  }
  const change = current.value - previous.value;
  return {
    previousValue: previous.value,
    change,
    changePercent: previous.value === 0 ? null : (change / Math.abs(previous.value)) * 100,
    comparable: previous.value !== 0,
  };
};

const kpi = (
  id: string,
  label: string,
  unit: MonthlyMetricUnit,
  current: MonthlyMetric,
  previous: MonthlyMetric,
): MonthlyKpi => ({ id, label, unit, current, comparison: comparison(current, previous) });

const snapshotValue = (snapshot: MonthlySnapshot, key: keyof MonthlySnapshot): MonthlyMetric => {
  const value = snapshot[key];
  return typeof value === 'number' ? available(value) : value && typeof value === 'object' && 'status' in value
    ? value as MonthlyMetric
    : unavailable('المؤشر غير مدعوم', 'unsupported');
};

const buildKpis = (current: MonthlySnapshot, previous: MonthlySnapshot): MonthlyKpi[] => {
  const definitions: Array<[string, string, MonthlyMetricUnit, keyof MonthlySnapshot]> = [
    ['sales', 'إجمالي المبيعات النقدية', 'currency', 'sales'],
    ['goldSales', 'مبيعات الذهب', 'currency', 'goldSales'],
    ['goldSalesWeight', 'وزن الذهب المباع', 'gram', 'goldSalesWeight'],
    ['goldSalesWeight21', 'الوزن العربي المباع', 'gold21', 'goldSalesWeight21'],
    ['silverSales', 'مبيعات الفضة', 'currency', 'silverSales'],
    ['silverSalesWeight', 'وزن الفضة المباع', 'gram', 'silverSalesWeight'],
    ['purchases', 'إجمالي المشتريات', 'currency', 'purchases'],
    ['goldPurchaseWeight', 'وزن الذهب المشترى', 'gram', 'goldPurchaseWeight'],
    ['silverPurchaseWeight', 'وزن الفضة المشترى', 'gram', 'silverPurchaseWeight'],
    ['cogs', 'COGS', 'currency', 'cogs'],
    ['grossProfit', 'Gross Profit', 'currency', 'grossProfit'],
    ['netOperatingProfit', 'Net Operating Profit', 'currency', 'netOperatingProfit'],
    ['grossMargin', 'Gross Margin', 'percent', 'grossMargin'],
    ['netMargin', 'Net Margin', 'percent', 'netMargin'],
    ['workmanshipRevenue', 'المصنعية والخدمات', 'currency', 'workmanshipRevenue'],
    ['operatingExpenses', 'المصروفات التشغيلية', 'currency', 'operatingExpenses'],
    ['closingCash', 'الرصيد النقدي الختامي', 'currency', 'closingCash'],
    ['goldInventoryWeight', 'مخزون الذهب الفعلي', 'gram', 'goldInventoryWeight'],
    ['goldInventory21', 'مخزون الذهب العربي', 'gold21', 'goldInventory21'],
    ['merchantGoldLiabilities21', 'التزامات تجار الذهب', 'gold21', 'merchantGoldLiabilities21'],
    ['netOwnedGold21', 'صافي الذهب المملوك', 'gold21', 'netOwnedGold21'],
    ['silverInventoryWeight', 'مخزون الفضة', 'gram', 'silverInventoryWeight'],
    ['accessoryCount', 'عدد الملحقات', 'count', 'accessoryCount'],
    ['accessoryCost', 'تكلفة الملحقات', 'currency', 'accessoryCost'],
  ];
  const result = definitions.map(([id, label, unit, key]) =>
    kpi(id, label, unit, snapshotValue(current, key), snapshotValue(previous, key)));
  if (current.merchantSilverLiabilities !== null) {
    result.push(kpi('merchantSilverLiabilities', 'التزامات تجار الفضة', 'gram', available(current.merchantSilverLiabilities), previous.merchantSilverLiabilities === null ? unavailable('لا توجد بيانات مقارنة', 'insufficient_data') : available(previous.merchantSilverLiabilities)));
  }
  if (current.netOwnedSilver !== null) {
    result.push(kpi('netOwnedSilver', 'صافي الفضة المملوكة', 'gram', available(current.netOwnedSilver), previous.netOwnedSilver === null ? unavailable('لا توجد بيانات مقارنة', 'insufficient_data') : available(previous.netOwnedSilver)));
  }
  return result;
};

const monthOffset = (year: number, month: number, offset: number) => {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

const trendPoint = (snapshot: MonthlySnapshot): MonthlyTrendPoint => ({
  month: snapshot.month,
  label: snapshot.month,
  sales: snapshot.sales,
  purchases: snapshot.purchases,
  grossProfit: snapshot.grossProfit.value,
  netOperatingProfit: snapshot.netOperatingProfit.value,
  closingCash: snapshot.closingCash,
  goldInventory21: snapshot.goldInventory21,
  merchantGoldLiabilities21: snapshot.merchantGoldLiabilities21,
  goldSalesWeight: snapshot.goldSalesWeight,
  operatingExpenses: snapshot.operatingExpenses,
});

export const buildMonthlyReport = (input: BuildMonthlyReportInput): MonthlyReportData => {
  const { entries, accounts, year, month, costTimeline, goldPrice } = input;
  const period = createMonthlyReportPeriod(year, month);
  const current = buildSnapshot(entries, accounts, period.startDate, period.endDate, costTimeline);
  const previous = buildSnapshot(entries, accounts, period.previousStartDate, period.previousEndDate, costTimeline);
  const rolling3 = [-3, -2, -1].map(offset => {
    const target = monthOffset(year, month, offset);
    const targetPeriod = createMonthlyReportPeriod(target.year, target.month);
    return buildSnapshot(entries, accounts, targetPeriod.startDate, targetPeriod.endDate, costTimeline);
  });
  const ytd = buildSnapshot(entries, accounts, period.ytdStartDate, period.endDate, costTimeline);
  const trends = [-5, -4, -3, -2, -1, 0].map(offset => {
    const target = monthOffset(year, month, offset);
    const targetPeriod = createMonthlyReportPeriod(target.year, target.month);
    return trendPoint(buildSnapshot(entries, accounts, targetPeriod.startDate, targetPeriod.endDate, costTimeline));
  });

  const periodEntries = entries.filter(entry => entry.date <= period.endDate);
  const operatingEntries = entries.filter(entry =>
    entry.date >= period.startDate && entry.date <= period.endDate && resolveOperationKind(entry) !== 'opening');
  const incomeStatement = buildIncomeStatementReport(operatingEntries, accounts, period.startDate, period.endDate);
  const equity = buildEquityStatementReport(operatingEntries, accounts, incomeStatement);
  const position = buildFinancialPositionReport(periodEntries, accounts, equity);
  current.cashLiabilities = position.cash.liabilities.total;
  const trialCash = buildTrialBalanceReport(entries, accounts, 'cash', period.startDate, period.endDate);
  const trialGold = buildTrialBalanceReport(entries, accounts, 'gold', period.startDate, period.endDate);
  const trialSilver = buildTrialBalanceReport(entries, accounts, 'silver', period.startDate, period.endDate);

  const insights = buildMonthlyDecisionInsights({ current, previous, rolling3 });
  const healthStatus = deriveMonthlyHealthStatus(current, insights);
  const highlights = [
    `المبيعات ${current.sales.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م خلال ${current.saleCount.toLocaleString('ar-EG')} عملية.`,
    current.netOperatingProfit.value === null
      ? 'نتيجة التشغيل غير متاحة حتى يكتمل مصدر التكلفة.'
      : `صافي نتيجة التشغيل ${current.netOperatingProfit.value.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م.`,
    `صافي الذهب المملوك ${current.netOwnedGold21.toLocaleString('ar-EG', { maximumFractionDigits: 3 })} جم عيار 21.`,
  ];

  const latestEntryDate = entries.reduce((max, entry) => entry.date > max ? entry.date : max, '');
  const canUseFinalCost = !!costTimeline?.valid && (!latestEntryDate || period.endDate >= latestEntryDate);
  const goldBookCost = canUseFinalCost
    ? Object.values(costTimeline!.finalStates).filter(state => state.kind === 'gold').reduce((sum, state) => sum + state.remainingTotalCostMinor, 0) / 100
    : null;
  const marketValue = goldPrice && goldPrice > 0 ? current.goldInventory21 * goldPrice : null;

  return {
    period,
    current,
    previous,
    rolling3,
    ytd,
    trends,
    kpis: buildKpis(current, previous),
    insights,
    healthStatus,
    highlights,
    accountingSummary: {
      trialBalance: { cashDifference: trialCash.difference, goldDifference: trialGold.difference, silverDifference: trialSilver.difference },
      incomeStatement: { cashRevenue: incomeStatement.cash.revenue.total, cashExpenses: incomeStatement.cash.expenses.total, cashNet: incomeStatement.cash.net },
      financialPosition: { cashAssets: position.cash.assets.total, cashLiabilities: position.cash.liabilities.total, goldOwned21: current.netOwnedGold21 },
      equity: { cashChange: equity.cash.totalChange, goldChange: equity.gold.totalChange, silverChange: equity.silver.totalChange },
    },
    marketRevaluation: marketValue === null
      ? { status: 'unsupported', inventoryMarketValue: null, inventoryBookCost: goldBookCost, revaluationDifference: null, price: null, source: null }
      : {
        status: goldBookCost === null ? 'data_issue' : 'available',
        inventoryMarketValue: marketValue,
        inventoryBookCost: goldBookCost,
        revaluationDifference: goldBookCost === null ? null : marketValue - goldBookCost,
        price: goldPrice!,
        source: 'إعداد سعر الذهب الحالي بالتطبيق',
      },
    warnings: costTimeline?.valid ? [] : ['غير متاح مؤقتًا بسبب مشكلة في مصدر بيانات التكلفة: COGS والربحية التشغيلية.'],
  };
};
