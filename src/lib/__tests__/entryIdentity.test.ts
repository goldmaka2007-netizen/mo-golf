import { describe, expect, it } from 'vitest';
import { OPERATION_RULES } from '../../constants';
import { Account, Entry } from '../../types';
import { resolveEntryIdentity } from '../entryIdentity';

const saleTx = Object.entries(OPERATION_RULES).find(([, rule]) => rule.isSale)?.[0] || 'sale';
const accounts: Account[] = [
  { id: 'cash-id', name: 'cash', mainType: 'asset', subType: '', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold-ring-id', name: 'gold-ring', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
];
const base = (overrides: Partial<Entry> = {}): Entry => ({ seq: 1, tx: saleTx, debit: 'cash', credit: 'gold-ring', debitAccountId: 'cash-id', creditAccountId: 'gold-ring-id', date: '2026-07-22', cash: '1000', weight: '1', arabicWeight: '1', count: '0', notes: '', userId: 'u', ...overrides });

describe('resolveEntryIdentity', () => {
  it('pins a gold sale to sale and the selected account IDs while retaining names', () => {
    const entry = base();
    expect(resolveEntryIdentity(entry, accounts)).toEqual({ ok: true, value: { operationKind: 'sale', debitAccountId: 'cash-id', creditAccountId: 'gold-ring-id' } });
    expect(entry).toMatchObject({ debit: 'cash', credit: 'gold-ring', tx: saleTx });
  });
  it('rejects a legacy name-only write until explicit operational IDs are selected', () => {
    const oldEntry = base({ id: 'legacy-entry', debitAccountId: undefined, creditAccountId: undefined });
    expect(resolveEntryIdentity(oldEntry, accounts)).toMatchObject({ ok: false });
  });
  it('rejects a write when a selected account cannot be resolved', () => {
    expect(resolveEntryIdentity(base({ debitAccountId: 'missing' }), accounts)).toEqual(expect.objectContaining({ ok: false, message: expect.stringContaining('\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062F \u0645\u0639\u0631\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0646') }));
  });
});