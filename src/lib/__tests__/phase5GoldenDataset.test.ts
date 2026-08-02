import { describe, expect, it } from 'vitest';
import {
  calculateNormalizedSourceDatasetSha256,
  calculatePhase5SourceDatasetSha256,
  createGoldenResultFingerprint,
  loadPhase5GoldenBaseline,
  loadPhase5GoldenDataset,
  runPhase5GoldenDataset,
  summarizeGoldenTimeline,
} from '../../test-fixtures/phase5GoldenDataset';
import { buildAccountingEngineProjection } from '../accountingEngine';
import { canonicalResolverCatalogV1Resolver } from '../canonicalResolverCatalogV1';
import {
  APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
  HISTORICAL_INVENTORY_OVERLAY_VERSION,
  isHistoricalOverlayActive,
  sealAppliedHistoricalInventoryOverlay,
} from '../historicalInventoryOverlay';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
  INVENTORY_COST_TAXONOMY_VERSION,
} from '../inventoryCostCatalog';
import {
  PHASE5_COST_CATALOG_VERSION,
  rebuildInventoryCostTimeline,
} from '../inventoryCostEngine';
import { INVENTORY_COST_CALCULATION_VERSION } from '../inventoryCostTypes';

const baseline = loadPhase5GoldenBaseline();
const SCRAP_ARABIC = 'seed-account-d1216eb4076ccdf40e20';
const GOUACHE_ARABIC = 'seed-account-391695330f1733e03bb0';
const FUTURE_SURPLUS = 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed';

const expectWithin = (actual: number, expected: number, tolerance: number, label: string) => {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`,
  ).toBeLessThanOrEqual(tolerance);
};

describe('Phase 5 Golden Dataset Regression — phase5-cost-baseline-v2-sanitized', () => {
  it('matches the official monetary, quantity, overlay, WAC, and ordering baseline', () => {
    const { entries, inputRevision, run, timeline } = runPhase5GoldenDataset(101);
    expect(entries.length).toBe(baseline.datasetRecordCount);
    expect(entries.length).toBe(2169);
    expect(inputRevision).toBe(baseline.datasetFingerprint);
    expect(calculatePhase5SourceDatasetSha256()).toBe(baseline.sourceDatasetSha256);
    expect(run.status).toBe('valid');
    expect(timeline).toBeDefined();
    const validTimeline = timeline!;
    const summary = summarizeGoldenTimeline(validTimeline);
    expect(createGoldenResultFingerprint(validTimeline)).toBe(baseline.expectedResultFingerprint);

    expect(validTimeline.valid).toBe(true);
    expect(summary.deficitCount).toBe(baseline.expectedDeficitCount);
    expect(summary.diagnosticCount).toBe(baseline.expectedDiagnosticCount);
    expect(summary.cogsMinor).toBe(baseline.expectedCogsMinor);
    expect(summary.grossProfitMinor).toBe(baseline.expectedGrossProfitMinor);
    expect(summary.overlayCount).toBe(baseline.expectedOverlayCount);
    expect(summary.overlayQuantityUnits).toBe(baseline.expectedOverlayQuantityUnits);
    expect(validTimeline.orderingDiagnostics.length)
      .toBe(baseline.expectedOrderingDiagnosticCount);
    expect(validTimeline.orderingDiagnostics.filter(item => item.changed).length)
      .toBe(baseline.expectedChangedOrderingDiagnosticCount);

    for (const [accountId, expected] of Object.entries(baseline.expectedFinalAccountBalances)) {
      const state = validTimeline.finalStates[accountId];
      expect(state, `Missing stable inventory account ${accountId}`).toBeDefined();
      expect(state.unitBasis).toBe(expected.unitBasis);
      const actualQuantityUnits = state.unitBasis === 'accessory_milli_piece'
        ? state.accessoryQuantityUnits
        : state.standardizedQuantityUnits;
      expect(actualQuantityUnits).toBe(expected.quantityUnits);
      if (state.unitBasis !== 'accessory_milli_piece') {
        expectWithin(
          state.metalWacMinorPerStandardUnit ?? Number.NaN,
          expected.metalWacMinorPerStandardUnit,
          baseline.precisionPolicy.wacMinorPerScaledUnitTolerance,
          `${accountId} final metal WAC`,
        );
        expectWithin(
          state.workmanshipWacMinorPerPhysicalUnit ?? Number.NaN,
          expected.workmanshipWacMinorPerPhysicalUnit,
          baseline.precisionPolicy.wacMinorPerScaledUnitTolerance,
          `${accountId} final workmanship WAC`,
        );
      }
    }

    const overlays = validTimeline.historicalInventoryOverlays;
    expect(overlays.map(item => item.overlayId)).toEqual(baseline.approvedOverlayIds);
    expect(new Set(overlays.map(item => item.overlayId)).size).toBe(overlays.length);
    for (const overlay of overlays) {
      expect(overlay.auditHash).toBe(baseline.approvedOverlayAuditHashes[overlay.overlayId]);
      expect(overlay.quantityUnits).toBe(baseline.expectedOverlayQuantities[overlay.overlayId]);
      expect(overlay.ownerApprovalStatus).toBe('approved');
      expect(overlay.approvedAt).toBeTruthy();
      const expectedWac = baseline.expectedOverlayWac[overlay.overlayId];
      expectWithin(
        overlay.metalWacBefore,
        expectedWac.metalWacBefore,
        baseline.precisionPolicy.wacMinorPerScaledUnitTolerance,
        `${overlay.overlayId} metal WAC before`,
      );
      expectWithin(
        overlay.metalWacAfter,
        expectedWac.metalWacAfter,
        baseline.precisionPolicy.wacMinorPerScaledUnitTolerance,
        `${overlay.overlayId} metal WAC after`,
      );
      expectWithin(
        overlay.workmanshipWacBefore,
        expectedWac.workmanshipWacBefore,
        baseline.precisionPolicy.wacMinorPerScaledUnitTolerance,
        `${overlay.overlayId} workmanship WAC before`,
      );
      expectWithin(
        overlay.workmanshipWacAfter,
        expectedWac.workmanshipWacAfter,
        baseline.precisionPolicy.wacMinorPerScaledUnitTolerance,
        `${overlay.overlayId} workmanship WAC after`,
      );      const { auditHash: _hash, ...unsealed } = overlay;
      expect(sealAppliedHistoricalInventoryOverlay({
        ...unsealed,
        calculationGenerationId: 999999,
      }).auditHash).toBe(overlay.auditHash);
    }

    const january12 = validTimeline.orderingDiagnostics.find(item =>
      item.date === '2026-01-12' && item.inventoryAccountId === SCRAP_ARABIC);
    expect(january12).toMatchObject({ changed: true });
    expect(january12!.operationIdsAfter).toEqual(expect.arrayContaining(
      january12!.operationIdsBefore,
    ));
  });

  it('keeps Phase 4 isolated from overlays and preserves stable account mappings', () => {
    const { entries, accounts, timeline } = runPhase5GoldenDataset(102);
    const overlayIds = new Set(baseline.approvedOverlayIds);
    const projection = buildAccountingEngineProjection(entries, accounts, {
      mode: 'canonical_preview',
      canonicalResolver: canonicalResolverCatalogV1Resolver,
    });
    expect(projection.mode).toBe('canonical_preview');
    if (projection.mode !== 'canonical_preview') throw new Error('Expected canonical preview');
    expect(projection.canonicalPostings.filter(posting =>
      overlayIds.has(posting.sourceOperationId))).toHaveLength(0);
    expect(projection.canonicalLegs.filter(leg =>
      overlayIds.has(leg.sourceOperationId))).toHaveLength(0);
    expect(timeline!.results.filter(result => overlayIds.has(result.operationId))).toHaveLength(0);

    const bindings = new Map(CURRENT_DATASET_INVENTORY_BINDINGS.map(binding => [
      binding.inventoryAccountId,
      binding.taxonomyKey,
    ]));
    expect(bindings.get(SCRAP_ARABIC)).toBe('gold.raw.scrap_arabic');
    expect(bindings.get(GOUACHE_ARABIC)).toBe('gold.product.gouache_arabic');
  });

  it('never offsets the future surplus against a historical overlay', () => {
    const { timeline } = runPhase5GoldenDataset(103);
    const surplus = timeline!.resultsByOperationId[FUTURE_SURPLUS];
    expect(surplus).toMatchObject({
      classification: 'surplus',
      incomingStandardizedQuantityUnits: 78,
      incomingTotalCostMinor: 1746332,
      adjustmentGainMinor: 1746332,
    });
    expect(timeline!.historicalInventoryOverlays).toHaveLength(3);
    expect(timeline!.finalStates[SCRAP_ARABIC].standardizedQuantityUnits).toBe(1833);
  });

  it('fails closed for duplicate, missing, pending, rejected, or revoked overlays', () => {
    const { entries, accounts, openingConfig } = loadPhase5GoldenDataset();
    const duplicate = rebuildInventoryCostTimeline(entries, accounts, openingConfig, {
      historicalInventoryOverlayDirectives: [
        ...APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
        APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES[0],
      ],
    });
    expect(duplicate.valid).toBe(false);
    expect(duplicate.diagnostics[0]).toMatchObject({ code: 'invalid_historical_overlay' });

    const missingApproved = rebuildInventoryCostTimeline(entries, accounts, openingConfig, {
      historicalInventoryOverlayDirectives:
        APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES.slice(0, 2),
    });
    expect(missingApproved.valid).toBe(false);
    expect(missingApproved.diagnostics[0]).toMatchObject({ code: 'insufficient_inventory' });

    const approved = APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES[0];
    for (const status of ['pending_final_approval', 'rejected', 'revoked'] as const) {
      const inactive = {
        ...approved,
        ownerApprovalStatus: status,
        approvedAt: null,
        revokedAt: status === 'revoked' ? '2026-07-24T16:00:00.000+03:00' : null,
        revocationReason: status === 'revoked' ? 'golden safeguard fixture' : null,
      };
      expect(isHistoricalOverlayActive(inactive, false)).toBe(false);
      if (status !== 'pending_final_approval') {
        const inactiveRun = rebuildInventoryCostTimeline(entries, accounts, openingConfig, {
          historicalInventoryOverlayDirectives: [
            inactive,
            ...APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES.slice(1),
          ],
        });
        expect(inactiveRun.valid).toBe(false);
        expect(inactiveRun.diagnostics[0]).toMatchObject({ code: 'insufficient_inventory' });
      }
    }
    const pending = rebuildInventoryCostTimeline(entries, accounts, openingConfig, {
      historicalInventoryOverlayDirectives: [{
        ...approved,
        ownerApprovalStatus: 'pending_final_approval',
        approvedAt: null,
      }],
    });
    expect(pending.valid).toBe(false);
    expect(pending.diagnostics[0]).toMatchObject({ code: 'invalid_historical_overlay' });
  });

  it('fails clearly when the dataset count or rules identity changes', () => {
    const { entries } = loadPhase5GoldenDataset();
    expect(entries.slice(0, -1).length).not.toBe(baseline.datasetRecordCount);
    expect(baseline.calculationRulesVersion).toBe(
      `${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`
      + `+${HISTORICAL_INVENTORY_OVERLAY_VERSION}`,
    );
    expect(PHASE5_COST_CATALOG_VERSION)
      .toBe(`${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`);

    const lf = Buffer.from('{\n  "entries": [{"id": 1}, {"id": 2}]\n}\n');
    const crlf = Buffer.from('{\r\n  "entries": [{"id": 1}, {"id": 2}]\r\n}\r\n');
    const cr = Buffer.from('{\r  "entries": [{"id": 1}, {"id": 2}]\r}\r');
    const numericChange = Buffer.from('{\n  "entries": [{"id": 1}, {"id": 3}]\n}\n');
    const reordered = Buffer.from('{\n  "entries": [{"id": 2}, {"id": 1}]\n}\n');
    const removed = Buffer.from('{\n  "entries": [{"id": 1}]\n}\n');
    const expectedSha = calculateNormalizedSourceDatasetSha256(lf);

    expect(calculateNormalizedSourceDatasetSha256(crlf)).toBe(expectedSha);
    expect(calculateNormalizedSourceDatasetSha256(cr)).toBe(expectedSha);
    expect(calculateNormalizedSourceDatasetSha256(numericChange)).not.toBe(expectedSha);
    expect(calculateNormalizedSourceDatasetSha256(reordered)).not.toBe(expectedSha);
    expect(calculateNormalizedSourceDatasetSha256(removed)).not.toBe(expectedSha);
  });
});
