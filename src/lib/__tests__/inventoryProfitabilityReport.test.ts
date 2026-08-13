import { describe, expect, it } from 'vitest';
import { buildInventoryProfitabilityReport, groupProfitabilityRowsByMonth } from '../inventoryProfitabilityReport';
import type { InventoryCostTimeline, OperationCostResultV2 } from '../inventoryCostTypes';

const accounts = [
  { id: 'g18-a', name: 'خاتم إفرنجي', is_inventory: true, metal: 'gold' as const, karat: '18' as const },
  { id: 'g18-b', name: 'كسر إفرنجي', is_inventory: true, metal: 'gold' as const, karat: '18' as const },
  { id: 'g21', name: 'خاتم عربي', is_inventory: true, metal: 'gold' as const, karat: '21' as const },
  { id: 'g24', name: 'سبيكة', is_inventory: true, metal: 'gold' as const, karat: '24' as const },
];
const row = (id: string, classification: OperationCostResultV2['classification'], date: string, patch: Partial<OperationCostResultV2> = {}): OperationCostResultV2 => ({
  operationId: id, classification, inventoryAccountId: 'g18-a', incomingStandardizedQuantityUnits: 0, outgoingStandardizedQuantityUnits: 0,
  incomingActualPhysicalWeightUnits: 0, outgoingActualPhysicalWeightUnits: 0, incomingAccessoryQuantityUnits: 0, outgoingAccessoryQuantityUnits: 0,
  incomingMetalCostMinor: 0, incomingWorkmanshipCostMinor: 0, outgoingMetalCostMinor: 0, outgoingWorkmanshipCostMinor: 0,
  incomingTotalCostMinor: 0, outgoingTotalCostMinor: 0, metalCogsMinor: 0, workmanshipCogsMinor: 0, totalCogsMinor: 0,
  saleAmountMinor: 0, profitMinor: null, adjustmentGainMinor: 0, adjustmentLossMinor: 0, calculationVersion: 'phase5-wac-v1',
  entry: { id, tx: id, debit: '', credit: '', date, cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u' }, ...patch,
});
const timeline = (): InventoryCostTimeline => ({ calculationVersion: 'phase5-wac-v1', valid: true, orderedOperationIds: [], results: [
  row('purchase', 'customer_purchase', '2026-01-02', { destinationInventoryAccountId: 'g18-a', incomingStandardizedQuantityUnits: 100, incomingTotalCostMinor: 50000 }),
  row('receipt', 'merchant_receipt', '2026-01-03', { destinationInventoryAccountId: 'g18-a', incomingStandardizedQuantityUnits: 100, incomingTotalCostMinor: 90000 }),
  row('sale', 'sale', '2026-01-04', { sourceInventoryAccountId: 'g18-a', outgoingStandardizedQuantityUnits: 80, totalCogsMinor: 32000, outgoingTotalCostMinor: 32000, saleAmountMinor: 48000, profitMinor: 16000 }),
  row('transfer', 'transfer', '2026-01-05', { sourceInventoryAccountId: 'g18-a', destinationInventoryAccountId: 'g18-b', incomingStandardizedQuantityUnits: 20, outgoingStandardizedQuantityUnits: 20 }),
  row('cross-karat', 'tafyeet', '2026-02-02', { sourceInventoryAccountId: 'g18-a', destinationInventoryAccountId: 'g21', incomingStandardizedQuantityUnits: 10, outgoingStandardizedQuantityUnits: 10 }),
  row('surplus', 'surplus', '2026-02-03', { destinationInventoryAccountId: 'g21', incomingStandardizedQuantityUnits: 10, adjustmentGainMinor: 7000 }),
  row('shortage', 'shortage', '2026-02-04', { sourceInventoryAccountId: 'g21', outgoingStandardizedQuantityUnits: 5, adjustmentLossMinor: 4000 }),
], resultsByOperationId: {}, finalStates: {
  'g18-a': { inventoryAccountId: 'g18-a', taxonomyKey: 'gold.product.ring_women', displayName: 'خاتم إفرنجي', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', standardizedQuantityUnits: 100, actualPhysicalWeightUnits: 120, accessoryQuantityUnits: 0, remainingMetalCostMinor: 50000, remainingWorkmanshipCostMinor: 0, remainingAccessoryCostMinor: 0, remainingTotalCostMinor: 50000, metalWacMinorPerStandardUnit: 500, workmanshipWacMinorPerPhysicalUnit: 0, totalWacMinorPerDisplayUnit: 500, lastKnownMetalCostMinor: 0, lastKnownStandardizedQuantityUnits: 0, lastKnownWorkmanshipCostMinor: 0, lastKnownPhysicalQuantityUnits: 0, lastKnownAccessoryCostMinor: 0, lastKnownAccessoryQuantityUnits: 0, hasReliableCostBasis: true, calculationVersion: 'phase5-wac-v1' },
  'g18-b': { inventoryAccountId: 'g18-b', taxonomyKey: 'gold.raw.scrap_foreign', displayName: 'كسر إفرنجي', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', standardizedQuantityUnits: 20, actualPhysicalWeightUnits: 24, accessoryQuantityUnits: 0, remainingMetalCostMinor: 10000, remainingWorkmanshipCostMinor: 0, remainingAccessoryCostMinor: 0, remainingTotalCostMinor: 10000, metalWacMinorPerStandardUnit: 500, workmanshipWacMinorPerPhysicalUnit: 0, totalWacMinorPerDisplayUnit: 500, lastKnownMetalCostMinor: 0, lastKnownStandardizedQuantityUnits: 0, lastKnownWorkmanshipCostMinor: 0, lastKnownPhysicalQuantityUnits: 0, lastKnownAccessoryCostMinor: 0, lastKnownAccessoryQuantityUnits: 0, hasReliableCostBasis: true, calculationVersion: 'phase5-wac-v1' },
  'g21': { inventoryAccountId: 'g21', taxonomyKey: 'gold.product.ring_arabic', displayName: 'خاتم عربي', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', standardizedQuantityUnits: 50, actualPhysicalWeightUnits: 50, accessoryQuantityUnits: 0, remainingMetalCostMinor: 30000, remainingWorkmanshipCostMinor: 0, remainingAccessoryCostMinor: 0, remainingTotalCostMinor: 30000, metalWacMinorPerStandardUnit: 600, workmanshipWacMinorPerPhysicalUnit: 0, totalWacMinorPerDisplayUnit: 600, lastKnownMetalCostMinor: 0, lastKnownStandardizedQuantityUnits: 0, lastKnownWorkmanshipCostMinor: 0, lastKnownPhysicalQuantityUnits: 0, lastKnownAccessoryCostMinor: 0, lastKnownAccessoryQuantityUnits: 0, hasReliableCostBasis: true, calculationVersion: 'phase5-wac-v1' },
}, diagnostics: [], orderingDiagnostics: [], historicalInventoryOverlays: [] });

describe('inventory profitability report', () => {
  it('keeps customer purchases separate from merchant receipts and reconciles authoritative sales', () => {
    const report = buildInventoryProfitabilityReport(timeline(), accounts, { type: 'item', accountId: 'g18-a' });
    expect(report.rows.filter(x => x.result.classification === 'customer_purchase').reduce((s, x) => s + x.incomingCostMinor, 0)).toBe(50000);
    expect(report.saleAmountMinor).toBe(48000); expect(report.totalCogsMinor).toBe(32000); expect(report.grossProfitMinor).toBe(16000);
  });
  it('shows item transfer movement but excludes same-group and total-gold internal transfers', () => {
    expect(buildInventoryProfitabilityReport(timeline(), accounts, { type: 'item', accountId: 'g18-a' }).externalOutgoingE21Units).toBe(110);
    expect(buildInventoryProfitabilityReport(timeline(), accounts, { type: 'karat', karat: 18 }).externalOutgoingE21Units).toBe(90);
    expect(buildInventoryProfitabilityReport(timeline(), accounts, { type: 'gold-total' }).externalOutgoingE21Units).toBe(85);
  });
  it('uses karat accounts, E21 units, separate adjustments, and reconciling monthly rows', () => {
    const report = buildInventoryProfitabilityReport(timeline(), accounts, { type: 'karat', karat: 21 });
    expect(report.accountIds).toEqual(['g21']); expect(report.currentE21Units).toBe(50); expect(report.adjustmentGainMinor).toBe(7000); expect(report.adjustmentLossMinor).toBe(4000);
    for (const month of groupProfitabilityRowsByMonth(buildInventoryProfitabilityReport(timeline(), accounts, { type: 'gold-total' }))) expect(month.openingE21Units + month.incomingE21Units - month.outgoingE21Units).toBe(month.closingE21Units);
  });
});
