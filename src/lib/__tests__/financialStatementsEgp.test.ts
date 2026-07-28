import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import type { InventoryCostTimeline } from '../inventoryCostTypes';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'نقدية', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'ذهب 21', mainType: 'asset', subType: 'مخزون ذهب', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' },
  { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'رأس المال', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'rent', name: 'إيجار', mainType: 'expenses', subType: 'مصروفات تشغيل', balanceNature: 'cash', type: 'other', userId: 'u' },
];

const entry = (patch: Partial<Entry>): Entry => ({
  tx: 'عملية', debit: '', credit: '', date: '2026-01-01', cash: '0', weight: '0',
  count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});

const opening = entry({
  id: 'opening', operationKind: 'opening', debit: 'ذهب 21', debitAccountId: 'gold',
  credit: 'رأس المال', creditAccountId: 'capital', weight: '10', arabicWeight: '10',
});
const sale = entry({
  id: 'sale', date: '2026-02-01', operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash',
  credit: 'ذهب 21', creditAccountId: 'gold', cash: '500', weight: '4', arabicWeight: '4',
});
const rent = entry({
  id: 'rent', date: '2026-02-02', operationKind: 'expense', debit: 'إيجار', debitAccountId: 'rent',
  credit: 'الخزنة', creditAccountId: 'cash', cash: '50',
});
const cashCapital = entry({
  id: 'capital', debit: 'الخزنة', debitAccountId: 'cash',
  credit: 'رأس المال', creditAccountId: 'capital', cash: '1000',
});

const timeline = {
  valid: true,
  results: [
    {
      operationId: 'opening', classification: 'opening', entry: opening,
      inventoryAccountId: 'gold', incomingTotalCostMinor: 100000,
      totalCogsMinor: 0, saleAmountMinor: 0, adjustmentLossMinor: 0,
      outgoingActualPhysicalWeightUnits: 0,
    },
    {
      operationId: 'sale', classification: 'sale', entry: sale,
      sourceInventoryAccountId: 'gold', incomingTotalCostMinor: 0,
      totalCogsMinor: 40000, saleAmountMinor: 50000, adjustmentLossMinor: 0,
      outgoingActualPhysicalWeightUnits: 400,
    },
  ],
  finalStates: {
    gold: {
      inventoryAccountId: 'gold', displayName: 'ذهب 21', kind: 'gold',
      standardizedQuantityUnits: 600, accessoryQuantityUnits: 0,
      remainingTotalCostMinor: 60000,
    },
  },
} as unknown as InventoryCostTimeline;

describe('EGP financial statements', () => {
  it('uses WAC COGS and keeps weights out of income calculations', () => {
    const report = buildFinancialStatementsEgp([opening, cashCapital, sale, rent], accounts, {
      timeline, incomeStartDate: '2026-01-01', incomeEndDate: '2026-12-31', balanceEndDate: '2026-12-31',
      goldPriceEgp: 200,
    });
    expect(report.incomeStatement).toMatchObject({
      revenueTotal: 500,
      cogs: 400,
      grossProfit: 100,
      operatingExpensesTotal: 50,
      netProfit: 50,
      soldWeight: { gold: 4, silver: 0 },
    });
  });

  it('uses opening/WAC book value in totals and isolates market revaluation', () => {
    const lowMarket = buildFinancialStatementsEgp([opening, cashCapital, sale, rent], accounts, {
      timeline, balanceEndDate: '2026-12-31', goldPriceEgp: 200,
    });
    const highMarket = buildFinancialStatementsEgp([opening, cashCapital, sale, rent], accounts, {
      timeline, balanceEndDate: '2026-12-31', goldPriceEgp: 300,
    });

    expect(lowMarket.balanceSheet.assets.goldInventory).toBe(600);
    expect(lowMarket.balanceSheet.inventory[0]).toMatchObject({
      weight: 6, bookValue: 600, marketValue: 1200, unrealizedDifference: 600,
    });
    expect(highMarket.balanceSheet.inventory[0].marketValue).toBe(1800);
    expect(highMarket.incomeStatement.netProfit).toBe(lowMarket.incomeStatement.netProfit);
    expect(highMarket.balanceSheet.assets.total).toBe(lowMarket.balanceSheet.assets.total);
    expect(highMarket.balanceSheet.equity.total).toBe(lowMarket.balanceSheet.equity.total);
    expect(lowMarket.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });
});
