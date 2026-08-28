import { describe, expect, it } from 'vitest';
import type { Account, TransactionRule } from '../../types';
import { findSafeAddUseCandidate, hasEffectiveDuplicate, isProtectedAccountForUses, resolveAccountUses } from '../accountUses';

const customer: Account = { id: 'customer', name: 'Customer', mainType: 'assets', subType: 'customer', canonicalSubType: 'customer', balanceNature: 'debit', userId: 'u', type: 'other', metal: null, is_inventory: false };
const cash: Account = { id: 'cash', name: 'Cash', mainType: 'assets', subType: 'cash', canonicalSubType: 'cash', balanceNature: 'debit', userId: 'u', type: 'cash', metal: null, is_inventory: false };
const rules: TransactionRule[] = [{ id: 'r1', tx: 'Collection', debit: cash.name, credit: customer.name, debitAccountId: cash.id, creditAccountId: customer.id, category: 'x', userId: 'u', multiplier: 1 }];

describe('account use safety helpers', () => {
  it('resolves explicit IDs and legacy labels, with explicit IDs taking precedence', () => {
    expect(resolveAccountUses(customer, rules)).toHaveLength(1);
    expect(resolveAccountUses({ ...customer, id: 'new' }, [{ ...rules[0], creditAccountId: undefined }])).toHaveLength(1);
    expect(resolveAccountUses(customer, [{ ...rules[0], creditAccountId: 'different-account' }])).toHaveLength(0);
  });
  it('protects cash and inventory accounts', () => {
    expect(isProtectedAccountForUses(cash)).toBe(true);
    expect(isProtectedAccountForUses({ ...customer, is_inventory: true, type: 'gold_product' })).toBe(true);
  });
  it('accepts a proven pattern and rejects ambiguity or unresolved counterparts', () => {
    expect(findSafeAddUseCandidate({ ...customer, id: 'customer2', name: 'Customer 2' }, 'Collection', rules, [cash, customer])).toMatchObject({ side: 'credit', counterpartAccountId: 'cash' });
    expect(findSafeAddUseCandidate(customer, 'Missing', rules, [cash, customer])).toBeNull();
    expect(findSafeAddUseCandidate(customer, 'Collection', [...rules, { ...rules[0], id: 'r2', debit: 'Other', credit: cash.name, debitAccountId: 'other-customer', creditAccountId: cash.id }], [cash, customer, { ...customer, id: 'other-customer', name: 'Other' }])).toBeNull();
    expect(findSafeAddUseCandidate({ ...customer, id: 'customer2' }, 'Collection', [{ ...rules[0], creditAccountId: undefined, credit: 'Unknown' }], [cash, customer])).toBeNull();
    expect(findSafeAddUseCandidate({ ...customer, id: 'customer2' }, 'Collection', [{ ...rules[0], creditAccountId: undefined, credit: customer.name }], [cash, customer, { ...customer, id: 'customer-2', name: customer.name }])).toBeNull();
  });
  it('deduplicates effective identity', () => expect(hasEffectiveDuplicate({ ...rules[0], id: undefined }, rules, [cash, customer])).toBe(true));
});
