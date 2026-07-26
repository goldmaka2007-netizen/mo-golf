import { Account, Entry, AccountingOperationKind } from '../types';
import {
  ACCESSORY_QUANTITY_SCALE,
  compareEntriesForCost,
  formatAccessoryQuantityUnits,
  getOperationId,
  isQuantityAlignedToStep,
  parseAccessoryQuantityUnits,
  rebuildCostTimeline,
  type CostTimelineResult,
  type OperationCostResult,
  type OpeningCostConfig,
} from './weightedAverageCost';
import {
  buildAccountIndex,
  getEntryArabicWeight,
  isAccessoryAccount,
  isGoldAccount,
  isInventoryAccount,
  isSilverAccount,
  processInventory,
  resolveAccount,
  resolveOperationKind,
  parseCash,
} from './engine';
import { parseWeight } from './accounting';
import { applyWarningState, createDefaultWarningState, type InventoryWarningReviewRecord, type InventoryWarningState } from './inventoryCycleWarnings';

export type InventoryCycleTab = 'gold' | 'silver' | 'accessory';
export type PeriodPreset = 'current-month' | 'year-to-date' | 'custom' | `month-${number}`;
export type ReportCacheStatus = 'current' | 'rebuilding' | 'stale' | 'failed';
export type WarningSeverity = 'critical' | 'medium' | 'info';

export interface InventoryCycleFilters {
  periodPreset: PeriodPreset;
  startDate: string;
  endDate: string;
  accountId: string;
  movementKind: 'all' | AccountingOperationKind;
  chartGrouping?: 'daily' | 'weekly' | 'monthly';
}

export interface InventoryCycleWarning {
  id: string;
  severity: WarningSeverity;
  type: string;
  typeCode: string;
  status?: 'active' | 'reviewed';
  accountId?: string;
  accountName?: string;
  operationId?: string;
  operationNumber?: string;
  date?: string;
  description: string;
}

export interface InventoryCycleOperationRow {
  id: string;
  date: string;
  invoiceNumber: string;
  journalNumber: string;
  tx: string;
  kind: AccountingOperationKind;
  direction: 'in' | 'out' | 'neutral';
  accountName: string;
  debit: string;
  credit: string;
  karat?: string;
  physicalQuantity: number;
  equivalent21?: number;
  cash: number;
  movedCost: number | null;
  averageBefore: number | null;
  averageAfter: number | null;
  balanceBefore: number;
  balanceAfter: number;
  cogs: number | null;
  revenue: number;
  grossProfit: number | null;
  notes?: string;
  status?: OperationCostResult['status'];
}

export interface InventoryCycleSeriesPoint {
  date: string;
  balance: number;
  averageCost?: number | null;
  bookValue?: number;
  sales?: number;
  cogs?: number;
  grossProfit?: number;
}

export interface InventoryCycleItemReport {
  account: Account;
  accountId: string;
  accountName: string;
  isActive: boolean;
  openingPhysical: number;
  openingEquivalent21?: number;
  openingCost: number | null;
  openingAverage: number | null;
  incoming: number;
  outgoing: number;
  closingPhysical: number;
  closingEquivalent21?: number;
  closingCost: number | null;
  closingAverage: number | null;
  purchaseQuantity: number;
  transferIn: number;
  transferOut: number;
  tifeetIn: number;
  tifeetOut: number;
  surplus: number;
  shortage: number;
  salesQuantity: number;
  salesRevenue: number;
  cogs: number | null;
  grossProfit: number | null;
  averageSalePrice: number | null;
  averageProfitPerUnit: number | null;
  grossMarginPct: number | null;
  adjustmentGain: number;
  adjustmentLoss: number;
  operationalResult: number | null;
  marketValue?: number | null;
  revaluation?: number | null;
  operations: InventoryCycleOperationRow[];
  warnings: InventoryCycleWarning[];
  chart: InventoryCycleSeriesPoint[];
  karatBreakdown?: Record<string, { openingPhysical: number; closingPhysical: number; movementPhysical: number }>;
}

export interface InventoryCycleReport {
  tab: InventoryCycleTab;
  filters: InventoryCycleFilters;
  cache: { status: ReportCacheStatus; updatedAt: string; lastUpdatedAt?: string; lastOperationId?: string; lastIncludedOperationNo?: string; error?: string };
  movementKinds: AccountingOperationKind[];
  accounts: Account[];
  items: InventoryCycleItemReport[];
  warnings: InventoryCycleWarning[];
  reviewedWarnings: InventoryWarningReviewRecord[];
  summary: {
    opening: number;
    incoming: number;
    outgoing: number;
    closing: number;
    closingCost: number | null;
    averageCost: number | null;
    marketValue?: number | null;
    revaluation?: number | null;
    operationsCount: number;
    activeItemCount?: number;
    salesRevenue: number;
    cogs: number | null;
    grossProfit: number | null;
    adjustmentGain: number;
    adjustmentLoss: number;
    operationalResult: number | null;
    warningsCount: number;
    criticalWarnings: number;
    mediumWarnings: number;
    infoWarnings: number;
  };
  chart: InventoryCycleSeriesPoint[];
}

const keyOf = (account: Account): string => account.id ?? account.name;
const isSameAccount = (account: Account, idOrName: string): boolean => keyOf(account) === idOrName || account.name === idOrName;
const isInPeriod = (entry: Entry, startDate: string, endDate: string): boolean => !!entry.date && entry.date >= startDate && entry.date <= endDate;
const isBefore = (entry: Entry, date: string): boolean => !entry.date || entry.date < date;
const isAtOrBefore = (entry: Entry, date: string): boolean => !entry.date || entry.date <= date;

const accountMatchesTab = (account: Account, tab: InventoryCycleTab): boolean => {
  if (!isInventoryAccount(account)) return false;
  if (tab === 'gold') return isGoldAccount(account);
  if (tab === 'silver') return isSilverAccount(account);
  return isAccessoryAccount(account);
};

const getQuantity = (entry: Entry, account: Account, tab: InventoryCycleTab): number => {
  if (tab === 'accessory') return formatAccessoryQuantityUnits(parseAccessoryQuantityUnits(entry.count));
  if (tab === 'silver') return parseWeight(entry.weight);
  return getEntryArabicWeight(entry, account);
};

const getPhysicalQuantity = (entry: Entry, _account: Account, tab: InventoryCycleTab): number => {
  if (tab === 'accessory') return formatAccessoryQuantityUnits(parseAccessoryQuantityUnits(entry.count));
  return parseWeight(entry.weight);
};

const getStateCost = (timeline: CostTimelineResult, account: Account, tab: InventoryCycleTab): { cost: number | null; average: number | null } => {
  const state = timeline.finalStates[keyOf(account)] ?? timeline.finalStates[account.name];
  if (!state || state.quantityUnits <= 0) return { cost: 0, average: null };
  if (!state.hasReliableCostBasis) return { cost: null, average: null };
  const divisor = tab === 'accessory' ? ACCESSORY_QUANTITY_SCALE : 100;
  return {
    cost: state.totalCostMinor / 100,
    average: state.totalCostMinor / state.quantityUnits * divisor / 100,
  };
};

const getInventorySnapshotQuantity = (entries: Entry[], accountsDb: Account[], account: Account, tab: InventoryCycleTab): { physical: number; equivalent?: number } => {
  const snapshot = processInventory(entries, accountsDb).snapshots[account.name];
  if (!snapshot) return { physical: 0, equivalent: tab === 'gold' ? 0 : undefined };
  if (tab === 'accessory') return { physical: snapshot.count };
  if (tab === 'silver') return { physical: snapshot.weight };
  return { physical: snapshot.weight, equivalent: snapshot.arabicWeight };
};

const warningSeverity = (status: OperationCostResult['status']): WarningSeverity => {
  if (status === 'insufficient_inventory' || status === 'invalid_operation' || status === 'quantity_mismatch') return 'critical';
  if (status === 'missing_cost_basis') return 'medium';
  return 'info';
};

const costWarning = (result: OperationCostResult, account: Account): InventoryCycleWarning | null => {
  if (result.status === 'valid') return null;
  const typeCode = resolveOperationKind(result.entry) === 'opening' && result.status === 'missing_cost_basis' ? 'missing_opening_cost' : result.status;
  const typeMap: Record<string, string> = {
    missing_cost_basis: 'تكلفة غير متاحة',
    insufficient_inventory: 'خروج أكبر من الرصيد',
    invalid_operation: 'بيانات عملية غير مكتملة',
    quantity_mismatch: 'عدم اتساق الكمية',
  };
  return {
    id: `${result.operationId}-${account.id ?? account.name}-${result.status}`,
    severity: warningSeverity(result.status),
    type: typeMap[typeCode] ?? typeMap[result.status] ?? result.status,
    typeCode,
    accountId: keyOf(account),
    accountName: account.name,
    operationId: result.operationId,
    operationNumber: result.entry.invoiceNumber || String(result.entry.seq ?? ''),
    date: result.entry.date,
    description: result.message || typeMap[result.status] || 'تحذير تكلفة',
  };
};

const operationAverage = (value: number | null | undefined, tab: InventoryCycleTab): number | null => {
  if (value === null || value === undefined) return null;
  return tab === 'accessory' ? value / 100 : value;
};

const buildOperationRow = (entry: Entry, account: Account, tab: InventoryCycleTab, direction: 'in' | 'out', result?: OperationCostResult): InventoryCycleOperationRow => {
  const quantity = getQuantity(entry, account, tab);
  const physical = getPhysicalQuantity(entry, account, tab);
  const revenue = resolveOperationKind(entry) === 'sale' && direction === 'out' ? parseCash(entry) : 0;
  const movedCostMinor = direction === 'in' ? result?.incomingCostMinor : result?.outgoingCostMinor;
  const cogs = result?.status === 'valid' && result.cogsMinor > 0 ? result.cogsMinor / 100 : null;
  const grossProfit = cogs === null || revenue === 0 ? null : revenue - cogs;
  return {
    id: getOperationId(entry),
    date: entry.date || '',
    invoiceNumber: entry.invoiceNumber || '',
    journalNumber: String((entry as any).journalNo ?? entry.seq ?? ''),
    tx: entry.tx || '',
    kind: resolveOperationKind(entry),
    direction,
    accountName: account.name,
    debit: entry.debit,
    credit: entry.credit,
    karat: String(account.karat ?? entry.karat ?? ''),
    physicalQuantity: physical,
    equivalent21: tab === 'gold' ? quantity : undefined,
    cash: parseCash(entry),
    movedCost: result?.status === 'valid' && movedCostMinor !== undefined ? movedCostMinor / 100 : null,
    averageBefore: operationAverage(result?.averageCostBefore, tab),
    averageAfter: operationAverage(result?.averageCostAfter, tab),
    balanceBefore: result ? (tab === 'accessory' ? formatAccessoryQuantityUnits(result.quantityBeforeUnits) : result.quantityBeforeUnits / 100) : 0,
    balanceAfter: result ? (tab === 'accessory' ? formatAccessoryQuantityUnits(result.quantityAfterUnits) : result.quantityAfterUnits / 100) : 0,
    cogs,
    revenue,
    grossProfit,
    notes: entry.notes,
    status: result?.status,
  };
};

const addMovement = (item: InventoryCycleItemReport, kind: AccountingOperationKind, direction: 'in' | 'out', qty: number, result?: OperationCostResult) => {
  if (direction === 'in') item.incoming += qty;
  if (direction === 'out') item.outgoing += qty;
  if (kind === 'purchase' || kind === 'opening') item.purchaseQuantity += direction === 'in' ? qty : 0;
  if (kind === 'sale') item.salesQuantity += direction === 'out' ? qty : 0;
  if (kind === 'transfer') direction === 'in' ? item.transferIn += qty : item.transferOut += qty;
  if (kind === 'tifeet') direction === 'in' ? item.tifeetIn += qty : item.tifeetOut += qty;
  if (kind === 'adjustment') {
    if (direction === 'in') item.surplus += qty;
    if (direction === 'out') item.shortage += qty;
  }
  if (result?.status === 'valid') {
    item.adjustmentGain += result.adjustmentGainMinor / 100;
    item.adjustmentLoss += result.adjustmentLossMinor / 100;
  }
};

const eachDay = (startDate: string, endDate: string): string[] => {
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};

export const buildInventoryCycleItemChart = (entries: Entry[], accountsDb: Account[], account: Account, tab: InventoryCycleTab, startDate: string, endDate: string, openingConfig: OpeningCostConfig): InventoryCycleSeriesPoint[] => {
  const days = eachDay(startDate, endDate);
  if (days.length > 370) {
    return [startDate, endDate].map(date => {
      const dayEntries = entries.filter(entry => isAtOrBefore(entry, date));
      const snap = getInventorySnapshotQuantity(dayEntries, accountsDb, account, tab);
      const cost = getStateCost(rebuildCostTimeline(dayEntries, accountsDb, openingConfig), account, tab);
      return { date, balance: tab === 'gold' ? snap.equivalent ?? 0 : snap.physical, averageCost: cost.average, bookValue: cost.cost ?? undefined };
    });
  }
  return days.map(date => {
    const dayEntries = entries.filter(entry => isAtOrBefore(entry, date));
    const snap = getInventorySnapshotQuantity(dayEntries, accountsDb, account, tab);
    const cost = getStateCost(rebuildCostTimeline(dayEntries, accountsDb, openingConfig), account, tab);
    return { date, balance: tab === 'gold' ? snap.equivalent ?? 0 : snap.physical, averageCost: cost.average, bookValue: cost.cost ?? undefined };
  });
};

const chooseChartGrouping = (filters: InventoryCycleFilters): 'daily' | 'weekly' | 'monthly' => {
  if (filters.chartGrouping) return filters.chartGrouping;
  const days = eachDay(filters.startDate, filters.endDate).length;
  if (days > 180) return 'monthly';
  if (days > 45) return 'weekly';
  return 'daily';
};

const formatLocalDate = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getGroupingKey = (date: string, grouping: 'daily' | 'weekly' | 'monthly'): string => {
  if (grouping === 'daily') return date;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  if (grouping === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const first = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d.getTime() - first.getTime()) / 86400000) + first.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};
export const getDefaultInventoryCycleFilters = (tab: InventoryCycleTab, now = new Date()): InventoryCycleFilters => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const startDate = formatLocalDate(new Date(y, m, 1));
  const endDate = formatLocalDate(new Date(y, m + 1, 0));
  return { periodPreset: 'current-month', startDate, endDate, accountId: 'all', movementKind: 'all', chartGrouping: tab === 'accessory' ? 'daily' : undefined };
};

export function buildInventoryCycleReport(args: {
  entries: Entry[];
  accountsDb: Account[];
  tab: InventoryCycleTab;
  filters: InventoryCycleFilters;
  goldPrice: number;
  silverPrice: number;
  openingConfig?: OpeningCostConfig;
  warningState?: InventoryWarningState;
  cacheMeta?: Partial<InventoryCycleReport['cache']>;
}): InventoryCycleReport {
  const { entries, accountsDb, tab, filters, goldPrice, silverPrice, openingConfig = {}, warningState = createDefaultWarningState(), cacheMeta = {} } = args;
  const sorted = [...entries].sort(compareEntriesForCost);
  const allAccounts = accountsDb.filter(account => accountMatchesTab(account, tab));
  const accounts = filters.accountId === 'all' ? allAccounts : allAccounts.filter(account => isSameAccount(account, filters.accountId));
  const index = buildAccountIndex(accountsDb);
  const preEntries = sorted.filter(entry => isBefore(entry, filters.startDate));
  const endEntries = sorted.filter(entry => isAtOrBefore(entry, filters.endDate));
  const periodEntries = sorted.filter(entry => isInPeriod(entry, filters.startDate, filters.endDate));
  const preTimeline = rebuildCostTimeline(preEntries, accountsDb, openingConfig);
  const endTimeline = rebuildCostTimeline(endEntries, accountsDb, openingConfig);
  const periodCostResults = endTimeline.resultsByOperationId;
  const movementKinds = Array.from(new Set(periodEntries.map(resolveOperationKind))).filter(kind => kind !== 'other');

  const items = accounts.map(account => {
    const openingSnap = getInventorySnapshotQuantity(preEntries, accountsDb, account, tab);
    const closingSnap = getInventorySnapshotQuantity(endEntries, accountsDb, account, tab);
    const openingCost = getStateCost(preTimeline, account, tab);
    const closingCost = getStateCost(endTimeline, account, tab);
    const item: InventoryCycleItemReport = {
      account,
      accountId: keyOf(account),
      accountName: account.name,
      isActive: account.isActive !== false,
      openingPhysical: openingSnap.physical,
      openingEquivalent21: tab === 'gold' ? openingSnap.equivalent ?? 0 : undefined,
      openingCost: openingCost.cost,
      openingAverage: openingCost.average,
      incoming: 0,
      outgoing: 0,
      closingPhysical: closingSnap.physical,
      closingEquivalent21: tab === 'gold' ? closingSnap.equivalent ?? 0 : undefined,
      closingCost: closingCost.cost,
      closingAverage: closingCost.average,
      purchaseQuantity: 0,
      transferIn: 0,
      transferOut: 0,
      tifeetIn: 0,
      tifeetOut: 0,
      surplus: 0,
      shortage: 0,
      salesQuantity: 0,
      salesRevenue: 0,
      cogs: 0,
      grossProfit: 0,
      averageSalePrice: null,
      averageProfitPerUnit: null,
      grossMarginPct: null,
      adjustmentGain: 0,
      adjustmentLoss: 0,
      operationalResult: 0,
      marketValue: tab === 'gold' ? (goldPrice > 0 ? (closingSnap.equivalent ?? 0) * goldPrice : null) : tab === 'silver' ? (silverPrice > 0 ? closingSnap.physical * silverPrice : null) : undefined,
      revaluation: undefined,
      operations: [],
      warnings: [],
      chart: [],
      karatBreakdown: tab === 'gold' ? {} : undefined,
    };

    periodEntries.forEach(entry => {
      const kind = resolveOperationKind(entry);
      if (filters.movementKind !== 'all' && filters.movementKind !== kind) return;
      const debitAcc = resolveAccount(entry, 'debit', index);
      const creditAcc = resolveAccount(entry, 'credit', index);
      const result = periodCostResults[getOperationId(entry)];
      const debitIsThis = debitAcc && isSameAccount(account, keyOf(debitAcc));
      const creditIsThis = creditAcc && isSameAccount(account, keyOf(creditAcc));
      if (!debitIsThis && !creditIsThis) return;
      if (debitIsThis) {
        const qty = getQuantity(entry, account, tab);
        addMovement(item, kind, 'in', qty, result);
        item.operations.push(buildOperationRow(entry, account, tab, 'in', result));
      }
      if (creditIsThis) {
        const qty = getQuantity(entry, account, tab);
        addMovement(item, kind, 'out', qty, result);
        const row = buildOperationRow(entry, account, tab, 'out', result);
        item.operations.push(row);
        if (kind === 'sale') {
          item.salesRevenue += row.revenue;
          if (row.cogs === null) item.cogs = null;
          else if (item.cogs !== null) item.cogs += row.cogs;
        }
      }
      if (result) {
        const warning = costWarning(result, account);
        if (warning && !item.warnings.some(existing => existing.id === warning.id)) item.warnings.push(warning);
      }
      if (tab === 'accessory' && !isQuantityAlignedToStep(entry.count, account.quantityStep ?? 1)) {
        item.warnings.push({
          id: `${getOperationId(entry)}-${keyOf(account)}-quantity-step`,
          severity: 'medium',
          type: 'كمية لا تتوافق مع quantityStep',
          typeCode: 'quantity_step_mismatch',
          accountId: keyOf(account),
          accountName: account.name,
          operationId: getOperationId(entry),
          operationNumber: entry.invoiceNumber || String(entry.seq ?? ''),
          date: entry.date,
          description: `الكمية ${entry.count || '0'} ليست من مضاعفات خطوة الصنف ${account.quantityStep ?? 1}.`,
        });
      }
    });

    if (tab === 'gold' && item.karatBreakdown) {
      const karat = String(account.karat ?? '21');
      item.karatBreakdown[karat] = {
        openingPhysical: item.openingPhysical,
        closingPhysical: item.closingPhysical,
        movementPhysical: item.incoming - item.outgoing,
      };
    }

    item.operations.sort((a, b) => a.date.localeCompare(b.date) || a.journalNumber.localeCompare(b.journalNumber) || a.id.localeCompare(b.id));
    if (item.cogs === null) item.grossProfit = null;
    else item.grossProfit = item.salesRevenue - item.cogs;
    item.averageSalePrice = item.salesQuantity > 0 ? item.salesRevenue / item.salesQuantity : null;
    item.averageProfitPerUnit = item.salesQuantity > 0 && item.grossProfit !== null ? item.grossProfit / item.salesQuantity : null;
    item.grossMarginPct = item.salesRevenue > 0 && item.grossProfit !== null ? (item.grossProfit / item.salesRevenue) * 100 : null;
    item.operationalResult = item.grossProfit === null ? null : item.grossProfit + item.adjustmentGain - item.adjustmentLoss;
    item.revaluation = item.marketValue === undefined || item.marketValue === null || item.closingCost === null ? null : item.marketValue - item.closingCost;
    if (tab !== 'accessory') {
      const closingBalance = tab === 'gold' ? item.closingEquivalent21 ?? 0 : item.closingPhysical;
      if (closingBalance < -0.0001) {
        item.warnings.push({ id: `${tab}-${item.accountId}-negative-balance-${filters.endDate}`, severity: 'critical', type: 'رصيد سالب', typeCode: 'negative_balance', accountId: item.accountId, accountName: item.accountName, date: filters.endDate, description: 'رصيد آخر المدة للصنف سالب.' });
      }
      item.operations.forEach(operation => {
        if (operation.averageBefore && operation.averageAfter && operation.averageBefore > 0) {
          const jump = Math.abs(operation.averageAfter - operation.averageBefore) / operation.averageBefore;
          if (jump >= 0.5) item.warnings.push({ id: `${operation.id}-${item.accountId}-average-cost-jump`, severity: 'info', type: 'قفزة غير معتادة في متوسط التكلفة', typeCode: 'unusual_average_cost_jump', accountId: item.accountId, accountName: item.accountName, operationId: operation.id, operationNumber: operation.invoiceNumber || operation.journalNumber, date: operation.date, description: 'تغير متوسط التكلفة بأكثر من 50% حول هذه العملية.' });
        }
        if (operation.kind === 'sale' && operation.grossProfit !== null && operation.revenue > 0) {
          const margin = operation.grossProfit / operation.revenue;
          if (margin > 0.6 || margin < -0.25) item.warnings.push({ id: `${operation.id}-${item.accountId}-unusual-margin`, severity: 'info', type: 'هامش ربح غير معتاد', typeCode: 'unusual_margin', accountId: item.accountId, accountName: item.accountName, operationId: operation.id, operationNumber: operation.invoiceNumber || operation.journalNumber, date: operation.date, description: 'هامش ربح البيع خارج النطاق المعتاد للمراجعة.' });
        }
      });
      if (item.revaluation !== null && item.revaluation !== undefined && item.closingCost && Math.abs(item.revaluation) / item.closingCost >= 0.5) {
        item.warnings.push({ id: `${tab}-${item.accountId}-large-revaluation-${filters.endDate}`, severity: 'info', type: 'فرق تقييم سوقي كبير', typeCode: 'large_revaluation', accountId: item.accountId, accountName: item.accountName, date: filters.endDate, description: 'فرق إعادة التقييم أكبر من 50% من القيمة الدفترية.' });
      }
    }    return item;
  }).filter(item => {
    const opening = tab === 'gold' ? item.openingEquivalent21 ?? 0 : item.openingPhysical;
    const closing = tab === 'gold' ? item.closingEquivalent21 ?? 0 : item.closingPhysical;
    return Math.abs(opening) > 0.0001 || Math.abs(closing) > 0.0001 || item.operations.length > 0;
  });

  const rawWarnings = items.flatMap(item => item.warnings).sort((a, b) => {
    const order: Record<WarningSeverity, number> = { critical: 0, medium: 1, info: 2 };
    return order[a.severity] - order[b.severity] || String(b.date ?? '').localeCompare(String(a.date ?? ''));
  });
  const warningStateResult = applyWarningState(rawWarnings, warningState, tab);
  const warnings = warningStateResult.active.sort((a, b) => {
    const order: Record<WarningSeverity, number> = { critical: 0, medium: 1, info: 2 };
    return order[a.severity] - order[b.severity] || String(b.date ?? '').localeCompare(String(a.date ?? ''));
  });
  const activeWarningIds = new Set(warnings.map(warning => warning.id));
  items.forEach(item => {
    item.warnings = item.warnings
      .map(warning => warnings.find(active => active.id === warning.id) ?? warning)
      .filter(warning => tab === 'accessory' || activeWarningIds.has(warning.id));
  });

  const sumNullable = (values: Array<number | null | undefined>): number | null => values.some(v => v === null) ? null : values.reduce((sum, value) => sum + (value ?? 0), 0);
  const closingCost = sumNullable(items.map(item => item.closingCost));
  const cogs = sumNullable(items.map(item => item.cogs));
  const grossProfit = cogs === null ? null : items.reduce((sum, item) => sum + (item.grossProfit ?? 0), 0);
  const marketValue = tab === 'accessory' ? undefined : items.some(item => item.marketValue === null) ? null : items.reduce((sum, item) => sum + (item.marketValue ?? 0), 0);
  const revaluation = tab === 'accessory' || closingCost === null || marketValue === null ? undefined : (marketValue ?? 0) - closingCost;
  const closing = items.reduce((sum, item) => sum + (tab === 'gold' ? item.closingEquivalent21 ?? 0 : item.closingPhysical), 0);

  const chart: InventoryCycleSeriesPoint[] = eachDay(filters.startDate, filters.endDate).map(date => {
    const dayEntries = endEntries.filter(entry => isAtOrBefore(entry, date));
    const inventory = processInventory(dayEntries, accountsDb);
    const timeline = tab === 'accessory' ? rebuildCostTimeline(dayEntries, accountsDb, openingConfig) : null;
    const rows = accounts.map(account => {
      const snapshot = inventory.snapshots[account.name];
      const balance = tab === 'accessory' ? snapshot?.count ?? 0 : tab === 'silver' ? snapshot?.weight ?? 0 : snapshot?.arabicWeight ?? 0;
      const bookValue = timeline ? getStateCost(timeline, account, tab).cost ?? 0 : undefined;
      return { balance, bookValue };
    });
    return {
      date,
      balance: rows.reduce((sum, row) => sum + row.balance, 0),
      bookValue: rows.reduce((sum, row) => sum + (row.bookValue ?? 0), 0),
    };
  });

  if (tab === 'accessory') {
    const grouping = chooseChartGrouping(filters);
    const grouped: Map<string, InventoryCycleSeriesPoint> = new Map();
    chart.forEach(point => grouped.set(getGroupingKey(point.date, grouping), { ...point, date: getGroupingKey(point.date, grouping), sales: 0, cogs: 0, grossProfit: 0 }));
    items.flatMap(item => item.operations).forEach(operation => {
      if (operation.kind !== 'sale') return;
      const key = getGroupingKey(operation.date, grouping);
      const row = grouped.get(key) ?? { date: key, balance: 0, bookValue: 0, sales: 0, cogs: 0, grossProfit: 0 };
      row.sales = (row.sales ?? 0) + operation.revenue;
      row.cogs = operation.cogs === null ? undefined : (row.cogs ?? 0) + operation.cogs;
      row.grossProfit = operation.grossProfit === null ? undefined : (row.grossProfit ?? 0) + operation.grossProfit;
      grouped.set(key, row);
    });
    chart.splice(0, chart.length, ...Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date)));
  }

  const lastOperationId = sorted.length ? getOperationId(sorted[sorted.length - 1]) : undefined;
  return {
    tab,
    filters,
    cache: { status: cacheMeta.status ?? 'current', updatedAt: cacheMeta.updatedAt ?? new Date().toISOString(), lastUpdatedAt: cacheMeta.lastUpdatedAt, lastOperationId, lastIncludedOperationNo: cacheMeta.lastIncludedOperationNo, error: cacheMeta.error },
    movementKinds,
    accounts: allAccounts,
    items,
    warnings,
    reviewedWarnings: warningStateResult.reviewed,
    summary: {
      opening: items.reduce((sum, item) => sum + (tab === 'gold' ? item.openingEquivalent21 ?? 0 : item.openingPhysical), 0),
      incoming: items.reduce((sum, item) => sum + item.incoming, 0),
      outgoing: items.reduce((sum, item) => sum + item.outgoing, 0),
      closing,
      closingCost,
      averageCost: closing > 0 && closingCost !== null ? closingCost / closing : null,
      marketValue,
      revaluation,
      operationsCount: items.reduce((sum, item) => sum + item.operations.length, 0),
      activeItemCount: tab === 'accessory' ? items.filter(item => item.closingPhysical > 0).length : undefined,
      salesRevenue: items.reduce((sum, item) => sum + item.salesRevenue, 0),
      cogs,
      grossProfit,
      adjustmentGain: items.reduce((sum, item) => sum + item.adjustmentGain, 0),
      adjustmentLoss: items.reduce((sum, item) => sum + item.adjustmentLoss, 0),
      operationalResult: grossProfit === null ? null : grossProfit + items.reduce((sum, item) => sum + item.adjustmentGain - item.adjustmentLoss, 0),
      warningsCount: warnings.length,
      criticalWarnings: warnings.filter(w => w.severity === 'critical').length,
      mediumWarnings: warnings.filter(w => w.severity === 'medium').length,
      infoWarnings: warnings.filter(w => w.severity === 'info').length,
    },
    chart,
  };
}









