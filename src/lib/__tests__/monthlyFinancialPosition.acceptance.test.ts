import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import { PRODUCTION_INVENTORY_ACCOUNT_IDS_IN_SEED_ORDER } from '../../test-fixtures/productionInventoryAccountIds';
import { buildOpeningCostConfig } from '../openingCostConfig';
import { rebuildRuntimeInventoryCostTimeline } from '../costRecalculation';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { isFinancialPositionRowVisible } from '../financialPositionPresentation';
import {
  buildMonthlyFinancialPosition,
  financialPositionCsvRows,
  historicalOverlaysForCutoff,
  type MonthlyFinancialPositionResult,
} from '../monthlyFinancialPosition';

const overlayAccount: Account = {
  id: 'seed-account-d1216eb4076ccdf40e20', name: 'historical gold', mainType: 'assets', subType: 'inventory_gold',
  balanceNature: 'gold', type: 'gold_raw', metal: 'gold', is_inventory: true, karat: '21', userId: 'test',
};
const overlayEntry = (date: string): Entry => ({
  id: 'csvref-entry-8bac4f51c5f366affbcb8884610f549e', tx: 'historical', operationKind: 'purchase', date,
  debit: overlayAccount.name, debitAccountId: overlayAccount.id, credit: 'capital', creditAccountId: 'capital',
  cash: '0', weight: '1', arabicWeight: '1', count: '0', notes: '', userId: 'test',
});

const availableResult = (): MonthlyFinancialPositionResult => ({
  available: true,
  costBasisAvailable: true,
  merchantLiabilityDiagnostics: [],
  incomeStatement: {} as any,
  metalSummary: { goldAssetWeight: 12, silverAssetWeight: 8, goldLiabilityWeight: 3, silverLiabilityWeight: 2, netGoldWeight: 9, netSilverWeight: 6 },
  ownership: { physicalGoldInventory21: 10, merchantGoldLiability21: 3, merchantGoldReceivable21: 2, netGoldOwnership21: 9, physicalSilverInventoryGrams: 5, merchantSilverLiabilityGrams: 2, merchantSilverReceivableGrams: 3, netSilverOwnershipGrams: 6 },
  balanceSheet: {
    assets: {
      cash: 100, goldInventory: 1000, silverInventory: 800, accessoriesInventory: 50, receivables: 485, fixedAssets: 0,
      ordinaryReceivables: 20, merchantCashReceivables: 25, merchantMetalReceivables: 440,
      merchantGoldReceivables: 300, merchantSilverReceivables: 140,
      cashDetails: [{ id: 'cash', label: 'cash', amount: 100 }], ordinaryReceivableDetails: [{ id: 'ordinary', label: 'ordinary', amount: 20 }], fixedAssetDetails: [],
      merchantReceivableDetails: [
        { id: 'gold-r', accountId: 'gold-r', label: 'gold receiver', metal: 'gold', equivalent21Weight: 2, silverWeight: 0, bookValue: 300, cashPayable: 0, cashReceivable: 0, averageEgpPerGram: null, positionSide: 'receivable' },
        { id: 'silver-r', accountId: 'silver-r', label: 'silver receiver', metal: 'silver', equivalent21Weight: 0, silverWeight: 4, bookValue: 140, cashPayable: 0, cashReceivable: 0, averageEgpPerGram: null, positionSide: 'receivable' },
        { id: 'cash-r', accountId: 'cash-r', label: 'cash receiver', metal: 'gold', equivalent21Weight: 0, silverWeight: 0, bookValue: 0, cashPayable: 0, cashReceivable: 25, averageEgpPerGram: null, positionSide: 'settled' },
      ], total: 2435,
    },
    liabilities: {
      merchant: 465, merchantGold: 250, merchantSilver: 175, merchantCash: 40, other: 20, total: 485,
      merchantDetails: [
        { id: 'gold-p', accountId: 'gold-p', label: 'gold payable', metal: 'gold', equivalent21Weight: 3, silverWeight: 0, bookValue: 250, cashPayable: 0, cashReceivable: 0, averageEgpPerGram: null, positionSide: 'payable' },
        { id: 'silver-p', accountId: 'silver-p', label: 'silver payable', metal: 'silver', equivalent21Weight: 0, silverWeight: 2, bookValue: 175, cashPayable: 0, cashReceivable: 0, averageEgpPerGram: null, positionSide: 'payable' },
        { id: 'cash-p', accountId: 'cash-p', label: 'cash payable', metal: 'gold', equivalent21Weight: 0, silverWeight: 0, bookValue: 0, cashPayable: 40, cashReceivable: 0, averageEgpPerGram: null, positionSide: 'settled' },
      ], otherDetails: [{ id: 'other', label: 'other', amount: 20 }],
    },
    equity: { capital: 1950, retainedEarnings: 0, currentProfit: 0, total: 1950, capitalDetails: [{ id: 'capital', label: 'capital', amount: 1950 }], retainedEarningsDetails: [], currentProfitDetails: [] },
    inventory: [{ accountId: 'accessory', kind: 'accessory', label: 'accessory name', weight: null, quantity: 10, bookValue: 50, marketValue: null, unrealizedDifference: null, averageBookCost: 5 }],
    inventoryCategories: {} as any, reconciliationWarnings: [], balances: { assetsLessLiabilitiesAndEquity: 0 },
  },
});

describe('monthly financial position acceptance', () => {
  it('keeps a zero-EGP gold row visible when E21 weight is genuine', () => {
    expect(isFinancialPositionRowVisible(0, 1.25)).toBe(true);
  });

  it('keeps a zero-EGP silver row visible when silver weight is genuine', () => {
    expect(isFinancialPositionRowVisible(0, 3.5)).toBe(true);
  });

  it('hides a row only when both EGP and metal dimensions are zero', () => {
    expect(isFinancialPositionRowVisible(0, 0)).toBe(false);
  });

  it('restricts approved historical overlays to both cutoff and operation presence', () => {
    expect(historicalOverlaysForCutoff([overlayEntry('2026-03-03')], [overlayAccount], '2026-03-03')).toEqual([]);
    expect(historicalOverlaysForCutoff([overlayEntry('2026-03-04')], [overlayAccount], '2026-03-04')).toMatchObject([{ overlayId: 'hiro-20260304-scrap-arabic-e21-002' }]);
  });

  it('refuses CSV rows when the cost timeline is unavailable', () => {
    expect(financialPositionCsvRows({ available: false, diagnostic: { code: 'unknown_inventory_operation', message: 'timeline unavailable' } })).toBeNull();
  });

  it('exports genuine merchant metal and cash independently while preserving economic totals', () => {
    const result = availableResult();
    const rows = financialPositionCsvRows(result)!;
    expect(rows.filter(row => row.section === 'asset:merchant-gold-receivable')).toEqual([expect.objectContaining({ account: 'gold receiver', bookValue: 300, goldEquivalent21Weight: 2, cash: null })]);
    expect(rows.filter(row => row.section === 'asset:merchant-silver-receivable')).toEqual([expect.objectContaining({ account: 'silver receiver', bookValue: 140, silverWeight: 4 })]);
    expect(rows.filter(row => row.section === 'asset:merchant-cash-receivable')).toEqual([expect.objectContaining({ account: 'cash receiver', bookValue: null, cash: 25, goldEquivalent21Weight: null })]);
    expect(rows.filter(row => row.section === 'liability:merchant-gold-payable')).toEqual([expect.objectContaining({ bookValue: 250, goldEquivalent21Weight: 3 })]);
    expect(rows.filter(row => row.section === 'liability:merchant-silver-payable')).toEqual([expect.objectContaining({ bookValue: 175, silverWeight: 2 })]);
    expect(rows.filter(row => row.section === 'liability:merchant-cash-payable')).toEqual([expect.objectContaining({ bookValue: null, cash: 40, goldEquivalent21Weight: null })]);
    expect(rows.find(row => row.section === 'summary' && row.account === 'balance difference')).toMatchObject({ bookValue: 0 });
    expect(rows.find(row => row.section === 'asset:inventory:accessory')).toEqual(expect.objectContaining({ account: 'accessory name', bookValue: 50, goldEquivalent21Weight: null, silverWeight: null }));
  });

  it('preserves buildFinancialStatementsEgp monetary outputs at the same cutoff', () => {
    const inventoryAccounts = SEED_ACCOUNTS.filter(account => account.is_inventory).map((account, index) => ({ ...account, id: PRODUCTION_INVENTORY_ACCOUNT_IDS_IN_SEED_ORDER[index], userId: 'test' })) as Account[];
    const gold = inventoryAccounts.find(account => account.type === 'gold_product')!;
    const silver = inventoryAccounts.find(account => account.type === 'silver')!;
    const accessory = inventoryAccounts.find(account => account.type === 'accessory')!;
    const accounts: Account[] = [
      { id: 'cash', name: 'cash', mainType: 'assets', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'test' },
      ...inventoryAccounts,
      { id: 'merchant-gold', name: 'merchant gold', mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', balanceNature: 'gold', type: 'merchant', metal: 'gold', merchantDirection: 'payable', userId: 'test' },
      { id: 'merchant-silver', name: 'merchant silver', mainType: 'liabilities', subType: 'merchant_silver', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_silver', balanceNature: 'silver', type: 'merchant', metal: 'silver', merchantDirection: 'payable', userId: 'test' },
      { id: 'capital', name: 'capital', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', userId: 'test' },
    ];
    const row = (patch: Partial<Entry>): Entry => ({ id: 'row', tx: 'test', operationKind: 'opening', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'test', ...patch });
    const entries = [
      row({ id: 'cash-opening', debit: 'cash', debitAccountId: 'cash', credit: 'capital', creditAccountId: 'capital', cash: '1000' }),
      row({ id: 'gold-opening', debit: gold.name, debitAccountId: gold.id, credit: 'capital', creditAccountId: 'capital', weight: '2', arabicWeight: '2', karat: 21 }),
      row({ id: 'silver-opening', debit: silver.name, debitAccountId: silver.id, credit: 'capital', creditAccountId: 'capital', weight: '3', arabicWeight: '3' }),
      row({ id: 'accessory-opening', debit: accessory.name, debitAccountId: accessory.id, credit: 'capital', creditAccountId: 'capital', count: '4' }),
      row({ id: 'gold-merchant', operationKind: 'purchase', debit: gold.name, debitAccountId: gold.id, credit: 'merchant gold', creditAccountId: 'merchant-gold', weight: '1', arabicWeight: '1', karat: 21, invoiceOfficialPricePerGramEgp: 6000 }),
      row({ id: 'silver-merchant', operationKind: 'purchase', debit: silver.name, debitAccountId: silver.id, credit: 'merchant silver', creditAccountId: 'merchant-silver', weight: '2', arabicWeight: '2', invoiceOfficialPricePerGramEgp: 100 }),
    ];
    const config = [{ year: 2026, gold21PriceEgp: 5000, silverPriceEgp: 50, accessoryOpeningCosts: { [accessory.id!]: 25 } }];
    const timeline = rebuildRuntimeInventoryCostTimeline(entries, accounts, buildOpeningCostConfig(config, accounts), { historicalInventoryOverlayDirectives: [] });
    expect(timeline.valid, JSON.stringify(timeline.diagnostics)).toBe(true);
    const original = buildFinancialStatementsEgp(entries, accounts, { timeline, balanceEndDate: '2026-01-31', incomeStartDate: '2026-01-01', incomeEndDate: '2026-01-31' });
    const monthly = buildMonthlyFinancialPosition({ entries, accounts, canonicalDefinitions: [], openingCostConfig: config, cutoffDate: '2026-01-31' });
    expect(monthly.available).toBe(true);
    if (!monthly.available) return;
    expect(monthly.balanceSheet.assets).toMatchObject({
      cash: original.balanceSheet.assets.cash, goldInventory: original.balanceSheet.assets.goldInventory, silverInventory: original.balanceSheet.assets.silverInventory, accessoriesInventory: original.balanceSheet.assets.accessoriesInventory, receivables: original.balanceSheet.assets.receivables, merchantGoldReceivables: original.balanceSheet.assets.merchantGoldReceivables, merchantSilverReceivables: original.balanceSheet.assets.merchantSilverReceivables, total: original.balanceSheet.assets.total,
    });
    expect(monthly.balanceSheet.liabilities).toMatchObject({ merchantGold: original.balanceSheet.liabilities.merchantGold, merchantSilver: original.balanceSheet.liabilities.merchantSilver, merchantCash: original.balanceSheet.liabilities.merchantCash, other: original.balanceSheet.liabilities.other, total: original.balanceSheet.liabilities.total });
    expect(monthly.balanceSheet.equity).toMatchObject({ capital: original.balanceSheet.equity.capital, retainedEarnings: original.balanceSheet.equity.retainedEarnings, currentProfit: original.balanceSheet.equity.currentProfit, total: original.balanceSheet.equity.total });
    expect(monthly.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(original.balanceSheet.balances.assetsLessLiabilitiesAndEquity);
    expect(monthly.ownership).toMatchObject({
      physicalGoldInventory21: monthly.balanceSheet.inventoryCategories.gold.weight,
      merchantGoldLiability21: monthly.metalSummary.goldLiabilityWeight,
      netGoldOwnership21: monthly.metalSummary.netGoldWeight,
    });
  });
});
