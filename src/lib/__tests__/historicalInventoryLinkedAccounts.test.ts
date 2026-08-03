import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import { exposeInventoryLinkedAccounts } from '../inventoryAccountLinkage';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildLedgerAccountSelection, buildLedgerReport } from '../ledgerReport';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';

const itemName = '\u062e\u0627\u062a\u0645 \u062d\u0631\u064a\u0645\u064a';
const inventoryDisplayName = `${itemName} \u2014 \u0645\u062e\u0632\u0648\u0646`;
const salesName = `\u0645\u0628\u064a\u0639\u0627\u062a ${itemName}`;
const cogsName = `\u062a\u0643\u0644\u0641\u0629 \u0645\u0628\u064a\u0639\u0627\u062a ${itemName}`;

const cash: Account = { id: 'cash', name: 'Cash', mainType: 'asset', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, userId: 'u' };
const inventory: Account = { id: 'ring', name: itemName, mainType: 'asset', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_product', metal: 'gold', karat: '21', is_inventory: true, userId: 'u' };
const capital: Account = { id: 'capital', name: 'Capital', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' };
const accounts = [cash, inventory, capital];
const entry = (patch: Partial<Entry>): Entry => ({ id: 'entry', seq: 1, tx: 'entry', operationKind: 'other', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });
const opening = entry({ id: 'opening', operationKind: 'opening', debit: inventory.name, debitAccountId: inventory.id, credit: capital.name, creditAccountId: capital.id, weight: '10', arabicWeight: '10', karat: 21 });
const sale = entry({ id: 'sale', seq: 2, date: '2026-01-02', operationKind: 'sale', debit: cash.name, debitAccountId: cash.id, credit: inventory.name, creditAccountId: inventory.id, cash: '200', weight: '1', arabicWeight: '1', karat: 21 });
const entries = [opening, sale];
const timeline = rebuildInventoryCostTimeline(entries, accounts, { gold21PriceByYearMinor: { '2026': 10000 } }, { bindings: [{ inventoryAccountId: 'ring', taxonomyKey: 'gold.product.ring_arabic' }] });

const projected = () => buildLegacyLedgerLegs(entries, accounts, [], { enableFinancialProjection: true, costTimeline: timeline });

const realCompanion = (role: 'sales' | 'cost_of_sales', id: string): Account => ({
  id, name: role === 'sales' ? salesName : cogsName, mainType: role === 'sales' ? 'revenue' : 'expense',
  subType: role === 'sales' ? 'revenue' : 'expense', canonicalMainType: role === 'sales' ? 'revenue' : 'expense',
  canonicalSubType: role === 'sales' ? 'revenue' : 'expense', balanceNature: role === 'sales' ? 'cash' : 'book value',
  type: 'other', is_inventory: false, userId: 'u', accountRole: role, linkedInventoryAccountId: inventory.id,
});

describe('historical inventory three-account compatibility', () => {
  it('exposes three accounts and posts historical sale and COGS outside inventory', () => {
    expect(timeline.valid).toBe(true);
    const before = JSON.stringify(accounts);
    const linked = exposeInventoryLinkedAccounts(accounts);
    expect(linked.filter(account => account.id === 'ring' || account.linkedInventoryAccountId === 'ring').map(account => [account.id, account.accountRole, account.name])).toEqual([
      ['ring', 'inventory', itemName],
      ['ring::sales', 'sales', salesName],
      ['ring::cogs', 'cost_of_sales', cogsName],
    ]);
    expect(JSON.stringify(accounts)).toBe(before);

    const saleLegs = projected().filter(leg => leg.sourceEntryId === 'sale');
    expect(saleLegs.filter(leg => leg.entityId === 'product:ring' && (leg.dimension === 'cash' || leg.group === 'revenue' || leg.group === 'expenses'))).toHaveLength(0);
    expect(saleLegs).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: 'account:ring::sales', accountName: salesName, dimension: 'cash', side: 'credit', amount: 200 }),
      expect.objectContaining({ entityId: 'account:ring::sales', accountName: salesName, dimension: 'gold', side: 'debit', amount: 1 }),
      expect.objectContaining({ entityId: 'account:ring::cogs', accountName: cogsName, dimension: 'book_value', side: 'debit', amount: 100 }),
      expect.objectContaining({ entityId: 'product:ring', accountName: inventoryDisplayName, dimension: 'book_value', side: 'credit', amount: 100 }),
    ]));
    expect(saleLegs.some(leg => leg.entityId.startsWith('system:income:sales-revenue:') || leg.entityId.startsWith('system:income:cogs:'))).toBe(false);

    const existingSales = realCompanion('sales', 'real-sales');
    const withoutDuplicates = exposeInventoryLinkedAccounts([{ ...inventory, salesAccountId: existingSales.id }, existingSales, cash, capital]);
    expect(withoutDuplicates.filter(account => account.accountRole === 'sales' && account.linkedInventoryAccountId === 'ring')).toHaveLength(1);
    expect(withoutDuplicates.some(account => account.id === 'ring::sales')).toBe(false);
  });

  it('shows all three as independently openable Ledger and Trial Balance rows while financial totals balance', () => {
    const selections = buildLedgerAccountSelection(accounts).flatMap(group => group.accounts);
    const selected = selections.filter(row => [inventoryDisplayName, salesName, cogsName].includes(row.displayName));
    expect(selected.map(row => row.displayName).sort()).toEqual([inventoryDisplayName, salesName, cogsName].sort());
    const dimensions = new Map<string, 'cash' | 'book_value'>([[inventoryDisplayName, 'book_value'], [salesName, 'cash'], [cogsName, 'book_value']]);
    selected.forEach(row => expect(buildLedgerReport(entries, accounts, row.account, dimensions.get(row.displayName)!, '2026-01-01', '2026-12-31', [], { costTimeline: timeline }).rows.length).toBeGreaterThan(0));

    const trial = buildUnifiedTrialBalance(entries, accounts, '2026-01-01', '2026-12-31', { timeline });
    expect(trial.rows.filter(row => [inventoryDisplayName, salesName, cogsName].includes(row.accountName)).map(row => row.accountName).sort()).toEqual([inventoryDisplayName, salesName, cogsName].sort());
    expect(trial.financialBalanced).toBe(true);
    expect(trial.financialDebit).toBe(trial.financialCredit);
  });

  it('maps inventory to assets, sales to revenue and COGS to cost of sales without changing profit or the balance equation', () => {
    const registry = buildAccountRegistry(accounts, entries);
    expect(registry.bySourceAccountId.get('ring')).toMatchObject({ mainGroup: 'assets', reportParticipation: expect.arrayContaining(['financialPosition']) });
    expect(registry.bySourceAccountId.get('ring::sales')).toMatchObject({ mainGroup: 'revenue', reportParticipation: expect.arrayContaining(['incomeStatement']) });
    expect(registry.bySourceAccountId.get('ring::cogs')).toMatchObject({ mainGroup: 'expenses', reportParticipation: expect.arrayContaining(['incomeStatement']) });

    const derived = buildFinancialStatementsEgp(entries, accounts, { timeline, balanceEndDate: '2026-12-31' });
    const realAccounts = [
      { ...inventory, salesAccountId: 'real-sales', costOfSalesAccountId: 'real-cogs' },
      realCompanion('sales', 'real-sales'), realCompanion('cost_of_sales', 'real-cogs'), cash, capital,
    ];
    const real = buildFinancialStatementsEgp(entries, realAccounts, { timeline, balanceEndDate: '2026-12-31' });
    expect(derived.incomeStatement).toMatchObject({ revenueTotal: 200, cogs: 100, grossProfit: 100, netProfit: 100 });
    expect(derived.incomeStatement.revenue).toEqual([expect.objectContaining({ id: 'account:ring::sales', label: salesName, amount: 200 })]);
    expect(derived.balanceSheet.assets.goldInventory).toBe(900);
    expect(derived.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
    expect(derived.incomeStatement.netProfit).toBe(real.incomeStatement.netProfit);
    expect(derived.balanceSheet.assets.total).toBe(real.balanceSheet.assets.total);
  });
});
