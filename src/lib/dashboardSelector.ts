import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { parseCash, resolveOperationKind } from './engine';
import { buildFinancialStatementsEgp } from './financialStatementsEgp';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import { buildMonthlyReport } from './monthlyReportService';
import { buildOperationalProjection } from './operationalProjection';

export type DashboardTone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface DashboardMetric {
  value: number | null;
  available: boolean;
}

export interface DashboardInventoryMetric {
  weight: number | null;
  bookValue: DashboardMetric;
  marketValue: DashboardMetric;
}

export interface DashboardInsight {
  id: string;
  title: string;
  detail: string;
  tone: DashboardTone;
}

export interface DashboardActivity {
  id: string;
  entry: Entry;
  date: string;
  operationType: string;
  description: string;
  amount: number;
  status: 'مسجلة' | 'تمت التسوية';
}

export interface DashboardData {
  asOfDate: string;
  costBasisAvailable: boolean;
  snapshot: {
    cash: number;
    gold: DashboardInventoryMetric;
    silver: DashboardInventoryMetric;
    accessoriesBookValue: DashboardMetric;
    totalInventoryBookValue: DashboardMetric;
    totalAssets: DashboardMetric;
    totalLiabilities: number;
    equity: DashboardMetric;
  };
  today: {
    sales: number;
    purchases: number;
    expenses: number;
    grossProfit: DashboardMetric;
    netProfit: DashboardMetric;
  };
  month: {
    revenue: number;
    cogs: DashboardMetric;
    grossProfit: DashboardMetric;
    operatingExpenses: number;
    netProfit: DashboardMetric;
  };
  merchant: {
    goldLiability: number;
    silverLiability: number | null;
    cashBalance: number;
  };
  insights: DashboardInsight[];
  recentActivity: DashboardActivity[];
}

export interface BuildDashboardDataInput {
  entries: Entry[];
  accounts: Account[];
  canonicalDefinitions?: CanonicalAccountDefinition[];
  timeline?: InventoryCostTimeline | null;
  goldPrice: number;
  silverPrice: number;
  today: string;
}

const available = (value: number): DashboardMetric => ({ value, available: true });
const unavailable = (): DashboardMetric => ({ value: null, available: false });
const metric = (value: number | null, isAvailable = value !== null): DashboardMetric =>
  isAvailable && value !== null && Number.isFinite(value) ? available(value) : unavailable();

const operationId = (entry: Entry, index: number): string =>
  entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? `${entry.date}-${index}`);

const activityDescription = (entry: Entry): string =>
  entry.notes?.trim()
  || entry.clientName?.trim()
  || `${entry.debit || '—'} ← ${entry.credit || '—'}`;

const sortEntriesNewestFirst = (left: Entry, right: Entry): number => {
  if (left.date !== right.date) return right.date.localeCompare(left.date);
  return Number(right.seq ?? 0) - Number(left.seq ?? 0);
};

const sumOperations = (entries: Entry[], kind: ReturnType<typeof resolveOperationKind>): number =>
  entries.reduce((total, entry) =>
    total + (resolveOperationKind(entry) === kind ? Math.abs(parseCash(entry)) : 0), 0);

const dailySales = (entries: Entry[]): Array<{ date: string; amount: number }> => {
  const totals = new Map<string, number>();
  entries.forEach(entry => {
    if (!entry.date || resolveOperationKind(entry) !== 'sale') return;
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + Math.abs(parseCash(entry)));
  });
  return [...totals.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .filter(item => item.amount > 0)
    .sort((left, right) => right.amount - left.amount || left.date.localeCompare(right.date));
};

const percentChange = (current: number | null, previous: number | null): number | null =>
  current === null || previous === null || previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;

const formatMoney = (value: number): string =>
  value.toLocaleString('ar-EG', { maximumFractionDigits: 0 });

const formatPercent = (value: number): string =>
  `${Math.abs(value).toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;

const buildInsights = (
  monthEntries: Entry[],
  highestExpense: { label: string; amount: number } | null,
  currentProfit: number | null,
  previousProfit: number | null,
  openingInventoryWeight: number,
  closingInventoryWeight: number,
): DashboardInsight[] => {
  const insights: DashboardInsight[] = [];
  if (highestExpense && highestExpense.amount > 0) {
    insights.push({
      id: 'highest-expense',
      title: 'أعلى مصروف هذا الشهر',
      detail: `${highestExpense.label}: ${formatMoney(highestExpense.amount)} ج.م`,
      tone: 'warning',
    });
  }

  const salesDays = dailySales(monthEntries);
  if (salesDays.length > 0) {
    insights.push({
      id: 'best-sales-day',
      title: 'أفضل يوم مبيعات',
      detail: `${salesDays[0].date} بإجمالي ${formatMoney(salesDays[0].amount)} ج.م`,
      tone: 'positive',
    });
  }
  if (salesDays.length > 1) {
    const lowest = salesDays.at(-1)!;
    insights.push({
      id: 'lowest-sales-day',
      title: 'أقل يوم مبيعات نشط',
      detail: `${lowest.date} بإجمالي ${formatMoney(lowest.amount)} ج.م`,
      tone: 'neutral',
    });
  }

  const profitChange = percentChange(currentProfit, previousProfit);
  if (profitChange !== null) {
    insights.push({
      id: 'profit-change',
      title: 'مقارنة الربح بالشهر السابق',
      detail: `${profitChange >= 0 ? 'ارتفع' : 'انخفض'} صافي الربح ${formatPercent(profitChange)}`,
      tone: profitChange >= 0 ? 'positive' : 'negative',
    });
  }

  const inventoryChange = percentChange(closingInventoryWeight, openingInventoryWeight);
  if (inventoryChange !== null && inventoryChange <= -10) {
    insights.push({
      id: 'inventory-warning',
      title: 'تنبيه انخفاض المخزون',
      detail: `انخفض وزن مخزون الذهب ${formatPercent(inventoryChange)} خلال الشهر`,
      tone: 'warning',
    });
  }
  return insights.slice(0, 6);
};

export const buildDashboardData = ({
  entries,
  accounts,
  canonicalDefinitions = [],
  timeline,
  goldPrice,
  silverPrice,
  today,
}: BuildDashboardDataInput): DashboardData => {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const validTimeline = timeline?.valid ? timeline : null;
  const asOfEntries = entries.filter(entry => entry.date <= today);
  const monthEntries = asOfEntries.filter(entry => entry.date >= monthStart);
  const todayEntries = entries.filter(entry => entry.date === today);

  const statements = buildFinancialStatementsEgp(entries, accounts, {
    canonicalDefinitions,
    timeline: validTimeline,
    goldPriceEgp: goldPrice,
    silverPriceEgp: silverPrice,
    incomeStartDate: monthStart,
    incomeEndDate: today,
    balanceEndDate: today,
  });
  const todayStatements = buildFinancialStatementsEgp(entries, accounts, {
    canonicalDefinitions,
    timeline: validTimeline,
    incomeStartDate: today,
    incomeEndDate: today,
    balanceEndDate: today,
  });
  const monthly = buildMonthlyReport({
    entries: asOfEntries,
    accounts,
    year,
    month,
    costTimeline: validTimeline,
    goldPrice,
  });
  const operational = buildOperationalProjection(asOfEntries, accounts);
  const inventoryRows = statements.balanceSheet.inventory;
  const rowsFor = (kind: 'gold' | 'silver' | 'accessory') =>
    inventoryRows.filter(row => row.kind === kind);
  const sumBookValue = (kind: 'gold' | 'silver' | 'accessory'): number =>
    rowsFor(kind).reduce((total, row) => total + row.bookValue, 0);
  const sumMarketValue = (kind: 'gold' | 'silver'): number | null => {
    const rows = rowsFor(kind);
    if (rows.some(row => row.marketValue === null)) return null;
    return rows.reduce((total, row) => total + (row.marketValue ?? 0), 0);
  };
  const costBasisAvailable = statements.costBasisAvailable;
  const goldWeight = monthly.current.goldInventory21;
  const silverWeight = monthly.current.silverInventoryWeight;

  const highestExpenseLine = statements.incomeStatement.operatingExpenses[0];
  const currentProfit = monthly.current.netOperatingProfit.value;
  const previousProfit = monthly.previous.netOperatingProfit.value;
  const currentGoldMovement = monthly.current.inventory.gold21;

  return {
    asOfDate: today,
    costBasisAvailable,
    snapshot: {
      cash: statements.balanceSheet.assets.cash,
      gold: {
        weight: goldWeight,
        bookValue: metric(sumBookValue('gold'), costBasisAvailable),
        marketValue: metric(sumMarketValue('gold'), costBasisAvailable),
      },
      silver: {
        weight: silverWeight,
        bookValue: metric(sumBookValue('silver'), costBasisAvailable),
        marketValue: metric(sumMarketValue('silver'), costBasisAvailable),
      },
      accessoriesBookValue: metric(sumBookValue('accessory'), costBasisAvailable),
      totalInventoryBookValue: metric(
        statements.balanceSheet.assets.goldInventory
        + statements.balanceSheet.assets.silverInventory
        + statements.balanceSheet.assets.accessoriesInventory,
        costBasisAvailable,
      ),
      totalAssets: metric(statements.balanceSheet.assets.total, costBasisAvailable),
      totalLiabilities: statements.balanceSheet.liabilities.total,
      equity: metric(statements.balanceSheet.equity.total, costBasisAvailable),
    },
    today: {
      sales: sumOperations(todayEntries, 'sale'),
      purchases: sumOperations(todayEntries, 'purchase'),
      expenses: todayStatements.incomeStatement.operatingExpensesTotal,
      grossProfit: metric(todayStatements.incomeStatement.grossProfit, costBasisAvailable),
      netProfit: metric(todayStatements.incomeStatement.netProfit, costBasisAvailable),
    },
    month: {
      revenue: statements.incomeStatement.revenueTotal,
      cogs: metric(statements.incomeStatement.cogs, costBasisAvailable),
      grossProfit: metric(statements.incomeStatement.grossProfit, costBasisAvailable),
      operatingExpenses: statements.incomeStatement.operatingExpensesTotal,
      netProfit: metric(statements.incomeStatement.netProfit, costBasisAvailable),
    },
    merchant: {
      goldLiability: monthly.current.merchantGoldLiabilities21,
      silverLiability: monthly.current.merchantSilverLiabilities,
      cashBalance: operational.merchantWorkmanshipCashMovement,
    },
    insights: buildInsights(
      monthEntries,
      highestExpenseLine ? { label: highestExpenseLine.label, amount: highestExpenseLine.amount } : null,
      currentProfit,
      previousProfit,
      currentGoldMovement.opening,
      currentGoldMovement.closing,
    ),
    recentActivity: [...asOfEntries]
      .sort(sortEntriesNewestFirst)
      .slice(0, 10)
      .map((entry, index) => ({
        id: operationId(entry, index),
        entry,
        date: entry.date,
        operationType: entry.tx || resolveOperationKind(entry),
        description: activityDescription(entry),
        amount: Math.abs(parseCash(entry)),
        status: entry.isSettled ? 'تمت التسوية' : 'مسجلة',
      })),
  };
};
