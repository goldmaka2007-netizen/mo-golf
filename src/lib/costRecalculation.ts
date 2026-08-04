import type { Account, Entry } from '../types';
import {
  APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
  approvedHistoricalInventoryOverlaysForAccounts,
  HISTORICAL_INVENTORY_OVERLAY_VERSION,
} from './historicalInventoryOverlay';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
  INVENTORY_COST_TAXONOMY,
} from './inventoryCostCatalog';
import {
  compareEntriesForPhase5Cost,
  getPhase5OperationId,
  PHASE5_COST_CATALOG_VERSION,
  rebuildInventoryCostTimeline,
} from './inventoryCostEngine';
import type {
  CostCalculationRun,
  InventoryCostDiagnostic,
  InventoryCostTimeline,
  Phase5OpeningCostConfig,
} from './inventoryCostTypes';
import { INVENTORY_COST_CALCULATION_VERSION } from './inventoryCostTypes';
import type { RebuildInventoryCostOptions } from './inventoryCostEngine';
import { resolveRuntimeCostAccountInputs } from './runtimeCostAccountResolver';
import { resolveApprovedOpeningCostConfig } from './approvedCostDatasetConfig';

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
const inventoryKindByAccountId = (
  bindings = CURRENT_DATASET_INVENTORY_BINDINGS,
): ReadonlyMap<string, 'gold' | 'silver' | 'accessory' | undefined> => new Map(
  bindings.map(binding => [
    binding.inventoryAccountId,
    INVENTORY_COST_TAXONOMY.find(item => item.taxonomyKey === binding.taxonomyKey)?.kind,
  ]),
);

const defaultInventoryKindByAccountId = inventoryKindByAccountId();



export const prepareRuntimeInventoryCostInputs = (
  entries: Entry[],
  accounts: Account[],
) => resolveRuntimeCostAccountInputs(entries, accounts);

const emptyInvalidTimeline = (message: string): InventoryCostTimeline => ({
  calculationVersion: INVENTORY_COST_CALCULATION_VERSION,
  orderedOperationIds: [], results: [], resultsByOperationId: {}, finalStates: {},
  diagnostics: [{ code: 'unknown_inventory_account', message }],
  orderingDiagnostics: [], historicalInventoryOverlays: [], valid: false,
});

const restoreRuntimeInventoryIds = (
  timeline: InventoryCostTimeline,
  entries: readonly Entry[],
  audit: readonly { legacyAccountId: string; resolvedStableAccountId: string }[],
): InventoryCostTimeline => {
  if (audit.length === 0) return timeline;
  const runtimeIdByStableId = new Map(
    audit.map(item => [item.resolvedStableAccountId, item.legacyAccountId]),
  );
  const runtimeId = (value?: string): string | undefined =>
    value ? runtimeIdByStableId.get(value) ?? value : undefined;
  const originalEntryById = new Map(entries.map(entry => [getPhase5OperationId(entry), entry]));
  const results = timeline.results.map(result => ({
    ...result,
    entry: { ...(originalEntryById.get(result.operationId) ?? result.entry) },
    inventoryAccountId: runtimeId(result.inventoryAccountId),
    sourceInventoryAccountId: runtimeId(result.sourceInventoryAccountId),
    destinationInventoryAccountId: runtimeId(result.destinationInventoryAccountId),
  }));
  const finalStates = Object.fromEntries(Object.entries(timeline.finalStates).map(([accountId, state]) => {
    const restoredId = runtimeId(accountId) ?? accountId;
    return [restoredId, { ...state, inventoryAccountId: restoredId }];
  }));
  return {
    ...timeline,
    results,
    resultsByOperationId: Object.fromEntries(results.map(result => [result.operationId, result])),
    finalStates,
    diagnostics: timeline.diagnostics.map(item => ({
      ...item, inventoryAccountId: runtimeId(item.inventoryAccountId),
    })),
    orderingDiagnostics: timeline.orderingDiagnostics.map(item => ({
      ...item, inventoryAccountId: runtimeId(item.inventoryAccountId) ?? item.inventoryAccountId,
    })),
    historicalInventoryOverlays: timeline.historicalInventoryOverlays.map(item => ({
      ...item,
      stableInventoryAccountId:
        runtimeId(item.stableInventoryAccountId) ?? item.stableInventoryAccountId,
    })),
  };
};

/** Canonical runtime path shared by invoice validation and all WAC/report consumers. */
export const rebuildRuntimeInventoryCostTimeline = (
  entries: Entry[],
  accounts: Account[],
  openingConfig: Phase5OpeningCostConfig = {},
  options: RebuildInventoryCostOptions = {},
): InventoryCostTimeline => {
  const prepared = prepareRuntimeInventoryCostInputs(entries, accounts);
  if (prepared.errors.length > 0) return emptyInvalidTimeline(prepared.errors[0]);
  const timeline = rebuildInventoryCostTimeline(
    prepared.entries, prepared.accounts, openingConfig,
    {
      ...options,
      historicalInventoryOverlayDirectives:
        options.historicalInventoryOverlayDirectives
        ?? approvedHistoricalInventoryOverlaysForAccounts(prepared.accounts),
      bindings: prepared.bindings,
    },
  );
  return restoreRuntimeInventoryIds(timeline, entries, prepared.audit);
};

const comparableTimestamp = (value: any): string => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value.seconds === 'number') return `${value.seconds}.${value.nanoseconds ?? 0}`;
  if (typeof value.toMillis === 'function') return String(value.toMillis());
  return '';
};

const entryCostFingerprint = (
  entry: Entry,
  kindByAccountId = defaultInventoryKindByAccountId,
) => {
  const inventoryAccountId = kindByAccountId.has(entry.debitAccountId || '')
    ? entry.debitAccountId
    : kindByAccountId.has(entry.creditAccountId || '')
      ? entry.creditAccountId
      : undefined;
  const inventoryKind = inventoryAccountId
    ? kindByAccountId.get(inventoryAccountId) : undefined;
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

export const createCostSettingsHash = (openingConfig: Phase5OpeningCostConfig): string =>
  hashString(stableStringify({
    openingConfig,
    historicalInventoryOverlayVersion: HISTORICAL_INVENTORY_OVERLAY_VERSION,
    historicalInventoryOverlays: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
  }));

export const createCostInputRevision = (
  entries: Entry[],
  accounts: Account[],
  openingConfig: Phase5OpeningCostConfig,
): string => {
  const prepared = prepareRuntimeInventoryCostInputs(entries, accounts);
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
  },
  entries: [...prepared.entries].sort(compareEntriesForPhase5Cost).map(entry => entryCostFingerprint(entry, inventoryKindByAccountId(prepared.bindings))),
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
  earliestAffectedOperationId?: string;
  startedAt?: string;
}): CostCalculationRun => {
  const startedAt = args.startedAt ?? new Date().toISOString();
  const prepared = prepareRuntimeInventoryCostInputs(args.entries, args.accounts);
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
      settingsHash: createCostSettingsHash(openingResolution.config),
      error: {
        code: 'unknown_inventory_account',
        message: prepared.errors[0],
      },
    };
  }
  const stableTimeline = rebuildInventoryCostTimeline(
    prepared.entries,
    prepared.accounts,
    openingResolution.config,
    {
      historicalInventoryOverlayDirectives:
        approvedHistoricalInventoryOverlaysForAccounts(prepared.accounts),
      calculationGenerationId: args.generationId,
      bindings: prepared.bindings,
    },
  );
  const timeline = restoreRuntimeInventoryIds(stableTimeline, args.entries, prepared.audit);
  if (!timeline.valid) {
    return {
      generationId: args.generationId,
      inputRevision: args.inputRevision,
      catalogVersion: PHASE5_COST_CATALOG_VERSION,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      earliestAffectedOperationId: args.earliestAffectedOperationId,
      settingsHash: createCostSettingsHash(openingResolution.config),
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
    settingsHash: createCostSettingsHash(openingResolution.config),
    timeline,
  };
};

export const commitCostCalculationRun = (
  activeGenerationId: number,
  completedRun: CostCalculationRun,
): { accepted: true; run: CostCalculationRun } | { accepted: false; diagnostic: InventoryCostDiagnostic } => {
  if (completedRun.generationId !== activeGenerationId) {
    return {
      accepted: false,
      diagnostic: {
        code: 'stale_generation',
        message: `Rejected stale cost generation ${completedRun.generationId}; active generation is ${activeGenerationId}`,
      },
    };
  }
  return { accepted: true, run: completedRun };
};

export const isCostReportAvailable = (
  run: CostCalculationRun,
  inputRevision: string,
): run is CostCalculationRun & { status: 'valid'; timeline: InventoryCostTimeline } =>
  run.status === 'valid'
  && run.inputRevision === inputRevision
  && !!run.timeline
  && run.timeline.valid;

export const areOperationWritesLocked = (run: CostCalculationRun | undefined): boolean =>
  run?.status === 'running' || run?.status === 'failed';
