import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import type { InventoryCostTimeline } from '../inventoryCostTypes';
import { buildTrialBalanceReport } from '../trialBalanceReport';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'نقدية', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'ذهب 21', mainType: 'asset', subType: 'مخزون ذهب', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' },
  { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'رأس المال', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'rent', name: 'إيجار', mainType: 'expenses', subType: 'مصروفات تشغيل', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'merchant', name: 'تاجر ذهب', mainType: 'liability', subType: 'تجار ذهب', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' },
  { id: 'other-income', name: 'Misc gain', mainType: 'revenue', subType: 'Other Income', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'donation', name: 'Donation', mainType: 'expenses', subType: 'Other Expenses', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'withdrawals', name: 'Owner withdrawals', mainType: 'equity', subType: 'مسحوبات', balanceNature: 'cash', type: 'other', userId: 'u' },
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
const merchantPurchase = entry({
  id: 'merchant-purchase', date: '2026-02-03', operationKind: 'purchase',
  debit: 'ذهب 21', debitAccountId: 'gold', credit: 'تاجر ذهب', creditAccountId: 'merchant',
  weight: '5', arabicWeight: '5', cash: '100',
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
    expect(report.incomeStatement.revenueTree).toMatchObject([{
      label: 'إيرادات مبيعات المخزون',
      amount: 500,
      children: [{ label: 'إيرادات مبيعات الذهب', amount: 500, children: [{ label: 'ذهب 21', amount: 500 }] }],
    }]);
    expect(report.incomeStatement.cogsTree).toMatchObject([{
      label: 'تكلفة البضاعة المباعة',
      amount: 400,
      children: [{ label: 'تكلفة مبيعات الذهب', amount: 400, children: [{ label: 'ذهب 21', amount: 400 }] }],
    }]);
    expect(report.incomeStatement.operatingExpensesTree).toMatchObject([{
      label: 'مصروفات تشغيل', amount: 50, children: [{ label: 'إيجار', amount: 50 }],
    }]);
  });

  it('builds financial-position branches with gold equivalent-21 measures', () => {
    const report = buildFinancialStatementsEgp([opening, cashCapital, sale, rent], accounts, {
      timeline, balanceEndDate: '2026-12-31', goldPriceEgp: 200,
    });
    const gold = report.balanceSheet.tree.assets.find(item => item.id === 'assets:gold');
    const cash = report.balanceSheet.tree.assets.find(item => item.id === 'assets:cash');

    expect(gold).toMatchObject({
      label: 'مخزون الذهب',
      amount: 1200,
      measure: { value: 6, unit: 'gold21' },
      children: [{ label: 'أصناف الذهب', measure: { value: 6, unit: 'gold21' }, children: [{ label: 'ذهب 21', measure: { value: 6, unit: 'gold21' } }] }],
    });
    expect(cash?.children?.[0].children).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'الخزنة', amount: 1450 }),
    ]));
    expect(report.balanceSheet.tree.assets.reduce((sum, item) => sum + item.amount, 0)).toBe(report.balanceSheet.assets.total);
  });
  it('includes imported sales whose operation kind is inferred from the transaction name', () => {
    const importedSale = entry({
      ...sale,
      id: 'historical-sale',
      tx: 'بيع ذهب',
      operationKind: undefined,
    });
    const importedTimeline = {
      ...timeline,
      results: timeline.results.map(result => result.operationId === 'sale'
        ? { ...result, operationId: 'historical-sale', entry: importedSale }
        : result),
    } as unknown as InventoryCostTimeline;

    const income = buildFinancialStatementsEgp(
      [opening, cashCapital, importedSale],
      accounts,
      { timeline: importedTimeline, incomeStartDate: '2026-02-01', incomeEndDate: '2026-02-28' },
    ).incomeStatement;

    expect(income).toMatchObject({ revenueTotal: 500, cogs: 400, grossProfit: 100 });
    expect(income.revenueTree[0].children?.[0].children?.[0]).toMatchObject({ label: 'ذهب 21', amount: 500 });
  });
  it('nets customer returns against sales revenue and COGS in the same item branches', () => {
    const customerReturn = entry({
      id: 'customer-return', date: '2026-02-03', operationKind: 'customer_return',
      debit: 'ذهب 21', debitAccountId: 'gold', credit: 'الخزنة', creditAccountId: 'cash',
      cash: '250', weight: '2', arabicWeight: '2', originalOperationId: 'sale',
    });
    const returnTimeline = {
      ...timeline,
      results: [
        ...timeline.results,
        {
          operationId: 'customer-return', classification: 'customer_return', entry: customerReturn,
          inventoryAccountId: 'gold', destinationInventoryAccountId: 'gold',
          reversedCogsMinor: 20000, revenueReversalMinor: 25000,
          incomingTotalCostMinor: 20000, totalCogsMinor: 0, saleAmountMinor: 0,
          adjustmentLossMinor: 0, outgoingActualPhysicalWeightUnits: 0,
        },
      ],
    } as unknown as InventoryCostTimeline;

    const income = buildFinancialStatementsEgp(
      [opening, cashCapital, sale, customerReturn],
      accounts,
      { timeline: returnTimeline, incomeStartDate: '2026-02-01', incomeEndDate: '2026-02-28' },
    ).incomeStatement;

    expect(income).toMatchObject({ revenueTotal: 250, cogs: 200, grossProfit: 50 });
    expect(income.revenueTree[0].children?.[0].children?.[0]).toMatchObject({ label: 'ذهب 21', amount: 250 });
    expect(income.cogsTree[0].children?.[0].children?.[0]).toMatchObject({ label: 'ذهب 21', amount: 200 });
  });

  it('keeps merchant settlement losses outside operating expenses', () => {
    const settlement = entry({
      id: 'settlement-loss', date: '2026-02-04', operationKind: 'merchant_settlement',
      debit: 'تاجر ذهب', debitAccountId: 'merchant', credit: 'الخزنة', creditAccountId: 'cash', cash: '0',
    });
    const settlementTimeline = {
      ...timeline,
      results: [
        ...timeline.results,
        {
          operationId: 'settlement-loss', classification: 'merchant_cash_settlement', entry: settlement,
          merchantSettlementLossMinor: 5800, merchantSettlementGainMinor: 0,
          incomingTotalCostMinor: 0, totalCogsMinor: 0, saleAmountMinor: 0,
          adjustmentLossMinor: 0, outgoingActualPhysicalWeightUnits: 0,
        },
      ],
    } as unknown as InventoryCostTimeline;

    const income = buildFinancialStatementsEgp(
      [opening, cashCapital, sale, settlement],
      accounts,
      { timeline: settlementTimeline, incomeStartDate: '2026-02-01', incomeEndDate: '2026-02-28' },
    ).incomeStatement;

    expect(income.operatingExpensesTotal).toBe(0);
    expect(income.otherExpensesTotal).toBe(58);
    expect(income.otherExpensesTree[0]).toMatchObject({ label: 'خسائر تسوية التزامات التجار', amount: 58 });
  });

  it('uses the same gold valuation price for inventory and merchant liabilities', () => {
    const merchantTimeline = {
      ...timeline,
      results: [
        ...timeline.results,
        {
          operationId: 'merchant-purchase', classification: 'purchase', entry: merchantPurchase,
          inventoryAccountId: 'gold', incomingWorkmanshipCostMinor: 10000,
          incomingTotalCostMinor: 10000, totalCogsMinor: 0,
          saleAmountMinor: 0, adjustmentLossMinor: 0, outgoingActualPhysicalWeightUnits: 0,
        },
      ],
      finalStates: {
        gold: {
          ...timeline.finalStates.gold,
          standardizedQuantityUnits: 1100,
          remainingTotalCostMinor: 70000,
        },
      },
    } as unknown as InventoryCostTimeline;

    const report = buildFinancialStatementsEgp(
      [opening, cashCapital, sale, rent, merchantPurchase],
      accounts,
      { timeline: merchantTimeline, balanceEndDate: '2026-12-31', goldPriceEgp: 200 },
    );

    expect(report.balanceSheet.assets.goldInventory).toBe(2200);
    expect(report.balanceSheet.liabilities).toMatchObject({
      merchantGoldWeight: 5,
      goldValuationPrice: 200,
      merchant: 1000,
      merchantCashSettlements: 100,
      other: 0,
      total: 1100,
    });
    // Actual revaluation data only:
    // inventory: 2,200 market - 700 book = 1,500
    // merchant gold debt: 1,000 market - 0 gold book value = 1,000
    // cash settlement/workmanship 100 remains in other liabilities
    // net reserve: 1,500 - 1,000 = 500
    expect(report.balanceSheet.equity.valuationReserve).toBe(500);
    expect(report.balanceSheet.assets.goldInventory / 11).toBe(report.balanceSheet.liabilities.merchant / 5);
    expect(report.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('keeps the revaluation reserve at zero when market and carrying values are identical', () => {
    const report = buildFinancialStatementsEgp([opening, cashCapital, sale, rent], accounts, {
      timeline,
      balanceEndDate: '2026-12-31',
      goldPriceEgp: 100,
    });

    expect(report.balanceSheet.assets.goldInventory).toBe(600);
    expect(report.balanceSheet.inventory[0].bookValue).toBe(600);
    expect(report.balanceSheet.liabilities.merchant).toBe(0);
    expect(report.balanceSheet.equity.valuationReserve).toBe(0);
    expect(report.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('derives profit and the trial balance from one deduplicated posting projection', () => {
    const purchase = entry({ id: 'purchase', date: '2026-02-03', operationKind: 'purchase', debit: 'ذهب 21', debitAccountId: 'gold', credit: 'تاجر ذهب', creditAccountId: 'merchant', cash: '100', weight: '2', arabicWeight: '2' });
    const merchantSettlement = entry({ id: 'merchant-settlement', date: '2026-02-04', operationKind: 'merchant_settlement', debit: 'تاجر ذهب', debitAccountId: 'merchant', credit: 'الخزنة', creditAccountId: 'cash', cash: '25' });
    const withdrawal = entry({ id: 'withdrawal', date: '2026-02-05', operationKind: 'personal_withdrawal', debit: 'Owner withdrawals', debitAccountId: 'withdrawals', credit: 'الخزنة', creditAccountId: 'cash', cash: '30' });
    const surplus = entry({ id: 'surplus', date: '2026-02-06', operationKind: 'adjustment', debit: 'ذهب 21', debitAccountId: 'gold', credit: 'Misc gain', creditAccountId: 'other-income', weight: '1', arabicWeight: '1' });
    const miscGain = entry({ id: 'misc-gain', date: '2026-02-07', operationKind: 'other', debit: 'الخزنة', debitAccountId: 'cash', credit: 'Misc gain', creditAccountId: 'other-income', cash: '40' });
    const miscGainContra = entry({ id: 'misc-gain-contra', date: '2026-02-08', operationKind: 'other', debit: 'Misc gain', debitAccountId: 'other-income', credit: 'الخزنة', creditAccountId: 'cash', cash: '10' });
    const donation = entry({ id: 'donation', date: '2026-02-09', operationKind: 'expense', debit: 'Donation', debitAccountId: 'donation', credit: 'الخزنة', creditAccountId: 'cash', cash: '20' });
    const rentContra = entry({ id: 'rent-contra', date: '2026-02-10', operationKind: 'other', debit: 'الخزنة', debitAccountId: 'cash', credit: 'إيجار', creditAccountId: 'rent', cash: '5' });
    const duplicateTimeline = {
      ...timeline,
      results: [
        ...timeline.results,
        timeline.results[1],
        { operationId: 'surplus', classification: 'surplus', entry: surplus, inventoryAccountId: 'gold', incomingTotalCostMinor: 3000, adjustmentGainMinor: 3000, adjustmentLossMinor: 0, totalCogsMinor: 0, saleAmountMinor: 0, outgoingActualPhysicalWeightUnits: 0 },
      ],
    } as unknown as InventoryCostTimeline;
    const all = [opening, cashCapital, sale, sale, purchase, merchantSettlement, withdrawal, surplus, miscGain, miscGainContra, rent, rentContra, donation];
    const baseOptions = { timeline, incomeStartDate: '2026-02-01', incomeEndDate: '2026-02-28' };
    expect(buildFinancialStatementsEgp([opening, cashCapital, sale, purchase], accounts, baseOptions).incomeStatement.netProfit).toBe(100);
    expect(buildFinancialStatementsEgp([opening, cashCapital, sale, merchantSettlement], accounts, baseOptions).incomeStatement.netProfit).toBe(100);
    expect(buildFinancialStatementsEgp([opening, cashCapital, sale, withdrawal], accounts, baseOptions).incomeStatement.netProfit).toBe(100);

    const report = buildFinancialStatementsEgp(all, accounts, {
      timeline: duplicateTimeline,
      incomeStartDate: '2026-02-01', incomeEndDate: '2026-02-28',
      balanceEndDate: '2026-02-28', goldPriceEgp: 9999,
    });
    const income = report.incomeStatement;

    expect(income).toMatchObject({ revenueTotal: 500, cogs: 400, grossProfit: 100, operatingExpensesTotal: 45, otherIncomeTotal: 60, otherExpensesTotal: 20, netProfit: 95 });
    expect(income.otherIncome.map(line => line.id)).toContain('system:income:inventory-surplus-gain');
    expect(income.otherExpenses.map(line => line.id)).toContain('account:donation');

    const trial = buildTrialBalanceReport(all, accounts, 'cash', '2026-02-01', '2026-02-28', [], { enableFinancialProjection: true, costTimeline: duplicateTimeline });
    const revenueGroup = trial.groups.find(group => group.id === 'revenue');
    const expenseGroup = trial.groups.find(group => group.id === 'expenses');
    const trialNetIncome = ((revenueGroup?.periodCredit ?? 0) - (revenueGroup?.periodDebit ?? 0)) - ((expenseGroup?.periodDebit ?? 0) - (expenseGroup?.periodCredit ?? 0));
    expect(trialNetIncome).toBe(income.netProfit);

    const revalued = buildFinancialStatementsEgp(all, accounts, {
      timeline: duplicateTimeline,
      incomeStartDate: '2026-02-01', incomeEndDate: '2026-02-28',
      balanceEndDate: '2026-02-28', goldPriceEgp: 1,
    });
    expect(revalued.incomeStatement.netProfit).toBe(income.netProfit);
  });
  it('covers fixed assets, receivables, other assets, and non-merchant metal creditors', () => {
    const coverageAccounts: Account[] = [
      { id: 'fixed', name: 'لابتوب', mainType: 'اصول', subType: 'اصول ثابتة', balanceNature: 'جنيه مصري', type: 'other', is_inventory: false, userId: 'u' },
      { id: 'debtor', name: 'شروق حبشي', mainType: 'اصول', subType: 'ذمم مدينة', balanceNature: 'جنيه مصري', type: 'other', is_inventory: false, userId: 'u' },
      { id: 'other-asset', name: 'تأمينات لدى الغير', mainType: 'اصول', subType: 'أصول أخرى', balanceNature: 'جنيه مصري', type: 'other', is_inventory: false, userId: 'u' },
      { id: 'alaa', name: 'الاء ياسر', mainType: 'خصوم', subType: 'ذمم دائنة', balanceNature: 'جرام ذهب', type: 'other', metal: 'gold', is_inventory: false, userId: 'u' },
      { id: 'coverage-capital', name: 'رأس مال التغطية', mainType: 'equity', subType: 'رأس المال', balanceNature: 'جنيه مصري', type: 'other', is_inventory: false, userId: 'u' },
    ];
    const coverageEntries = [
      entry({ id: 'fixed-opening', debit: 'لابتوب', debitAccountId: 'fixed', credit: 'رأس مال التغطية', creditAccountId: 'coverage-capital', cash: '100' }),
      entry({ id: 'debtor-opening', debit: 'شروق حبشي', debitAccountId: 'debtor', credit: 'رأس مال التغطية', creditAccountId: 'coverage-capital', cash: '50' }),
      entry({ id: 'other-opening', debit: 'تأمينات لدى الغير', debitAccountId: 'other-asset', credit: 'رأس مال التغطية', creditAccountId: 'coverage-capital', cash: '25' }),
      entry({ id: 'alaa-opening', debit: 'رأس مال التغطية', debitAccountId: 'coverage-capital', credit: 'الاء ياسر', creditAccountId: 'alaa', weight: '5', arabicWeight: '5' }),
    ];

    const report = buildFinancialStatementsEgp(coverageEntries, coverageAccounts, { goldPriceEgp: 100 });
    const fixed = report.balanceSheet.tree.assets.find(item => item.id === 'assets:fixed');
    const receivables = report.balanceSheet.tree.assets.find(item => item.id === 'assets:receivables');
    const otherAssets = report.balanceSheet.tree.assets.find(item => item.id === 'assets:other');
    const otherLiabilities = report.balanceSheet.tree.liabilities.find(item => item.id === 'liabilities:other');
    const flattenLabels = (items: typeof report.balanceSheet.tree.assets): string[] => items.flatMap(item => [item.label, ...flattenLabels(item.children ?? [])]);

    expect(flattenLabels([fixed!])).toContain('لابتوب');
    expect(flattenLabels([receivables!])).toContain('شروق حبشي');
    expect(flattenLabels([otherAssets!])).toContain('تأمينات لدى الغير');
    expect(flattenLabels([otherLiabilities!])).toContain('الاء ياسر');
    expect(otherLiabilities?.children?.flatMap(group => group.children ?? []).find(item => item.label === 'الاء ياسر')).toMatchObject({
      amount: 500,
      measure: { value: 5, unit: 'gold21' },
    });
    expect(report.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });
});
