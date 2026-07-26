import type {
  HistoricalInventoryOverlayDirective,
  CostCalculationRun,
} from './inventoryCostTypes';

export type CostIntegrityStatus = 'healthy' | 'recalculating' | 'blocked' | 'failed';
export type GoldenRegressionStatus = 'passed' | 'failed' | 'not_run';

export interface CostIntegritySnapshot {
  status: CostIntegrityStatus;
  lastSuccessfulGenerationId: number | null;
  lastSuccessfulCalculatedAt: string | null;
  datasetRecordCount: number;
  deficitCount: number;
  diagnosticCount: number;
  approvedOverlayCount: number;
  approvedOverlayQuantityByAsset: Record<string, number>;
  pendingOverlayCount: number;
  revokedOverlayCount: number;
  currentBaselineVersion: string;
  goldenRegressionStatus: GoldenRegressionStatus;
  originalDataHash: string | null;
  requiresRecalculation: boolean;
  blockingReason: string | null;
  canExposeCurrentCostReports: boolean;
}

export interface CostIntegrityInput {
  currentRun?: CostCalculationRun;
  lastSuccessfulRun?: CostCalculationRun;
  currentInputRevision: string;
  datasetRecordCount: number;
  overlays: readonly HistoricalInventoryOverlayDirective[];
  currentBaselineVersion: string;
  goldenRegressionStatus: GoldenRegressionStatus;
  originalDataHash?: string | null;
}

const overlayAssetKey = (overlay: HistoricalInventoryOverlayDirective): string => {
  if (overlay.unitBasis === 'gold_equivalent21_centigram') return 'goldE21QuantityUnits';
  if (overlay.unitBasis === 'silver_centigram') return 'silverQuantityUnits';
  return 'accessoryQuantityUnits';
};

export const selectCostIntegrity = (input: CostIntegrityInput): CostIntegritySnapshot => {
  const approved = input.overlays.filter(item =>
    item.ownerApprovalStatus === 'approved' && !item.revokedAt);
  const approvedOverlayQuantityByAsset: Record<string, number> = {};
  for (const overlay of approved) {
    const key = overlayAssetKey(overlay);
    approvedOverlayQuantityByAsset[key] =
      (approvedOverlayQuantityByAsset[key] ?? 0) + overlay.quantityUnits;
  }

  const currentRun = input.currentRun;
  const currentDiagnostics = currentRun?.timeline?.diagnostics ?? [];
  const runError = currentRun?.error;
  const deficitCount = currentDiagnostics.filter(item =>
    item.code === 'insufficient_inventory').length
    + (runError?.code === 'insufficient_inventory' ? 1 : 0);
  const diagnosticCount = currentDiagnostics.length + (runError ? 1 : 0);
  const isCurrentValid = currentRun?.status === 'valid'
    && currentRun.inputRevision === input.currentInputRevision
    && currentRun.timeline?.valid === true;
  const requiresRecalculation = currentRun?.status === 'running'
    || !isCurrentValid
    || input.goldenRegressionStatus !== 'passed';

  let status: CostIntegrityStatus;
  let blockingReason: string | null = null;
  if (currentRun?.status === 'running') {
    status = 'recalculating';
    blockingReason = 'cost_recalculation_in_progress';
  } else if (deficitCount > 0) {
    status = 'blocked';
    blockingReason = 'inventory_deficit';
  } else if (currentRun?.status === 'failed') {
    status = 'failed';
    blockingReason = runError?.code ?? 'cost_run_failed';
  } else if (!isCurrentValid) {
    status = 'blocked';
    blockingReason = 'missing_or_stale_cost_run';
  } else if (input.goldenRegressionStatus !== 'passed') {
    status = 'blocked';
    blockingReason = input.goldenRegressionStatus === 'failed'
      ? 'golden_regression_failed'
      : 'golden_regression_not_run';
  } else if (diagnosticCount > 0) {
    status = 'blocked';
    blockingReason = 'unexpected_cost_diagnostic';
  } else {
    status = 'healthy';
  }

  const successfulRun = input.lastSuccessfulRun
    ?? (isCurrentValid ? currentRun : undefined);
  return {
    status,
    lastSuccessfulGenerationId:
      successfulRun?.status === 'valid' ? successfulRun.generationId : null,
    lastSuccessfulCalculatedAt:
      successfulRun?.status === 'valid' ? successfulRun.completedAt ?? null : null,
    datasetRecordCount: input.datasetRecordCount,
    deficitCount,
    diagnosticCount,
    approvedOverlayCount: approved.length,
    approvedOverlayQuantityByAsset,
    pendingOverlayCount: input.overlays.filter(item =>
      item.ownerApprovalStatus === 'pending_final_approval').length,
    revokedOverlayCount: input.overlays.filter(item =>
      item.ownerApprovalStatus === 'revoked' || !!item.revokedAt).length,
    currentBaselineVersion: input.currentBaselineVersion,
    goldenRegressionStatus: input.goldenRegressionStatus,
    originalDataHash: input.originalDataHash ?? null,
    requiresRecalculation,
    blockingReason,
    canExposeCurrentCostReports: status === 'healthy' && isCurrentValid,
  };
};
