import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import { validateAccountingPolicy } from '../accountingPolicy';
import { buildCanonicalPosting } from '../postingMatrix';

const account = (patch: Partial<Account>): Account => ({ id: 'x', name: 'account', mainType: 'asset', subType: 'other', balanceNature: 'cash', type: 'other', userId: 'u', ...patch });
const accounts: Account[] = [
  account({ id: 'cash', name: 'cash', type: 'cash' }),
  account({ id: 'customer', name: 'customer', canonicalSubType: 'customer' }),
  account({ id: 'gold', name: 'gold', type: 'gold_raw', metal: 'gold', is_inventory: true, balanceNature: 'gold' }),
  account({ id: 'silver', name: 'silver', type: 'silver', metal: 'silver', is_inventory: true, balanceNature: 'silver' }),
  account({ id: 'accessory', name: 'accessory', type: 'accessory', is_inventory: true, balanceNature: 'quantity', quantityStep: 1 }),
  account({ id: 'gold-merchant', name: 'gold merchant', mainType: 'liability', type: 'merchant', metal: 'gold', balanceNature: 'gold' }),
  account({ id: 'silver-merchant', name: 'silver merchant', mainType: 'liability', type: 'merchant', metal: 'silver', balanceNature: 'silver' }),
];
const entry = (patch: Partial<Entry>): Entry => ({ id: 'e', seq: 1, tx: 'operation', operationKind: 'other', debit: '', credit: '', date: '2026-06-16', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });
const registry = buildAccountRegistry(accounts);
const scenarios: Array<[string, Partial<Entry>, string[]]> = [
  ['gold cash purchase', { operationKind: 'purchase', debit: 'gold', debitAccountId: 'gold', credit: 'cash', creditAccountId: 'cash', cash: '1000', weight: '2', arabicWeight: '2', count: '1' }, ['cash', 'gold']],
  ['gold credit purchase', { operationKind: 'purchase', debit: 'gold', debitAccountId: 'gold', credit: 'gold merchant', creditAccountId: 'gold-merchant', cash: '1000', weight: '2', arabicWeight: '2', count: '1', marketPrice: 4000 }, ['cash', 'gold']],
  ['silver cash purchase', { operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', cash: '800', weight: '4', count: '2' }, ['cash', 'silver']],
  ['silver credit purchase', { operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'silver merchant', creditAccountId: 'silver-merchant', cash: '800', weight: '4', count: '2' }, ['cash', 'silver']],
  ['accessory cash purchase', { operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', cash: '300', weight: '3', count: '3' }, ['cash', 'quantity']],
  ['gold cash sale', { operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', cash: '1200', weight: '1', arabicWeight: '1', count: '1' }, ['cash', 'gold']],
  ['gold credit sale', { operationKind: 'sale', debit: 'customer', debitAccountId: 'customer', credit: 'gold', creditAccountId: 'gold', cash: '1200', weight: '1', arabicWeight: '1', count: '1' }, ['cash', 'gold']],
  ['silver sale', { operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', cash: '900', weight: '2', count: '1' }, ['cash', 'silver']],
  ['accessory sale', { operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'accessory', creditAccountId: 'accessory', cash: '200', weight: '2', count: '2' }, ['cash', 'quantity']],
  ['customer receipt', { operationKind: 'other', debit: 'cash', debitAccountId: 'cash', credit: 'customer', creditAccountId: 'customer', cash: '500' }, ['cash']],
  ['merchant payment', { operationKind: 'merchant_settlement', debit: 'gold merchant', debitAccountId: 'gold-merchant', credit: 'cash', creditAccountId: 'cash', cash: '500' }, ['cash']],
];

describe('supported invoice and settlement dimension matrix', () => {
  it.each(scenarios)('%s emits only its owned dimensions', (_name, patch, expected) => {
    const row = entry(patch);
    const posting = buildCanonicalPosting(row, registry);
    expect(posting.valid, JSON.stringify(posting.issues)).toBe(true);
    expect(posting.dimensions).toEqual(expected);
    expect(posting.dimensions).not.toContain(expected.includes('quantity') ? 'gold' : 'quantity');
    expect(validateAccountingPolicy(row, accounts).map(issue => issue.code)).not.toContain('invalid_account_dimension');
  });

  it('keeps genuine validation active for a forbidden settlement quantity', () => {
    const posting = buildCanonicalPosting(entry({ operationKind: 'merchant_settlement', debit: 'gold merchant', debitAccountId: 'gold-merchant', credit: 'accessory', creditAccountId: 'accessory', count: '2' }), registry);
    expect(posting.valid).toBe(false);
    expect(posting.issues.map(issue => issue.code)).toContain('dimension_forbidden');
  });
});
