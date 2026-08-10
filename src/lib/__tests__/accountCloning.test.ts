import { describe, expect, it } from 'vitest';
import type { Account, TransactionRule } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import {
  accountCloneDocumentId,
  buildAccountClonePlan,
  canCloneAccount,
  normalizeCloneAccountName,
} from '../accountCloning';
import { buildAccountRegistry } from '../accountRegistry';
import { getLedgerAccountGroupId } from '../ledgerReport';
import { resolveRuntimeCostAccountInputs } from '../runtimeCostAccountResolver';

const accountFromSeed = (name: string, id: string): Account => ({
  ...SEED_ACCOUNTS.find(account => account.name === name)!,
  id,
  userId: 'user',
  isActive: true,
});

const inventory = accountFromSeed('خاتم حريمي', 'ring');
const treasury = accountFromSeed('الخزنة', 'cash');
const customer = accountFromSeed('شروق حبشي', 'customer');
const merchant = accountFromSeed('محمد السيد', 'merchant');

const rules: TransactionRule[] = [
  { id: 'sale', tx: 'بيع ذهب', debit: treasury.name, credit: inventory.name, debitAccountId: treasury.id, creditAccountId: inventory.id, karat: 18, multiplier: 0.857142857, category: 'المبيعات', userId: 'user' },
  { id: 'customer-sale', tx: 'بيع آجل', debit: customer.name, credit: inventory.name, debitAccountId: customer.id, creditAccountId: inventory.id, karat: 18, multiplier: 0.857142857, category: 'المبيعات', userId: 'user' },
  { id: 'merchant-receipt', tx: 'تاجر ذهب', debit: inventory.name, credit: merchant.name, debitAccountId: inventory.id, creditAccountId: merchant.id, karat: 18, multiplier: 0.857142857, category: 'التجار', userId: 'user' },
];

const accounts = [inventory, treasury, customer, merchant];

const planFor = (source: Account, name: string, existingAccounts = accounts) => buildAccountClonePlan({
  source,
  newName: name,
  userId: 'user',
  ids: { primary: accountCloneDocumentId('user', name) },
  existingAccounts,
  transactionRules: rules,
});

describe('operational account clone planning', () => {
  it('models a product as one stored entity and reuses derived Sales/COGS linkage', () => {
    const sourceBefore = structuredClone(inventory);
    const plan = planFor(inventory, 'كوليه');

    expect(plan.account).toMatchObject({
      name: 'كوليه',
      type: 'gold_product',
      metal: 'gold',
      karat: '18',
      is_inventory: true,
      canonicalMainType: 'assets',
      canonicalSubType: 'inventory_gold',
      dimensions: ['gold', 'book_value'],
      accountRole: 'inventory',
      cloneSourceAccountId: 'ring',
    });
    expect(plan.account).not.toHaveProperty('salesAccountId');
    expect(plan.account).not.toHaveProperty('costOfSalesAccountId');
    expect(plan.account).not.toHaveProperty('balance');
    expect(plan.account).not.toHaveProperty('costBasis');
    expect(inventory).toEqual(sourceBefore);
    expect(resolveRuntimeCostAccountInputs([], [...accounts, plan.account]).errors).toEqual([]);
  });

  it('keeps second-generation inventory clones on the authoritative root Cost taxonomy', () => {
    const first = planFor(inventory, 'كوليه').account;
    const firstRule: TransactionRule = {
      id: 'first-sale', tx: 'بيع ذهب', debit: treasury.name, credit: first.name,
      debitAccountId: treasury.id, creditAccountId: first.id, karat: 18,
      multiplier: 0.857142857, category: 'المبيعات', userId: 'user',
    };
    const second = buildAccountClonePlan({
      source: first,
      newName: 'سلسلة جديدة',
      userId: 'user',
      ids: { primary: accountCloneDocumentId('user', 'سلسلة جديدة') },
      existingAccounts: [inventory, treasury, first],
      transactionRules: [firstRule],
    }).account;
    expect(first.cloneSourceAccountId).toBe(inventory.id);
    expect(second.cloneSourceAccountId).toBe(inventory.id);
    expect(resolveRuntimeCostAccountInputs([], [second, first, treasury, inventory]).errors).toEqual([]);
  });

  it('creates an independent customer with complete canonical classification and zero/empty state', () => {
    const plan = planFor(customer, 'أحمد');
    expect(plan.account).toMatchObject({
      name: 'أحمد',
      canonicalMainType: 'assets',
      canonicalSubType: 'customer',
      dimensions: ['cash'],
      accountRole: 'standard',
      cloneSourceAccountId: 'customer',
    });
    expect(plan.account.id).not.toBe(customer.id);
    expect(getLedgerAccountGroupId(plan.account)).toBe('customer');
    expect(Object.keys(plan.account)).not.toEqual(expect.arrayContaining(['balance', 'cashBalance', 'weightBalance', 'wac', 'history']));

    const registration = buildAccountRegistry([...accounts, plan.account]);
    expect(registration.resolve(plan.account.id, plan.account.name)).toMatchObject({
      status: 'resolved',
      account: { sourceAccountId: plan.account.id, mainGroup: 'assets' },
    });
  });

  it('resets merchant runtime state while inheriting metal and operation behavior', () => {
    const plan = planFor(merchant, 'تاجر مستقل');
    expect(plan.account).toMatchObject({
      type: 'merchant',
      metal: 'gold',
      merchantDirection: 'payable',
      canonicalSubType: 'merchant_gold',
      dimensions: ['gold', 'book_value', 'cash'],
    });
    expect(plan.account).not.toHaveProperty('signedBalance');
    expect(plan.account).not.toHaveProperty('carryingValue');
    expect(plan.account).not.toHaveProperty('wac');
    expect(plan.transactionRules).toEqual([expect.objectContaining({
      tx: 'تاجر ذهب',
      credit: 'تاجر مستقل',
      creditAccountId: plan.account.id,
    })]);
  });

  it('inherits every effective source rule with new stable identity references', () => {
    const plan = planFor(inventory, 'كوليه');
    expect(plan.transactionRules).toHaveLength(3);
    expect(plan.transactionRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ tx: 'بيع ذهب', credit: 'كوليه', creditAccountId: plan.account.id }),
      expect.objectContaining({ tx: 'بيع آجل', credit: 'كوليه', creditAccountId: plan.account.id }),
      expect.objectContaining({ tx: 'تاجر ذهب', debit: 'كوليه', debitAccountId: plan.account.id }),
    ]));
    expect(plan.transactionRules.every(rule => rule.userId === 'user' && !!rule.id)).toBe(true);
  });

  it('rejects legacy, unclassified, inactive, cash, equity and derived sources', () => {
    const legacy = { ...customer, id: 'legacy', type: undefined };
    const unclassified: Account = { ...customer, id: 'unknown', canonicalSubType: 'unclassified', subType: 'غامض' };
    const inactive = { ...customer, id: 'inactive', isActive: false };
    const equity = accountFromSeed('راس المال نقدا', 'capital');
    const derived = { ...customer, id: 'derived', accountRole: 'cost_of_sales' as const };
    const context = { accounts: [...accounts, legacy, unclassified, inactive, equity, derived], transactionRules: rules };
    expect([legacy, unclassified, inactive, treasury, equity, derived].map(source => canCloneAccount(source, context).allowed)).toEqual([false, false, false, false, false, false]);
  });

  it('prevents active/archived duplicates with conservative normalization', () => {
    const archived = { ...customer, id: 'archived', name: 'Existing Name', isActive: false };
    expect(() => planFor(customer, '  existing   name ', [...accounts, archived])).toThrow(/مستخدم بالفعل/);
    expect(normalizeCloneAccountName('أحمد')).not.toBe(normalizeCloneAccountName('احمد'));
    expect(() => planFor(customer, 'احمد')).not.toThrow();
  });

  it('uses one collision-free reservation ID for concurrent equivalent names', () => {
    expect(accountCloneDocumentId('user', '  New   Customer ')).toBe(accountCloneDocumentId('user', 'new customer'));
    expect(accountCloneDocumentId('user', 'أحمد')).not.toBe(accountCloneDocumentId('user', 'احمد'));
    expect(accountCloneDocumentId('user-a', 'أحمد')).not.toBe(accountCloneDocumentId('user-b', 'أحمد'));
  });
});
