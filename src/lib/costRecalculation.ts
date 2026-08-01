import type { Account, Entry } from '../types';
import {
  APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
  APPROVED_HISTORICAL_MERCHANT_LIABILITY_OPENINGS,
  approvedHistoricalInventoryOverlaysForAccounts,
  approvedHistoricalMerchantLiabilityOpeningsForAccounts,
  HISTORICAL_INVENTORY_OVERLAY_VERSION,
  HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION,
} from './historicalInventoryOverlay';
import {
  compareEntriesForPhase5Cost,
  getPhase5OperationId,
  PHASE5_COST_CATALOG_VERSION,
  rebuildInventoryCostTimeline,
} from './inventoryCostEngine';
import type {
  CostCalculationRun,
  Phase5OpeningCostConfig,
} from './inventoryCostTypes';
export {
  areOperationWritesLocked,
  commitCostCalculationRun,
  isCostReportAvailable,
} from './costRunState';
import { prepareRuntimeCostAccountInputs } from './runtimeCostAccountResolver';
import { resolveApprovedOpeningCostConfig } from './approvedCostDatasetConfig';
import { isMerchantReceiptEntry } from './merchantInvoiceValuation';
import {
  APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS,
  effectiveApprovedHistoricalCostOverlays,
  projectEntriesWithHistoricalCostOverlays,
  type HistoricalCostReviewOverlay,
} from './historicalCostReview';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};


const comparableTimestamp = (value: any): string => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value.seconds === 'number') return `${value.seconds}.${value.nanoseconds ?? 0}`;
  if (typeof value.toMillis === 'function') return String(value.toMillis());
  return '';
};

const entryCostFingerprint = (entry: Entry, accounts: readonly Account[] = []) => {
  const accountsById = new Map(accounts.filter(account => account.id).map(account => [account.id!, account]));
  const inventoryAccount = accountsById.get(entry.debitAccountId || '') ?? accountsById.get(entry.creditAccountId || '');
  const inferredAccessory = entry.karat === undefined && Number(entry.arabicWeight ?? 0) === 0 && Number(entry.count ?? 0) > 0;
  const inventoryKind = inventoryAccount?.inventoryKind ?? (inventoryAccount?.type === 'accessory' || (!inventoryAccount && inferredAccessory) ? 'accessory' : inventoryAccount?.metal);
  return {
    id: getPhase5OperationId(entry),
    date: entry.date,
    seq: entry.seq,
    sourceRow: entry.sourceRow,
    legacyOperationNo: entry.legacyOperationNo,
    createdAt: comparableTimestamp(entry.createdAt),
    tx: entry.tx,
    operationKind: entry.operationKind,
    subTx: entry.subTx,
    debitAccountId: entry.debitAccountId,
    creditAccountId: entry.creditAccountId,
    cash: entry.cash,
    weight: entry.weight,
    arabicWeight: entry.arabicWeight,
    karat: entry.karat,
    multiplier: entry.multiplier,
    goldEquivalent21Snapshot: entry.goldEquivalent21Snapshot,
    invoiceOfficialPricePerGramEgp: isMerchantReceiptEntry(entry) ? entry.invoiceOfficialPricePerGramEgp : undefined,
    marketPrice: isMerchantReceiptEntry(entry) ? entry.marketPrice : undefined,
    transactionGoldValueMinor: isMerchantReceiptEntry(entry) ? entry.transactionGoldValueMinor : undefined,
    merchantGoldBookValueMinor: isMerchantReceiptEntry(entry) ? entry.merchantGoldBookValueMinor : undefined,
    workmanshipCostMinor: isMerchantReceiptEntry(entry) ? entry.workmanshipCostMinor : undefined,
    // Piece count is a cost input only for accessories. Gold/silver count-only
    // edits therefore do not invalidate or rebuild the cost timeline.
    count: inventoryKind === 'accessory' ? entry.count : undefined,
  };
};

const accountCostFingerprint = (account: Account) => ({
  id: account.id,
  type: account.type,
  metal: account.metal,
  karat: account.karat,
  is_inventory: account.is_inventory,
  quantityStep: account.quantityStep,
  isActive: account.isActive,
});

export const createCostSettingsHash = (
  openingConfig: Phase5OpeningCostConfig,
  historicalCostReviewOverlays: readonly HistoricalCostReviewOverlay[] = [],
): string =>
  hashString(stableStringify({
    openingConfig,
    historicalInventoryOverlayVersion: HISTORICAL_INVENTORY_OVERLAY_VERSION,
    historicalInventoryOverlays: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
    historicalMerchantLiabilityOpeningVersion: HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION,
    historicalMerchantLiabilityOpenings: APPROVED_HISTORICAL_MERCHANT_LIABILITY_OPENINGS,
    historicalCostReviewOverlays: effectiveApprovedHistoricalCostOverlays([...APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS, ...historicalCostReviewOverlays]),
  }));

export const createCostInputRevision = (
  entries: Entry[],
  accounts: Account[],
  openingConfig: Phase5OpeningCostConfig,
  historicalCostReviewOverlays: readonly HistoricalCostReviewOverlay[] = [],
): string => {
  const projectedEntries = projectEntriesWithHistoricalCostOverlays(entries, accounts, historicalCostReviewOverlays);
  const prepared = prepareRuntimeCostAccountInputs(projectedEntries, accounts);
  const openingResolution = resolveApprovedOpeningCostConfig(
    prepared.entries,
    openingConfig,
  );
  return hashString(stableStringify({
  catalogVersion: PHASE5_COST_CATALOG_VERSION,
  settings: {
    openingConfig: openingResolution.config,
    openingConfigSource: openingResolution.source,
    openingConfigVersion: openingResolution.version,
    historicalInventoryOverlayVersion: HISTORICAL_INVENTORY_OVERLAY_VERSION,
    historicalInventoryOverlays: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
    historicalMerchantLiabilityOpeningVersion: HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION,
    historicalMerchantLiabilityOpenings: APPROVED_HISTORICAL_MERCHANT_LIABILITY_OPENINGS,
    historicalCostReviewOverlays: effectiveApprovedHistoricalCostOverlays([...APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS, ...historicalCostReviewOverlays]),
  },
  entries: [...prepared.entries].sort(compareEntriesForPhase5Cost).map(entry => entryCostFingerprint(entry, prepared.accounts)),
  accounts: [...prepared.accounts].sort((left, right) => String(left.id).localeCompare(String(right.id))).map(accountCostFingerprint),
  resolverErrors: prepared.errors,
}));
};

export const findEarliestCostAffectedOperationId = (
  previousEntries: Entry[],
  nextEntries: Entry[],
): string | undefined => {
  const previous = [...previousEntries].sort(compareEntriesForPhase5Cost);
  const next = [...nextEntries].sort(compareEntriesForPhase5Cost);
  const count = Math.max(previous.length, next.length);
  for (let index = 0; index < count; index += 1) {
    const previousFingerprint = previous[index] ? stableStringify(entryCostFingerprint(previous[index])) : '';
    const nextFingerprint = next[index] ? stableStringify(entryCostFingerprint(next[index])) : '';
    if (previousFingerprint !== nextFingerprint) {
      return getPhase5OperationId(next[index] ?? previous[index]);
    }
  }
  return undefined;
};

export const executeCostCalculationRun = (args: {
  generationId: number;
  inputRevision: string;
  entries: Entry[];
  accounts: Account[];
  openingConfig: Phase5OpeningCostConfig;
  historicalCostReviewOverlays?: readonly HistoricalCostReviewOverlay[];
  earliestAffectedOperationId?: string;
  startedAt?: string;
}): CostCalculationRun => {
  const startedAt = args.startedAt ?? new Date().toISOString();
  const projectedEntries = projectEntriesWithHistoricalCostOverlays(args.entries, args.accounts, args.historicalCostReviewOverlays ?? []);
  const prepared = prepareRuntimeCostAccountInputs(projectedEntries, args.accounts);
  const openingResolution = resolveApprovedOpeningCostConfig(
    prepared.entries,
    args.openingConfig,
  );
  if (prepared.errors.length > 0) {
    return {
      generationId: args.generationId,
      inputRevision: args.inputRevision,
      catalogVersion: PHASE5_COST_CATALOG_VERSION,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      earliestAffectedOperationId: args.earliestAffectedOperationId,
      settingsHash: createCostSettingsHash(openingResolution.config, args.historicalCostReviewOverlays),
      error: {
        code: 'unknown_inventory_account',
        message: prepared.errors[0],
      },
    };
  }
  const timeline = rebuildInventoryCostTimeline(
    prepared.entries,
    prepared.accounts,
    openingResolution.config,
    {
      historicalInventoryOverlayDirectives:
        approvedHistoricalInventoryOverlaysForAccounts(prepared.accounts),
      historicalMerchantLiabilityOpeningDirectives:
        approvedHistoricalMerchantLiabilityOpeningsForAccounts(prepared.accounts),
      calculationGenerationId: args.generationId,
    },
  );
  timeline.excludedHistoricalOperationIds = effectiveApprovedHistoricalCostOverlays([
    ...APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS,
    ...(args.historicalCostReviewOverlays ?? []),
  ])
    .filter(item => item.overlayType === 'inventory_duplicate_exclusion' || item.overlayType === 'inventory_non_surplus')
    .map(item => item.targetOperationId);
  if (!timeline.valid) {
    return {
      generationId: args.generationId,
      inputRevision: args.inputRevision,
      catalogVersion: PHASE5_COST_CATALOG_VERSION,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      earliestAffectedOperationId: args.earliestAffectedOperationId,
      settingsHash: createCostSettingsHash(openingResolution.config, args.historicalCostReviewOverlays),
      error: timeline.diagnostics[0] ?? {
        code: 'unknown_inventory_operation',
        message: 'Cost calculation failed without a diagnostic',
      },
    };
  }
  return {
    generationId: args.generationId,
    inputRevision: args.inputRevision,
    catalogVersion: PHASE5_COST_CATALOG_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    status: 'valid',
    earliestAffectedOperationId: args.earliestAffectedOperationId,
    settingsHash: createCostSettingsHash(openingResolution.config, args.historicalCostReviewOverlays),
    timeline,
  };
};
