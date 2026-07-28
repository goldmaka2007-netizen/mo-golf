import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildDashboardData } from '../dashboardSelector';
import type { InventoryCostTimeline } from '../inventoryCostTypes';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'ذهب 21', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', karat: '21', is_inventory: true, userId: 'u' },
  { id: 'merchant', name: 'تاجر ذهب', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' },
  { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'expense', name: 'إيجار', mainType: 'expense', subType: 'operating', balanceNature: 'cash', type: 'other', userId: 'u' },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  tx: 'عملية',
  date: '2026-07-01',
  debit: '',
  credit: '',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u',
  ...overrides,
});

const opening = entry({
  id: 'opening',
  operationKind: 'opening',
  debit: 'ذهب 21',
  debitAccountId: 'gold',
  credit: 'رأس المال',
  creditAccountId: 'capital',
  weight: '10',
  arabicWeight: '10',
});
const cashOpening = entry({
  id: 'cash-opening',
  operationKind: 'opening',
  debit: 'الخزنة',
  debitAccountId: 'cash',
  credit: 'رأس المال',
  creditAccountId: 'capital',
  cash: '1000',
});
const firstSale = entry({
  id: 'sale-1',
  seq: 2,
  date: '2026-07-27',
  tx: 'بيع ذهب',
  operationKind: 'sale',
  debit: 'الخزنة',
  debitAccountId: 'cash',
  credit: 'ذهب 21',
  creditAccountId: 'gold',
  cash: '500',
  weight: '1',
  arabicWeight: '1',
});
const todaySale = entry({
  id: 'sale-2',
  seq: 4,
  date: '2026-07-28',
  tx: 'بيع ذهب',
  operationKind: 'sale',
  debit: 'الخزنة',
  debitAccountId: 'cash',
  credit: 'ذهب 21',
  creditAccountId: 'gold',
  cash: '800',
  weight: '1',
  arabicWeight: '1',
});
const todayExpense = entry({
  id: 'expense-1',
  seq: 3,
  date: '2026-07-28',
  tx: 'مصروف',
  operationKind: 'expense',
  debit: 'إيجار',
  debitAccountId: 'expense',
  credit: 'الخزنة',
  creditAccountId: 'cash',
  cash: '100',
  notes: 'إيجار المحل',
});

const timeline = {
  valid: true,
  results: [
    {
      operationId: 'opening',
      classification: 'opening',
      entry: opening,
      inventoryAccountId: 'gold',
      incomingTotalCostMinor: 100000,
      totalCogsMinor: 0,
      saleAmountMinor: 0,
      adjustmentGainMinor: 0,
      adjustmentLossMinor: 0,
      outgoingActualPhysicalWeightUnits: 0,
    },
    {
      operationId: 'sale-1',
      classification: 'sale',
      entry: firstSale,
      sourceInventoryAccountId: 'gold',
      incomingTotalCostMinor: 0,
      totalCogsMinor: 10000,
      saleAmountMinor: 50000,
      adjustmentGainMinor: 0,
      adjustmentLossMinor: 0,
      outgoingActualPhysicalWeightUnits: 100,
    },
    {
      operationId: 'sale-2',
      classification: 'sale',
      entry: todaySale,
      sourceInventoryAccountId: 'gold',
      incomingTotalCostMinor: 0,
      totalCogsMinor: 10000,
      saleAmountMinor: 80000,
      adjustmentGainMinor: 0,
      adjustmentLossMinor: 0,
      outgoingActualPhysicalWeightUnits: 100,
    },
  ],
  finalStates: {
    gold: {
      inventoryAccountId: 'gold',
      displayName: 'ذهب 21',
      kind: 'gold',
      standardizedQuantityUnits: 800,
      accessoryQuantityUnits: 0,
      remainingTotalCostMinor: 80000,
    },
  },
} as unknown as InventoryCostTimeline;

describe('executive dashboard selector', () => {
  const data = buildDashboardData({
    entries: [opening, cashOpening, firstSale, todayExpense, todaySale],
    accounts,
    timeline,
    goldPrice: 200,
    silverPrice: 30,
    today: '2026-07-28',
  });

  it('reuses the cost timeline for book value, COGS, and profit', () => {
    expect(data.snapshot.gold).toMatchObject({
      weight: 8,
      bookValue: { value: 800, available: true },
      marketValue: { value: 1600, available: true },
    });
    expect(data.month.cogs).toEqual({ value: 200, available: true });
    expect(data.today).toMatchObject({
      sales: 800,
      expenses: 100,
      grossProfit: { value: 700, available: true },
      netProfit: { value: 600, available: true },
    });
  });

  it('sorts recent activity once and derives insights only from recorded operations', () => {
    expect(data.recentActivity.slice(0, 2).map(item => item.id)).toEqual(['sale-2', 'expense-1']);
    expect(data.insights.find(item => item.id === 'best-sales-day')?.detail).toContain('2026-07-28');
    expect(data.insights.find(item => item.id === 'highest-expense')?.detail).toContain('إيجار');
  });

  it('marks cost-dependent metrics unavailable without a valid timeline', () => {
    const unavailable = buildDashboardData({
      entries: [],
      accounts,
      timeline: null,
      goldPrice: 200,
      silverPrice: 30,
      today: '2026-07-28',
    });
    expect(unavailable.costBasisAvailable).toBe(false);
    expect(unavailable.month.cogs).toEqual({ value: null, available: false });
    expect(unavailable.month.grossProfit.available).toBe(false);
    expect(unavailable.month.netProfit.available).toBe(false);
    expect(unavailable.today.grossProfit.available).toBe(false);
    expect(unavailable.today.netProfit.available).toBe(false);
    expect(unavailable.snapshot.totalInventoryBookValue.available).toBe(false);
    expect(unavailable.snapshot.gold.marketValue.available).toBe(false);
    expect(unavailable.snapshot.silver.marketValue.available).toBe(false);
    expect(unavailable.snapshot.totalAssets.available).toBe(false);
    expect(unavailable.snapshot.equity.available).toBe(false);
  });
});
