import { describe, expect, it } from 'vitest';
import type { Account, TransactionRule } from '../../types';
import { findSafeAddUseCandidate, hasEffectiveDuplicate, isProtectedAccountForUses, resolveAccountUses } from '../accountUses';

const customer: Account = { id: 'customer', name: 'عميل', mainType: 'assets', subType: 'customer', canonicalSubType: 'customer', balanceNature: 'debit', userId: 'u', type: 'other', metal: null, is_inventory: false };
const cash: Account = { id: 'cash', name: 'الخزنة', mainType: 'assets', subType: 'cash', canonicalSubType: 'cash', balanceNature: 'debit', userId: 'u', type: 'cash', metal: null, is_inventory: false };
const rules: TransactionRule[] = [{ id: 'r1', tx: 'تحصيل عميل', debit: cash.name, credit: customer.name, debitAccountId: cash.id, creditAccountId: customer.id, category: 'x', userId: 'u', multiplier: 1 }];

describe('account use safety helpers', () => {
  it('resolves explicit IDs and legacy labels', () => {
    expect(resolveAccountUses(customer, rules)).toHaveLength(1);
    expect(resolveAccountUses({ ...customer, id: 'new' }, [{ ...rules[0], creditAccountId: undefined }])).toHaveLength(1);
  });
  it('protects cash and inventory accounts', () => {
    expect(isProtectedAccountForUses(cash)).toBe(true);
    expect(isProtectedAccountForUses({ ...customer, is_inventory: true, type: 'gold_product' })).toBe(true);
  });
  it('accepts a proven pattern and rejects ambiguity', () => {
    expect(findSafeAddUseCandidate({ ...customer, id: 'customer2', name: 'عميل 2' }, 'تحصيل عميل', rules, [cash, customer])).toMatchObject({ side: 'credit', counterpartAccountId: 'cash' });
    expect(findSafeAddUseCandidate(customer, 'غير موجود', rules, [cash, customer])).toBeNull();
    expect(findSafeAddUseCandidate(customer, 'تحصيل عميل', [...rules, { ...rules[0], id: 'r2', debit: 'عميل آخر', credit: cash.name, debitAccountId: 'other-customer', creditAccountId: cash.id }], [cash, customer, { ...customer, id: 'other-customer', name: 'عميل آخر' }])).toBeNull();
  });
  it('deduplicates effective identity', () => expect(hasEffectiveDuplicate({ ...rules[0], id: undefined }, rules, [cash, customer])).toBe(true));
});
