import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildCanonicalAccountRegistry, buildCanonicalAccountingLegs } from '../canonicalAccounting';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding, Phase5OpeningCostConfig } from '../inventoryCostTypes';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildMerchantGoldLiabilityTimeline } from '../merchantGoldLiability';
import { trialBalanceDimensionLabel } from '../trialBalanceReport';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';

const accounts: Account[] = [
  { id: 'finished', name: 'مشغولات ذهب', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'جرام ذهب', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' },
  { id: 'scrap', name: 'كسر عربي', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'جرام ذهب', type: 'gold_raw', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' },
  { id: 'merchant-a', name: 'محمد السيد', mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', balanceNature: 'جرام ذهب', type: 'merchant', metal: 'gold', merchantDirection: 'payable', userId: 'u' },
  { id: 'merchant-b', name: 'الصافي', mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', balanceNature: 'جرام ذهب', type: 'merchant', metal: 'gold', merchantDirection: 'payable', userId: 'u' },
  { id: 'khaled', name: 'خالد حميدو', mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', balanceNature: 'جرام ذهب', type: 'merchant', metal: 'gold', merchantDirection: 'payable', userId: 'u' },
  { id: 'cash', name: 'الخزنة', mainType: 'assets', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'جنيه', type: 'cash', userId: 'u' },
  { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'جنيه', type: 'other', userId: 'u' },
];

const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'finished', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'scrap', taxonomyKey: 'gold.raw.scrap_arabic' },
];
const openingConfig: Phase5OpeningCostConfig = { gold21PriceByYearMinor: { '2026': 500000 } };

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: '', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0',
  arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch,
});
const rebuild = (entries: Entry[]) => rebuildInventoryCostTimeline(entries, accounts, openingConfig, { bindings });
const receipt = (id: string, merchantId: string, weight: string, marketPrice?: number, cash = '0', seq = 1): Entry => entry({
  id, seq, tx: 'تاجر ذهب', operationKind: 'purchase', debit: 'مشغولات ذهب', debitAccountId: 'finished',
  credit: accounts.find(account => account.id === merchantId)!.name, creditAccountId: merchantId,
  weight, arabicWeight: weight, cash, marketPrice,
});
const settlement = (id: string, merchantId: string, weight: string, seq: number): Entry => entry({
  id, seq, tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: accounts.find(account => account.id === merchantId)!.name,
  debitAccountId: merchantId, credit: 'كسر عربي', creditAccountId: 'scrap', weight, arabicWeight: weight,
});
const opening = (id: string, inventoryId: 'finished' | 'scrap', weight: string, seq = 1): Entry => entry({
  id, seq, tx: 'قيد افتتاحي', operationKind: 'opening', debit: accounts.find(account => account.id === inventoryId)!.name,
  debitAccountId: inventoryId, credit: 'رأس المال', creditAccountId: 'capital', weight, arabicWeight: weight,
});
const signed = (legs: ReturnType<typeof buildLegacyLedgerLegs>, entityId: string, dimension: 'cash' | 'gold' | 'book_value'): number =>
  legs.filter(leg => leg.entityId === entityId && leg.dimension === dimension)
    .reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0);

describe('merchant gold liability WAC central projection', () => {
  it('creates receipt liability weight, carrying value, and merchant WAC from the immutable operation price', () => {
    const entries = [receipt('receipt', 'merchant-a', '10', 6000)];
    const inventory = rebuild(entries);
    const timeline = buildMerchantGoldLiabilityTimeline(entries, accounts, inventory);
    expect(timeline.movementsByOperationId.receipt).toMatchObject({
      kind: 'receipt', quantityUnits: 1000, carryingValueMinor: 6000000, valuationSource: 'operation_price_snapshot',
    });
    expect(timeline.finalStates['merchant-a']).toMatchObject({
      goldE21Balance: 10, goldLiabilityBookValueMinor: 6000000, goldLiabilityWacMinorPerE21Unit: 6000,
    });
  });

  it('releases merchant WAC and Inventory WAC independently and posts only the settlement gain', () => {
    const entries = [opening('opening-scrap', 'scrap', '1'), receipt('receipt', 'merchant-a', '1', 6000, '0', 2), settlement('settle', 'merchant-a', '1', 3)];
    const inventory = rebuild(entries);
    const timeline = buildMerchantGoldLiabilityTimeline(entries, accounts, inventory);
    const movement = timeline.movementsByOperationId.settle;
    expect(movement).toMatchObject({
      merchantLiabilityReleasedValueMinor: 600000,
      inventoryBookValueReleasedMinor: 500000,
      settlementGainMinor: 100000,
      settlementLossMinor: 0,
    });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ goldE21Balance: 0, goldLiabilityBookValueMinor: 0 });

    const legs = buildLegacyLedgerLegs(entries, accounts, [], { enableFinancialProjection: true, costTimeline: inventory });
    expect(signed(legs, 'merchant:merchant-a', 'book_value')).toBe(0);
    expect(legs.filter(leg => leg.sourceEntryId === 'settle' && leg.entityId === 'system:income:gold-settlement-gain')).toEqual([
      expect.objectContaining({ side: 'credit', amount: 1000 }),
    ]);
    expect(legs.filter(leg => leg.sourceEntryId === 'settle' && leg.entityId.startsWith('system:income:cogs:'))).toHaveLength(0);

    const statements = buildFinancialStatementsEgp(entries, accounts, { timeline: inventory, balanceEndDate: '2026-12-31' });
    expect(statements.incomeStatement.revenue).toContainEqual(expect.objectContaining({ label: 'مكاسب تسوية التزامات الذهب', amount: 1000 }));
    expect(statements.incomeStatement.cogs).toBe(0);
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
    const trial = buildUnifiedTrialBalance(entries, accounts, '2026-01-01', '2026-12-31', { timeline: inventory });
    expect(trial.financialDifference).toBe(0);
    expect(trialBalanceDimensionLabel('book_value')).toBe('ميزان القيمة الدفترية');
  });

  it('carries source WAC on merchant transfer with no inventory or P&L', () => {
    const before = [receipt('a-receipt', 'merchant-a', '20', 6000), receipt('b-receipt', 'merchant-b', '10', 7000, '0', 2)];
    const transfer = entry({ id: 'merchant-transfer', seq: 3, date: '2026-06-20', tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '5', arabicWeight: '5', marketPrice: 9999 });
    const inventoryBefore = rebuild(before);
    const inventoryAfter = rebuild([...before, transfer]);
    const timeline = buildMerchantGoldLiabilityTimeline([...before, transfer], accounts, inventoryAfter);
    expect(timeline.movementsByOperationId['merchant-transfer']).toMatchObject({ carryingValueMinor: 3000000, valuationSource: 'source_merchant_wac' });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ goldE21Balance: 15, goldLiabilityBookValueMinor: 9000000 });
    expect(timeline.finalStates['merchant-b']).toMatchObject({ goldE21Balance: 15, goldLiabilityBookValueMinor: 10000000 });
    expect(Object.values(inventoryAfter.finalStates).map(state => state.remainingTotalCostMinor))
      .toEqual(Object.values(inventoryBefore.finalStates).map(state => state.remainingTotalCostMinor));
    const legs = buildLegacyLedgerLegs([...before, transfer], accounts, [], { enableFinancialProjection: true, costTimeline: inventoryAfter });
    expect(legs.filter(leg => leg.sourceEntryId === 'merchant-transfer' && ['revenue', 'expenses'].includes(leg.group))).toHaveLength(0);
  });

  it('keeps Merchant + Treasury settlement cash-only', () => {
    const receive = receipt('receipt', 'merchant-a', '2', 6000, '800');
    const cashSettlement = entry({ id: 'cash-settlement', seq: 2, tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الخزنة', creditAccountId: 'cash', cash: '800' });
    const inventory = rebuild([receive, cashSettlement]);
    const timeline = buildMerchantGoldLiabilityTimeline([receive, cashSettlement], accounts, inventory);
    expect(timeline.movementsByOperationId['cash-settlement']).toMatchObject({ kind: 'cash_settlement', quantityUnits: 0, carryingValueMinor: 0 });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ goldE21Balance: 2, goldLiabilityBookValueMinor: 1200000 });
    expect(inventory.resultsByOperationId['cash-settlement']).toBeUndefined();
    expect(buildCanonicalAccountingLegs([cashSettlement], buildCanonicalAccountRegistry(accounts, [cashSettlement])))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ entityId: 'merchant:merchant-a', side: 'debit', dimension: 'cash', amount: 800 }),
        expect.objectContaining({ entityId: 'account:cash', side: 'credit', dimension: 'cash', amount: 800 }),
      ]));
  });

  it('closes both real Khaled Hamido receipt/settlement cycles without residual gold, book value, or workmanship cash', () => {
    const entries = [
      opening('khaled-scrap-opening', 'scrap', '10'),
      opening('khaled-finished-opening', 'finished', '10', 2),
      { ...receipt('TX646', 'khaled', '2.14', undefined, '670', 3), date: '2026-02-17' },
      { ...settlement('TX653', 'khaled', '2.14', 4), date: '2026-02-17' },
      entry({ id: 'TX661', seq: 5, date: '2026-02-17', tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: 'خالد حميدو', debitAccountId: 'khaled', credit: 'الخزنة', creditAccountId: 'cash', cash: '670' }),
      { ...receipt('TX1662', 'khaled', '1.63', 5871, '590', 6), date: '2026-05-19' },
      { ...settlement('TX1663', 'khaled', '1.63', 7), date: '2026-05-19' },
      entry({ id: 'TX1664', seq: 8, date: '2026-05-19', tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: 'خالد حميدو', debitAccountId: 'khaled', credit: 'الخزنة', creditAccountId: 'cash', cash: '590' }),
    ];
    const inventory = rebuild(entries);
    const timeline = buildMerchantGoldLiabilityTimeline(entries, accounts, inventory);
    const legs = buildLegacyLedgerLegs(entries, accounts, [], { enableFinancialProjection: true, costTimeline: inventory });
    expect(timeline.movements.filter(movement => movement.kind === 'receipt').reduce((sum, movement) => sum + movement.quantityUnits, 0)).toBe(377);
    expect(timeline.finalStates.khaled).toMatchObject({ goldE21Balance: 0, goldLiabilityBookValueMinor: 0 });
    expect(signed(legs, 'merchant:khaled', 'cash')).toBe(0);
    expect(signed(legs, 'merchant:khaled', 'gold')).toBe(0);
    expect(signed(legs, 'merchant:khaled', 'book_value')).toBe(0);
    expect(timeline.diagnostics).toContainEqual(expect.objectContaining({ code: 'missing_approved_historical_price', operationId: 'TX646' }));
  });

  it('proves TX1768 Mohamed-to-Al-Safy invariant and settles destination at its recomputed WAC', () => {
    const base = [
      opening('safy-scrap-opening', 'scrap', '20'),
      receipt('mohamed-credit', 'merchant-a', '20', 6000, '0', 2),
      receipt('safy-credit', 'merchant-b', '10', 7000, '0', 3),
    ];
    const transfer = entry({ id: 'TX1768', seq: 4, date: '2026-06-20', tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '14', arabicWeight: '14' });
    const delivery = { ...settlement('safy-delivery', 'merchant-b', '5', 5), date: '2026-06-21' };
    const beforeInventory = rebuild(base);
    const afterTransferInventory = rebuild([...base, transfer]);
    const afterTransfer = buildMerchantGoldLiabilityTimeline([...base, transfer], accounts, afterTransferInventory);
    const totalBefore = 12000000 + 7000000;
    const totalAfter = Object.values(afterTransfer.finalStates).reduce((sum, state) => sum + state.goldLiabilityBookValueMinor, 0);
    expect(afterTransfer.movementsByOperationId.TX1768).toMatchObject({ quantityUnits: 1400, carryingValueMinor: 8400000 });
    expect(totalAfter).toBe(totalBefore);
    expect(afterTransfer.finalStates['merchant-b'].goldLiabilityWacMinorPerE21Unit).toBeCloseTo(15400000 / 2400);
    expect(Object.values(afterTransferInventory.finalStates).map(state => state.remainingTotalCostMinor))
      .toEqual(Object.values(beforeInventory.finalStates).map(state => state.remainingTotalCostMinor));

    const finalInventory = rebuild([...base, transfer, delivery]);
    const finalTimeline = buildMerchantGoldLiabilityTimeline([...base, transfer, delivery], accounts, finalInventory);
    const released = Math.round((15400000 * 500) / 2400);
    expect(finalTimeline.movementsByOperationId['safy-delivery']).toMatchObject({
      merchantLiabilityReleasedValueMinor: released,
      inventoryBookValueReleasedMinor: 2500000,
      settlementGainMinor: released - 2500000,
    });
    const transferLegs = buildLegacyLedgerLegs([...base, transfer], accounts, [], { enableFinancialProjection: true, costTimeline: afterTransferInventory })
      .filter(leg => leg.sourceEntryId === 'TX1768');
    expect(transferLegs.filter(leg => leg.dimension === 'book_value')).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: 'merchant:merchant-a', side: 'debit', amount: 84000 }),
      expect.objectContaining({ entityId: 'merchant:merchant-b', side: 'credit', amount: 84000 }),
    ]));
    expect(transferLegs.filter(leg => ['revenue', 'expenses'].includes(leg.group))).toHaveLength(0);
  });
});
