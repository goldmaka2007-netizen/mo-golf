import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import { buildFinancialStatementsEgp, deriveUnitPrice } from '../financialStatementsEgp';
import { EGP_CURRENCY_LABEL, formatEgpAmount } from '../formatting';
import { toggleAccordionKey } from '../../components/views/reports/EgpIncomeStatementView';
import type { InventoryCostTimeline } from '../inventoryCostTypes';
import { buildLedgerAccountSelection, buildLedgerReport } from '../ledgerReport';

const accounts: Account[] = [
  { id: 'cash', name: '\u0627\u0644\u062e\u0632\u0646\u0629', mainType: 'asset', subType: '\u0646\u0642\u062f\u064a\u0629', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'capital', name: '\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644', mainType: 'equity', subType: '\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'gold', name: '\u062e\u0627\u062a\u0645 \u0630\u0647\u0628 21', mainType: 'asset', subType: '\u0645\u062e\u0632\u0648\u0646 \u0630\u0647\u0628', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', costOfSalesAccountId: 'gold-cogs', userId: 'u' },
  { id: 'silver', name: '\u062e\u0627\u062a\u0645 \u0641\u0636\u0629', mainType: 'asset', subType: '\u0645\u062e\u0632\u0648\u0646 \u0641\u0636\u0629', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, karat: 'silver', costOfSalesAccountId: 'silver-cogs', userId: 'u' },
  { id: 'accessory', name: '\u0639\u0644\u0628\u0629 \u0625\u0643\u0633\u0633\u0648\u0627\u0631', mainType: 'asset', subType: '\u0645\u062e\u0632\u0648\u0646 \u0645\u0644\u062d\u0642\u0627\u062a', balanceNature: 'quantity', type: 'accessory', is_inventory: true, costOfSalesAccountId: 'accessory-cogs', userId: 'u' },
  { id: 'other-revenue', name: '\u0625\u064a\u0631\u0627\u062f \u062e\u062f\u0645\u0627\u062a', mainType: 'revenue', subType: '\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0623\u062e\u0631\u0649', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'rent', name: '\u0625\u064a\u062c\u0627\u0631', mainType: 'expenses', subType: '\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u062a\u0634\u063a\u064a\u0644', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'gold-cogs', name: 'Gold item COGS', mainType: 'expenses', subType: 'COGS', balanceNature: 'book_value', type: 'other', userId: 'u' },
  { id: 'silver-cogs', name: 'Silver item COGS', mainType: 'expenses', subType: 'COGS', balanceNature: 'book_value', type: 'other', userId: 'u' },
  { id: 'accessory-cogs', name: 'Accessory item COGS', mainType: 'expenses', subType: 'COGS', balanceNature: 'book_value', type: 'other', userId: 'u' },
];
const entry = (patch: Partial<Entry>): Entry => ({ tx: '\u0639\u0645\u0644\u064a\u0629', debit: '', credit: '', date: '2026-01-01', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch });
const capitalCash = entry({ id: 'capital-cash', debit: '\u0627\u0644\u062e\u0632\u0646\u0629', debitAccountId: 'cash', credit: '\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644', creditAccountId: 'capital', cash: '1000' });
const openingGold = entry({ id: 'opening-gold', operationKind: 'opening', debit: accounts[2].name, debitAccountId: 'gold', credit: accounts[1].name, creditAccountId: 'capital', weight: '10', arabicWeight: '10' });
const openingSilver = entry({ id: 'opening-silver', operationKind: 'opening', debit: accounts[3].name, debitAccountId: 'silver', credit: accounts[1].name, creditAccountId: 'capital', weight: '10' });
const openingAccessory = entry({ id: 'opening-accessory', operationKind: 'opening', debit: accounts[4].name, debitAccountId: 'accessory', credit: accounts[1].name, creditAccountId: 'capital', weight: '5', count: '5' });
const saleGold = entry({ id: 'sale-gold', date: '2026-02-01', operationKind: 'sale', debit: accounts[0].name, debitAccountId: 'cash', credit: accounts[2].name, creditAccountId: 'gold', cash: '500', weight: '4', arabicWeight: '4' });
const saleSilver = entry({ id: 'sale-silver', date: '2026-02-02', operationKind: 'sale', debit: accounts[0].name, debitAccountId: 'cash', credit: accounts[3].name, creditAccountId: 'silver', cash: '300', weight: '6' });
const saleAccessory = entry({ id: 'sale-accessory', date: '2026-02-03', operationKind: 'sale', debit: accounts[0].name, debitAccountId: 'cash', credit: accounts[4].name, creditAccountId: 'accessory', cash: '120', weight: '2', count: '2' });
const otherRevenue = entry({ id: 'other-revenue-entry', date: '2026-02-04', debit: accounts[0].name, debitAccountId: 'cash', credit: accounts[5].name, creditAccountId: 'other-revenue', cash: '80' });
const rent = entry({ id: 'rent-entry', date: '2026-02-05', operationKind: 'expense', debit: accounts[6].name, debitAccountId: 'rent', credit: accounts[0].name, creditAccountId: 'cash', cash: '50' });
const entries = [capitalCash, openingGold, openingSilver, openingAccessory, saleGold, saleSilver, saleAccessory, otherRevenue, rent];

const result = (entryValue: Entry, classification: 'opening' | 'sale', inventoryId: string, kind: 'gold' | 'silver' | 'accessory', cogsMinor: number, standardizedUnits: number, accessoryUnits: number, incomingCost: number, physicalUnits = standardizedUnits) => ({
  operationId: entryValue.id!, classification, entry: entryValue, inventoryAccountId: inventoryId,
  sourceInventoryAccountId: classification === 'sale' ? inventoryId : undefined,
  incomingTotalCostMinor: incomingCost, outgoingTotalCostMinor: cogsMinor, totalCogsMinor: cogsMinor,
  saleAmountMinor: Math.round((Number(entryValue.cash) || 0) * 100), adjustmentLossMinor: 0, adjustmentGainMinor: 0,
  incomingStandardizedQuantityUnits: 0, outgoingStandardizedQuantityUnits: kind === 'gold' ? standardizedUnits : 0,
  incomingActualPhysicalWeightUnits: 0, outgoingActualPhysicalWeightUnits: kind === 'accessory' ? 0 : physicalUnits,
  incomingAccessoryQuantityUnits: 0, outgoingAccessoryQuantityUnits: accessoryUnits,
  incomingMetalCostMinor: 0, incomingWorkmanshipCostMinor: 0, outgoingMetalCostMinor: 0, outgoingWorkmanshipCostMinor: 0,
  metalCogsMinor: 0, workmanshipCogsMinor: 0, profitMinor: null,
});
const timeline = {
  valid: true,
  results: [
    result(openingGold, 'opening', 'gold', 'gold', 0, 0, 0, 100000),
    result(openingSilver, 'opening', 'silver', 'silver', 0, 0, 0, 50000),
    result(openingAccessory, 'opening', 'accessory', 'accessory', 0, 0, 0, 15000),
    result(saleGold, 'sale', 'gold', 'gold', 40000, 350, 0, 0, 400),
    result(saleSilver, 'sale', 'silver', 'silver', 30000, 600, 0, 0),
    result(saleAccessory, 'sale', 'accessory', 'accessory', 6000, 0, 2000, 0),
  ],
  finalStates: {
    gold: { inventoryAccountId: 'gold', displayName: accounts[2].name, kind: 'gold', standardizedQuantityUnits: 500, actualPhysicalWeightUnits: 600, accessoryQuantityUnits: 0, remainingTotalCostMinor: 60000 },
    silver: { inventoryAccountId: 'silver', displayName: accounts[3].name, kind: 'silver', standardizedQuantityUnits: 400, actualPhysicalWeightUnits: 400, accessoryQuantityUnits: 0, remainingTotalCostMinor: 20000 },
    accessory: { inventoryAccountId: 'accessory', displayName: accounts[4].name, kind: 'accessory', standardizedQuantityUnits: 0, actualPhysicalWeightUnits: 0, accessoryQuantityUnits: 3000, remainingTotalCostMinor: 9000 },
  },
} as unknown as InventoryCostTimeline;
const report = () => buildFinancialStatementsEgp(entries, accounts, { timeline, incomeStartDate: '2026-01-01', incomeEndDate: '2026-12-31', balanceEndDate: '2026-12-31' });

describe('targeted report drilldown patch', () => {
  it('uses the gold COGS debit and sold 21K-equivalent weight for item and category averages', () => {
    const income = report().incomeStatement;
    expect(income.cogsCategories.map(category => [category.id, category.amount, category.weight, category.quantity, category.unitPrice])).toEqual([
      ['gold', 400, 3.5, null, 114.29],
      ['silver', 300, 6, null, 50],
      ['accessories', 60, null, 2, 30],
    ]);
    expect(income.cogsCategories.flatMap(category => category.lines).map(line => line.id)).toEqual(['account:gold-cogs', 'account:silver-cogs', 'account:accessory-cogs']);
    expect(income.cogsCategories.find(category => category.id === 'gold')?.lines[0]).toMatchObject({ amount: 400, weight: 3.5, unitPrice: 114.29 });
    expect(income.revenueCategories.reduce((sum, category) => sum + category.amount, 0)).toBe(income.revenueTotal);
    expect(report().balanceSheet.equity.currentProfit).toBe(income.netProfit);
    expect(income.operatingExpensesTotal).toBe(50);
    expect(deriveUnitPrice(100, 0.0009)).toBeNull();
  });

  it('reports gold inventory with 21K-equivalent rather than physical weight', () => {
    const balance = report().balanceSheet;
    expect(balance.inventory.map(row => [row.accountId, row.kind, row.bookValue, row.weight, row.quantity, row.averageBookCost])).toEqual([
      ['gold', 'gold', 600, 5, null, 120],
      ['silver', 'silver', 200, 4, null, 50],
      ['accessory', 'accessory', 90, null, 3, 30],
    ]);
    for (const kind of ['gold', 'silver', 'accessory'] as const) {
      const rows = balance.inventory.filter(row => row.kind === kind);
      const summary = balance.inventoryCategories[kind];
      expect(rows.reduce((sum, row) => sum + row.bookValue, 0)).toBe(summary.bookValue);
      expect(rows.reduce((sum, row) => sum + (row.weight ?? row.quantity ?? 0), 0)).toBe(summary.weight ?? summary.quantity);
      expect(summary.averageBookCost).toBe(deriveUnitPrice(summary.bookValue, summary.weight ?? summary.quantity));
    }
    expect(balance.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('reconciles every supported COGS leg with no unallocated amount and preserves controls', () => {
    const statements = report();
    const income = statements.incomeStatement;
    expect(income.cogsCategories.some(category => category.id === 'other')).toBe(false);
    expect(income.cogsCategories.reduce((sum, category) => sum + category.amount, 0)).toBe(income.cogs);
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
    expect(statements.balanceSheet.equity.currentProfit).toBe(income.netProfit);
    expect(toggleAccordionKey(null, 'gold')).toBe('gold');
    expect(toggleAccordionKey('gold', 'silver')).toBe('silver');
    expect(toggleAccordionKey('silver', 'silver')).toBeNull();
    const registry = buildAccountRegistry(accounts, entries);
    const inventoryId = report().balanceSheet.inventory[0].accountId;
    const selectableIds = buildLedgerAccountSelection(registry.expandedAccounts).flatMap(group => group.accounts.map(item => item.account.id));
    expect(selectableIds).toContain(inventoryId);
    const inventory = registry.expandedAccounts.find(account => account.id === inventoryId)!;
    const ledger = buildLedgerReport(entries, registry.expandedAccounts, inventory, 'book_value', '2026-01-01', '2026-12-31', [], { enableFinancialProjection: true, costTimeline: timeline });
    expect(ledger.rows.map(row => row.entry.id)).toEqual(['sale-gold']);
    expect(ledger.closingBalance).toBe(600);
    const cogsAccountId = report().incomeStatement.cogsCategories[0].lines[0].accountId!;
    expect(cogsAccountId).toBe('gold-cogs');
    const cogsAccount = registry.expandedAccounts.find(account => account.id === cogsAccountId)!;
    const cogsLedger = buildLedgerReport(entries, registry.expandedAccounts, cogsAccount, 'book_value', '2026-01-01', '2026-12-31', [], { enableFinancialProjection: true, costTimeline: timeline });
    expect(cogsLedger.rows.map(row => row.entry.id)).toEqual(['sale-gold']);
  });

  it('renders the central Arabic currency label without escaped Unicode text', () => {
    expect(EGP_CURRENCY_LABEL).toBe('\u062c.\u0645');
    expect(formatEgpAmount(1250)).toContain('\u062c.\u0645');
    expect(formatEgpAmount(1250)).not.toMatch(/(?:\\u|u)062c|(?:\\u|u)0645/);
  });
});
