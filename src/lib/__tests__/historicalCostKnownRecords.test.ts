import { describe, expect, it } from 'vitest';
import { runPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';
import { findHistoricalCostReviewItems, previewAutomaticInventorySurplusWac } from '../historicalCostReview';

describe('historical cost known-record discovery', () => {
  it('discovers the 11 merchant receipts and all 16 possible surpluses across blocked accounts', () => {
    const { entries, accounts, run } = runPhase5GoldenDataset();
    const items = findHistoricalCostReviewItems(
      entries,
      accounts,
      run.timeline,
      run.error ? [run.error] : [],
    );
    expect(items.filter(item => item.kind === 'merchant_receipt')).toHaveLength(11);
    expect(items.filter(item => item.kind === 'inventory_surplus')).toHaveLength(16);
    expect(new Set(items.filter(item => item.kind === 'inventory_surplus')
      .map(item => item.inventoryAccountId)).size).toBeGreaterThan(1);
    expect(items.some(item =>
      item.operationId === 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed')).toBe(true);
    expect(entries.some(item =>
      item.id === 'csvref-entry-5e60e797bdd890736a846cf479af173b')).toBe(true);
    expect(run.status).toBe('valid');
    expect(run.timeline?.valid).toBe(true);
    expect(run.timeline?.costDataComplete).toBe(true);
    expect(run.timeline?.historicalInventoryOverlays).toContainEqual(expect.objectContaining({
      overlayId: 'hiro-20260410-scrap-arabic-e21-005',
      quantityUnits: 5,
    }));
  });

  it('values ADJ213 independently without applying future reconciliation overlays to its prefix', () => {
    const { entries, accounts, openingConfig } = runPhase5GoldenDataset();
    const preview = previewAutomaticInventorySurplusWac({
      entries,
      accounts,
      overlays: [],
      targetOperationId: 'csvref-entry-9587e49435e7da01294ff883b9fa48a9',
      openingConfig,
    });

    expect(preview).toMatchObject({
      costMinor: 520_562,
      gainMinor: 520_562,
    });
    expect(preview?.wacBeforeMinorPerDisplayUnit).toBeCloseTo(591_547.5155, 3);
    expect(preview?.wacAfterMinorPerDisplayUnit).toBeCloseTo(591_547.5410, 3);
  });
});
