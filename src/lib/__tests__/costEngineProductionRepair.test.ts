import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding } from '../inventoryCostTypes';
import { createHistoricalCostInterpretationOverlay, validateHistoricalCostInterpretationOverlay } from '../historicalCostMigrationOverlay';
import { buildIndependentMigrationControlTotals } from '../independentMigrationControls';
import { buildFinancialPostingProjection } from '../postingProjection';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { annualSnapshotMatchesFullHistory, createAnnualCostSnapshot, invalidateAnnualSnapshots, rebuildInventoryCostFromAnnualSnapshot } from '../annualCostSnapshots';

const accounts: Account[] = [
  { id: 'g21', name: 'ذهب 21', mainType: 'اصول', subType: 'مخزون', balanceNature: 'ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'g21b', name: 'ذهب 21 ب', mainType: 'اصول', subType: 'مخزون', balanceNature: 'ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'g18', name: 'ذهب 18', mainType: 'اصول', subType: 'مخزون', balanceNature: 'ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '18' },
  { id: 'g24', name: 'ذهب 24', mainType: 'اصول', subType: 'مخزون', balanceNature: 'ذهب', userId: 'u', type: 'gold_direct', is_inventory: true, metal: 'gold', karat: '24' },
  { id: 'cash', name: 'الخزنة', mainType: 'اصول', subType: 'نقدية', balanceNature: 'جنيه', userId: 'u', type: 'cash' },
  { id: 'merchant', name: 'تاجر', mainType: 'خصوم', subType: 'تاجر ذهب', balanceNature: 'ذهب', userId: 'u', type: 'merchant', metal: 'gold' },
  { id: 'merchant2', name: '\u0627\u0644\u062a\u0627\u062c\u0631 \u0627\u0644\u0645\u062d\u0648\u0644 \u0625\u0644\u064a\u0647', mainType: '\u062e\u0635\u0648\u0645', subType: '\u062a\u062c\u0627\u0631 \u0630\u0647\u0628', balanceNature: '\u062c\u0631\u0627\u0645 \u0630\u0647\u0628', userId: 'u', type: 'merchant', metal: 'gold' },
  { id: 'adjustment', name: 'تسويات', mainType: 'مصروفات', subType: 'تسويات', balanceNature: 'جنيه', userId: 'u', type: 'other' },
];
const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'g21', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'g21b', taxonomyKey: 'gold.product.earring_arabic' },
  { inventoryAccountId: 'g18', taxonomyKey: 'gold.product.ring_women' },
  { inventoryAccountId: 'g24', taxonomyKey: 'gold.direct.bar' },
];
let seq = 0;
const make = (overrides: Partial<Entry>): Entry => ({
  id: `p-${++seq}`, seq, tx: '', debit: '', credit: '', date: '2026-01-01', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...overrides,
});
const run = (entries: Entry[]) => rebuildInventoryCostTimeline(entries, accounts, {}, { bindings });
const purchase = (id: string, weight: string, cash: string, date = '2026-01-01') => make({ id, operationKind: 'purchase', tx: 'شراء ذهب', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'الخزنة', creditAccountId: 'cash', weight, cash, date });
const sale = (id: string, weight: string, cash: string, date = '2026-01-02') => make({ id, operationKind: 'sale', tx: 'بيع ذهب', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب 21', creditAccountId: 'g21', weight, cash, date });

describe('production Cost Engine repair', () => {
  it('keeps purchase out of profit and derives sale COGS from pre-sale WAC', () => {
    const timeline = run([purchase('buy', '3', '10'), sale('sell', '1', '8')]);
    expect(timeline.valid).toBe(true);
    expect(timeline.resultsByOperationId.buy.profitMinor).toBeNull();
    expect(timeline.resultsByOperationId.sell.totalCogsMinor).toBe(333);
    expect(timeline.finalStates.g21.remainingTotalCostMinor).toBe(667);
  });

  it('keeps partial rounding residual and clears it on the final sale', () => {
    const partial = run([purchase('buy-r', '3', '0.01'), sale('sale-r1', '1', '1')]);
    expect(partial.resultsByOperationId['sale-r1'].totalCogsMinor).toBe(0);
    expect(partial.finalStates.g21.remainingTotalCostMinor).toBe(1);
    const full = run([purchase('buy-r2', '3', '0.01'), sale('sale-r2', '1', '1'), sale('sale-r3', '2', '1', '2026-01-03')]);
    expect(full.resultsByOperationId['sale-r3'].totalCogsMinor).toBe(1);
    expect(full.finalStates.g21.remainingTotalCostMinor).toBe(0);
    expect(full.finalStates.g21.standardizedQuantityUnits).toBe(0);
  });

  it('recognizes merchant metal at transaction value without zero-cost dilution', () => {
    const timeline = run([
      purchase('cash-buy', '10', '1000'),
      make({ id: 'mr', tx: 'تاجر ذهب', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'تاجر', creditAccountId: 'merchant', weight: '10', transactionGoldValueMinor: 200000, workmanshipCostMinor: 10000, date: '2026-01-02' }),
    ]);
    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates.g21.remainingMetalCostMinor).toBe(300000);
    expect(timeline.merchantGoldLiabilities.merchant).toMatchObject({ standardizedWeightUnits: 1000, bookValueMinor: 200000 });
  });

  it('supports receipt, sale, partial settlement and full settlement deterministically', () => {
    const timeline = run([
      make({ id: 'mr2', tx: 'تاجر ذهب', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'تاجر', creditAccountId: 'merchant', weight: '10', transactionGoldValueMinor: 100000, workmanshipCostMinor: 0 }),
      sale('merchant-sale', '2', '300', '2026-01-02'),
      make({ id: 'settle1', tx: 'حساب تاجر ذهب', debit: 'تاجر', debitAccountId: 'merchant', credit: 'ذهب 21', creditAccountId: 'g21', weight: '3', date: '2026-01-03' }),
      make({ id: 'settle2', tx: 'حساب تاجر ذهب', debit: 'تاجر', debitAccountId: 'merchant', credit: 'ذهب 21', creditAccountId: 'g21', weight: '5', date: '2026-01-04' }),
      make({ id: 'cash-settle', tx: 'حساب تاجر ذهب', debit: 'تاجر', debitAccountId: 'merchant', credit: 'الخزنة', creditAccountId: 'cash', merchantGoldWeight: '2', cash: '200', date: '2026-01-05' }),
    ]);
    expect(timeline.valid).toBe(true);
    expect(timeline.merchantGoldLiabilities.merchant.bookValueMinor).toBe(0);
    expect(timeline.finalStates.g21.remainingTotalCostMinor).toBe(0);
  });

  it('posts merchant gold settlement gain from liability book value versus source-account WAC', () => {
    const timeline = run([
      purchase('scrap-base', '10', '65000'),
      make({
        id: 'merchant-receipt-6600', date: '2026-01-02', tx: 'تاجر ذهب',
        debit: 'ذهب 21 ب', debitAccountId: 'g21b', credit: 'تاجر',
        creditAccountId: 'merchant', weight: '10', arabicWeight: '10',
        transactionGoldValueMinor: 6_600_000, workmanshipCostMinor: 0,
      }),
      make({
        id: 'merchant-delivery-9', date: '2026-01-03', tx: 'حساب تاجر ذهب',
        debit: 'تاجر', debitAccountId: 'merchant', credit: 'ذهب 21',
        creditAccountId: 'g21', weight: '9', arabicWeight: '9',
      }),
    ]);

    expect(timeline.valid).toBe(true);
    expect(timeline.resultsByOperationId['merchant-delivery-9']).toMatchObject({
      classification: 'merchant_delivery',
      outgoingTotalCostMinor: 5_850_000,
      merchantLiabilityDecreaseMinor: 5_940_000,
      merchantSettlementGainMinor: 90_000,
      merchantSettlementLossMinor: 0,
    });
    expect(timeline.finalStates.g21.standardizedQuantityUnits).toBe(100);
    expect(timeline.merchantGoldLiabilities.merchant.standardizedWeightUnits).toBe(100);
  });

  it('restores customer returns at original sale cost after later purchases and prevents over-return', () => {
    const originalPurchase = purchase('return-buy', '10', '1000');
    const originalSale = sale('return-sale', '4', '800', '2026-01-02');
    const later = purchase('later-buy', '10', '3000', '2026-01-03');
    const returned = make({ id: 'customer-return', operationKind: 'customer_return', originalOperationId: 'return-sale', tx: 'مرتجع ذهب', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'الخزنة', creditAccountId: 'cash', weight: '2', date: '2026-01-04' });
    const timeline = run([originalPurchase, originalSale, later, returned]);
    expect(timeline.resultsByOperationId['customer-return']).toMatchObject({ reversedCogsMinor: 20000, revenueReversalMinor: 40000, incomingTotalCostMinor: 20000 });
    const invalid = run([originalPurchase, originalSale, later, returned, make({ ...returned, id: 'too-much', seq: ++seq, weight: '3', date: '2026-01-05' })]);
    expect(invalid.valid).toBe(false);
    expect(invalid.diagnostics[0].code).toBe('over_return');
  });

  it('reverses supplier purchase at original acquisition cost, not current WAC', () => {
    const timeline = run([
      purchase('supplier-buy', '10', '1000'),
      purchase('expensive-buy', '10', '3000', '2026-01-02'),
      make({ id: 'supplier-return', operationKind: 'supplier_return', originalOperationId: 'supplier-buy', tx: 'مرتجع مورد', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب 21', creditAccountId: 'g21', weight: '5', date: '2026-01-03' }),
    ]);
    expect(timeline.resultsByOperationId['supplier-return'].purchaseCostReversalMinor).toBe(50000);
    expect(timeline.finalStates.g21.remainingTotalCostMinor).toBe(350000);
  });

  it('values surplus from the same account pre-operation WAC and fails closed without one', () => {
    const automatic = run([purchase('surplus-base', '1', '100'), make({ id: 'automatic', operationKind: 'adjustment', tx: 'تسوية زيادة', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'تسويات', creditAccountId: 'adjustment', weight: '1', costAssignmentStatus: 'pending_cost_assignment' })]);
    expect(automatic.costDataComplete).toBe(true);
    expect(automatic.resultsByOperationId.automatic).toMatchObject({
      classification: 'surplus',
      incomingTotalCostMinor: 10000,
      adjustmentGainMinor: 10000,
      wacBeforeMinorPerDisplayUnit: 10000,
      wacAfterMinorPerDisplayUnit: 10000,
    });
    expect(automatic.finalStates.g21.standardizedQuantityUnits).toBe(200);
    expect(automatic.finalStates.g21.pendingStandardizedQuantityUnits).toBe(0);

    const ignoresManualMarketValue = run([purchase('surplus-base2', '1', '100'), make({ id: 'approved', operationKind: 'adjustment', tx: 'تسوية زيادة', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'تسويات', creditAccountId: 'adjustment', weight: '1', costAssignmentStatus: 'approved', manualCostAssignmentMinor: 99999, costAssignmentApprovedAt: '2026-01-02T00:00:00Z', costAssignmentApprovedBy: 'auditor' })]);
    expect(ignoresManualMarketValue.resultsByOperationId.approved.incomingTotalCostMinor).toBe(10000);
    expect(ignoresManualMarketValue.finalStates.g21.remainingTotalCostMinor).toBe(20000);

    const noPriorWac = run([make({ id: 'manual-required', operationKind: 'adjustment', tx: 'تسوية زيادة', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'تسويات', creditAccountId: 'adjustment', weight: '1' })]);
    expect(noPriorWac.costDataComplete).toBe(false);
    expect(noPriorWac.resultsByOperationId['manual-required'].classification).toBe('pending_surplus');
    expect(noPriorWac.unresolvedCostData[0]).toMatchObject({ code: 'pending_surplus_cost', operationId: 'manual-required' });
  });

  it('moves actual carrying cost in a two-sided adjustment without gain or loss', () => {
    const timeline = run([purchase('move-base', '10', '1000'), make({ id: 'move', operationKind: 'adjustment', tx: 'تسوية', debit: 'ذهب 21 ب', debitAccountId: 'g21b', credit: 'ذهب 21', creditAccountId: 'g21', weight: '4' })]);
    expect(timeline.resultsByOperationId.move).toMatchObject({ outgoingTotalCostMinor: 40000, incomingTotalCostMinor: 40000, adjustmentGainMinor: 0, adjustmentLossMinor: 0 });
  });

  it('manufactures without profit, absorbs normal loss, adds conversion cost and separates abnormal loss', () => {
    const noLoss = run([purchase('m-buy', '10', '1000'), make({ id: 'm1', operationKind: 'manufacturing', tx: 'تيفيت', debit: 'ذهب 21 ب', debitAccountId: 'g21b', credit: 'ذهب 21', creditAccountId: 'g21', manufacturing: { version: 'manufacturing-v1', inputs: [{ inventoryAccountId: 'g21', physicalWeight: '10' }], outputs: [{ inventoryAccountId: 'g21b', physicalWeight: '10' }], directConversionCostMinor: 10000 } })]);
    expect(noLoss.resultsByOperationId.m1).toMatchObject({ incomingTotalCostMinor: 110000, outgoingTotalCostMinor: 100000, manufacturingConversionCostMinor: 10000, manufacturingAbnormalLossMinor: 0 });
    const losses = run([purchase('m-buy2', '10', '1000'), make({ id: 'm2', operationKind: 'manufacturing', tx: 'تيفيت', debit: 'ذهب 21 ب', debitAccountId: 'g21b', credit: 'ذهب 21', creditAccountId: 'g21', manufacturing: { version: 'manufacturing-v1', inputs: [{ inventoryAccountId: 'g21', physicalWeight: '10' }], outputs: [{ inventoryAccountId: 'g21b', physicalWeight: '8' }], directConversionCostMinor: 0, normalLossStandardizedUnits: 100, abnormalLossStandardizedUnits: 100, abnormalLossCostMinor: 10000 } })]);
    expect(losses.resultsByOperationId.m2).toMatchObject({ incomingTotalCostMinor: 90000, manufacturingAbnormalLossMinor: 10000 });
  });

  it('allocates waste/by-product and validates different-karat Standard-21 conservation', () => {
    const timeline = run([purchase('karat-buy', '10', '1000'), make({ id: 'karat-mfg', operationKind: 'manufacturing', tx: 'تيفيت', manufacturing: { version: 'manufacturing-v1', inputs: [{ inventoryAccountId: 'g21', physicalWeight: '10', standardizedQuantityUnits: 1000 }], outputs: [{ inventoryAccountId: 'g18', physicalWeight: '10.5', standardizedQuantityUnits: 900, allocatedCostMinor: 90000 }, { inventoryAccountId: 'g21b', physicalWeight: '1', standardizedQuantityUnits: 100, role: 'by_product', allocatedCostMinor: 10000 }], directConversionCostMinor: 0 }, debit: 'ذهب 18', debitAccountId: 'g18', credit: 'ذهب 21', creditAccountId: 'g21' })]);
    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates.g18.remainingTotalCostMinor).toBe(90000);
    expect(timeline.finalStates.g21b.remainingTotalCostMinor).toBe(10000);
  });

  it('keeps karat pools isolated and fails closed for duplicate IDs and negative inventory', () => {
    const isolated = run([purchase('iso21', '1', '100'), make({ id: 'iso24', operationKind: 'purchase', tx: 'شراء ذهب', debit: 'ذهب 24', debitAccountId: 'g24', credit: 'الخزنة', creditAccountId: 'cash', weight: '1', cash: '240' })]);
    expect(isolated.finalStates.g21.remainingTotalCostMinor).toBe(10000);
    expect(isolated.finalStates.g24.remainingTotalCostMinor).toBe(24000);
    expect(run([purchase('dup', '1', '100'), purchase('dup', '1', '100')]).diagnostics[0].code).toBe('duplicate_operation');
    const negative = run([purchase('neg-buy', '1', '100'), sale('neg-sale', '2', '300')]);
    expect(negative.valid).toBe(false);
    expect(negative.results).toEqual([]);
    expect(negative.diagnostics[0].code).toBe('insufficient_inventory');
  });

  it('opens the next year from an approved snapshot without duplication and invalidates later snapshots', () => {
    const yearOneEntries = [purchase('snap-buy', '10', '1000', '2026-01-01')];
    const close2026 = run(yearOneEntries);
    const snapshot = createAnnualCostSnapshot(close2026, '2026', '2026-12-31T23:59:59Z', 'auditor');
    const all = [...yearOneEntries, sale('snap-sale', '4', '800', '2027-02-01')];
    const full = run(all);
    const seeded = rebuildInventoryCostFromAnnualSnapshot(all, accounts, snapshot, {}, { bindings });
    expect(annualSnapshotMatchesFullHistory(full, seeded)).toBe(true);
    expect(() => rebuildInventoryCostFromAnnualSnapshot([...all, make({ id: 'double-open', operationKind: 'opening', tx: 'قيد افتتاحي', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'الخزنة', creditAccountId: 'cash', weight: '1', date: '2027-01-01' })], accounts, snapshot, {}, { bindings })).toThrow('duplicate_opening');
    expect(invalidateAnnualSnapshots([snapshot], { id: 'prior-change', date: '2026-05-01' })[0].status).toBe('requires_recalculation');
  });

  it('survives thousands of deterministic adversarial operations with exact zero close', () => {
    const operations: Entry[] = [];
    for (let index = 0; index < 1000; index += 1) operations.push(purchase(`stress-buy-${index}`, '1', String((index % 7) + 1), '2026-01-01'));
    for (let index = 0; index < 1000; index += 1) operations.push(sale(`stress-sale-${index}`, '1', '10', '2026-01-02'));
    const timeline = run(operations);
    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates.g21.standardizedQuantityUnits).toBe(0);
    expect(timeline.finalStates.g21.remainingTotalCostMinor).toBe(0);
  });

  it('seals migration overlays and reconciles independent account/year control totals', () => {
    const operations = [purchase('control-buy', '10', '1000'), sale('control-sale', '4', '800')];
    const timeline = run(operations);
    const controls = buildIndependentMigrationControlTotals(operations, accounts);
    const row = controls.rows.find(item => item.inventoryAccountId === 'g21' && item.year === '2026')!;
    expect(controls.complete).toBe(true);
    expect(row).toMatchObject({ closingQuantityUnits: 600, closingCarryingCostMinor: 60000, cogsMinor: 40000, grossProfitMinor: 40000 });
    expect(row.closingCarryingCostMinor).toBe(timeline.finalStates.g21.remainingTotalCostMinor);
    const overlay = createHistoricalCostInterpretationOverlay({ overlayId: 'ov-1', targetOperationId: 'legacy-1', targetAccountId: 'g21', reason: 'فاتورة تاريخية معتمدة', oldValue: null, newInterpretedValue: { transactionGoldValueMinor: 100000 }, approver: 'auditor', source: 'invoice-1', createdTimestamp: '2026-12-31T10:00:00Z' });
    expect(validateHistoricalCostInterpretationOverlay(overlay)).toBe(true);
    expect(validateHistoricalCostInterpretationOverlay({ ...overlay, reason: 'tampered' })).toBe(false);
  });
  it('keeps the unified Posting Projection balanced and ties statement profit to its exact legs', () => {
    const operations = [purchase('posting-buy', '10', '1000'), sale('posting-sale', '4', '800')];
    const timeline = run(operations);
    const projection = buildFinancialPostingProjection(operations, accounts, [], timeline);
    expect(projection.journal.trialBalanceTotals.cash.difference).toBe(0);
    const statements = buildFinancialStatementsEgp(operations, accounts, { timeline, incomeStartDate: '2026-01-01', incomeEndDate: '2026-12-31' });
    expect(statements.incomeStatement.netProfit).toBe(400);
    expect(statements.balanceSheet.inventory.reduce((sum, row) => sum + row.bookValue, 0)).toBe(timeline.finalStates.g21.remainingTotalCostMinor / 100);
  });
  it('remeasures merchant liability from recorded book value, never from a zero-book assumption', () => {
    const receipt = make({ id: 'remeasure-receipt', tx: 'تاجر ذهب', debit: 'ذهب 21', debitAccountId: 'g21', credit: 'تاجر', creditAccountId: 'merchant', weight: '10', arabicWeight: '10', transactionGoldValueMinor: 100000, workmanshipCostMinor: 0 });
    const timeline = run([receipt]);
    const report = buildFinancialStatementsEgp([receipt], accounts, { timeline, goldPriceEgp: 200, balanceEndDate: '2026-12-31' });
    expect(report.balanceSheet.assets.goldInventory).toBe(2000);
    expect(report.balanceSheet.liabilities.merchant).toBe(2000);
    expect(report.balanceSheet.equity.valuationReserve).toBe(0);
  });
  it('values merchant opening liability and carries its book value through a same-day merchant transfer before delivery', () => {
    const openingInventory = make({
      id: 'legacy-inventory-opening', imported: true, seq: undefined, sourceRow: 100,
      operationKind: 'opening', tx: '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a',
      debit: '\u0630\u0647\u0628 21', debitAccountId: 'g21', credit: '\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644',
      weight: '10', arabicWeight: '10', date: '2026-01-01',
    });
    const openingLiability = make({
      id: 'legacy-merchant-opening', imported: true, seq: undefined, sourceRow: 99,
      operationKind: 'opening', tx: '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a',
      debit: '\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644', credit: '\u062a\u0627\u062c\u0631', creditAccountId: 'merchant',
      weight: '10', arabicWeight: '10', date: '2026-01-01',
    });
    const delivery = make({
      id: 'legacy-delivery-before-transfer', imported: true, seq: undefined, sourceRow: 20,
      tx: '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628',
      debit: '\u0627\u0644\u062a\u0627\u062c\u0631 \u0627\u0644\u0645\u062d\u0648\u0644 \u0625\u0644\u064a\u0647', debitAccountId: 'merchant2',
      credit: '\u0630\u0647\u0628 21', creditAccountId: 'g21', weight: '4', arabicWeight: '4', date: '2026-02-01',
    });
    const transfer = make({
      id: 'legacy-merchant-transfer', imported: true, seq: undefined, sourceRow: 10,
      tx: '\u062d\u0648\u0627\u0644\u0629', debit: '\u062a\u0627\u062c\u0631', debitAccountId: 'merchant',
      credit: '\u0627\u0644\u062a\u0627\u062c\u0631 \u0627\u0644\u0645\u062d\u0648\u0644 \u0625\u0644\u064a\u0647', creditAccountId: 'merchant2',
      weight: '4', arabicWeight: '4', date: '2026-02-01',
    });

    const timeline = rebuildInventoryCostTimeline(
      [openingInventory, openingLiability, delivery, transfer],
      accounts,
      { gold21PriceByYearMinor: { '2026': 10_000 } },
      { bindings },
    );

    expect(timeline.valid).toBe(true);
    expect(timeline.costDataComplete).toBe(true);
    expect(timeline.orderedOperationIds.indexOf(transfer.id!)).toBeLessThan(
      timeline.orderedOperationIds.indexOf(delivery.id!),
    );
    expect(timeline.resultsByOperationId['legacy-merchant-opening']).toMatchObject({
      classification: 'merchant_liability_opening',
      merchantLiabilityIncreaseMinor: 100_000,
    });
    expect(timeline.resultsByOperationId['legacy-merchant-transfer']).toMatchObject({
      classification: 'merchant_liability_transfer',
      merchantLiabilityIncreaseMinor: 40_000,
      merchantLiabilityDecreaseMinor: 40_000,
    });
    expect(timeline.resultsByOperationId['legacy-delivery-before-transfer']).toMatchObject({
      classification: 'merchant_delivery',
      merchantLiabilityDecreaseMinor: 40_000,
    });
    expect(timeline.unresolvedCostData).toEqual([]);
    expect(timeline.merchantGoldLiabilities.merchant).toMatchObject({
      standardizedWeightUnits: 600,
      bookValueMinor: 60_000,
    });
    expect(timeline.merchantGoldLiabilities.merchant2).toMatchObject({
      standardizedWeightUnits: 0,
      bookValueMinor: 0,
    });
  });});