import type { Account, Entry } from '../types';
import { createDeterministicAuditHash } from './historicalInventoryOverlay';
import { getPhase5OperationId, rebuildInventoryCostTimeline } from './inventoryCostEngine';
import type {
  InventoryCostDiagnosticCode,
  InventoryCostTimeline,
  Phase5OpeningCostConfig,
} from './inventoryCostTypes';
import { invalidateAnnualSnapshots, type AnnualCostSnapshot } from './annualCostSnapshots';
import { approvedHistoricalInventoryOverlaysForAccounts } from './historicalInventoryOverlay';
import { calculateMerchantInvoiceMetalValueMinor } from './merchantInvoiceValuation';

export const HISTORICAL_COST_REVIEW_VERSION = 'historical-cost-review-v1' as const;

export type HistoricalCostOverlayType =
  | 'merchant_receipt_cost'
  | 'inventory_surplus_cost'
  | 'inventory_two_sided_correction'
  | 'inventory_duplicate_exclusion'
  | 'inventory_non_surplus';
export type HistoricalCostOverlayStatus = 'draft' | 'approved' | 'rejected';
export type HistoricalCostValueBasis =
  | 'total'
  | 'actual_weight'
  | 'standard21_weight'
  | 'carrying_cost_transfer'
  | 'exclusion';
export type HistoricalCostSourceType =
  | 'original_invoice'
  | 'merchant_statement'
  | 'manual_records'
  | 'bank_or_cash_evidence'
  | 'approved_accounting_estimate'
  | 'other';

export interface HistoricalCostReviewOverlay {
  overlayId: string;
  overlayVersion: number;
  schemaVersion: typeof HISTORICAL_COST_REVIEW_VERSION;
  targetOperationId: string;
  overlayType: HistoricalCostOverlayType;
  originalDiagnosticCode: InventoryCostDiagnosticCode;
  approvedInterpretedCostMinor: number | null;
  pricePerGramMinor: number | null;
  valueBasis: HistoricalCostValueBasis;
  sourceType: HistoricalCostSourceType;
  sourceReference: string;
  approver: string;
  createdAt: string;
  approvedAt: string | null;
  supersedesOverlayId: string | null;
  status: HistoricalCostOverlayStatus;
  sourceInventoryAccountId: string | null;
  notes: string;
  confidenceNote: string;
  historicalAssignmentConfirmed: boolean;
  userId?: string;
  ownerId?: string;
  createdBy?: string;
  auditHash: string;
}

export interface AutomaticSurplusWacCost {
  costMinor: number;
  gainMinor: number;
  wacBeforeMinorPerDisplayUnit: number;
  wacAfterMinorPerDisplayUnit: number;
}

export interface HistoricalCostReviewItem {
  operation: Entry;
  operationId: string;
  kind: 'merchant_receipt' | 'inventory_surplus';
  inventoryAccountId?: string;
  diagnosticCode: 'unresolved_merchant_cost' | 'pending_surplus_cost';
  diagnosticMessage: string;
  automaticWacCost?: AutomaticSurplusWacCost;
}

export interface HistoricalCostPreview {
  timeline: InventoryCostTimeline;
  before: InventoryCostTimeline;
  overlay: HistoricalCostReviewOverlay;
  targetResult: InventoryCostTimeline['results'][number] | null;
  recordImpact: {
    inventoryBookCostIncreaseMinor: number | null;
    merchantLiabilityBookValueIncreaseMinor: number | null;
    wacBeforeMinorPerDisplayUnit: number | null;
    wacAfterMinorPerDisplayUnit: number | null;
    resolved: boolean;
  };
  resolvesTargetDiagnostic: boolean;
  officialReportsAvailable: boolean;
  officialReportsBlockedByOtherRecords: boolean;
  affectedYears: string[];
  earliestAffectedDate: string;
}

const payload = (
  overlay: Omit<HistoricalCostReviewOverlay, 'auditHash'> | HistoricalCostReviewOverlay,
) => {
  const { auditHash: _ignored, ...stable } = overlay as HistoricalCostReviewOverlay;
  return stable;
};

const requirePositiveMinor = (value: number | null): void => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error('invalid_cost_value');
};

export const createHistoricalCostReviewOverlay = (
  input: Omit<HistoricalCostReviewOverlay, 'auditHash' | 'schemaVersion'>,
): HistoricalCostReviewOverlay => {
  if (!input.overlayId || !input.targetOperationId || !Number.isSafeInteger(input.overlayVersion)
    || input.overlayVersion < 1 || !input.createdAt
    || (input.status !== 'draft' && !input.approver)) {
    throw new Error('invalid_historical_cost_overlay');
  }
  if (input.status === 'approved') {
    if (!input.approvedAt || !input.historicalAssignmentConfirmed
      || (!input.sourceReference.trim() && !input.notes.trim())) {
      throw new Error('approval_confirmation_required');
    }
    if (input.overlayType === 'merchant_receipt_cost' || input.overlayType === 'inventory_surplus_cost') {
      requirePositiveMinor(input.approvedInterpretedCostMinor);
    }
    if (input.overlayType === 'inventory_two_sided_correction' && !input.sourceInventoryAccountId) {
      throw new Error('source_inventory_account_required');
    }
  }
  if (input.pricePerGramMinor !== null) requirePositiveMinor(input.pricePerGramMinor);
  if (input.approvedInterpretedCostMinor !== null) requirePositiveMinor(input.approvedInterpretedCostMinor);
  const base = { ...input, schemaVersion: HISTORICAL_COST_REVIEW_VERSION };
  return { ...base, auditHash: createDeterministicAuditHash(base) };
};

const APPROVED_SYSTEM_MERCHANT_RECEIPT_COSTS = [
  ['csvref-entry-05bfacf442cfcaf960a621b1ebaf63ec', 73_715_400, 660_000, 'standard21_weight', 'approved_accounting_estimate'],
  ['csvref-entry-33d94c2ea6abf6fbd8d9ddde8141fb40', 16_222_800, 660_000, 'standard21_weight', 'approved_accounting_estimate'],
  ['csvref-entry-616f2de44c64a5174e3f4ee38bb0e543', 5_577_000, 660_000, 'standard21_weight', 'original_invoice'],
  ['csvref-entry-6e2e2fbf424ae0607c1122e435d8491a', 1_303_400, 686_000, 'actual_weight', 'original_invoice'],
  ['csvref-entry-85bff7318050eb5a960ae48208645234', 429_600, 15_000, 'actual_weight', 'original_invoice'],
  ['csvref-entry-9ac368e9fc7c9b0fbc2cce56bb72bb5d', 15_972_000, 660_000, 'standard21_weight', 'original_invoice'],
  ['csvref-entry-9cb1a308179facf0acc06917649bde80', 674_700, 15_000, 'actual_weight', 'original_invoice'],
  ['csvref-entry-9fbbe7627d9ad263f457932f54fd4f13', 393_150, 15_000, 'actual_weight', 'original_invoice'],
  ['csvref-entry-a838448132b5ed27c5ae735e642ddfed', 1_412_400, 660_000, 'standard21_weight', 'original_invoice'],
  ['csvref-entry-b45fb9d56d91b8e592c51b683e391de1', 19_357_800, 660_000, 'actual_weight', 'original_invoice'],
  ['csvref-entry-cb8744386dfbd24d8232fa93b9da1774', 735_000, 15_000, 'actual_weight', 'original_invoice'],
] as const satisfies readonly (readonly [
  string,
  number,
  number,
  HistoricalCostValueBasis,
  HistoricalCostSourceType,
])[];

export const APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS: readonly HistoricalCostReviewOverlay[] = [
  ...APPROVED_SYSTEM_MERCHANT_RECEIPT_COSTS.map(([
    targetOperationId,
    approvedInterpretedCostMinor,
    pricePerGramMinor,
    valueBasis,
    sourceType,
  ]) => createHistoricalCostReviewOverlay({
    overlayId: `system-hcr-${targetOperationId}-merchant-receipt-v1`,
    overlayVersion: 1,
    targetOperationId,
    overlayType: 'merchant_receipt_cost',
    originalDiagnosticCode: 'unresolved_merchant_cost',
    approvedInterpretedCostMinor,
    pricePerGramMinor,
    valueBasis,
    sourceType,
    sourceReference: 'Owner-approved official historical merchant invoice price.',
    approver: 'owner-approved',
    createdAt: '2026-07-29T16:10:00+03:00',
    approvedAt: '2026-07-29T16:10:00+03:00',
    supersedesOverlayId: null,
    status: 'approved',
    sourceInventoryAccountId: null,
    notes: 'Approved historical invoice valuation; sanitized system decision contains no personal source data.',
    confidenceNote: 'Matches the effective approved Firestore decision.',
    historicalAssignmentConfirmed: true,
  })),  createHistoricalCostReviewOverlay({
    overlayId: 'system-hcr-20260323-scrap-arabic-nearest-carrying-cost-v1',
    overlayVersion: 1,
    targetOperationId: 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed',
    overlayType: 'inventory_surplus_cost',
    originalDiagnosticCode: 'pending_surplus_cost',
    approvedInterpretedCostMinor: 528_214,
    pricePerGramMinor: 677_198,
    valueBasis: 'standard21_weight',
    sourceType: 'approved_accounting_estimate',
    sourceReference: 'Nearest prior carrying cost: csvref-entry-0d4c9ee1f0f2eae2af57a503a0c3dce8 (2026-03-20)',
    approver: 'owner-approved',
    createdAt: '2026-07-29T16:10:00+03:00',
    approvedAt: '2026-07-29T16:10:00+03:00',
    supersedesOverlayId: null,
    status: 'approved',
    sourceInventoryAccountId: null,
    notes: 'Owner approved valuing the 0.78g historical surplus at the nearest prior same-account carrying cost.',
    confidenceNote: 'Same inventory account; nearest earlier costed movement.',
    historicalAssignmentConfirmed: true,
  }),
  createHistoricalCostReviewOverlay({
    overlayId: 'system-hcr-20260412-gouache-arabic-nearest-carrying-cost-v1',
    overlayVersion: 1,
    targetOperationId: 'csvref-entry-a0336b0baa791eb94f70774c2f34d730',
    overlayType: 'inventory_surplus_cost',
    originalDiagnosticCode: 'pending_surplus_cost',
    approvedInterpretedCostMinor: 12_517,
    pricePerGramMinor: 625_837,
    valueBasis: 'standard21_weight',
    sourceType: 'approved_accounting_estimate',
    sourceReference: 'Nearest prior carrying cost: csvref-entry-1a614dcb5f2ffe9369daa03453366393 (2026-04-06)',
    approver: 'owner-approved',
    createdAt: '2026-07-29T16:10:00+03:00',
    approvedAt: '2026-07-29T16:10:00+03:00',
    supersedesOverlayId: null,
    status: 'approved',
    sourceInventoryAccountId: null,
    notes: 'Owner approved valuing the 0.02g historical surplus at the nearest prior same-account carrying cost.',
    confidenceNote: 'Same inventory account; nearest earlier costed movement.',
    historicalAssignmentConfirmed: true,
  }),
] as const;

export const validateHistoricalCostReviewOverlay = (
  overlay: HistoricalCostReviewOverlay,
): boolean => {
  try {
    if (overlay.schemaVersion !== HISTORICAL_COST_REVIEW_VERSION) return false;
    const recreated = createHistoricalCostReviewOverlay(payload(overlay) as Omit<
      HistoricalCostReviewOverlay,
      'auditHash' | 'schemaVersion'
    >);
    return recreated.auditHash === overlay.auditHash;
  } catch {
    return false;
  }
};

export const nextOverlayVersion = (
  overlays: readonly HistoricalCostReviewOverlay[],
  targetOperationId: string,
): number => Math.max(
  0,
  ...overlays.filter(item => item.targetOperationId === targetOperationId)
    .map(item => item.overlayVersion),
) + 1;

export const effectiveApprovedHistoricalCostOverlays = (
  overlays: readonly HistoricalCostReviewOverlay[],
): HistoricalCostReviewOverlay[] => {
  const valid = overlays.filter(item => item.status === 'approved'
    && validateHistoricalCostReviewOverlay(item));
  const latest = new Map<string, HistoricalCostReviewOverlay>();
  valid.forEach(item => {
    const current = latest.get(item.targetOperationId);
    if (!current || item.overlayVersion > current.overlayVersion
      || (item.overlayVersion === current.overlayVersion
        && item.overlayId.localeCompare(current.overlayId) > 0)) {
      latest.set(item.targetOperationId, item);
    }
  });
  return [...latest.values()].sort((a, b) =>
    a.targetOperationId.localeCompare(b.targetOperationId));
};

const accountName = (accounts: readonly Account[], id: string | null): string | undefined =>
  id ? accounts.find(item => item.id === id)?.name : undefined;

/**
 * Creates the cost/report projection. Source Entry objects are never changed.
 * Approved overlays only are considered; drafts and rejected versions are audit-only.
 */
export const projectEntriesWithHistoricalCostOverlays = (
  entries: readonly Entry[],
  accounts: readonly Account[],
  overlays: readonly HistoricalCostReviewOverlay[],
): Entry[] => {
  const active = new Map(effectiveApprovedHistoricalCostOverlays(
    [...APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS, ...overlays],
  )
    .map(item => [item.targetOperationId, item]));
  return entries.flatMap(original => {
    const operationId = getPhase5OperationId(original);
    const overlay = active.get(operationId);
    if (!overlay) return [{ ...original }];
    if (overlay.overlayType === 'inventory_duplicate_exclusion'
      || overlay.overlayType === 'inventory_non_surplus') return [];
    if (overlay.overlayType === 'merchant_receipt_cost') {
      return [{ ...original, transactionGoldValueMinor: overlay.approvedInterpretedCostMinor ?? undefined }];
    }
    if (overlay.overlayType === 'inventory_surplus_cost') {
      return [{
        ...original,
        costAssignmentStatus: 'approved' as const,
        manualCostAssignmentMinor: overlay.approvedInterpretedCostMinor ?? undefined,
        costAssignmentApprovedAt: overlay.approvedAt ?? undefined,
        costAssignmentApprovedBy: overlay.approver,
      }];
    }
    const sourceId = overlay.sourceInventoryAccountId;
    return [{
      ...original,
      operationKind: 'adjustment' as const,
      creditAccountId: sourceId ?? original.creditAccountId,
      credit: accountName(accounts, sourceId) ?? original.credit,
    }];
  });
};

export const findHistoricalCostReviewItems = (
  entries: readonly Entry[],
  accounts: readonly Account[],
  timeline?: InventoryCostTimeline | null,
  blockingDiagnostics: readonly { code: string; inventoryAccountId?: string }[] = [],
): HistoricalCostReviewItem[] => {
  const diagnostics = new Map((timeline?.unresolvedCostData ?? []).map(item => [item.operationId, item]));
  const inventoryIds = new Set(accounts.filter(item => item.is_inventory && item.id).map(item => item.id as string));
  // A failed timeline reports only the first account that consumes pending
  // surplus. Discovery must still expose every source surplus across accounts,
  // otherwise approval merely advances the engine to the next hidden blocker.
  void blockingDiagnostics;
  return entries.flatMap(operation => {
    const operationId = getPhase5OperationId(operation);
    const unresolved = diagnostics.get(operationId);
    const costResult = timeline?.resultsByOperationId[operationId];
    const merchant = ['تاجر ذهب', 'تاجر فضة'].includes(operation.tx)
      && inventoryIds.has(operation.debitAccountId ?? '')
      && calculateMerchantInvoiceMetalValueMinor(operation, accounts) === null
      && !(Number.isSafeInteger(operation.transactionGoldValueMinor)
        && Number(operation.transactionGoldValueMinor) > 0)
      && !(Number.isSafeInteger(operation.merchantGoldBookValueMinor)
        && Number(operation.merchantGoldBookValueMinor) > 0);
    const surplus = (operation.operationKind === 'adjustment'
      || ['تسوية', 'تسوية زيادة'].includes(operation.tx))
      && inventoryIds.has(operation.debitAccountId ?? '')
      && !inventoryIds.has(operation.creditAccountId ?? '')
      && operation.costAssignmentStatus !== 'approved';
    // Merchant-delivery liability diagnostics require a different correction;
    // never present them as merchant-receipt historical-price assignments.
    if (!merchant && !surplus) return [];
    const kind = merchant ? 'merchant_receipt' as const : 'inventory_surplus' as const;
    return [{
      operation,
      operationId,
      kind,
      inventoryAccountId: unresolved?.inventoryAccountId ?? operation.debitAccountId,
      diagnosticCode: kind === 'merchant_receipt'
        ? 'unresolved_merchant_cost' as const : 'pending_surplus_cost' as const,
      diagnosticMessage: unresolved?.message ?? (kind === 'merchant_receipt'
        ? 'Historical merchant receipt has no approved EGP metal carrying value'
        : costResult?.classification === 'surplus'
          ? 'Inventory surplus valued automatically at the affected account pre-operation WAC'
          : 'Possible historical inventory surplus requires reviewed classification and cost'),
      automaticWacCost: kind === 'inventory_surplus'
        && costResult?.classification === 'surplus'
        && costResult.wacBeforeMinorPerDisplayUnit !== null
        && costResult.wacBeforeMinorPerDisplayUnit !== undefined
        && costResult.wacAfterMinorPerDisplayUnit !== null
        && costResult.wacAfterMinorPerDisplayUnit !== undefined
        ? {
          costMinor: costResult.incomingTotalCostMinor,
          gainMinor: costResult.adjustmentGainMinor,
          wacBeforeMinorPerDisplayUnit: costResult.wacBeforeMinorPerDisplayUnit,
          wacAfterMinorPerDisplayUnit: costResult.wacAfterMinorPerDisplayUnit,
        }
        : undefined,
    }];
  }).sort((a, b) => a.operation.date.localeCompare(b.operation.date)
    || a.operationId.localeCompare(b.operationId));
};

export const validateHistoricalCostOverlayTarget = (
  overlay: Pick<HistoricalCostReviewOverlay, 'targetOperationId' | 'overlayType'>,
  entries: readonly Entry[],
  accounts: readonly Account[],
): HistoricalCostReviewItem => {
  const item = findHistoricalCostReviewItems(entries, accounts)
    .find(candidate => candidate.operationId === overlay.targetOperationId);
  if (!item) throw new Error('unknown_operation_id');
  const merchantOverlay = overlay.overlayType === 'merchant_receipt_cost';
  if (merchantOverlay !== (item.kind === 'merchant_receipt')) {
    throw new Error('overlay_operation_type_mismatch');
  }
  return item;
};

export const buildHistoricalOverlayRebuildPlan = (
  overlay: HistoricalCostReviewOverlay,
  entries: readonly Entry[],
  snapshots: AnnualCostSnapshot[] = [],
) => {
  const target = entries.find(item => getPhase5OperationId(item) === overlay.targetOperationId);
  if (!target) throw new Error('unknown_operation_id');
  const firstYear = Number(target.date.slice(0, 4));
  const lastYear = Math.max(firstYear, ...entries.map(item => Number(item.date.slice(0, 4)))
    .filter(Number.isFinite));
  return {
    earliestAffectedDate: target.date,
    affectedYears: Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => String(firstYear + index),
    ),
    snapshots: invalidateAnnualSnapshots(snapshots, target),
    requiresPostingProjectionRebuild: true,
    requiresFinancialStatementsRebuild: true,
  };
};
export const calculateHistoricalPriceTotalMinor = (
  pricePerGramMinor: number,
  basis: 'actual_weight' | 'standard21_weight',
  operation: Entry,
): number => {
  requirePositiveMinor(pricePerGramMinor);
  const rawWeight = basis === 'actual_weight' ? operation.weight : operation.arabicWeight;
  const weight = Number(String(rawWeight ?? '').replace(',', '.'));
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('invalid_weight_basis');
  const total = Math.round(pricePerGramMinor * weight);
  requirePositiveMinor(total);
  return total;
};

export const previewAutomaticInventorySurplusWac = (args: {
  entries: Entry[];
  accounts: Account[];
  overlays: HistoricalCostReviewOverlay[];
  targetOperationId: string;
  openingConfig?: Phase5OpeningCostConfig;
}): AutomaticSurplusWacCost | null => {
  const target = findHistoricalCostReviewItems(args.entries, args.accounts)
    .find(item => item.operationId === args.targetOperationId
      && item.kind === 'inventory_surplus');
  const targetAccountId = target?.inventoryAccountId ?? '';
  if (!target || !targetAccountId) return null;

  const projected = projectEntriesWithHistoricalCostOverlays(
    args.entries,
    args.accounts,
    args.overlays,
  );
  const engineOptions = {
    historicalInventoryOverlayDirectives: approvedHistoricalInventoryOverlaysForAccounts(args.accounts),
    calculationGenerationId: 0,
  };
  const touchesTargetAccount = (entry: Entry): boolean =>
    getPhase5OperationId(entry) === args.targetOperationId
    || entry.debitAccountId === targetAccountId
    || entry.creditAccountId === targetAccountId;
  const scopedProjected = projected.filter(touchesTargetAccount);
  const scopedOrdering = rebuildInventoryCostTimeline(
    scopedProjected,
    args.accounts,
    args.openingConfig ?? {},
    engineOptions,
  ).orderedOperationIds;
  const targetOrderIndex = scopedOrdering.indexOf(args.targetOperationId);
  if (targetOrderIndex < 0) return null;
  const throughTargetIds = new Set(scopedOrdering.slice(0, targetOrderIndex + 1));
  const throughTargetEntries = scopedProjected
    .filter(entry => throughTargetIds.has(getPhase5OperationId(entry)));
  const prefixEngineOptions = {
    ...engineOptions,
    historicalInventoryOverlayDirectives:
      engineOptions.historicalInventoryOverlayDirectives.filter(directive =>
        throughTargetIds.has(directive.originalOperationId)),
  };
  const timeline = rebuildInventoryCostTimeline(
    throughTargetEntries,
    args.accounts,
    args.openingConfig ?? {},
    prefixEngineOptions,
  );
  const result = timeline.resultsByOperationId[args.targetOperationId];
  if (!result || result.classification !== 'surplus'
    || result.wacBeforeMinorPerDisplayUnit === null
    || result.wacBeforeMinorPerDisplayUnit === undefined
    || result.wacAfterMinorPerDisplayUnit === null
    || result.wacAfterMinorPerDisplayUnit === undefined
    || timeline.unresolvedCostData.some(item => item.operationId === args.targetOperationId)
    || timeline.diagnostics.some(item => item.operationId === args.targetOperationId)) {
    return null;
  }
  return {
    costMinor: result.incomingTotalCostMinor,
    gainMinor: result.adjustmentGainMinor,
    wacBeforeMinorPerDisplayUnit: result.wacBeforeMinorPerDisplayUnit,
    wacAfterMinorPerDisplayUnit: result.wacAfterMinorPerDisplayUnit,
  };
};

export const previewHistoricalCostOverlay = (args: {
  entries: Entry[];
  accounts: Account[];
  overlays: HistoricalCostReviewOverlay[];
  candidate: HistoricalCostReviewOverlay;
  openingConfig?: Phase5OpeningCostConfig;
}): HistoricalCostPreview => {
  if (args.candidate.status !== 'approved') throw new Error('preview_requires_approved_candidate');
  validateHistoricalCostOverlayTarget(args.candidate, args.entries, args.accounts);
  const beforeEntries = projectEntriesWithHistoricalCostOverlays(args.entries, args.accounts, args.overlays);
  const engineOptions = {
    historicalInventoryOverlayDirectives: approvedHistoricalInventoryOverlaysForAccounts(args.accounts),
    calculationGenerationId: 0,
  };
  const before = rebuildInventoryCostTimeline(beforeEntries, args.accounts, args.openingConfig ?? {}, engineOptions);
  const projected = projectEntriesWithHistoricalCostOverlays(
    args.entries,
    args.accounts,
    [...args.overlays, args.candidate],
  );
  const timeline = rebuildInventoryCostTimeline(projected, args.accounts, args.openingConfig ?? {}, engineOptions);
  // The official run may stop at an earlier diagnostic in a different inventory
  // account. Build a target-account prefix solely for the dry-run card so the
  // selected record can still be evaluated by the real cost engine.
  const targetItem = validateHistoricalCostOverlayTarget(
    args.candidate,
    args.entries,
    args.accounts,
  );
  const targetAccountId = targetItem.inventoryAccountId ?? '';
  const touchesTargetAccount = (entry: Entry): boolean =>
    getPhase5OperationId(entry) === args.candidate.targetOperationId
    || entry.debitAccountId === targetAccountId
    || entry.creditAccountId === targetAccountId;
  const scopedProjected = projected.filter(touchesTargetAccount);
  const scopedOrdering = rebuildInventoryCostTimeline(
    scopedProjected,
    args.accounts,
    args.openingConfig ?? {},
    engineOptions,
  ).orderedOperationIds;
  const targetOrderIndex = scopedOrdering.indexOf(args.candidate.targetOperationId);
  const beforeIds = new Set(targetOrderIndex < 0 ? [] : scopedOrdering.slice(0, targetOrderIndex));
  const throughTargetIds = new Set(targetOrderIndex < 0
    ? [args.candidate.targetOperationId]
    : scopedOrdering.slice(0, targetOrderIndex + 1));
  const scopedBefore = rebuildInventoryCostTimeline(
    beforeEntries.filter(entry => beforeIds.has(getPhase5OperationId(entry))),
    args.accounts,
    args.openingConfig ?? {},
    {
      ...engineOptions,
      historicalInventoryOverlayDirectives:
        engineOptions.historicalInventoryOverlayDirectives.filter(directive =>
          beforeIds.has(directive.originalOperationId)),
    },
  );
  const scopedThroughTarget = rebuildInventoryCostTimeline(
    scopedProjected.filter(entry => throughTargetIds.has(getPhase5OperationId(entry))),
    args.accounts,
    args.openingConfig ?? {},
    {
      ...engineOptions,
      historicalInventoryOverlayDirectives:
        engineOptions.historicalInventoryOverlayDirectives.filter(directive =>
          throughTargetIds.has(directive.originalOperationId)),
    },
  );
  const targetResult = scopedThroughTarget.resultsByOperationId[
    args.candidate.targetOperationId
  ] ?? null;
  const resolvesTargetDiagnostic = !!targetResult
    && !scopedThroughTarget.unresolvedCostData.some(
      item => item.operationId === args.candidate.targetOperationId,
    )
    && !scopedThroughTarget.diagnostics.some(
      item => item.operationId === args.candidate.targetOperationId,
    );
  const officialReportsAvailable = timeline.valid && timeline.costDataComplete;
  const target = args.entries.find(item => getPhase5OperationId(item) === args.candidate.targetOperationId);
  const earliestAffectedDate = target?.date ?? '';
  const latestYear = Math.max(...args.entries.map(item => Number(item.date.slice(0, 4))).filter(Number.isFinite));
  const firstYear = Number(earliestAffectedDate.slice(0, 4));
  const affectedYears = Number.isFinite(firstYear) && Number.isFinite(latestYear)
    ? Array.from({ length: Math.max(0, latestYear - firstYear + 1) }, (_, index) => String(firstYear + index))
    : [];
  return {
    timeline,
    before,
    overlay: args.candidate,
    targetResult,
    recordImpact: {
      inventoryBookCostIncreaseMinor: targetResult?.incomingMetalCostMinor ?? null,
      merchantLiabilityBookValueIncreaseMinor:
        targetResult?.merchantLiabilityIncreaseMinor ?? null,
      wacBeforeMinorPerDisplayUnit:
        scopedBefore.finalStates[targetAccountId]?.totalWacMinorPerDisplayUnit ?? null,
      wacAfterMinorPerDisplayUnit:
        scopedThroughTarget.finalStates[targetAccountId]?.totalWacMinorPerDisplayUnit ?? null,
      resolved: resolvesTargetDiagnostic,
    },
    resolvesTargetDiagnostic,
    officialReportsAvailable,
    officialReportsBlockedByOtherRecords: resolvesTargetDiagnostic && !officialReportsAvailable,
    affectedYears,
    earliestAffectedDate,
  };
};
