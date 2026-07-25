import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import type { InventoryCostTimeline, OperationCostResultV2 } from '../inventoryCostTypes';
import { buildIncomeStatementReport } from '../incomeStatementReport';
import { buildLedgerReport } from '../ledgerReport';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildTrialBalanceReport } from '../trialBalanceReport';

const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'gold inventory', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, userId: 'u' },
  { id: 'capital', name: 'capital', mainType: 'equity', subType: 'capital', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'drawings', name: 'drawings', mainType: 'equity', subType: 'drawings', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'rent', name: 'rent expense', mainType: 'expense', subType: 'opex', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'shortage', name: 'shortage settlement', mainType: 'expense', subType: 'inventory_loss', balanceNature: 'gold', type: 'other', userId: 'u' },
];

const entry = (value: Partial<Entry>): Entry => ({
  id: value.id,
  seq: 1,
  tx: value.tx || 'tx',
  operationKind: value.operationKind || 'other',
  date: value.date || '2026-01-01',
  debit: '',
  credit: '',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u',
  ...value,
});

const entries: Entry[] = [
  entry({ id: 'capital', operationKind: 'other', debit: 'cash', debitAccountId: 'cash', credit: 'capital', creditAccountId: 'capital', cash: '5000' }),
  entry({ id: 'purchase', operationKind: 'purchase', debit: 'gold inventory', debitAccountId: 'gold', credit: 'cash', creditAccountId: 'cash', cash: '1000', weight: '10', arabicWeight: '10', karat: 21 }),
  entry({ id: 'sale', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold inventory', creditAccountId: 'gold', cash: '1500', weight: '4', arabicWeight: '4', karat: 21 }),
  entry({ id: 'rent', operationKind: 'expense', debit: 'rent expense', debitAccountId: 'rent', credit: 'cash', creditAccountId: 'cash', cash: '100' }),
  entry({ id: 'drawings', operationKind: 'personal_withdrawal', debit: 'drawings', debitAccountId: 'drawings', credit: 'cash', creditAccountId: 'cash', cash: '200' }),
  entry({ id: 'shortage', operationKind: 'adjustment', debit: 'shortage settlement', debitAccountId: 'shortage', credit: 'gold inventory', creditAccountId: 'gold', weight: '1', arabicWeight: '1', karat: 21 }),
  entry({ id: 'outside', operationKind: 'sale', date: '2025-12-31', debit: 'cash', debitAccountId: 'cash', credit: 'gold inventory', creditAccountId: 'gold', cash: '999', weight: '1', arabicWeight: '1', karat: 21 }),
];

const costResult = (entryId: string, patch: Partial<OperationCostResultV2>): OperationCostResultV2 => {
  const source = entries.find(item => item.id === entryId)!;
  return {
    operationId: entryId,
    classification: 'non_cost',
    incomingStandardizedQuantityUnits: 0,
    outgoingStandardizedQuantityUnits: 0,
    incomingActualPhysicalWeightUnits: 0,
    outgoingActualPhysicalWeightUnits: 0,
    incomingAccessoryQuantityUnits: 0,
    outgoingAccessoryQuantityUnits: 0,
    incomingMetalCostMinor: 0,
    incomingWorkmanshipCostMinor: 0,
    outgoingMetalCostMinor: 0,
    outgoingWorkmanshipCostMinor: 0,
    incomingTotalCostMinor: 0,
    outgoingTotalCostMinor: 0,
    metalCogsMinor: 0,
    workmanshipCogsMinor: 0,
    totalCogsMinor: 0,
    saleAmountMinor: 0,
    profitMinor: null,
    adjustmentGainMinor: 0,
    adjustmentLossMinor: 0,
    calculationVersion: 'phase5-wac-v1',
    entry: source,
    ...patch,
  };
};

const timeline: InventoryCostTimeline = {
  calculationVersion: 'phase5-wac-v1',
  orderedOperationIds: entries.map(item => item.id!),
  results: [
    costResult('sale', { classification: 'sale', sourceInventoryAccountId: 'gold', inventoryAccountId: 'gold', totalCogsMinor: 60000, metalCogsMinor: 60000, saleAmountMinor: 150000, profitMinor: 90000 }),
    costResult('shortage', { classification: 'shortage', sourceInventoryAccountId: 'gold', inventoryAccountId: 'gold', adjustmentLossMinor: 15000 }),
    costResult('outside', { classification: 'sale', sourceInventoryAccountId: 'gold', inventoryAccountId: 'gold', totalCogsMinor: 30000, saleAmountMinor: 99900, profitMinor: 69900 }),
  ],
  resultsByOperationId: {},
  finalStates: {},
  diagnostics: [],
  orderingDiagnostics: [],
  historicalInventoryOverlays: [],
  valid: true,
};
timeline.resultsByOperationId = Object.fromEntries(timeline.results.map(result => [result.operationId, result]));

const options = { enableFinancialProjection: true, costTimeline: timeline };

describe('central income statement projection', () => {
  it('keeps journal, ledger, trial balance, and income statement on the same balances', () => {
    const legs = buildLegacyLedgerLegs(entries, accounts, [], options).filter(leg => leg.dimension === 'cash' && leg.date >= '2026-01-01' && leg.date <= '2026-01-31');
    expect(legs.reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0)).toBe(0);

    const inventoryLedger = buildLedgerReport(entries, accounts, accounts[1], 'cash', '2026-01-01', '2026-01-31', [], options);
    expect(inventoryLedger.totalDebit).toBe(1000);
    expect(inventoryLedger.totalCredit).toBe(750);
    expect(inventoryLedger.openingBalance).toBe(-300);
    expect(inventoryLedger.closingBalance).toBe(-50);

    const trial = buildTrialBalanceReport(entries, accounts, 'cash', '2026-01-01', '2026-01-31', [], options);
    const trialInventory = trial.groups.flatMap(group => group.rows).find(row => row.entityId === 'product:gold');
    expect(trialInventory).toMatchObject({ periodDebit: inventoryLedger.totalDebit, periodCredit: inventoryLedger.totalCredit, closingCredit: Math.abs(inventoryLedger.closingBalance) });
    expect(trial.balanced).toBe(true);

    const income = buildIncomeStatementReport(entries, accounts, '2026-01-01', '2026-01-31', [], timeline);
    expect(income.revenue.total).toBe(1500);
    expect(income.cogs.total).toBe(600);
    expect(income.grossProfit).toBe(900);
    expect(income.operatingExpenses.total).toBe(250);
    expect(income.operatingProfit).toBe(650);
    expect(income.trialBalance.groups).toEqual(trial.groups);
  });

  it('excludes capital, drawings, purchases, outside-period operations, and duplicate sale recognition from profit', () => {
    const income = buildIncomeStatementReport(entries, accounts, '2026-01-01', '2026-01-31', [], timeline);
    expect(income.revenue.lines.map(line => line.accountName)).toEqual(['إيراد مبيعات المخزون']);
    expect(income.revenue.total).not.toBe(1500 + 5000 + 999);
    expect(income.operatingExpenses.lines.map(line => line.accountName)).toContain('rent expense');
    expect(income.operatingExpenses.lines.map(line => line.accountName)).toContain('خسائر تسوية عجز المخزون');
    expect(income.operatingExpenses.lines.map(line => line.accountName)).not.toContain('drawings');
    expect(income.cogs.total).toBe(600);
  });

  it('does not estimate COGS when the weighted-average timeline is unavailable', () => {
    const income = buildIncomeStatementReport(entries, accounts, '2026-01-01', '2026-01-31');
    expect(income.cogs.status).toBe('missing_cost_timeline');
    expect(income.grossProfit).toBeNull();
    expect(income.operatingProfit).toBeNull();
  });

  it('projects gold, silver, and accessory income tabs from central trial-balance dimensions', () => {
    const dimensionalAccounts: Account[] = [
      ...accounts,
      { id: 'silver', name: 'silver inventory', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
      { id: 'accessory', name: 'accessory inventory', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, userId: 'u' },
      { id: 'gold-surplus', name: 'gold surplus', mainType: 'revenue', subType: 'surplus', balanceNature: 'gold', type: 'other', userId: 'u' },
      { id: 'silver-surplus', name: 'silver surplus', mainType: 'revenue', subType: 'surplus', balanceNature: 'silver', type: 'other', userId: 'u' },
      { id: 'accessory-surplus', name: 'accessory surplus', mainType: 'revenue', subType: 'surplus', balanceNature: 'piece', type: 'other', userId: 'u' },
    ];
    const dimensionalEntries = [
      entry({ id: 'gold-surplus-entry', operationKind: 'adjustment', debit: 'gold inventory', debitAccountId: 'gold', credit: 'gold surplus', creditAccountId: 'gold-surplus', weight: '2', arabicWeight: '2', karat: 21 }),
      entry({ id: 'silver-surplus-entry', operationKind: 'adjustment', debit: 'silver inventory', debitAccountId: 'silver', credit: 'silver surplus', creditAccountId: 'silver-surplus', weight: '3' }),
      entry({ id: 'accessory-surplus-entry', operationKind: 'adjustment', debit: 'accessory inventory', debitAccountId: 'accessory', credit: 'accessory surplus', creditAccountId: 'accessory-surplus', weight: '5', count: '5' }),
    ];

    expect(buildIncomeStatementReport(dimensionalEntries, dimensionalAccounts, '2026-01-01', '2026-01-31', [], null, 'gold').revenue.total).toBe(2);
    expect(buildIncomeStatementReport(dimensionalEntries, dimensionalAccounts, '2026-01-01', '2026-01-31', [], null, 'silver').revenue.total).toBe(3);
    expect(buildIncomeStatementReport(dimensionalEntries, dimensionalAccounts, '2026-01-01', '2026-01-31', [], null, 'quantity').revenue.total).toBe(5);
  });
});