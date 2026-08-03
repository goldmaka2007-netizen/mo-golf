import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { computeAccountBalances } from '../engine';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { getAvailableDimensions, getLedgerAccountGroupId } from '../ledgerReport';
import type { InventoryCostTimeline } from '../inventoryCostTypes';

const cash: Account = { id: 'cash', name: '??????', mainType: 'asset', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', metal: null, is_inventory: false, userId: 'u' };
const gold: Account = { id: 'gold', name: '????? ???', mainType: 'asset', subType: 'gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' };
const capital: Account = { id: 'capital', name: '??? ?????', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', metal: null, is_inventory: false, userId: 'u' };
const accounts = [cash, gold, capital];
const entry = (patch: Partial<Entry>): Entry => ({ id: 'entry', seq: 1, tx: '?????', operationKind: 'other', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });

describe('cash-only treasury and dimensional accounting regression', () => {
  it('never gives the treasury gold, silver, or quantity balances or tabs', () => {
    const sale = entry({ id: 'sale', operationKind: 'sale', debit: cash.name, debitAccountId: cash.id, credit: gold.name, creditAccountId: gold.id, cash: '1000', weight: '2', arabicWeight: '2', count: '3', karat: 21 });
    const result = computeAccountBalances([sale], accounts).balances.get('cash');
    expect(result).toMatchObject({ cashBalance: 1000, goldActualBalance: 0, goldE21Balance: 0, silverBalance: 0, quantityBalance: 0, metal: null });
    expect(getAvailableDimensions(cash, [sale], accounts)).toEqual(['cash']);
  });

  it('keeps a cash gold purchase split between treasury cash and inventory weight/book value', () => {
    const purchase = entry({ id: 'purchase', operationKind: 'purchase', debit: gold.name, debitAccountId: gold.id, credit: cash.name, creditAccountId: cash.id, cash: '1200', weight: '2', arabicWeight: '2', karat: 21 });
    const computed = computeAccountBalances([purchase], accounts);
    expect(computed.balances.get('cash')).toMatchObject({ cashBalance: -1200, goldE21Balance: 0 });
    expect(computed.balances.get('gold')).toMatchObject({ cashBalance: 0, goldE21Balance: 2 });
    const projected = buildLegacyLedgerLegs([purchase], accounts, [], { enableFinancialProjection: true });
    expect(projected.filter(leg => leg.dimension === 'cash').map(leg => [leg.entityId, leg.side, leg.amount])).toEqual([['product:gold', 'debit', 1200], ['account:cash', 'credit', 1200]]);
  });

  it('projects sale revenue and WAC COGS exactly once while weight leaves inventory only', () => {
    const sale = entry({ id: 'sale', operationKind: 'sale', debit: cash.name, debitAccountId: cash.id, credit: gold.name, creditAccountId: gold.id, cash: '1000', weight: '2', arabicWeight: '2', karat: 21 });
    const timeline = { valid: true, results: [{ operationId: 'sale', classification: 'sale', entry: sale, sourceInventoryAccountId: 'gold', inventoryAccountId: 'gold', totalCogsMinor: 70000, adjustmentLossMinor: 0 }] } as unknown as InventoryCostTimeline;
    const legs = buildLegacyLedgerLegs([sale], accounts, [], { enableFinancialProjection: true, costTimeline: timeline });
    expect(legs.filter(leg => leg.entityId === 'system:income:sales-revenue' && leg.side === 'credit')).toHaveLength(1);
    expect(legs.filter(leg => leg.entityId === 'system:income:cogs' && leg.side === 'debit')).toHaveLength(1);
    expect(legs.filter(leg => leg.entityId === 'product:gold' && leg.dimension === 'cash' && leg.side === 'credit' && leg.amount === 700)).toHaveLength(1);
    expect(legs.filter(leg => leg.dimension === 'gold').map(leg => [leg.entityId, leg.side, leg.amount])).toEqual([['product:gold', 'credit', 2]]);
  });

  it('classifies the two confirmed account IDs as Other Payables in their correct dimensions', () => {
    const alaa: Account = { id: 'CGuSD99FTGDiX3fdfuCc', name: '???? ????', mainType: 'other', subType: 'unclassified', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' };
    const dina: Account = { id: 'SyBsRKWdl1nwbJDPsXM7', name: '????', mainType: 'other', subType: 'unclassified', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' };
    const entries = [entry({ id: 'alaa-gold', debit: gold.name, debitAccountId: gold.id, credit: alaa.name, creditAccountId: alaa.id, weight: '1', arabicWeight: '1', karat: 21 }), entry({ id: 'dina-cash', debit: cash.name, debitAccountId: cash.id, credit: dina.name, creditAccountId: dina.id, cash: '50' })];
    const result = computeAccountBalances(entries, [...accounts, alaa, dina]);
    expect(result.balances.get(alaa.id!)).toMatchObject({ mainType: 'liabilities', subType: 'other_due', metal: 'gold', goldE21Balance: 1, cashBalance: 0 });
    expect(result.balances.get(dina.id!)).toMatchObject({ mainType: 'liabilities', subType: 'other_due', metal: null, cashBalance: 50, goldE21Balance: 0 });
    expect(getLedgerAccountGroupId(alaa)).toBe('other_due');
    expect(getLedgerAccountGroupId(dina)).toBe('other_due');
  });
});
