import { describe, expect, it } from 'vitest';
import { buildSelectedItemsCostAudit } from '../../../scripts/audit-selected-items-cost';
import { loadPhase5GoldenBaseline, loadPhase5GoldenDataset, runPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';

const RECONCILED_OPERATION = 'csvref-entry-7decedc1a2d80d7620897618e62f5e96';

describe('selected items cost audit trail', () => {
  it('publishes selected-item reconciliations from the complete Cost Run', () => {
    const audit = buildSelectedItemsCostAudit();
    expect(audit.accounts.length).toBeGreaterThan(0);
  });

  it('preserves the source and reconciles M1390 with complete cost data', () => {
    const baseline = loadPhase5GoldenBaseline();
    const { entries, run } = runPhase5GoldenDataset(301);
    expect(entries).toHaveLength(baseline.datasetRecordCount);
    expect(run.status).toBe('valid');
    expect(run.timeline?.costDataComplete).toBe(true);
    expect(run.timeline?.historicalInventoryOverlays).toContainEqual(expect.objectContaining({
      overlayId: 'hiro-20260410-scrap-arabic-e21-005',
      sourceDeficitOperationId: RECONCILED_OPERATION,
    }));
  });

  it('does not inject market value or a manual cost into the unresolved source record', () => {
    const { entries } = loadPhase5GoldenDataset();
    const source = entries.find(entry => entry.id === 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed')!;
    expect(source.manualCostAssignmentMinor).toBeUndefined();
    expect(source.costAssignmentStatus).toBeUndefined();
    expect(source.marketPrice).toBeUndefined();
  });
});