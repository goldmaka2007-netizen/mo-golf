import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding, Phase5OpeningCostConfig } from '../inventoryCostTypes';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildMerchantMetalPositionTimeline } from '../merchantGoldLiability';
import { applyRuntimeAccountOverride } from '../runtimeAccountOverrides';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';

const account = (patch: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_gold', balanceNature: 'gold', type: 'merchant', metal: 'gold',
  merchantDirection: 'payable', userId: 'u', ...patch,
});
const accounts: Account[] = [
  account({ id: 'gold-finished', name: 'مشغولات ذهب', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', type: 'gold_product', is_inventory: true, karat: '21' }),
  account({ id: 'gold-scrap', name: 'كسر عربي', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', type: 'gold_raw', is_inventory: true, karat: '21' }),
  account({ id: 'silver-stock', name: 'كسر فضة', mainType: 'assets', subType: 'inventory_silver', canonicalMainType: 'assets', canonicalSubType: 'inventory_silver', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, karat: null }),
  account({ id: 'merchant-a', name: 'محمد السيد' }),
  account({ id: 'merchant-b', name: 'الصافي' }),
  account({ id: 'khaled', name: 'خالد حميدو' }),
  account({ id: 'silver-merchant', name: 'تاجر الفضة', subType: 'merchant_silver', canonicalSubType: 'merchant_silver', balanceNature: 'silver', metal: 'silver' }),
  account({ id: 'CGuSD99FTGDiX3fdfuCc', name: 'الاء ياسر', type: 'other', subType: 'other_due', canonicalSubType: 'other_due', metal: null }),
  account({ id: 'cash', name: 'الخزنة', mainType: 'assets', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', metal: null, merchantDirection: undefined }),
  account({ id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', metal: null, merchantDirection: undefined }),
];
const normalizedAccounts = accounts.map(applyRuntimeAccountOverride);
const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold-finished', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'gold-scrap', taxonomyKey: 'gold.raw.scrap_arabic' },
  { inventoryAccountId: 'silver-stock', taxonomyKey: 'silver.raw.scrap' },
];
const openingConfig: Phase5OpeningCostConfig = {
  gold21PriceByYearMinor: { '2026': 500000 },
  silverPriceByYearMinor: { '2026': 10000 },
};
const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: '', date: '2026-01-01', debit: '', credit: '', cash: '0',
  weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch,
});
const rebuild = (entries: Entry[]) => rebuildInventoryCostTimeline(entries, normalizedAccounts, openingConfig, { bindings });
const opening = (id: string, inventoryId: 'gold-finished' | 'gold-scrap' | 'silver-stock', weight: string, seq = 1): Entry => entry({
  id, seq, tx: 'قيد افتتاحي', operationKind: 'opening', debit: normalizedAccounts.find(item => item.id === inventoryId)!.name,
  debitAccountId: inventoryId, credit: 'رأس المال', creditAccountId: 'capital', weight, arabicWeight: weight,
});
const goldReceipt = (id: string, merchantId: string, weight: string, price: number, cash = '0', seq = 1): Entry => entry({
  id, seq, tx: 'تاجر ذهب', operationKind: 'purchase', debit: 'مشغولات ذهب', debitAccountId: 'gold-finished',
  credit: normalizedAccounts.find(item => item.id === merchantId)!.name, creditAccountId: merchantId,
  weight, arabicWeight: weight, cash, invoiceOfficialPricePerGramEgp: price, karat: 21,
});
const goldDelivery = (id: string, merchantId: string, weight: string, seq: number, price?: number): Entry => entry({
  id, seq, tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: normalizedAccounts.find(item => item.id === merchantId)!.name,
  debitAccountId: merchantId, credit: 'كسر عربي', creditAccountId: 'gold-scrap', weight, arabicWeight: weight,
  invoiceOfficialPricePerGramEgp: price, karat: 21,
});
const silverReceipt = (id: string, weight: string, price: number, seq: number): Entry => entry({
  id, seq, tx: 'تاجر فضة', operationKind: 'purchase', debit: 'كسر فضة', debitAccountId: 'silver-stock',
  credit: 'تاجر الفضة', creditAccountId: 'silver-merchant', weight, arabicWeight: weight,
  invoiceOfficialPricePerGramEgp: price,
});
const silverDelivery = (id: string, weight: string, price: number, seq: number): Entry => entry({
  id, seq, tx: 'حساب تاجر فضة', operationKind: 'merchant_settlement', debit: 'تاجر الفضة', debitAccountId: 'silver-merchant',
  credit: 'كسر فضة', creditAccountId: 'silver-stock', weight, arabicWeight: weight,
  invoiceOfficialPricePerGramEgp: price,
});
const signed = (legs: ReturnType<typeof buildLegacyLedgerLegs>, entityId: string, dimension: 'cash' | 'gold' | 'silver' | 'book_value'): number =>
  legs.filter(leg => leg.entityId === entityId && leg.dimension === dimension)
    .reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0);

describe('signed merchant metal carrying-value projection', () => {
  it('preserves positive gold receipt and separate Merchant/Inventory WAC settlement', () => {
    const entries = [opening('open', 'gold-scrap', '10'), goldReceipt('receive', 'merchant-a', '1', 6000, '0', 2), goldDelivery('settle', 'merchant-a', '1', 3)];
    const inventory = rebuild(entries);
    const timeline = buildMerchantMetalPositionTimeline(entries, normalizedAccounts, inventory);
    expect(timeline.movementsByOperationId.receive).toMatchObject({ carryingValueMinor: 600000, valuationSource: 'operation_price_snapshot' });
    expect(timeline.movementsByOperationId.settle).toMatchObject({ merchantLiabilityReleasedValueMinor: 600000, inventoryBookValueReleasedMinor: 500000, settlementGainMinor: 100000 });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ positionSide: 'settled', signedQuantity: 0, payableBookValueMinor: 0, receivableBookValueMinor: 0 });
  });

  it('splits gold positive-to-negative overdelivery and recognizes the excess receivable immediately', () => {
    const entries = [opening('open', 'gold-scrap', '20'), goldReceipt('receive', 'merchant-a', '5', 6000, '0', 2), goldDelivery('over', 'merchant-a', '7', 3, 7000)];
    const inventory = rebuild(entries);
    const timeline = buildMerchantMetalPositionTimeline(entries, normalizedAccounts, inventory);
    expect(timeline.movementsByOperationId.over).toMatchObject({
      merchantLiabilityReleasedValueMinor: 3000000,
      merchantReceivableCreatedValueMinor: 1400000,
      inventoryBookValueReleasedMinor: 3500000,
      settlementGainMinor: 900000,
    });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ positionSide: 'receivable', signedQuantity: -2, receivableBookValueMinor: 1400000 });
    const statements = buildFinancialStatementsEgp(entries, normalizedAccounts, { timeline: inventory, balanceEndDate: '2026-12-31' });
    expect(statements.balanceSheet.assets.merchantGoldReceivables).toBe(14000);
    expect(statements.balanceSheet.liabilities.merchantGold).toBe(0);
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('settles a gold receivable then starts a fresh payable without blending old valuation', () => {
    const entries = [
      opening('open', 'gold-scrap', '20'),
      goldReceipt('first', 'merchant-a', '5', 6000, '0', 2),
      goldDelivery('over', 'merchant-a', '7', 3, 7000),
      goldReceipt('repay', 'merchant-a', '5', 8000, '0', 4),
    ];
    const inventory = rebuild(entries);
    const timeline = buildMerchantMetalPositionTimeline(entries, normalizedAccounts, inventory);
    expect(timeline.movementsByOperationId.repay).toMatchObject({
      merchantReceivableReleasedValueMinor: 1400000,
      merchantPayableCreatedValueMinor: 2400000,
      settlementGainMinor: 200000,
    });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ positionSide: 'payable', signedQuantity: 3, payableBookValueMinor: 2400000, currentWacMinorPerUnit: 8000 });
  });

  it('conserves source carrying value when a transfer crosses the destination from receivable to payable', () => {
    const before = [opening('open', 'gold-scrap', '20'), goldReceipt('source', 'merchant-a', '10', 6000, '0', 2), goldDelivery('safy-negative', 'merchant-b', '2', 3, 7000)];
    const transfer = entry({ id: 'cross-transfer', seq: 4, date: '2026-06-20', tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '5', arabicWeight: '5', karat: 21 });
    const inventoryBefore = rebuild(before);
    const inventoryAfter = rebuild([...before, transfer]);
    const timeline = buildMerchantMetalPositionTimeline([...before, transfer], normalizedAccounts, inventoryAfter);
    expect(timeline.finalStates['merchant-a']).toMatchObject({ positionSide: 'payable', signedQuantity: 5, payableBookValueMinor: 3000000, currentWacMinorPerUnit: 6000 });
    expect(timeline.finalStates['merchant-b']).toMatchObject({ positionSide: 'payable', signedQuantity: 3, payableBookValueMinor: 1600000, currentWacMinorPerUnit: 5333.333333333333 });
    expect(timeline.movementsByOperationId['cross-transfer']).toMatchObject({ carryingValueMinor: 3000000, merchantDebitValueMinor: 3000000, merchantCreditValueMinor: 3000000, inventoryBookValueReleasedMinor: 0, inventoryBookValueRecognizedMinor: 0, settlementGainMinor: 0, settlementLossMinor: 0 });
    expect(Object.values(inventoryAfter.finalStates).map(state => state.remainingTotalCostMinor)).toEqual(Object.values(inventoryBefore.finalStates).map(state => state.remainingTotalCostMinor));
    const totalSigned = Object.values(timeline.finalStates).reduce((sum, state) => sum + state.signedCarryingValueMinor, 0);
    expect(totalSigned).toBe(4600000);
    const legs = buildLegacyLedgerLegs([...before, transfer], normalizedAccounts, [], { enableFinancialProjection: true, costTimeline: inventoryAfter });
    expect(legs.filter(leg => leg.sourceEntryId === 'cross-transfer' && ['revenue', 'expenses'].includes(leg.group))).toHaveLength(0);
  });

  it('releases the complete source carrying pool when transfer reaches exact zero', () => {
    const before = [opening('open', 'gold-scrap', '20'), goldReceipt('source', 'merchant-a', '5', 6000, '0', 2)];
    const transfer = entry({ id: 'exact-zero', seq: 3, tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '5', arabicWeight: '5', karat: 21 });
    const timeline = buildMerchantMetalPositionTimeline([...before, transfer], normalizedAccounts, rebuild([...before, transfer]));
    expect(timeline.movementsByOperationId['exact-zero']).toMatchObject({ carryingValueMinor: 3000000, merchantDebitValueMinor: 3000000, merchantCreditValueMinor: 3000000 });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ positionSide: 'settled', signedQuantity: 0, signedCarryingValueMinor: 0 });
  });

  it('keeps source WAC on partial TX476-like and TX1768-like transfers', () => {
    const tx476Before = [opening('open-476', 'gold-scrap', '100'), goldReceipt('source-476', 'merchant-a', '61.71', 5840, '0', 2)];
    const tx476 = entry({ id: 'TX476-like', seq: 3, tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '34.29', arabicWeight: '34.29', karat: 21 });
    const timeline476 = buildMerchantMetalPositionTimeline([...tx476Before, tx476], normalizedAccounts, rebuild([...tx476Before, tx476]));
    expect(timeline476.movementsByOperationId['TX476-like']).toMatchObject({ carryingValueMinor: 20025360, merchantDebitValueMinor: 20025360, merchantCreditValueMinor: 20025360 });
    expect(timeline476.finalStates['merchant-a']).toMatchObject({ signedQuantity: 27.42, payableBookValueMinor: 16013280, currentWacMinorPerUnit: 5840 });

    const tx1768Before = [opening('open-1768', 'gold-scrap', '100'), goldReceipt('source-1768', 'merchant-a', '14.34', 6375.24, '0', 2)];
    const tx1768 = entry({ id: 'TX1768-like', seq: 3, tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '14', arabicWeight: '14', karat: 21 });
    const timeline1768Before = buildMerchantMetalPositionTimeline(tx1768Before, normalizedAccounts, rebuild(tx1768Before));
    const timeline1768 = buildMerchantMetalPositionTimeline([...tx1768Before, tx1768], normalizedAccounts, rebuild([...tx1768Before, tx1768]));
    expect(timeline1768.finalStates['merchant-a']).toMatchObject({ signedQuantity: 0.34 });
    expect(timeline1768.finalStates['merchant-a'].currentWacMinorPerUnit).toBeCloseTo(timeline1768Before.finalStates['merchant-a'].currentWacMinorPerUnit!, 2);
  });

  it('closes the two خالد حميدو metal/workmanship cycles at exact zero', () => {
    const entries = [
      opening('open-scrap', 'gold-scrap', '10'), opening('open-finished', 'gold-finished', '10', 2),
      { ...goldReceipt('TX646', 'khaled', '2.14', 6000, '670', 3), date: '2026-02-17' },
      { ...goldDelivery('TX653', 'khaled', '2.14', 4), date: '2026-02-17' },
      entry({ id: 'TX661', seq: 5, date: '2026-02-17', tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: 'خالد حميدو', debitAccountId: 'khaled', credit: 'الخزنة', creditAccountId: 'cash', cash: '670' }),
      { ...goldReceipt('TX1662', 'khaled', '1.63', 6850, '590', 6), date: '2026-05-19' },
      { ...goldDelivery('TX1663', 'khaled', '1.63', 7), date: '2026-05-19' },
      entry({ id: 'TX1664', seq: 8, date: '2026-05-19', tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: 'خالد حميدو', debitAccountId: 'khaled', credit: 'الخزنة', creditAccountId: 'cash', cash: '590' }),
    ];
    const inventory = rebuild(entries);
    const timeline = buildMerchantMetalPositionTimeline(entries, normalizedAccounts, inventory);
    const legs = buildLegacyLedgerLegs(entries, normalizedAccounts, [], { enableFinancialProjection: true, costTimeline: inventory });
    expect(timeline.movements.filter(movement => movement.kind === 'receipt').reduce((sum, movement) => sum + movement.quantityUnits, 0)).toBe(377);
    expect(timeline.finalStates.khaled).toMatchObject({ positionSide: 'settled', signedQuantity: 0, signedCarryingValueMinor: 0 });
    expect(signed(legs, 'merchant:khaled', 'cash')).toBe(0);
    expect(signed(legs, 'merchant:khaled', 'gold')).toBe(0);
    expect(signed(legs, 'merchant:khaled', 'book_value')).toBe(0);
  });

  it('keeps TX1768 non-physical and ends the full الصافي sequence as a -1.36g asset', () => {
    const before = [opening('open', 'gold-scrap', '30'), goldReceipt('mohamed', 'merchant-a', '20', 6000, '0', 2), goldDelivery('safy-history', 'merchant-b', '15.36', 3, 7000)];
    const transfer = entry({ id: 'TX1768', seq: 4, date: '2026-06-20', tx: 'حوالة', operationKind: 'transfer', debit: 'محمد السيد', debitAccountId: 'merchant-a', credit: 'الصافي', creditAccountId: 'merchant-b', weight: '16.33', arabicWeight: '14.00', karat: 18 });
    const inventoryBefore = rebuild(before);
    const inventoryAfter = rebuild([...before, transfer]);
    const timeline = buildMerchantMetalPositionTimeline([...before, transfer], normalizedAccounts, inventoryAfter);
    expect(timeline.movementsByOperationId.TX1768).toMatchObject({ quantityUnits: 1400, carryingValueMinor: 8400000 });
    expect(timeline.finalStates['merchant-b']).toMatchObject({ positionSide: 'receivable', signedQuantity: -1.36, receivableBookValueMinor: 2352000 });
    expect(Object.values(inventoryAfter.finalStates).map(state => state.remainingTotalCostMinor)).toEqual(Object.values(inventoryBefore.finalStates).map(state => state.remainingTotalCostMinor));
    const statements = buildFinancialStatementsEgp([...before, transfer], normalizedAccounts, { timeline: inventoryAfter, balanceEndDate: '2026-12-31' });
    expect(statements.balanceSheet.assets.merchantReceivableDetails).toContainEqual(expect.objectContaining({ accountId: 'merchant-b', positionSide: 'receivable', equivalent21Weight: 1.36 }));
    const trial = buildUnifiedTrialBalance([...before, transfer], normalizedAccounts, '2026-01-01', '2026-12-31', { timeline: inventoryAfter });
    expect(trial.rows).toContainEqual(expect.objectContaining({ entityId: 'merchant:merchant-b:metal', group: 'assets', normalBalance: 'debit' }));
  });

  it('mirrors signed crossing for silver with independent Silver inventory and WAC', () => {
    const entries = [opening('silver-open', 'silver-stock', '10'), silverReceipt('silver-in', '5', 120, 2), silverDelivery('silver-over', '7', 150, 3), goldReceipt('gold-independent', 'merchant-a', '1', 6000, '0', 4)];
    const inventory = rebuild(entries);
    const timeline = buildMerchantMetalPositionTimeline(entries, normalizedAccounts, inventory);
    expect(timeline.finalStates['silver-merchant']).toMatchObject({ metal: 'silver', positionSide: 'receivable', signedQuantity: -2, receivableBookValueMinor: 30000 });
    expect(timeline.movementsByOperationId['silver-over']).toMatchObject({ merchantLiabilityReleasedValueMinor: 60000, merchantReceivableCreatedValueMinor: 30000, inventoryBookValueReleasedMinor: 74667, settlementGainMinor: 15333 });
    expect(timeline.finalStates['merchant-a']).toMatchObject({ metal: 'gold', payableBookValueMinor: 600000 });
    const legs = buildLegacyLedgerLegs(entries, normalizedAccounts, [], { enableFinancialProjection: true, costTimeline: inventory });
    expect(legs).toContainEqual(expect.objectContaining({ sourceEntryId: 'silver-over', entityId: 'system:income:silver-settlement-gain', side: 'credit', amount: 153.33 }));
  });

  it('values TX39 الاء ياسر from Settings opening cost and applies generic over-settlement', () => {
    const tx39 = entry({ id: 'TX39', seq: 2, date: '2026-01-01', tx: 'قيد افتتاحي', operationKind: 'opening', debit: 'رأس المال', debitAccountId: 'capital', credit: 'الاء ياسر', creditAccountId: 'CGuSD99FTGDiX3fdfuCc', weight: '25.19714286', arabicWeight: '25.2', karat: 21 });
    const over = goldDelivery('alaa-over', 'CGuSD99FTGDiX3fdfuCc', '27', 3, 7000);
    const entries = [opening('open', 'gold-scrap', '30'), tx39, over];
    const inventory = rebuild(entries);
    const timeline = buildMerchantMetalPositionTimeline(entries, normalizedAccounts, inventory);
    expect(timeline.movementsByOperationId.TX39).toMatchObject({ carryingValueMinor: 12600000, valuationSource: 'opening_cost_compatibility' });
    expect(timeline.finalStates.CGuSD99FTGDiX3fdfuCc).toMatchObject({ positionSide: 'receivable', signedQuantity: -1.8, receivableBookValueMinor: 1260000 });
    const statements = buildFinancialStatementsEgp(entries, accounts, { timeline: inventory, balanceEndDate: '2026-12-31' });
    expect(statements.balanceSheet.assets.merchantReceivableDetails).toContainEqual(expect.objectContaining({ accountId: 'CGuSD99FTGDiX3fdfuCc', positionSide: 'receivable' }));
  });
});
