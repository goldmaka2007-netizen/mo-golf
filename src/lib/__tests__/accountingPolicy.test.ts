import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { validateAccountingPolicy } from '../accountingPolicy';

const accounts: Account[] = [
  { id: 'cash', name: '??????', mainType: '????', subType: '?????', balanceNature: '???? ????', type: 'cash', is_inventory: false, userId: 'u' },
  { id: 'finished', name: '????', mainType: '????', subType: '????? ???', balanceNature: '???? ???', type: 'gold_product', metal: 'gold', is_inventory: true, userId: 'u' },
  { id: 'scrap', name: '??? ????', mainType: '????', subType: '????? ???', balanceNature: '???? ???', type: 'gold_raw', metal: 'gold', is_inventory: true, userId: 'u' },
  { id: 'merchant', name: '????', mainType: '????', subType: '???? ???', balanceNature: '???? ???', type: 'merchant', metal: 'gold', is_inventory: false, userId: 'u' },
];

const entry = (values: Partial<Entry>): Partial<Entry> => ({
  tx: '', debit: '', credit: '', date: '2026-01-01', cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...values,
});

describe('invoice accounting policy', () => {
  it('blocks direct purchase of finished gold but allows the approved raw categories', () => {
    const finished = validateAccountingPolicy(entry({
      operationKind: 'purchase', debit: '????', debitAccountId: 'finished', credit: '??????', creditAccountId: 'cash', cash: '1000', weight: '2', arabicWeight: '2',
    }), accounts);
    const scrap = validateAccountingPolicy(entry({
      operationKind: 'purchase', debit: '??? ????', debitAccountId: 'scrap', credit: '??????', creditAccountId: 'cash', cash: '1000', weight: '2', arabicWeight: '2',
    }), accounts);
    expect(finished.map(issue => issue.code)).toContain('finished_gold_direct_purchase');
    expect(scrap.map(issue => issue.code)).not.toContain('finished_gold_direct_purchase');
  });

  it('requires the immutable invoice gold price for a trader receipt', () => {
    const missing = validateAccountingPolicy(entry({
      operationKind: 'other', debit: '????', debitAccountId: 'finished', credit: '????', creditAccountId: 'merchant', cash: '100', weight: '2', arabicWeight: '2',
    }), accounts);
    const priced = validateAccountingPolicy(entry({
      operationKind: 'other', debit: '????', debitAccountId: 'finished', credit: '????', creditAccountId: 'merchant', cash: '100', weight: '2', arabicWeight: '2', marketPrice: 4200,
    }), accounts);
    expect(missing.map(issue => issue.code)).toContain('trader_invoice_price_missing');
    expect(priced.map(issue => issue.code)).not.toContain('trader_invoice_price_missing');
  });

  it('does not project a generic metal piece count as accessories quantity', () => {
    const issues = validateAccountingPolicy(entry({
      operationKind: 'expense', debit: '??????', debitAccountId: 'cash', credit: '????', creditAccountId: 'merchant', cash: '100', count: '1',
    }), accounts);
    expect(issues.map(issue => issue.code)).not.toContain('invalid_account_dimension');
  });
});
