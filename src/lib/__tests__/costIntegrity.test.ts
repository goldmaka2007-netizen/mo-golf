import { describe, expect, it } from 'vitest';
import {
  APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
} from '../historicalInventoryOverlay';
import { selectCostIntegrity } from '../costIntegrity';
import type { CostCalculationRun } from '../inventoryCostTypes';
import { runPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';

describe('Cost Integrity status selector', () => {
  const valid = runPhase5GoldenDataset(77).run;
  const base = {
    currentInputRevision: valid.inputRevision,
    datasetRecordCount: 2169,
    overlays: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
    currentBaselineVersion: 'phase5-cost-baseline-v1',
    goldenRegressionStatus: 'passed' as const,
    originalDataHash: valid.inputRevision,
  };

  it('reports healthy only for a current valid run with a passing golden regression', () => {
    expect(selectCostIntegrity({ ...base, currentRun: valid })).toMatchObject({
      status: 'healthy',
      lastSuccessfulGenerationId: 77,
      datasetRecordCount: 2169,
      deficitCount: 0,
      diagnosticCount: 0,
      approvedOverlayCount: 3,
      approvedOverlayQuantityByAsset: { goldE21QuantityUnits: 80 },
      pendingOverlayCount: 0,
      revokedOverlayCount: 0,
      currentBaselineVersion: 'phase5-cost-baseline-v1',
      goldenRegressionStatus: 'passed',
      requiresRecalculation: false,
      blockingReason: null,
      canExposeCurrentCostReports: true,
    });
  });

  it('hides stale reports while recalculating or after a failure', () => {
    const running: CostCalculationRun = {
      ...valid,
      generationId: 78,
      status: 'running',
      timeline: undefined,
    };
    expect(selectCostIntegrity({
      ...base,
      currentRun: running,
      lastSuccessfulRun: valid,
    })).toMatchObject({
      status: 'recalculating',
      lastSuccessfulGenerationId: 77,
      requiresRecalculation: true,
      canExposeCurrentCostReports: false,
    });

    const failed: CostCalculationRun = {
      ...valid,
      generationId: 79,
      status: 'failed',
      timeline: undefined,
      error: { code: 'invalid_amount', message: 'fixture failure' },
    };
    expect(selectCostIntegrity({
      ...base,
      currentRun: failed,
      lastSuccessfulRun: valid,
    })).toMatchObject({
      status: 'failed',
      diagnosticCount: 1,
      requiresRecalculation: true,
      canExposeCurrentCostReports: false,
    });
  });

  it('maps any inventory deficit to blocked and never exposes old results as current', () => {
    const deficit: CostCalculationRun = {
      ...valid,
      status: 'failed',
      timeline: undefined,
      error: {
        code: 'insufficient_inventory',
        message: 'fixture deficit',
        inventoryAccountId: 'gold-a',
      },
    };
    expect(selectCostIntegrity({
      ...base,
      currentRun: deficit,
      lastSuccessfulRun: valid,
    })).toMatchObject({
      status: 'blocked',
      deficitCount: 1,
      blockingReason: 'inventory_deficit',
      canExposeCurrentCostReports: false,
    });
  });

  it('blocks a stale run or failed golden regression', () => {
    expect(selectCostIntegrity({
      ...base,
      currentRun: { ...valid, inputRevision: 'stale' },
    })).toMatchObject({
      status: 'blocked',
      blockingReason: 'missing_or_stale_cost_run',
      canExposeCurrentCostReports: false,
    });
    expect(selectCostIntegrity({
      ...base,
      currentRun: valid,
      goldenRegressionStatus: 'failed',
    })).toMatchObject({
      status: 'blocked',
      blockingReason: 'golden_regression_failed',
      canExposeCurrentCostReports: false,
    });
  });
  it('separates approved, pending, and revoked overlay counts', () => {
    const approved = APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES[0];
    const snapshot = selectCostIntegrity({
      ...base,
      currentRun: valid,
      overlays: [
        approved,
        { ...approved, overlayId: 'pending-fixture', ownerApprovalStatus: 'pending_final_approval', approvedAt: null },
        { ...approved, overlayId: 'revoked-fixture', ownerApprovalStatus: 'revoked', revokedAt: '2026-07-24T17:00:00.000+03:00', revocationReason: 'fixture' },
      ],
    });
    expect(snapshot).toMatchObject({
      approvedOverlayCount: 1,
      approvedOverlayQuantityByAsset: { goldE21QuantityUnits: 2 },
      pendingOverlayCount: 1,
      revokedOverlayCount: 1,
    });
  });
});
