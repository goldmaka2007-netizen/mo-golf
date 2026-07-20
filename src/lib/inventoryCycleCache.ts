import type { Account, Entry } from '../types';
import type { InventoryCycleFilters, InventoryCycleReport, InventoryCycleTab, ReportCacheStatus } from './inventoryCycleReport';
import { compareEntriesForCost, getOperationId } from './weightedAverageCost';
import type { OpeningCostConfig } from './weightedAverageCost';
import type { InventoryWarningState } from './inventoryCycleWarnings';

export interface InventoryCycleCacheMeta {
  status: ReportCacheStatus;
  lastUpdatedAt?: string;
  lastIncludedOperationNo?: string;
  fingerprint?: string;
  affectedFromOperationId?: string;
  error?: string;
}

export interface InventoryCycleCacheRecord {
  meta: InventoryCycleCacheMeta;
  report?: InventoryCycleReport;
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
};

const comparableUpdatedAt = (value: any): string => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value.seconds === 'number') return `${value.seconds}.${value.nanoseconds ?? 0}`;
  if (typeof value.toMillis === 'function') return String(value.toMillis());
  return '';
};

const entryFingerprint = (entry: Entry) => ({
  id: getOperationId(entry),
  seq: entry.seq,
  date: entry.date,
  tx: entry.tx,
  operationKind: entry.operationKind,
  subTx: entry.subTx,
  debit: entry.debit,
  credit: entry.credit,
  debitAccountId: entry.debitAccountId,
  creditAccountId: entry.creditAccountId,
  cash: entry.cash,
  weight: entry.weight,
  count: entry.count,
  arabicWeight: entry.arabicWeight,
  karat: entry.karat,
  multiplier: entry.multiplier,
  updatedAt: comparableUpdatedAt((entry as any).updatedAt),
  createdAt: comparableUpdatedAt(entry.createdAt),
});

const accountFingerprint = (account: Account) => ({
  id: account.id,
  name: account.name,
  type: account.type,
  metal: account.metal,
  karat: account.karat,
  is_inventory: account.is_inventory,
  quantityStep: account.quantityStep,
  isActive: account.isActive,
});

export const getLastIncludedOperationNo = (entries: Entry[]): string | undefined => {
  const sorted = [...entries].sort(compareEntriesForCost);
  const last = sorted[sorted.length - 1];
  return last ? String((last as any).operationNo ?? (last as any).journalNo ?? last.invoiceNumber ?? last.seq ?? getOperationId(last)) : undefined;
};

export const createInventoryCycleFingerprint = (args: {
  entries: Entry[];
  accountsDb: Account[];
  filters: InventoryCycleFilters;
  tab: InventoryCycleTab;
  goldPrice: number;
  silverPrice: number;
  openingConfig: OpeningCostConfig;
  warningState?: InventoryWarningState;
}): string => stableStringify({
  tab: args.tab,
  filters: args.filters,
  goldPrice: args.goldPrice,
  silverPrice: args.silverPrice,
  openingConfig: args.openingConfig,
  warningConfigs: args.warningState?.configs,
  entries: [...args.entries].sort(compareEntriesForCost).map(entryFingerprint),
  accounts: args.accountsDb.map(accountFingerprint),
});

export const findEarliestAffectedOperationId = (previousEntries: Entry[], nextEntries: Entry[]): string | undefined => {
  const previous = [...previousEntries].sort(compareEntriesForCost);
  const next = [...nextEntries].sort(compareEntriesForCost);
  const max = Math.max(previous.length, next.length);
  for (let i = 0; i < max; i += 1) {
    if (stableStringify(previous[i] ? entryFingerprint(previous[i]) : null) !== stableStringify(next[i] ? entryFingerprint(next[i]) : null)) {
      return getOperationId(next[i] ?? previous[i]);
    }
  }
  return undefined;
};

const key = (userKey: string, tab: InventoryCycleTab, filters: InventoryCycleFilters) => `inventory-cycle-cache-${userKey || 'local'}-${tab}-${filters.startDate}-${filters.endDate}-${filters.accountId}-${filters.movementKind}-${filters.chartGrouping ?? 'auto'}`;

export const loadInventoryCycleCache = (userKey: string, tab: InventoryCycleTab, filters: InventoryCycleFilters): InventoryCycleCacheRecord | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key(userKey, tab, filters)) || 'null') as InventoryCycleCacheRecord | null;
  } catch {
    return null;
  }
};

export const saveInventoryCycleCache = (userKey: string, tab: InventoryCycleTab, filters: InventoryCycleFilters, record: InventoryCycleCacheRecord) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(userKey, tab, filters), JSON.stringify(record));
  } catch {
    // Cache persistence must not make the accounting report fail; operations remain the source of truth.
  }
};

export const makeCurrentCacheRecord = (report: InventoryCycleReport, fingerprint: string, entries: Entry[]): InventoryCycleCacheRecord => ({
  meta: {
    status: 'current',
    lastUpdatedAt: new Date().toISOString(),
    lastIncludedOperationNo: getLastIncludedOperationNo(entries),
    fingerprint,
  },
  report: { ...report, cache: { status: 'current', updatedAt: new Date().toISOString(), lastOperationId: getLastIncludedOperationNo(entries) } },
});

export const resolveCacheStatus = (record: InventoryCycleCacheRecord | null, fingerprint: string): ReportCacheStatus => {
  if (!record) return 'stale';
  if (record.meta.status === 'failed') return 'failed';
  if (record.meta.status === 'rebuilding') return 'rebuilding';
  return record.meta.fingerprint === fingerprint && record.report ? 'current' : 'stale';
};

export const makeFailedCacheRecord = (previous: InventoryCycleCacheRecord | null, error: unknown): InventoryCycleCacheRecord => ({
  meta: {
    ...(previous?.meta ?? {}),
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  },
  report: previous?.report,
});
