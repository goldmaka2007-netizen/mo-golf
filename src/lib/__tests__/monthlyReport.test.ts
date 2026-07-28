import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildMonthlyDecisionInsights } from '../monthlyDecisionInsights';
import { buildMonthlyReport, createMonthlyReportPeriod } from '../monthlyReportService';

const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'gold', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', karat: '21', is_inventory: true, userId: 'u' },
  { id: 'silver', name: 'silver', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
  { id: 'merchant', name: 'merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', is_inventory: false, userId: 'u' },
  { id: 'capital', name: 'capital', mainType: 'equity', subType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'expense', name: 'expense', mainType: 'expense', subType: 'operating', balanceNature: 'cash', type: 'other', userId: 'u' },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  tx: 'test',
  date: '2026-01-01',
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

const validTimeline = (entries: Entry[]) => ({
  valid: true,
  results: entries.filter(item => item.operationKind === 'sale').map(item => ({
    classification: 'sale',
    entry: item,
    totalCogsMinor: 600000,
  })),
  finalStates: {},
}) as any;

describe('monthly report periods', () => {
  it('moves from January to previous December and builds YTD from January', () => {
    expect(createMonthlyReportPeriod(2026, 1)).toMatchObject({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      previousStartDate: '2025-12-01',
      previousEndDate: '2025-12-31',
      ytdStartDate: '2026-01-01',
    });
  });
});

describe('monthly report aggregation', () => {
  const entries = [
    entry({ id: 'o1', operationKind: 'opening', date: '2026-01-01', debit: 'gold', debitAccountId: 'gold', credit: 'capital', creditAccountId: 'capital', weight: '10' }),
    entry({ id: 'p1', operationKind: 'purchase', date: '2026-01-10', debit: 'gold', debitAccountId: 'gold', credit: 'merchant', creditAccountId: 'merchant', weight: '4', cash: '0' }),
    entry({ id: 's1', operationKind: 'sale', date: '2026-01-15', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', weight: '2', cash: '10000' }),
    entry({ id: 't1', operationKind: 'transfer', date: '2026-01-20', debit: 'gold', debitAccountId: 'gold', credit: 'gold', creditAccountId: 'gold', weight: '1' }),
    entry({ id: 'e1', operationKind: 'expense', date: '2026-01-22', debit: 'expense', debitAccountId: 'expense', credit: 'cash', creditAccountId: 'cash', cash: '1000' }),
  ];
  const report = buildMonthlyReport({ entries, accounts, year: 2026, month: 1, costTimeline: validTimeline(entries), goldPrice: 5000 });

  it('keeps opening out of monthly sales and maintains the inventory equation', () => {
    const movement = report.current.inventory.gold;
    expect(report.current.sales).toBe(10000);
    expect(movement.opening).toBe(10);
    expect(movement.opening + movement.inflows - movement.outflows + movement.adjustments).toBeCloseTo(movement.closing, 8);
    expect(movement.closing).toBe(12);
  });

  it('keeps merchant liability separate and calculates net owned gold', () => {
    expect(report.current.merchantGoldLiabilities21).toBe(4);
    expect(report.current.netOwnedGold21).toBe(8);
  });

  it('uses WAC COGS and keeps market revaluation outside operating profit', () => {
    expect(report.current.cogs.value).toBe(6000);
    expect(report.current.grossProfit.value).toBe(4000);
    expect(report.current.netOperatingProfit.value).toBe(3000);
    expect(report.marketRevaluation.inventoryMarketValue).toBe(60000);
    expect(report.current.netOperatingProfit.value).toBe(3000);
  });

  it('does not classify transfers as sales, purchases, or profit operations', () => {
    expect(report.current.saleCount).toBe(1);
    expect(report.current.purchaseCount).toBe(1);
    expect(report.current.inventory.gold.internalTransfers).toBe(2);
  });

  it('never emits NaN or Infinity for a zero previous period', () => {
    report.kpis.forEach(kpi => {
      expect(Number.isNaN(kpi.comparison.changePercent)).toBe(false);
      expect(kpi.comparison.changePercent).not.toBe(Infinity);
    });
  });
});

describe('monthly decision insights', () => {
  it('requires supporting metrics and creates no advice without activity', () => {
    const report = buildMonthlyReport({ entries: [], accounts, year: 2026, month: 1 });
    expect(buildMonthlyDecisionInsights(report)).toEqual([]);
  });

  it('always returns reason, metrics, and action for emitted insights', () => {
    const entries = [
      entry({ operationKind: 'sale', date: '2025-12-10', debit: 'cash', credit: 'gold', cash: '20000', weight: '2' }),
      entry({ operationKind: 'sale', date: '2026-01-10', debit: 'cash', credit: 'gold', cash: '10000', weight: '1' }),
      entry({ operationKind: 'purchase', date: '2026-01-11', debit: 'gold', credit: 'cash', cash: '15000', weight: '2' }),
    ];
    const report = buildMonthlyReport({ entries, accounts, year: 2026, month: 1 });
    buildMonthlyDecisionInsights(report).forEach(insight => {
      expect(insight.reason).toBeTruthy();
      expect(insight.supportingMetrics.length).toBeGreaterThan(0);
      expect(insight.suggestedAction).toBeTruthy();
    });
  });
});
