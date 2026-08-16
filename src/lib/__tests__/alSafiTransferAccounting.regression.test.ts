import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding, Phase5OpeningCostConfig } from '../inventoryCostTypes';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import {
  AL_SAFI_TRANSFER_HUB_ACCOUNT_ID,
  buildMerchantMetalPositionTimeline,
} from '../merchantGoldLiability';
import { applyRuntimeAccountOverride } from '../runtimeAccountOverrides';

const account = (patch: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  mainType: 'liabilities',
  subType: 'merchant_gold',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_gold',
  balanceNature: 'gold',
  type: 'merchant',
  metal: 'gold',
  merchantDirection: 'payable',
  userId: 'u',
  ...patch,
});

const accounts = [
  account({ id: 'gold-finished', name: 'Gold Finished', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', type: 'gold_product', is_inventory: true, karat: '21' }),
  account({ id: 'gold-scrap', name: 'Gold Scrap', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', type: 'gold_raw', is_inventory: true, karat: '21' }),
  account({ id: 'silver-stock', name: 'Silver Stock', mainType: 'assets', subType: 'inventory_silver', canonicalMainType: 'assets', canonicalSubType: 'inventory_silver', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, karat: null }),
  account({ id: 'beneficiary', name: 'Beneficiary' }),
  account({ id: 'ordinary-destination', name: 'Ordinary Destination' }),
  account({ id: AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, name: 'Al-Safi' }),
  account({ id: 'silver-merchant', name: 'Silver Merchant', subType: 'merchant_silver', canonicalSubType: 'merchant_silver', balanceNature: 'silver', metal: 'silver' }),
  account({ id: 'cash', name: 'Cash', mainType: 'assets', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', metal: null, merchantDirection: undefined }),
  account({ id: 'capital', name: 'Capital', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', metal: null, merchantDirection: undefined }),
].map(applyRuntimeAccountOverride);

const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold-finished', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'gold-scrap', taxonomyKey: 'gold.raw.scrap_arabic' },
  { inventoryAccountId: 'silver-stock', taxonomyKey: 'silver.raw.scrap' },
];
const openingConfig: Phase5OpeningCostConfig = {
  gold21PriceByYearMinor: { '2026': 500000 },
  silverPriceByYearMinor: { '2026': 10000 },
};
const base = (patch: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: '', date: '2026-01-01', debit: '', credit: '', cash: '0',
  weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch,
});
const name = (id: string) => accounts.find(item => item.id === id)!.name;
const opening = (weight = '100'): Entry => base({
  id: 'opening', operationKind: 'opening', tx: 'opening', debit: name('gold-scrap'), debitAccountId: 'gold-scrap',
  credit: name('capital'), creditAccountId: 'capital', weight, arabicWeight: weight,
});
const receipt = (id: string, merchantId: string, weight: string, price: number, seq: number, workmanship = '0'): Entry => base({
  id, seq, operationKind: 'purchase', tx: 'merchant receipt', debit: name('gold-finished'), debitAccountId: 'gold-finished',
  credit: name(merchantId), creditAccountId: merchantId, weight, arabicWeight: weight, cash: workmanship,
  invoiceOfficialPricePerGramEgp: price, karat: 21,
});
const delivery = (id: string, merchantId: string, weight: string, seq: number, price?: number, date = '2026-01-02'): Entry => base({
  id, seq, date, operationKind: 'merchant_settlement', tx: 'merchant delivery', debit: name(merchantId), debitAccountId: merchantId,
  credit: name('gold-scrap'), creditAccountId: 'gold-scrap', weight, arabicWeight: weight,
  invoiceOfficialPricePerGramEgp: price, karat: 21,
});
const transfer = (
  id: string,
  sourceId: string,
  destinationId: string,
  physicalWeight: string,
  standardizedWeight: string,
  price: number | undefined,
  seq: number,
  karat = 21,
  date = '2026-01-02',
): Entry => base({
  id, seq, date, operationKind: 'transfer', tx: 'transfer', debit: name(sourceId), debitAccountId: sourceId,
  credit: name(destinationId), creditAccountId: destinationId, weight: physicalWeight, arabicWeight: standardizedWeight,
  karat, invoiceOfficialPricePerGramEgp: karat === 21 ? price : undefined, marketPrice: karat === 21 ? undefined : price,
});
const rebuild = (entries: Entry[]) => rebuildInventoryCostTimeline(entries, accounts, openingConfig, { bindings });
const timeline = (entries: Entry[]) => buildMerchantMetalPositionTimeline(entries, accounts, rebuild(entries));
const transferLeg = (entries: Entry[], id: string) => buildLegacyLedgerLegs(entries, accounts, [], {
  enableFinancialProjection: true,
  costTimeline: rebuild(entries),
}).filter(leg => leg.sourceEntryId === id && leg.dimension === 'book_value');

const expectSignedInvariant = (entries: Entry[]) => {
  const result = timeline(entries);
  Object.values(result.finalStates).forEach(state => {
    expect(state.signedQuantityUnits === 0).toBe(state.signedCarryingValueMinor === 0);
    if (state.signedQuantityUnits !== 0) {
      expect(Math.sign(state.signedCarryingValueMinor)).toBe(Math.sign(state.signedQuantityUnits));
    }
  });
  expect(result.diagnostics.filter(item => ['transfer_carrying_value_sign_mismatch', 'zero_weight_book_value_residue'].includes(item.code))).toEqual([]);
};

describe('Al-Safi immutable-price transfer realization', () => {
  it('uses invoice price above or below beneficiary WAC without crossing Al-Safi', () => {
    const above = [opening(), receipt('source-above', 'beneficiary', '2', 6000, 2), transfer('above', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', '1', 7000, 3)];
    const aboveTimeline = timeline(above);
    expect(aboveTimeline.movementsByOperationId.above).toMatchObject({
      transferInvoiceValueMinor: 700000,
      sourceMerchantReleasedValueMinor: 600000,
      sourceTransferLossMinor: 100000,
      transferGainMinor: 0,
      transferLossMinor: 100000,
      inventoryBookValueReleasedMinor: 0,
      inventoryBookValueRecognizedMinor: 0,
      settlementGainMinor: 0,
      settlementLossMinor: 0,
      valuationSource: 'transfer_operation_price_snapshot',
    });
    expect(aboveTimeline.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ signedQuantity: 1, signedCarryingValueMinor: 700000 });

    const below = [opening(), receipt('source-below', 'beneficiary', '2', 6000, 2), transfer('below', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', '1', 5000, 3)];
    expect(timeline(below).movementsByOperationId.below).toMatchObject({
      transferInvoiceValueMinor: 500000,
      sourceMerchantReleasedValueMinor: 600000,
      sourceTransferGainMinor: 100000,
      transferGainMinor: 100000,
      transferLossMinor: 0,
    });
    expectSignedInvariant(above);
    expectSignedInvariant(below);
  });

  it('splits Al-Safi receivable-to-payable crossing and exact-zero close at the invoice boundary', () => {
    const crossing = [
      opening(),
      receipt('source', 'beneficiary', '5', 6000, 2),
      delivery('safi-receivable', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '2', 3, 6500),
      transfer('cross', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '3', '3', 7000, 4),
    ];
    const crossTimeline = timeline(crossing);
    expect(crossTimeline.movementsByOperationId.cross).toMatchObject({
      transferInvoiceValueMinor: 2100000,
      sourceMerchantReleasedValueMinor: 1800000,
      sourceTransferLossMinor: 300000,
      destinationMerchantReleasedQuantityUnits: 200,
      destinationMerchantReleasedValueMinor: 1300000,
      destinationMerchantCreatedValueMinor: 700000,
      destinationTransferGainMinor: 100000,
      transferGainMinor: 100000,
      transferLossMinor: 300000,
    });
    expect(crossTimeline.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ positionSide: 'payable', signedQuantity: 1, signedCarryingValueMinor: 700000 });

    const exact = [
      opening(),
      receipt('source-exact', 'beneficiary', '2', 6000, 2),
      delivery('safi-exact-receivable', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '2', 3, 6500),
      transfer('exact', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '2', '2', 6500, 4),
    ];
    expect(timeline(exact).finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ positionSide: 'settled', signedQuantity: 0, signedCarryingValueMinor: 0 });
    expectSignedInvariant(crossing);
    expectSignedInvariant(exact);
  });

  it('supports Al-Safi payable-to-receivable crossing and opens only the excess at the new price', () => {
    const entries = [
      opening(),
      receipt('safi-payable', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '2', 6000, 2),
      transfer('reverse-cross', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, 'beneficiary', '3', '3', 7000, 3),
    ];
    const result = timeline(entries);
    expect(result.movementsByOperationId['reverse-cross']).toMatchObject({
      sourceMerchantReleasedQuantityUnits: 200,
      sourceMerchantReleasedValueMinor: 1200000,
      sourceMerchantCreatedValueMinor: 700000,
      sourceTransferLossMinor: 200000,
      transferLossMinor: 200000,
    });
    expect(result.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ positionSide: 'receivable', signedQuantity: -1, signedCarryingValueMinor: -700000 });
    expectSignedInvariant(entries);
  });

  it('keeps consecutive invoice-price layers inside Al-Safi and excludes workmanship', () => {
    const entries = [
      opening(),
      receipt('source', 'beneficiary', '4', 6000, 2, '1000'),
      transfer('first', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', '1', 6500, 3),
      transfer('second', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', '1', 7000, 4),
    ];
    const result = timeline(entries);
    expect(result.movementsByOperationId.source).toMatchObject({ carryingValueMinor: 2400000 });
    expect(result.movementsByOperationId.first).toMatchObject({ sourceMerchantReleasedValueMinor: 600000, transferInvoiceValueMinor: 650000, sourceTransferLossMinor: 50000 });
    expect(result.movementsByOperationId.second).toMatchObject({ sourceMerchantReleasedValueMinor: 600000, transferInvoiceValueMinor: 700000, sourceTransferLossMinor: 100000 });
    expect(result.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ signedQuantity: 2, signedCarryingValueMinor: 1350000, currentWacMinorPerUnit: 6750 });
    expectSignedInvariant(entries);
  });

  it('separates transfer realization from later physical settlement with no double counting', () => {
    const entries = [
      opening('1'),
      receipt('source', 'beneficiary', '1', 6000, 2),
      transfer('transfer', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', '1', 7000, 3, 21, '2026-01-02'),
      delivery('physical', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', 4, undefined, '2026-01-02'),
    ];
    const result = timeline(entries);
    expect(result.movementsByOperationId.transfer).toMatchObject({ transferLossMinor: 100000, settlementGainMinor: 0, settlementLossMinor: 0 });
    expect(result.movementsByOperationId.physical).toMatchObject({ merchantLiabilityReleasedValueMinor: 700000, inventoryBookValueReleasedMinor: 500000, settlementGainMinor: 200000, transferGainMinor: 0, transferLossMinor: 0 });
    expect(result.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ positionSide: 'settled', signedQuantity: 0, signedCarryingValueMinor: 0 });
    expect(200000 - 100000).toBe(600000 - 500000);

    const legs = buildLegacyLedgerLegs(entries, accounts, [], { enableFinancialProjection: true, costTimeline: rebuild(entries) });
    expect(legs).toContainEqual(expect.objectContaining({ sourceEntryId: 'transfer', entityId: 'system:income:gold-transfer-loss', side: 'debit', amount: 1000 }));
    expect(legs).toContainEqual(expect.objectContaining({ sourceEntryId: 'physical', entityId: 'system:income:gold-settlement-gain', side: 'credit', amount: 2000 }));
    const statements = buildFinancialStatementsEgp(entries, accounts, { timeline: rebuild(entries), balanceEndDate: '2026-12-31' });
    expect(statements.incomeStatement.revenue).toContainEqual(expect.objectContaining({ id: 'system:income:gold-settlement-gain', amount: 2000 }));
    expect(statements.incomeStatement.operatingExpenses).toContainEqual(expect.objectContaining({ id: 'system:income:gold-transfer-loss', amount: 1000 }));
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('preserves ordinary source-WAC transfer semantics and zero P&L when Al-Safi is absent', () => {
    const entries = [
      opening(),
      receipt('source', 'beneficiary', '2', 6000, 2),
      transfer('ordinary', 'beneficiary', 'ordinary-destination', '1', '1', undefined, 3),
    ];
    const result = timeline(entries);
    expect(result.movementsByOperationId.ordinary).toMatchObject({
      carryingValueMinor: 600000,
      merchantDebitValueMinor: 600000,
      merchantCreditValueMinor: 600000,
      transferInvoiceValueMinor: 0,
      transferGainMinor: 0,
      transferLossMinor: 0,
      valuationSource: 'source_merchant_wac',
    });
    expect(transferLeg(entries, 'ordinary').filter(leg => ['revenue', 'expenses'].includes(leg.group))).toEqual([]);
  });

  it('rebuilds the TX476 crossing from its saved 18K price without inventory movement or residue', () => {
    const entries = [
      opening(),
      delivery('safi-before-476', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '34.27', 2, 6655),
      receipt('source-476', 'beneficiary', '61.71', 5840, 3),
      transfer('TX476', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '40', '34.29', 5704, 4, 18, '2026-02-05'),
    ];
    const inventoryBefore = rebuild(entries.slice(0, -1));
    const inventoryAfter = rebuild(entries);
    const result = buildMerchantMetalPositionTimeline(entries, accounts, inventoryAfter);
    expect(result.movementsByOperationId.TX476).toMatchObject({
      quantityUnits: 3429,
      transferInvoiceValueMinor: 22816000,
      sourceMerchantReleasedValueMinor: 20025360,
      destinationMerchantReleasedValueMinor: 22806685,
      destinationMerchantCreatedValueMinor: 13308,
      sourceTransferLossMinor: 2790640,
      destinationTransferLossMinor: 3993,
      transferGainMinor: 0,
      transferLossMinor: 2794633,
      inventoryBookValueReleasedMinor: 0,
      inventoryBookValueRecognizedMinor: 0,
      settlementGainMinor: 0,
      settlementLossMinor: 0,
    });
    expect(result.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ positionSide: 'payable', signedQuantity: 0.02, signedCarryingValueMinor: 13308 });
    expect(Object.values(inventoryAfter.finalStates).map(state => state.remainingTotalCostMinor)).toEqual(Object.values(inventoryBefore.finalStates).map(state => state.remainingTotalCostMinor));
    expectSignedInvariant(entries);
  });

  it('rebuilds TX1768 at its saved physical-18K invoice price and keeps gold/silver isolated', () => {
    const silverOpening = base({ id: 'silver-opening', seq: 2, operationKind: 'opening', tx: 'opening', debit: name('silver-stock'), debitAccountId: 'silver-stock', credit: name('capital'), creditAccountId: 'capital', weight: '10', arabicWeight: '10' });
    const silverReceipt = base({ id: 'silver-receipt', seq: 3, operationKind: 'purchase', tx: 'silver receipt', debit: name('silver-stock'), debitAccountId: 'silver-stock', credit: name('silver-merchant'), creditAccountId: 'silver-merchant', weight: '2', arabicWeight: '2', invoiceOfficialPricePerGramEgp: 120 });
    const entries = [
      opening(),
      silverOpening,
      silverReceipt,
      delivery('safi-before-1768', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '15.36', 4, 6250),
      receipt('source-1768', 'beneficiary', '20', 6000, 5),
      transfer('TX1768', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '16.33', '14', 5185, 6, 18, '2026-06-20'),
    ];
    const result = timeline(entries);
    expect(result.movementsByOperationId.TX1768).toMatchObject({
      quantityUnits: 1400,
      transferInvoiceValueMinor: 8467105,
      sourceMerchantReleasedValueMinor: 8400000,
      sourceTransferLossMinor: 67105,
      destinationMerchantReleasedValueMinor: 8750000,
      destinationTransferLossMinor: 282895,
      transferGainMinor: 0,
      transferLossMinor: 350000,
    });
    expect(result.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ positionSide: 'receivable', signedQuantity: -1.36, signedCarryingValueMinor: -850000 });
    expect(result.finalStates['silver-merchant']).toMatchObject({ metal: 'silver', signedQuantity: 2, signedCarryingValueMinor: 24000 });
    expect(result.diagnostics.filter(item => item.operationId === 'TX1768')).toEqual([]);
    expectSignedInvariant(entries);
  });

  it('fails closed with a diagnostic when an Al-Safi transfer has no immutable price', () => {
    const entries = [opening(), receipt('source', 'beneficiary', '2', 6000, 2), transfer('missing-price', 'beneficiary', AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, '1', '1', undefined, 3)];
    const result = timeline(entries);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'missing_transfer_invoice_price', operationId: 'missing-price' }));
    expect(result.finalStates.beneficiary).toMatchObject({ signedQuantity: 2, signedCarryingValueMinor: 1200000 });
    expect(result.finalStates[AL_SAFI_TRANSFER_HUB_ACCOUNT_ID]).toMatchObject({ signedQuantity: 0, signedCarryingValueMinor: 0 });
  });
});
