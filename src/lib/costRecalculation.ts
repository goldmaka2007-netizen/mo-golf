import type { Account, Entry } from '../types';
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

const kindByBoundAccountId = new Map(
  CURRENT_DATASET_INVENTORY_BINDINGS.map(binding => {
    const definition = INVENTORY_COST_TAXONOMY.find(item => item.taxonomyKey === binding.taxonomyKey);
    return [binding.inventoryAccountId, definition?.kind] as const;
  }),
);

const comparableTimestamp = (value: any): string => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value.seconds === 'number') return `${value.seconds}.${value.nanoseconds ?? 0}`;
  if (typeof value.toMillis === 'function') return String(value.toMillis());
  return '';
};

const entryCostFingerprint = (entry: Entry) => {
  const inventoryAccountId = kindByBoundAccountId.has(entry.debitAccountId || '')
    ? entry.debitAccountId
    : kindByBoundAccountId.has(entry.creditAccountId || '')
      ? entry.creditAccountId
      : undefined;
  const inventoryKind = inventoryAccountId ? kindByBoundAccountId.get(inventoryAccountId) : undefined;
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

export const createCostSettingsHash = (openingConfig: Phase5OpeningCostConfig): string =>
  hashString(stableStringify(openingConfig));

export const createCostInputRevision = (
  entries: Entry[],
  accounts: Account[],
  openingConfig: Phase5OpeningCostConfig,
): string => hashString(stableStringify({
  catalogVersion: PHASE5_COST_CATALOG_VERSION,
  settings: openingConfig,
  entries: [...entries].sort(compareEntriesForPhase5Cost).map(entryCostFingerprint),
  accounts: [...accounts].sort((left, right) => String(left.id).localeCompare(String(right.id))).map(accountCostFingerprint),
}));

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
  const timeline = rebuildInventoryCostTimeline(args.entries, args.accounts, args.openingConfig);
  if (!timeline.valid) {
    return {
      generationId: args.generationId,
      inputRevision: args.inputRevision,
      catalogVersion: PHASE5_COST_CATALOG_VERSION,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      earliestAffectedOperationId: args.earliestAffectedOperationId,
      settingsHash: createCostSettingsHash(args.openingConfig),
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
    settingsHash: createCostSettingsHash(args.openingConfig),
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
