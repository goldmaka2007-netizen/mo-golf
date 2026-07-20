import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, Entry } from '../types';
import { buildInventoryCycleReport, type InventoryCycleFilters, type InventoryCycleReport, type InventoryCycleTab } from '../lib/inventoryCycleReport';
import type { OpeningCostConfig } from '../lib/weightedAverageCost';
import type { InventoryWarningState } from '../lib/inventoryCycleWarnings';
import {
  createInventoryCycleFingerprint,
  findEarliestAffectedOperationId,
  loadInventoryCycleCache,
  makeCurrentCacheRecord,
  makeFailedCacheRecord,
  resolveCacheStatus,
  saveInventoryCycleCache,
  type InventoryCycleCacheMeta,
} from '../lib/inventoryCycleCache';

const makeLoadingReport = (args: {
  tab: InventoryCycleTab;
  filters: InventoryCycleFilters;
  meta: InventoryCycleCacheMeta;
}): InventoryCycleReport => ({
  tab: args.tab,
  filters: args.filters,
  cache: {
    status: args.meta.status,
    updatedAt: args.meta.lastUpdatedAt ?? new Date().toISOString(),
    lastUpdatedAt: args.meta.lastUpdatedAt,
    lastIncludedOperationNo: args.meta.lastIncludedOperationNo,
    error: args.meta.error,
  },
  movementKinds: [],
  accounts: [],
  items: [],
  warnings: [],
  reviewedWarnings: [],
  summary: {
    opening: 0,
    incoming: 0,
    outgoing: 0,
    closing: 0,
    closingCost: 0,
    averageCost: null,
    marketValue: args.tab === 'accessory' ? undefined : null,
    revaluation: args.tab === 'accessory' ? undefined : null,
    operationsCount: 0,
    activeItemCount: args.tab === 'accessory' ? 0 : undefined,
    salesRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    adjustmentGain: 0,
    adjustmentLoss: 0,
    operationalResult: 0,
    warningsCount: 0,
    criticalWarnings: 0,
    mediumWarnings: 0,
    infoWarnings: 0,
  },
  chart: [],
});
export const useInventoryCycleReportCache = (args: {
  userKey: string;
  entries: Entry[];
  accountsDb: Account[];
  tab: InventoryCycleTab;
  filters: InventoryCycleFilters;
  goldPrice: number;
  silverPrice: number;
  openingConfig: OpeningCostConfig;
  warningState: InventoryWarningState;
}) => {
  const fingerprint = useMemo(() => createInventoryCycleFingerprint(args), [args.entries, args.accountsDb, args.tab, args.filters, args.goldPrice, args.silverPrice, args.openingConfig, args.warningState]);
  const previousEntriesRef = useRef<Entry[]>(args.entries);
  const [meta, setMeta] = useState<InventoryCycleCacheMeta>({ status: 'stale' });
  const [report, setReport] = useState<InventoryCycleReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = loadInventoryCycleCache(args.userKey, args.tab, args.filters);
    const status = resolveCacheStatus(cached, fingerprint);
    const affectedFromOperationId = findEarliestAffectedOperationId(previousEntriesRef.current, args.entries);
    previousEntriesRef.current = args.entries;

    if (cached?.report) {
      const cachedMeta = { ...cached.meta, status, affectedFromOperationId };
      setReport({ ...cached.report, cache: { ...cached.report.cache, status, lastUpdatedAt: cached.meta.lastUpdatedAt, lastIncludedOperationNo: cached.meta.lastIncludedOperationNo, error: cached.meta.error } });
      setMeta(cachedMeta);
    } else {
      setReport(null);
      setMeta({ status, affectedFromOperationId });
    }

    if (status === 'current') return;

    setMeta(prev => ({ ...prev, status: 'rebuilding', affectedFromOperationId }));
    const timer = window.setTimeout(() => {
      try {
        const built = buildInventoryCycleReport({
          entries: args.entries,
          accountsDb: args.accountsDb,
          tab: args.tab,
          filters: args.filters,
          goldPrice: args.goldPrice,
          silverPrice: args.silverPrice,
          openingConfig: args.openingConfig,
          warningState: args.warningState,
          cacheMeta: { status: 'current' },
        });
        const record = makeCurrentCacheRecord(built, fingerprint, args.entries);
        saveInventoryCycleCache(args.userKey, args.tab, args.filters, record);
        if (!cancelled) {
          setReport(record.report ?? built);
          setMeta(record.meta);
        }
      } catch (error) {
        const failed = makeFailedCacheRecord(cached, error);
        saveInventoryCycleCache(args.userKey, args.tab, args.filters, failed);
        if (!cancelled) {
          setReport(failed.report ?? null);
          setMeta(failed.meta);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [args.userKey, args.entries, args.accountsDb, args.tab, args.filters, args.goldPrice, args.silverPrice, args.openingConfig, args.warningState, fingerprint]);

  const fallback = useMemo(() => report ?? makeLoadingReport({ tab: args.tab, filters: args.filters, meta }), [report, args.tab, args.filters, meta]);

  return { report: { ...fallback, cache: { ...fallback.cache, status: meta.status, lastUpdatedAt: meta.lastUpdatedAt, lastIncludedOperationNo: meta.lastIncludedOperationNo, error: meta.error } }, cacheMeta: meta, fingerprint };
};
