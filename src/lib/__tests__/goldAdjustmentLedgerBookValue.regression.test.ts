import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import type { InventoryCostTimeline } from '../inventoryCostTypes';
import { buildLedgerReport, getAvailableDimensions } from '../ledgerReport';

const inventory: Account = {
  id: 'gold-inventory', name: 'مخزون ذهب 21', mainType: 'assets', subType: 'inventory_gold',
  canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_product',
  metal: 'gold', is_inventory: true, karat: '21', userId: 'u',
};
const capital: Account = {
  id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital',
  canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u',
};
const surplus: Account = {
  id: 'gold-surplus', name: 'زيادة الذهب', mainType: 'revenue', subType: 'revenue',
  canonicalSubType: 'revenue', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u',
};
const shortage: Account = {
  id: 'gold-shortage', name: 'عجز الذهب', mainType: 'expenses', subType: 'expense',
  canonicalSubType: 'expense', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u',
};
const accounts = [inventory, capital, surplus, shortage];

const entry = (patch: Partial<Entry>): Entry => ({
  tx: 'تسوية', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0',
  arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch,
});
const opening = entry({
  id: 'opening', operationKind: 'opening', debit: inventory.name, debitAccountId: inventory.id,
  credit: capital.name, creditAccountId: capital.id, weight: '10', arabicWeight: '10',
});
const adjustmentTimeline = (
  adjustment: Entry,
  classification: 'surplus' | 'shortage',
): InventoryCostTimeline => ({
  valid: true,
  results: [
    {
      operationId: opening.id, classification: 'opening', entry: opening,
      inventoryAccountId: inventory.id, incomingTotalCostMinor: 100000,
    },
    {
      operationId: adjustment.id, classification, entry: adjustment,
      inventoryAccountId: classification === 'surplus' ? inventory.id : undefined,
      destinationInventoryAccountId: classification === 'surplus' ? inventory.id : undefined,
      sourceInventoryAccountId: classification === 'shortage' ? inventory.id : undefined,
      incomingTotalCostMinor: classification === 'surplus' ? 20000 : 0,
      adjustmentGainMinor: classification === 'surplus' ? 20000 : 0,
      totalCogsMinor: 0,
      adjustmentLossMinor: classification === 'shortage' ? 20000 : 0,
    },
  ],
  finalStates: {
    [inventory.id!]: {
      inventoryAccountId: inventory.id, displayName: inventory.name, kind: 'gold',
      standardizedQuantityUnits: classification === 'surplus' ? 1200 : 800,
      accessoryQuantityUnits: 0,
      remainingTotalCostMinor: classification === 'surplus' ? 120000 : 80000,
    },
  },
} as unknown as InventoryCostTimeline);

const options = (timeline: InventoryCostTimeline) => ({ enableFinancialProjection: true, costTimeline: timeline });

describe('gold adjustment ledger book value regression', () => {
  it('shows the existing surplus WAC leg as credit with a credit running balance', () => {
    const adjustment = entry({
      id: 'surplus', operationKind: 'adjustment', debit: inventory.name, debitAccountId: inventory.id,
      credit: surplus.name, creditAccountId: surplus.id, weight: '2', arabicWeight: '2',
    });
    const entries = [opening, adjustment];
    const timeline = adjustmentTimeline(adjustment, 'surplus');
    const ledger = buildLedgerReport(entries, accounts, surplus, 'book_value', '2026-01-01', '2026-12-31', [], options(timeline));
    const inventoryLedger = buildLedgerReport(entries, accounts, inventory, 'book_value', '2026-01-01', '2026-12-31', [], options(timeline));
    const statements = buildFinancialStatementsEgp(entries, accounts, { timeline, balanceEndDate: '2026-12-31' });

    expect(getAvailableDimensions(surplus, entries, accounts, [], options(timeline))).toContain('book_value');
    expect(ledger).toMatchObject({ totalDebit: 0, totalCredit: 200, closingBalance: 200 });
    expect(ledger.rows[0]).toMatchObject({ debit: 0, credit: 200, balance: 200 });
    expect(inventoryLedger.rows.find(row => row.entry.id === adjustment.id)).toMatchObject({ debit: 200, credit: 0 });
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('shows the existing shortage WAC leg as debit with a debit running balance', () => {
    const adjustment = entry({
      id: 'shortage', operationKind: 'adjustment', debit: shortage.name, debitAccountId: shortage.id,
      credit: inventory.name, creditAccountId: inventory.id, weight: '2', arabicWeight: '2',
    });
    const entries = [opening, adjustment];
    const timeline = adjustmentTimeline(adjustment, 'shortage');
    const ledger = buildLedgerReport(entries, accounts, shortage, 'book_value', '2026-01-01', '2026-12-31', [], options(timeline));
    const inventoryLedger = buildLedgerReport(entries, accounts, inventory, 'book_value', '2026-01-01', '2026-12-31', [], options(timeline));
    const statements = buildFinancialStatementsEgp(entries, accounts, { timeline, balanceEndDate: '2026-12-31' });

    expect(getAvailableDimensions(shortage, entries, accounts, [], options(timeline))).toContain('book_value');
    expect(ledger).toMatchObject({ totalDebit: 200, totalCredit: 0, closingBalance: 200 });
    expect(ledger.rows[0]).toMatchObject({ debit: 200, credit: 0, balance: 200 });
    expect(inventoryLedger.rows.find(row => row.entry.id === adjustment.id)).toMatchObject({ debit: 0, credit: 200 });
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });
});