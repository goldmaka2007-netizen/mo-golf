import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { computeAccountBalances } from '../engine';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';

const cash: Account = { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, userId: 'u' };
const gold: Account = { id: 'gold', name: 'ذهب 21', mainType: 'asset', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' };
const merchant: Account = { id: 'merchant', name: 'تاجر ذهب', mainType: 'liability', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', merchantDirection: 'payable', balanceNature: 'gold', type: 'merchant', metal: 'gold', is_inventory: false, userId: 'u' };
const capital: Account = { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' };
const accounts = [cash, gold, merchant, capital];
const entry = (patch: Partial<Entry>): Entry => ({ id: 'entry', seq: 1, tx: 'عملية', operationKind: 'other', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });
const opening = entry({ id: 'opening', operationKind: 'opening', tx: 'قيد افتتاحي', debit: gold.name, debitAccountId: gold.id, credit: capital.name, creditAccountId: capital.id, weight: '10', arabicWeight: '10', karat: 21 });
const receipt = entry({ id: 'receipt', seq: 2, date: '2026-01-02', operationKind: 'purchase', tx: 'تاجر ذهب', debit: gold.name, debitAccountId: gold.id, credit: merchant.name, creditAccountId: merchant.id, weight: '2', arabicWeight: '2', cash: '100', karat: 21 });
const sale = entry({ id: 'sale', seq: 3, date: '2026-01-03', operationKind: 'sale', tx: 'بيع ذهب', debit: cash.name, debitAccountId: cash.id, credit: gold.name, creditAccountId: gold.id, weight: '1', arabicWeight: '1', cash: '200', karat: 21 });
const settlement = entry({ id: 'settlement', seq: 4, date: '2026-01-04', operationKind: 'merchant_settlement', tx: 'سداد تاجر نقدي', debit: merchant.name, debitAccountId: merchant.id, credit: cash.name, creditAccountId: cash.id, cash: '50' });
const timeline = () => rebuildInventoryCostTimeline([opening, receipt, sale, settlement], accounts, { gold21PriceByYearMinor: { '2026': 10000 } }, { bindings: [{ inventoryAccountId: 'gold', taxonomyKey: 'gold.product.ring_arabic' }] });

describe('central accounting pipeline regression', () => {
  it('keeps Treasury cash-only', () => {
    expect(computeAccountBalances([sale], accounts).balances.get('cash')).toMatchObject({ cashBalance: 200, goldE21Balance: 0, silverBalance: 0, quantityBalance: 0 });
  });

  it('capitalizes credit-purchase principal and workmanship exactly once without Treasury', () => {
    const cost = timeline(); expect(cost.valid).toBe(true);
    expect(cost.resultsByOperationId.receipt).toMatchObject({ incomingMetalCostMinor: 20000, incomingWorkmanshipCostMinor: 10000, incomingTotalCostMinor: 30000 });
    const legs = buildLegacyLedgerLegs([opening, receipt], accounts, [], { enableFinancialProjection: true, costTimeline: cost }).filter(leg => leg.sourceEntryId === 'receipt');
    expect(legs.filter(leg => leg.dimension === 'book_value' && leg.entityId === 'product:gold' && leg.side === 'debit').map(leg => leg.amount)).toEqual([300]);
    expect(legs.filter(leg => leg.dimension === 'book_value' && leg.entityId === 'merchant:merchant' && leg.side === 'credit').map(leg => leg.amount)).toEqual([200]);
    expect(legs.filter(leg => leg.dimension === 'cash' && leg.entityId === 'merchant:merchant' && leg.side === 'credit').map(leg => leg.amount)).toEqual([100]);
    expect(legs.some(leg => leg.entityId === 'account:cash')).toBe(false);
  });

  it('generates sale revenue, COGS, weight and inventory book-value exit once', () => {
    const cost = timeline();
    const legs = buildLegacyLedgerLegs([opening, receipt, sale], accounts, [], { enableFinancialProjection: true, costTimeline: cost }).filter(leg => leg.sourceEntryId === 'sale');
    expect(legs.filter(leg => leg.entityId === 'account:gold::sales' && leg.side === 'credit')).toHaveLength(1);
    expect(legs.filter(leg => leg.entityId === 'account:gold::cogs' && leg.side === 'debit')).toHaveLength(1);
    expect(legs.filter(leg => leg.entityId === 'product:gold' && leg.dimension === 'gold' && leg.side === 'credit')).toHaveLength(1);
    expect(legs.filter(leg => leg.entityId === 'product:gold' && leg.dimension === 'book_value' && leg.side === 'credit')).toHaveLength(1);
  });

  it('settles merchant cash payable without metal, inventory or WAC movement', () => {
    const cost = timeline();
    expect(cost.results.some(result => result.operationId === 'settlement')).toBe(false);
    const legs = buildLegacyLedgerLegs([settlement], accounts, [], { enableFinancialProjection: true, costTimeline: cost });
    expect(legs.filter(leg => leg.dimension === 'cash').map(leg => [leg.entityId, leg.side, leg.amount])).toEqual([['merchant:merchant', 'debit', 50], ['account:cash', 'credit', 50]]);
    expect(legs.some(leg => leg.dimension !== 'cash')).toBe(false);
  });

  it('reconciles unified trial balance and financial position at book value', () => {
    const cost = timeline();
    const all = [opening, receipt, sale, settlement];
    const trial = buildUnifiedTrialBalance(all, accounts, '2026-01-01', '2026-12-31', { timeline: cost });
    const statements = buildFinancialStatementsEgp(all, accounts, { timeline: cost, balanceEndDate: '2026-12-31' });
    expect(trial.financialBalanced).toBe(true);
    expect(trial.rows.find(row => row.entityId === 'product:gold')?.effectiveGramPrice).toBeCloseTo(108.33, 2);
    expect(trial.rows.find(row => row.entityId === 'account:cash')?.effectiveGramPrice).toBeNull();
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
    expect(statements.balanceSheet.assets.goldInventory).toBeGreaterThan(0);
    expect(statements.balanceSheet.liabilities.merchantGold).toBe(200);
    expect(statements.balanceSheet.liabilities.merchantCash).toBe(50);
  });

  it('applies historical Account-ID compatibility without mutating stored records', () => {
    const legacy: Account = { id: 'CGuSD99FTGDiX3fdfuCc', name: 'الاء ياسر', mainType: 'other', subType: 'unclassified', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' };
    const before = JSON.stringify(legacy);
    const projected = computeAccountBalances([entry({ id: 'legacy', debit: gold.name, debitAccountId: gold.id, credit: legacy.name, creditAccountId: legacy.id, weight: '1', arabicWeight: '1', karat: 21 })], [...accounts, legacy]);
    expect(projected.balances.get(legacy.id!)?.mainType).toBe('liabilities');
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('reports canonical E21 instead of stale raw arabicWeight without changing financial totals', () => {
    const tx1714Equivalent = entry({
      id: 'tx1714-equivalent', operationKind: 'other', debit: gold.name, debitAccountId: gold.id,
      credit: capital.name, creditAccountId: capital.id, weight: '57.90', arabicWeight: '57.91', karat: 21,
      cash: '0',
    });
    const trial = buildUnifiedTrialBalance([tx1714Equivalent], accounts, '2026-01-01', '2026-12-31');
    const row = trial.rows.find(item => item.entityId === 'product:gold');
    expect(row?.goldBalance).toBe(57.9);
    expect(trial.financialDebit).toBe(0);
    expect(trial.financialCredit).toBe(0);
  });

  it('keeps 18K and 24K canonical conversion while silver and accessories use their own dimensions', () => {
    const gold18 = entry({ id: 'gold18', debit: gold.name, debitAccountId: gold.id, credit: capital.name, creditAccountId: capital.id, weight: '10', arabicWeight: '99', karat: 18 });
    const gold24 = entry({ id: 'gold24', debit: gold.name, debitAccountId: gold.id, credit: capital.name, creditAccountId: capital.id, weight: '10', arabicWeight: '99', karat: 24 });
    expect(buildUnifiedTrialBalance([gold18], accounts, '2026-01-01', '2026-12-31').rows.find(item => item.entityId === 'product:gold')?.goldBalance).toBeCloseTo(8.57, 2);
    expect(buildUnifiedTrialBalance([gold24], accounts, '2026-01-01', '2026-12-31').rows.find(item => item.entityId === 'product:gold')?.goldBalance).toBeCloseTo(11.43, 2);
    const silver: Account = { id: 'silver', name: 'Silver', mainType: 'asset', subType: 'inventory_silver', canonicalMainType: 'assets', canonicalSubType: 'inventory_silver', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' };
    const accessory: Account = { id: 'accessory', name: 'Accessory', mainType: 'asset', subType: 'inventory_accessory', canonicalMainType: 'assets', canonicalSubType: 'inventory_accessory', balanceNature: 'quantity', type: 'accessory', is_inventory: true, userId: 'u' };
    const silverEntry = entry({ id: 'silver', debit: silver.name, debitAccountId: silver.id, credit: capital.name, creditAccountId: capital.id, weight: '3.25', arabicWeight: '99', karat: 18 });
    const accessoryEntry = entry({ id: 'accessory', debit: accessory.name, debitAccountId: accessory.id, credit: capital.name, creditAccountId: capital.id, weight: '99', arabicWeight: '99', count: '4' });
    const silverRow = buildUnifiedTrialBalance([silverEntry], [...accounts, silver], '2026-01-01', '2026-12-31').rows.find(item => item.entityId === 'product:silver');
    const accessoryRow = buildUnifiedTrialBalance([accessoryEntry], [...accounts, accessory], '2026-01-01', '2026-12-31').rows.find(item => item.entityId === 'product:accessory');
    expect(silverRow?.silverBalance).toBe(3.25);
    expect(silverRow?.goldBalance).toBe(0);
    expect(accessoryRow?.quantityBalance).toBe(99);
    expect(accessoryRow?.goldBalance).toBe(0);
  });

  it('resolves one symmetric 18K E21 quantity from the inventory side when entry karat is absent', () => {
    const inventory18: Account = { ...gold, id: 'gold18', name: 'Gold 18', karat: '18' };
    const merchantNoKarat: Account = { ...merchant, id: 'merchant-no-karat', name: 'Merchant no karat', karat: null };
    const operation = entry({ id: 'receipt-18', operationKind: 'purchase', debit: inventory18.name, debitAccountId: inventory18.id, credit: merchantNoKarat.name, creditAccountId: merchantNoKarat.id, weight: '10', arabicWeight: '9.99' });
    const report = buildUnifiedTrialBalance([operation], [cash, inventory18, merchantNoKarat, capital], '2026-01-01', '2026-12-31');
    expect(report.dimensionDifferences.gold).toBe(0);
    expect(report.rows.find(row => row.entityId === 'product:gold18')?.goldBalance).toBeCloseTo(8.57, 2);
    expect(report.rows.find(row => row.entityId.startsWith('merchant:merchant-no-karat'))?.goldBalance).toBeCloseTo(8.57, 2);
  });

  it('resolves one symmetric 24K E21 quantity from the inventory side when entry karat is absent', () => {
    const inventory24: Account = { ...gold, id: 'gold24', name: 'Gold 24', karat: '24' };
    const merchantNoKarat: Account = { ...merchant, id: 'merchant-no-karat-24', name: 'Merchant no karat 24', karat: null };
    const operation = entry({ id: 'receipt-24', operationKind: 'purchase', debit: inventory24.name, debitAccountId: inventory24.id, credit: merchantNoKarat.name, creditAccountId: merchantNoKarat.id, weight: '10', arabicWeight: '9.99' });
    const report = buildUnifiedTrialBalance([operation], [cash, inventory24, merchantNoKarat, capital], '2026-01-01', '2026-12-31');
    expect(report.dimensionDifferences.gold).toBe(0);
    expect(report.rows.find(row => row.entityId === 'product:gold24')?.goldBalance).toBeCloseTo(11.43, 2);
    expect(report.rows.find(row => row.entityId.startsWith('merchant:merchant-no-karat-24'))?.goldBalance).toBeCloseTo(11.43, 2);
  });

  it('uses the inventory karat symmetrically for merchant receipt and settlement-style operations', () => {
    const inventory18: Account = { ...gold, id: 'gold18-receipt', name: 'Gold 18 receipt', karat: '18' };
    const merchantNoKarat: Account = { ...merchant, id: 'merchant-receipt-no-karat', name: 'Merchant receipt no karat', karat: null };
    const operation = entry({ id: 'merchant-receipt-18', operationKind: 'purchase', debit: inventory18.name, debitAccountId: inventory18.id, credit: merchantNoKarat.name, creditAccountId: merchantNoKarat.id, weight: '7', arabicWeight: '7.01' });
    const report = buildUnifiedTrialBalance([operation], [cash, inventory18, merchantNoKarat, capital], '2026-01-01', '2026-12-31');
    expect(report.dimensionDifferences.gold).toBe(0);
    expect(report.rows.find(row => row.entityId === 'product:gold18-receipt')?.goldBalance).toBeCloseTo(6, 2);
    expect(report.rows.find(row => row.entityId.startsWith('merchant:merchant-receipt-no-karat'))?.goldBalance).toBeCloseTo(6, 2);
  });

  it('falls back symmetrically to the stored historical quantity when karat is unprovable', () => {
    const inventoryUnknown: Account = { ...gold, id: 'gold-unknown', name: 'Gold unknown', karat: null };
    const merchantUnknown: Account = { ...merchant, id: 'merchant-unknown', name: 'Merchant unknown', karat: null };
    const operation = entry({ id: 'unknown-karat', operationKind: 'purchase', debit: inventoryUnknown.name, debitAccountId: inventoryUnknown.id, credit: merchantUnknown.name, creditAccountId: merchantUnknown.id, weight: '10', arabicWeight: '9.99' });
    const report = buildUnifiedTrialBalance([operation], [cash, inventoryUnknown, merchantUnknown, capital], '2026-01-01', '2026-12-31');
    expect(report.dimensionDifferences.gold).toBe(0);
    expect(report.rows.find(row => row.entityId === 'product:gold-unknown')?.goldBalance).toBe(9.99);
    expect(report.rows.find(row => row.entityId.startsWith('merchant:merchant-unknown'))?.goldBalance).toBeCloseTo(9.99, 2);
  });
});
