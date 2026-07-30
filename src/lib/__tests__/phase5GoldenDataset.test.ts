import { describe, expect, it } from 'vitest';
import { calculatePhase5SourceDatasetSha256, loadPhase5GoldenBaseline, loadPhase5GoldenDataset, runPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';
import { buildAccountingEngineProjection } from '../accountingEngine';
import { canonicalResolverCatalogV1Resolver } from '../canonicalResolverCatalogV1';
import { APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES, HISTORICAL_INVENTORY_OVERLAY_VERSION, HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION } from '../historicalInventoryOverlay';
import { CURRENT_DATASET_INVENTORY_BINDINGS, INVENTORY_COST_TAXONOMY_VERSION } from '../inventoryCostCatalog';
import { PHASE5_COST_CATALOG_VERSION, rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import { INVENTORY_COST_CALCULATION_VERSION } from '../inventoryCostTypes';
import { HISTORICAL_COST_REVIEW_VERSION } from '../historicalCostReview';

const baseline = loadPhase5GoldenBaseline();
const SCRAP_ARABIC = 'seed-account-d1216eb4076ccdf40e20';
const GOUACHE_ARABIC = 'seed-account-391695330f1733e03bb0';
const FUTURE_SURPLUS = 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed';
const BLOCKED_OPERATION = 'csvref-entry-7decedc1a2d80d7620897618e62f5e96';

describe('Phase 5 Golden Dataset Regression — unresolved-cost fail-closed policy', () => {
  it('preserves the official source fingerprint and reconciles the known M1390 deficit', () => {
    const { entries, inputRevision, run, timeline } = runPhase5GoldenDataset(101);
    expect(entries).toHaveLength(2169);
    expect(inputRevision).toBe(baseline.datasetFingerprint);
    expect(calculatePhase5SourceDatasetSha256()).toBe(baseline.sourceDatasetSha256);
    expect(run.status).toBe('valid');
    expect(timeline?.valid).toBe(true);
    expect(timeline?.costDataComplete).toBe(true);
    expect(timeline?.historicalInventoryOverlays).toContainEqual(expect.objectContaining({
      overlayId: 'hiro-20260410-scrap-arabic-e21-005',
      sourceDeficitOperationId: BLOCKED_OPERATION,
      stableInventoryAccountId: SCRAP_ARABIC,
      quantityUnits: 5,
      totalCostMinor: 35_099,
    }));
  });

  it('keeps Phase 4 isolated and preserves stable account mappings even while cost reports are blocked', () => {
    const { entries, accounts } = runPhase5GoldenDataset(102);
    const overlayIds = new Set(APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES.map(item => item.overlayId));
    const projection = buildAccountingEngineProjection(entries, accounts, { mode: 'canonical_preview', canonicalResolver: canonicalResolverCatalogV1Resolver });
    expect(projection.mode).toBe('canonical_preview');
    if (projection.mode !== 'canonical_preview') throw new Error('Expected canonical preview');
    expect(projection.canonicalPostings.filter(posting => overlayIds.has(posting.sourceOperationId))).toHaveLength(0);
    expect(projection.canonicalLegs.filter(leg => overlayIds.has(leg.sourceOperationId))).toHaveLength(0);
    const bindings = new Map(CURRENT_DATASET_INVENTORY_BINDINGS.map(binding => [binding.inventoryAccountId, binding.taxonomyKey]));
    expect(bindings.get(SCRAP_ARABIC)).toBe('gold.raw.scrap_arabic');
    expect(bindings.get(GOUACHE_ARABIC)).toBe('gold.product.gouache_arabic');
  });

  it('does not mutate or silently price the historical future-surplus source row', () => {
    const { entries } = loadPhase5GoldenDataset();
    const source = entries.find(entry => entry.id === FUTURE_SURPLUS)!;
    const before = JSON.stringify(source);
    expect(source).toBeDefined();
    expect(source.manualCostAssignmentMinor).toBeUndefined();
    expect(source.costAssignmentStatus).toBeUndefined();
    runPhase5GoldenDataset(103);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('fails closed for duplicate, missing, pending, rejected, or revoked overlays', () => {
    const { entries, accounts, openingConfig } = loadPhase5GoldenDataset();
    const duplicate = rebuildInventoryCostTimeline(entries, accounts, openingConfig, { historicalInventoryOverlayDirectives: [...APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES, APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES[0]] });
    expect(duplicate.diagnostics[0]).toMatchObject({ code: 'invalid_historical_overlay' });
    const missing = rebuildInventoryCostTimeline(entries, accounts, openingConfig, { historicalInventoryOverlayDirectives: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES.slice(0, 2) });
    expect(missing.valid).toBe(false);
    expect(['insufficient_inventory', 'pending_surplus_cost']).toContain(missing.diagnostics[0].code);
    const approved = APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES[0];
    const pending = rebuildInventoryCostTimeline(entries, accounts, openingConfig, { historicalInventoryOverlayDirectives: [{ ...approved, ownerApprovalStatus: 'pending_final_approval', approvedAt: null }] });
    expect(pending.diagnostics[0]).toMatchObject({ code: 'invalid_historical_overlay' });
  });

  it('pins dataset count and calculation-rule identities', () => {
    const { entries } = loadPhase5GoldenDataset();
    expect(entries.slice(0, -1)).toHaveLength(baseline.datasetRecordCount - 1);
    expect(baseline.calculationRulesVersion).toBe(
      `${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}+${HISTORICAL_INVENTORY_OVERLAY_VERSION}+${HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION}+${HISTORICAL_COST_REVIEW_VERSION}`,
    );
    expect(PHASE5_COST_CATALOG_VERSION).toBe(`${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`);
  });
});