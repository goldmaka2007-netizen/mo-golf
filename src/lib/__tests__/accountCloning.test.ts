import { describe, expect, it } from 'vitest';
import type { Account, TransactionRule } from '../../types';
import { buildAccountClonePlan, canCloneAccount } from '../accountCloning';

const inventory: Account = {
  id: 'ring', name: '???? ?????', mainType: '????', subType: '????? ???',
  canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: '???? ???',
  type: 'gold_product', metal: 'gold', karat: '18', is_inventory: true, userId: 'old-user',
};

describe('account configuration cloning', () => {
  it('creates the inventory, sales and COGS accounts without balance fields', () => {
    const rule: TransactionRule = {
      id: 'sale-rule', tx: '??? ???', debit: '??????', credit: inventory.name,
      debitAccountId: 'cash', creditAccountId: inventory.id, category: '????????', userId: 'old-user', multiplier: 1,
    };
    const plan = buildAccountClonePlan({
      source: inventory,
      newName: '???? ????? ????? 2',
      userId: 'user',
      ids: { primary: 'new-inventory', sales: 'new-sales', costOfSales: 'new-cogs' },
      existingAccounts: [inventory],
      transactionRules: [rule],
    });

    expect(plan.accounts).toHaveLength(3);
    expect(plan.accounts[0]).toMatchObject({
      id: 'new-inventory', dimensions: ['gold', 'book_value'],
      salesAccountId: 'new-sales', costOfSalesAccountId: 'new-cogs', cloneSourceAccountId: 'ring',
    });
    expect(plan.accounts[1]).toMatchObject({
      id: 'new-sales', accountRole: 'sales', linkedInventoryAccountId: 'new-inventory',
      canonicalMainType: 'revenue', dimensions: ['cash', 'gold'],
    });
    expect(plan.accounts[2]).toMatchObject({
      id: 'new-cogs', accountRole: 'cost_of_sales', linkedInventoryAccountId: 'new-inventory',
      canonicalMainType: 'expense', dimensions: ['book_value'],
    });
    expect(plan.accounts.every(account => !('balance' in account) && !('cashBalance' in account))).toBe(true);
    expect(plan.transactionRules).toEqual([expect.objectContaining({
      credit: '???? ????? ????? 2', creditAccountId: 'new-inventory', userId: 'user',
    })]);
  });

  it('clones a customer as configuration only and does not create companions', () => {
    const customer: Account = {
      id: 'customer', name: 'old customer', mainType: '????', subType: '??? ?????',
      canonicalMainType: 'assets', canonicalSubType: 'customer', balanceNature: '???? ????',
      type: 'other', is_inventory: false, userId: 'old-user',
    };
    const plan = buildAccountClonePlan({
      source: customer, newName: 'new customer', userId: 'user', ids: { primary: 'new-customer' },
      existingAccounts: [customer], transactionRules: [],
    });
    expect(plan.accounts).toHaveLength(1);
    expect(plan.accounts[0]).toMatchObject({ id: 'new-customer', dimensions: ['cash'], cloneSourceAccountId: 'customer' });
  });

  it('blocks cash, capital, retained earnings, system and revaluation accounts', () => {
    const protectedAccounts: Account[] = [
      { ...inventory, id: 'cash', name: '??????', type: 'cash', is_inventory: false },
      { ...inventory, id: 'capital', name: '??? ?????', type: 'other', is_inventory: false, canonicalMainType: 'equity', canonicalSubType: 'capital' },
      { ...inventory, id: 'retained', name: '????? ??????', type: 'other', is_inventory: false, canonicalMainType: 'equity', canonicalSubType: 'retained_earnings' },
      { ...inventory, id: 'system', name: 'System Account', type: 'other', is_inventory: false, accountRole: 'system' },
      { ...inventory, id: 'revaluation', name: '???? ????? ?????', type: 'other', is_inventory: false, accountRole: 'revaluation' },
    ];
    expect(protectedAccounts.map(account => canCloneAccount(account).allowed)).toEqual([false, false, false, false, false]);
  });
});
