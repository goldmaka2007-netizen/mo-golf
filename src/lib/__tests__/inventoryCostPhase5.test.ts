import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding, Phase5OpeningCostConfig } from '../inventoryCostTypes';

const accounts: Account[] = [
  { id: 'gold-a', name: 'ذهب أ', mainType: 'اصول', subType: 'مخزون ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'gold-b', name: 'ذهب ب', mainType: 'اصول', subType: 'مخزون ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'silver-a', name: 'فضة أ', mainType: 'اصول', subType: 'مخزون فضة', balanceNature: 'جرام فضة', userId: 'u', type: 'silver', is_inventory: true, metal: 'silver', karat: null },
  { id: 'accessory-a', name: 'ملحق أ', mainType: 'اصول', subType: 'مخزون ملحقات اضافية', balanceNature: 'قطعة', userId: 'u', type: 'accessory', is_inventory: true, metal: null, karat: null },
  { id: 'cash', name: 'الخزنة', mainType: 'اصول', subType: 'نقدية', balanceNature: 'جنيه', userId: 'u', type: 'cash', is_inventory: false },
  { id: 'merchant', name: 'تاجر', mainType: 'خصوم', subType: 'تجار ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'merchant', is_inventory: false, metal: 'gold' },
  { id: 'equity', name: 'رأس المال', mainType: 'حقوق ملكية', subType: 'رأس المال', balanceNature: 'جنيه', userId: 'u', type: 'other', is_inventory: false },
  { id: 'adjustment', name: 'نتيجة تسوية', mainType: 'مصروفات', subType: 'تسوية', balanceNature: 'جنيه', userId: 'u', type: 'other', is_inventory: false },
];

const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold-a', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'gold-b', taxonomyKey: 'gold.product.earring_arabic' },
  { inventoryAccountId: 'silver-a', taxonomyKey: 'silver.product.ring' },
  { inventoryAccountId: 'accessory-a', taxonomyKey: 'accessory.medical_earring' },
];

const config: Phase5OpeningCostConfig = {
  gold21PriceByYearMinor: { '2026': 10000 },
  silverPriceByYearMinor: { '2026': 5000 },
  accessoryUnitCostByYearAndAccountMinor: { '2026': { 'accessory-a': 2500 } },
};

let sequence = 0;
const entry = (overrides: Partial<Entry>): Entry => ({
  id: `op-${++sequence}`,
  seq: sequence,
  tx: '',
  debit: '',
  credit: '',
  debitAccountId: undefined,
  creditAccountId: undefined,
  date: '2026-01-01',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u',
  ...overrides,
});

const rebuild = (entries: Entry[], openingConfig = config) =>
  rebuildInventoryCostTimeline(entries, accounts, openingConfig, { bindings });

describe('Phase 5 component WAC engine', () => {
  it('builds gold, silver, and accessory opening cost with zero workmanship', () => {
    const timeline = rebuild([
      entry({ id: 'gold-opening', seq: 1, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '10', arabicWeight: '10' }),
      entry({ id: 'silver-opening', seq: 2, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'فضة أ', debitAccountId: 'silver-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '2' }),
      entry({ id: 'accessory-opening', seq: 3, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'ملحق أ', debitAccountId: 'accessory-a', credit: 'رأس المال', creditAccountId: 'equity', count: '4' }),
    ]);

    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates['gold-a']).toMatchObject({
      remainingMetalCostMinor: 100000,
      remainingWorkmanshipCostMinor: 0,
      remainingTotalCostMinor: 100000,
    });
    expect(timeline.finalStates['silver-a']).toMatchObject({
      remainingMetalCostMinor: 10000,
      remainingWorkmanshipCostMinor: 0,
    });
    expect(timeline.finalStates['accessory-a']).toMatchObject({
      accessoryQuantityUnits: 4000,
      remainingAccessoryCostMinor: 10000,
    });
  });

  it('uses full customer cash purchase as metal cost and keeps pools independent', () => {
    const timeline = rebuild([
      entry({ id: 'purchase-a', seq: 1, tx: 'شراء ذهب', operationKind: 'purchase', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
      entry({ id: 'purchase-b', seq: 2, tx: 'شراء ذهب', operationKind: 'purchase', debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'الخزنة', creditAccountId: 'cash', weight: '10', cash: '2000' }),
    ]);

    expect(timeline.finalStates['gold-a'].remainingMetalCostMinor).toBe(100000);
    expect(timeline.finalStates['gold-b'].remainingMetalCostMinor).toBe(200000);
    expect(timeline.finalStates['gold-a'].metalWacMinorPerStandardUnit).toBe(100);
    expect(timeline.finalStates['gold-b'].metalWacMinorPerStandardUnit).toBe(200);
  });

  it('adds merchant cash to workmanship only and weights it by physical grams', () => {
    const timeline = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '100' }),
      entry({ id: 'merchant-receipt', seq: 2, date: '2026-01-02', tx: 'تاجر ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'تاجر', creditAccountId: 'merchant', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
    ]);

    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates['gold-a']).toMatchObject({
      standardizedQuantityUnits: 11000,
      actualPhysicalWeightUnits: 11000,
      remainingMetalCostMinor: 1100000,
      remainingWorkmanshipCostMinor: 100000,
    });
    expect(timeline.finalStates['gold-a'].workmanshipWacMinorPerPhysicalUnit).toBeCloseTo(100000 / 11000);
  });

  it('releases metal plus workmanship COGS and calculates invoice profit', () => {
    const timeline = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '100' }),
      entry({ id: 'merchant-receipt', seq: 2, date: '2026-01-02', tx: 'تاجر ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'تاجر', creditAccountId: 'merchant', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
      entry({ id: 'sale', seq: 3, date: '2026-01-03', tx: 'بيع ذهب', operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '11', cash: '2000' }),
    ]);

    expect(timeline.resultsByOperationId.sale).toMatchObject({
      metalCogsMinor: 110000,
      workmanshipCogsMinor: 10000,
      totalCogsMinor: 120000,
      saleAmountMinor: 200000,
      profitMinor: 80000,
    });
  });

  it('transfers exact component book cost without profit', () => {
    const timeline = rebuild([
      entry({ id: 'purchase', seq: 1, tx: 'شراء ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
      entry({ id: 'transfer', seq: 2, date: '2026-01-02', tx: 'تحويل', debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '4' }),
    ]);

    expect(timeline.resultsByOperationId.transfer).toMatchObject({
      incomingTotalCostMinor: 40000,
      outgoingTotalCostMinor: 40000,
      profitMinor: null,
    });
    expect(timeline.finalStates['gold-a'].remainingTotalCostMinor).toBe(60000);
    expect(timeline.finalStates['gold-b'].remainingTotalCostMinor).toBe(40000);
  });

  it('tafyeet transfers cost and creates no gain, loss, or new cost', () => {
    const timeline = rebuild([
      entry({ id: 'purchase', seq: 1, tx: 'شراء ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
      entry({ id: 'tafyeet', seq: 2, date: '2026-01-02', tx: 'تيفيت', debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '4', cash: '0' }),
    ]);

    expect(timeline.resultsByOperationId.tafyeet).toMatchObject({
      incomingTotalCostMinor: 40000,
      outgoingTotalCostMinor: 40000,
      adjustmentGainMinor: 0,
      adjustmentLossMinor: 0,
      totalCogsMinor: 0,
    });
  });

  it('shortage and surplus use the same account current full WAC', () => {
    const timeline = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '10' }),
      entry({ id: 'shortage', seq: 2, date: '2026-01-02', tx: 'تسوية', debit: 'نتيجة تسوية', debitAccountId: 'adjustment', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '1' }),
      entry({ id: 'surplus', seq: 3, date: '2026-01-03', tx: 'تسوية', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'نتيجة تسوية', creditAccountId: 'adjustment', weight: '1', costAssignmentStatus: 'approved', manualCostAssignmentMinor: 99999, costAssignmentApprovedAt: '2026-01-03T10:00:00Z', costAssignmentApprovedBy: 'auditor' }),
    ]);

    expect(timeline.resultsByOperationId.shortage.adjustmentLossMinor).toBe(10000);
    expect(timeline.resultsByOperationId.surplus).toMatchObject({
      classification: 'surplus',
      incomingTotalCostMinor: 10000,
      adjustmentGainMinor: 10000,
      wacBeforeMinorPerDisplayUnit: 10000,
      wacAfterMinorPerDisplayUnit: 10000,
    });
    expect(timeline.finalStates['gold-a'].remainingTotalCostMinor).toBe(100000);
  });

  it('gold count-only adjustment has no cost movement', () => {
    const timeline = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '10' }),
      entry({ id: 'count-only', seq: 2, date: '2026-01-02', tx: 'تسوية', debit: 'نتيجة تسوية', debitAccountId: 'adjustment', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '0', count: '1' }),
    ]);

    expect(timeline.resultsByOperationId['count-only'].classification).toBe('quantity_only');
    expect(timeline.finalStates['gold-a'].remainingTotalCostMinor).toBe(100000);
  });

  it('uses WAC per piece for accessory sale and adjustments', () => {
    const timeline = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', debit: 'ملحق أ', debitAccountId: 'accessory-a', credit: 'رأس المال', creditAccountId: 'equity', count: '4' }),
      entry({ id: 'sale', seq: 2, date: '2026-01-02', tx: 'بيع ملحقات', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ملحق أ', creditAccountId: 'accessory-a', count: '1', cash: '50' }),
      entry({ id: 'surplus', seq: 3, date: '2026-01-03', tx: 'تسوية', debit: 'ملحق أ', debitAccountId: 'accessory-a', credit: 'نتيجة تسوية', creditAccountId: 'adjustment', count: '1', costAssignmentStatus: 'approved', manualCostAssignmentMinor: 99999, costAssignmentApprovedAt: '2026-01-03T10:00:00Z', costAssignmentApprovedBy: 'auditor' }),
      entry({ id: 'shortage', seq: 4, date: '2026-01-04', tx: 'تسوية', debit: 'نتيجة تسوية', debitAccountId: 'adjustment', credit: 'ملحق أ', creditAccountId: 'accessory-a', count: '1' }),
    ]);

    expect(timeline.resultsByOperationId.sale.totalCogsMinor).toBe(2500);
    expect(timeline.resultsByOperationId.surplus.adjustmentGainMinor).toBe(2500);
    expect(timeline.resultsByOperationId.shortage.adjustmentLossMinor).toBe(2500);
  });

  it('uses accessory opening unit cost saved by the actual accountId', () => {
    const timeline = rebuild([
      entry({ id: 'accessory-id-opening', seq: 1, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'ملحق أ', debitAccountId: 'accessory-a', credit: 'رأس المال', creditAccountId: 'equity', count: '2' }),
    ], {
      accessoryUnitCostByYearAndAccountMinor: { '2026': { 'accessory-a': 1234 } },
    });

    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates['accessory-a']).toMatchObject({
      accessoryQuantityUnits: 2000,
      remainingAccessoryCostMinor: 2468,
    });
  });

  it('does not require accessory opening unit cost when opening quantity is zero', () => {
    const timeline = rebuild([
      entry({ id: 'zero-accessory-opening', seq: 1, tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'ملحق أ', debitAccountId: 'accessory-a', credit: 'رأس المال', creditAccountId: 'equity', count: '0', weight: '0' }),
    ], {});

    expect(timeline.valid).toBe(true);
    expect(timeline.resultsByOperationId['zero-accessory-opening']).toMatchObject({
      incomingAccessoryQuantityUnits: 0,
      incomingTotalCostMinor: 0,
    });
    expect(timeline.finalStates['accessory-a']).toMatchObject({
      accessoryQuantityUnits: 0,
      remainingAccessoryCostMinor: 0,
      hasReliableCostBasis: false,
    });
  });
  it('reads historical accessory quantity from weight without changing the entry', () => {
    const opening = entry({
      id: 'legacy-accessory',
      seq: null,
      sourceRow: 1,
      imported: true,
      legacyOperationNo: 'TX1',
      tx: 'قيد افتتاحي',
      debit: 'ملحق أ',
      debitAccountId: 'accessory-a',
      credit: 'رأس المال',
      creditAccountId: 'equity',
      count: '0',
      weight: '4',
    });
    const timeline = rebuild([opening]);
    expect(timeline.finalStates['accessory-a'].accessoryQuantityUnits).toBe(4000);
    expect(opening.count).toBe('0');
  });

  it('fails closed for missing opening cost and unknown inventory IDs', () => {
    const missing = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '1' }),
    ], {});
    expect(missing.valid).toBe(false);
    expect(missing.results).toEqual([]);
    expect(missing.diagnostics[0].code).toBe('missing_opening_cost');

    const unknownAccounts = accounts.map(account => account.id === 'gold-a' ? { ...account, id: 'unknown-gold' } : account);
    const unknown = rebuildInventoryCostTimeline([], unknownAccounts, config, { bindings });
    expect(unknown.valid).toBe(false);
    expect(unknown.diagnostics.some(item => item.code === 'unknown_inventory_account')).toBe(true);
  });

  it('fails closed when merchant workmanship has zero physical weight', () => {
    const timeline = rebuild([
      entry({ id: 'merchant', seq: 1, tx: 'تاجر ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'تاجر', creditAccountId: 'merchant', weight: '0', cash: '1000', transactionGoldValueMinor: 100000 }),
    ]);
    expect(timeline.valid).toBe(false);
    expect(timeline.diagnostics[0].code).toBe('merchant_workmanship_without_weight');
  });

  it('rejects unequal standardized tafyeet weight', () => {
    const crossKaratAccounts = accounts.map(account =>
      account.id === 'gold-b' ? { ...account, karat: '18' as const } : account);
    const crossKaratBindings: InventoryRuntimeBinding[] = bindings.map(binding =>
      binding.inventoryAccountId === 'gold-b'
        ? { ...binding, taxonomyKey: 'gold.raw.scrap_foreign' }
        : binding);
    const timeline = rebuildInventoryCostTimeline([
      entry({ id: 'source', seq: 1, tx: 'شراء ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
      entry({ id: 'tafyeet', seq: 2, tx: 'تيفيت', debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '1' }),
    ], crossKaratAccounts, config, { bindings: crossKaratBindings });
    expect(timeline.valid).toBe(false);
    expect(timeline.diagnostics[0].code).toBe('tafyeet_quantity_mismatch');
  });

  it('rejects unsupported cost-affecting inventory variants and excessive sales', () => {
    const unsupported = rebuild([
      entry({ id: 'unknown', seq: 1, tx: 'عملية غير معتمدة', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '1' }),
    ]);
    expect(unsupported.valid).toBe(false);
    expect(unsupported.diagnostics[0].code).toBe('unknown_inventory_operation');

    const excessive = rebuild([
      entry({ id: 'purchase', seq: 1, tx: 'شراء ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '1', cash: '100' }),
      entry({ id: 'sale', seq: 2, tx: 'بيع ذهب', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '2', cash: '300' }),
    ]);
    expect(excessive.valid).toBe(false);
    expect(excessive.diagnostics[0].code).toBe('insufficient_inventory');
  });

  it('is deterministic regardless of input array order', () => {
    const entries = [
      entry({ id: 'purchase', seq: 1, tx: 'شراء فضة', debit: 'فضة أ', debitAccountId: 'silver-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '10', cash: '1000', transactionGoldValueMinor: 100000 }),
      entry({ id: 'sale', seq: 2, tx: 'بيع فضة', debit: 'الخزنة', debitAccountId: 'cash', credit: 'فضة أ', creditAccountId: 'silver-a', weight: '2', cash: '300' }),
    ];
    const forward = rebuild(entries);
    const reverse = rebuild([...entries].reverse());
    expect(reverse.results).toEqual(forward.results);
    expect(reverse.finalStates).toEqual(forward.finalStates);
  });

  it('batches unsequenced legacy receipts before same-day issues and records a diagnostic', () => {
    const opening = entry({
      id: 'legacy-opening',
      seq: null,
      imported: true,
      sourceRow: 30,
      tx: 'قيد افتتاحي',
      debit: 'ذهب أ',
      debitAccountId: 'gold-a',
      credit: 'رأس المال',
      creditAccountId: 'equity',
      weight: '1',
      arabicWeight: '1',
    });
    const sale = entry({
      id: 'legacy-sale',
      seq: null,
      imported: true,
      sourceRow: 20,
      date: '2026-01-02',
      tx: 'بيع ذهب',
      debit: 'الخزنة',
      debitAccountId: 'cash',
      credit: 'ذهب أ',
      creditAccountId: 'gold-a',
      weight: '2',
      arabicWeight: '2',
      cash: '300',
    });
    const purchase = entry({
      id: 'legacy-purchase',
      seq: null,
      imported: true,
      sourceRow: 10,
      date: '2026-01-02',
      tx: 'شراء ذهب',
      debit: 'ذهب أ',
      debitAccountId: 'gold-a',
      credit: 'الخزنة',
      creditAccountId: 'cash',
      weight: '2',
      arabicWeight: '2',
      cash: '200',
    });
    const timeline = rebuild([opening, sale, purchase]);
    expect(timeline.valid).toBe(true);
    expect(timeline.orderedOperationIds.indexOf('legacy-purchase'))
      .toBeLessThan(timeline.orderedOperationIds.indexOf('legacy-sale'));
    expect(timeline.orderingDiagnostics).toContainEqual(expect.objectContaining({
      date: '2026-01-02',
      inventoryAccountId: 'gold-a',
      changed: true,
    }));
  });

  it('orders the 2026-03-10 transfer as destination incoming before the outgoing sale', () => {
    const sourceOpening = entry({
      id: '2026-source-opening', seq: null, imported: true, sourceRow: 2168,
      tx: 'قيد افتتاحي', operationKind: 'opening',
      debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity',
      weight: '37.94', arabicWeight: '37.94',
    });
    const destinationOpening = entry({
      id: '2026-destination-opening', seq: null, imported: true, sourceRow: 2167,
      tx: 'قيد افتتاحي', operationKind: 'opening',
      debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'رأس المال', creditAccountId: 'equity',
      weight: '19.28', arabicWeight: '19.28',
    });
    const sale = entry({
      id: 'csvref-entry-c83e6fbd7b7281ade64971729a973623',
      seq: null, imported: true, sourceRow: 1274, date: '2026-03-10', tx: 'بيع ذهب',
      debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب ب', creditAccountId: 'gold-b',
      weight: '20.06', arabicWeight: '20.06', cash: '100',
    });
    const transfer = entry({
      id: 'csvref-entry-70429284f8d0738630b21fc0550da708',
      seq: null, imported: true, sourceRow: 1254, date: '2026-03-10', tx: 'تحويل',
      debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'ذهب أ', creditAccountId: 'gold-a',
      weight: '5.88', arabicWeight: '5.88',
    });

    const timeline = rebuild([sourceOpening, destinationOpening, sale, transfer]);
    const dayDiagnostic = timeline.orderingDiagnostics.find(item =>
      item.date === '2026-03-10' && item.inventoryAccountId === 'gold-b');

    expect(timeline.valid).toBe(true);
    expect(dayDiagnostic).toMatchObject({
      changed: true,
      incomingOperationIds: [transfer.id],
      outgoingOperationIds: [sale.id],
    });
    expect(timeline.orderedOperationIds.indexOf(transfer.id!))
      .toBeLessThan(timeline.orderedOperationIds.indexOf(sale.id!));
    expect(timeline.diagnostics).toEqual([]);
    expect(timeline.finalStates['gold-b'].standardizedQuantityUnits).toBe(510);
  });
  it('does not batch operations that have a reliable sequence or createdAt', () => {
    const sequenced = rebuild([
      entry({ id: 'opening', seq: 1, tx: 'قيد افتتاحي', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'equity', weight: '1' }),
      entry({ id: 'sale', seq: 1, date: '2026-01-02', tx: 'بيع ذهب', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '2', cash: '300' }),
      entry({ id: 'purchase', seq: 2, date: '2026-01-02', tx: 'شراء ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'الخزنة', creditAccountId: 'cash', weight: '2', cash: '200' }),
    ]);
    expect(sequenced.valid).toBe(false);
    expect(sequenced.diagnostics[0].code).toBe('insufficient_inventory');
    expect(sequenced.orderingDiagnostics.some(item => item.date === '2026-01-02')).toBe(false);

    const timestampedSale = entry({
      id: 'timestamped-sale',
      seq: null,
      imported: true,
      sourceRow: 20,
      createdAt: '2026-01-03T08:00:00.000Z',
      date: '2026-01-03',
      tx: 'بيع ذهب',
      debit: 'الخزنة',
      debitAccountId: 'cash',
      credit: 'ذهب أ',
      creditAccountId: 'gold-a',
      weight: '1',
      cash: '100',
    });
    const timestampedPurchase = entry({
      id: 'timestamped-purchase',
      seq: null,
      imported: true,
      sourceRow: 10,
      createdAt: '2026-01-03T09:00:00.000Z',
      date: '2026-01-03',
      tx: 'شراء ذهب',
      debit: 'ذهب أ',
      debitAccountId: 'gold-a',
      credit: 'الخزنة',
      creditAccountId: 'cash',
      weight: '1',
      cash: '100',
    });
    const timestamped = rebuild([timestampedSale, timestampedPurchase]);
    expect(timestamped.valid).toBe(false);
    expect(timestamped.orderingDiagnostics).toEqual([]);
  });

  it('does not mistake malformed legacy ordering metadata for a reliable order', () => {
    const timeline = rebuild([
      entry({
        id: 'malformed-sale',
        seq: '' as unknown as number,
        imported: true,
        sourceRow: 20,
        createdAt: 'not-a-timestamp',
        date: '2026-01-03',
        tx: 'بيع ذهب',
        debit: 'الخزنة',
        debitAccountId: 'cash',
        credit: 'ذهب أ',
        creditAccountId: 'gold-a',
        weight: '1',
        arabicWeight: '1',
        cash: '100',
      }),
      entry({
        id: 'malformed-purchase',
        seq: null,
        imported: true,
        sourceRow: 10,
        createdAt: 'also-invalid',
        date: '2026-01-03',
        tx: 'شراء ذهب',
        debit: 'ذهب أ',
        debitAccountId: 'gold-a',
        credit: 'الخزنة',
        creditAccountId: 'cash',
        weight: '1',
        arabicWeight: '1',
        cash: '100',
      }),
    ]);
    expect(timeline.valid).toBe(true);
    expect(timeline.orderedOperationIds).toEqual(['malformed-purchase', 'malformed-sale']);
    expect(timeline.orderingDiagnostics).toContainEqual(expect.objectContaining({
      date: '2026-01-03',
      inventoryAccountId: 'gold-a',
      changed: true,
    }));
  });
});
