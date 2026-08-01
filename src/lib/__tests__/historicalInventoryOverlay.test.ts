import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { HistoricalInventoryOverlayDirective, InventoryRuntimeBinding } from '../inventoryCostTypes';
import {
  approvedHistoricalMerchantLiabilityOpeningsForAccounts,
} from '../historicalInventoryOverlay';


const accounts: Account[] = [
  { id: 'gold-a', name: 'ذهب 21', mainType: 'اصول', subType: 'مخزون ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'cash', name: 'الخزنة', mainType: 'اصول', subType: 'نقدية', balanceNature: 'جنيه', userId: 'u', type: 'cash', is_inventory: false },
  { id: 'equity', name: 'رأس المال', mainType: 'حقوق ملكية', subType: 'رأس المال', balanceNature: 'جنيه', userId: 'u', type: 'other', is_inventory: false },
  { id: 'adjustment', name: 'تسوية', mainType: 'حقوق ملكية', subType: 'تسوية', balanceNature: 'جنيه', userId: 'u', type: 'other', is_inventory: false },
];
const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold-a', taxonomyKey: 'gold.raw.scrap_arabic' },
];
const entry = (overrides: Partial<Entry>): Entry => ({
  id: '', seq: 1, tx: '', debit: '', credit: '', date: '2026-01-01', cash: '0',
  weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...overrides,
});
const opening = entry({
  id: 'opening', seq: 1, operationKind: 'opening', tx: 'قيد افتتاحي',
  debit: 'ذهب 21', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity',
  weight: '10', arabicWeight: '10',
});
const deficitSale = entry({
  id: 'deficit-sale', seq: 2, date: '2026-01-02', operationKind: 'sale', tx: 'بيع ذهب',
  debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب 21', creditAccountId: 'gold-a',
  weight: '10.02', arabicWeight: '10.02', cash: '1200',
});
const directive: HistoricalInventoryOverlayDirective = {
  overlayId: 'overlay-1', historicalAccountKey: 'gold-a', originalOperationId: 'deficit-sale',
  stableInventoryAccountId: 'gold-a', effectiveDate: '2026-01-02',
  quantityUnits: 2, unitBasis: 'gold_equivalent21_centigram',
  reasonCode: 'historical_inventory_reconciliation', sourceDeficitOperationId: 'deficit-sale',
  ownerApprovalStatus: 'pending_final_approval', approvedAt: null, supersedesOverlayId: null,
  revokedAt: null, revocationReason: null,
};
const run = (entries: Entry[], overlays: HistoricalInventoryOverlayDirective[] = [directive]) =>
  rebuildInventoryCostTimeline(entries, accounts, { gold21PriceByYearMinor: { '2026': 10000 } }, {
    bindings,
    historicalInventoryOverlayDirectives: overlays,
    allowPendingFinalApprovalForSimulation: true,
    calculationGenerationId: 17,
  });

describe('Historical Inventory Reconciliation Overlay', () => {
  it('uses pre-deficit component WAC, keeps WAC neutral, and creates no operation result', () => {
    const timeline = run([opening, deficitSale]);
    expect(timeline.valid).toBe(true);
    expect(timeline.results).toHaveLength(2);
    expect(timeline.results.map(result => result.operationId)).toEqual(['opening', 'deficit-sale']);
    expect(timeline.historicalInventoryOverlays).toEqual([expect.objectContaining({
      overlayId: 'overlay-1', metalCostMinor: 200, workmanshipCostMinor: 0,
      totalCostMinor: 200, calculationGenerationId: 17,
      metalWacBefore: 100, metalWacAfter: 100,
    })]);
    expect(timeline.historicalInventoryOverlays[0].auditHash).toMatch(/^[a-f0-9]{64}$/);
    expect(timeline.resultsByOperationId['deficit-sale']).toMatchObject({
      totalCogsMinor: 100200,
      profitMinor: 19800,
    });
  });

  it('keeps a future surplus independent and never cancels the historical overlay', () => {
    const laterPurchase = entry({
      id: 'later-purchase', seq: 3, date: '2026-01-20', operationKind: 'purchase', tx: 'شراء ذهب',
      debit: 'ذهب 21', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash',
      weight: '1', arabicWeight: '1', cash: '100',
    });
    const futureSurplus = entry({
      id: 'future-surplus', seq: 4, date: '2026-02-01', operationKind: 'adjustment', tx: 'تسوية زيادة',
      debit: 'ذهب 21', debitAccountId: 'gold-a', credit: 'تسوية', creditAccountId: 'adjustment',
      weight: '1', arabicWeight: '1',
    });
    const timeline = run([opening, deficitSale, laterPurchase, futureSurplus]);
    expect(timeline.valid).toBe(true);
    expect(timeline.costDataComplete).toBe(true);
    expect(timeline.historicalInventoryOverlays).toHaveLength(1);
    expect(timeline.resultsByOperationId['future-surplus']).toMatchObject({
      classification: 'surplus',
      wacBeforeMinorPerDisplayUnit: timeline.resultsByOperationId['future-surplus'].wacAfterMinorPerDisplayUnit,
    });
    expect(timeline.resultsByOperationId['future-surplus'].incomingTotalCostMinor).toBeGreaterThan(0);
    expect(timeline.resultsByOperationId['future-surplus'].adjustmentGainMinor)
      .toBe(timeline.resultsByOperationId['future-surplus'].incomingTotalCostMinor);
    expect(timeline.finalStates['gold-a'].standardizedQuantityUnits).toBe(200);
    expect(timeline.finalStates['gold-a'].pendingStandardizedQuantityUnits).toBe(0);
  });

  it('does not apply revoked overlays and blocks pending overlays outside explicit simulation mode', () => {
    const revoked = run([opening, deficitSale], [{
      ...directive, ownerApprovalStatus: 'revoked', revokedAt: '2026-02-02T00:00:00.000Z',
      revocationReason: 'documentary correction DOC-1',
    }]);
    expect(revoked.valid).toBe(false);
    expect(revoked.diagnostics[0].code).toBe('insufficient_inventory');

    const notSimulation = rebuildInventoryCostTimeline(
      [opening, deficitSale], accounts, { gold21PriceByYearMinor: { '2026': 10000 } },
      { bindings, historicalInventoryOverlayDirectives: [directive] },
    );
    expect(notSimulation.valid).toBe(false);
    expect(notSimulation.diagnostics[0]).toMatchObject({ code: 'invalid_historical_overlay' });
  });

  it('resolves the approved merchant opening top-ups with exact opening-price book values', () => {
    const resolved = approvedHistoricalMerchantLiabilityOpeningsForAccounts([
      { id: 'phase5-non-inventory-40' },
      { id: 'phase5-non-inventory-43' },
    ]);

    expect(resolved).toEqual([
      expect.objectContaining({
        merchantAccountId: 'phase5-non-inventory-40',
        metal: 'gold', standardizedWeightUnits: 77, bookValueMinor: 449_680,
      }),
      expect.objectContaining({
        merchantAccountId: 'phase5-non-inventory-43',
        metal: 'silver', standardizedWeightUnits: 48, bookValueMinor: 6_048,
      }),
    ]);
    expect(77 * 584_000 / 100).toBe(449_680);
    expect(48 * 12_600 / 100).toBe(6_048);
  });
});
