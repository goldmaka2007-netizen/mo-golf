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
});