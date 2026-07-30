import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import { buildCanonicalPosting } from '../postingMatrix';

const account = (patch: Partial<Account>): Account => ({
  id: 'account', name: 'Account', mainType: 'asset', subType: '',
  balanceNature: 'value', type: 'other', userId: 'user', ...patch,
});

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: 'purchase', operationKind: 'purchase',
  debit: '', credit: '', date: '2026-07-29', cash: '0', weight: '0',
  arabicWeight: '0', count: '0', notes: '', userId: 'user', ...patch,
});

describe('Posting Matrix invoice piece counts', () => {
  it('keeps metal invoice count operational instead of posting accessory quantity', () => {
    const gold = account({
      id: 'gold', name: 'Gold inventory', type: 'gold_product', metal: 'gold',
      is_inventory: true, karat: '21', balanceNature: 'gold',
    });
    const merchant = account({
      id: 'merchant', name: 'Gold merchant', mainType: 'liability',
      type: 'merchant', metal: 'gold', balanceNature: 'gold',
    });
    const row = entry({
      debit: gold.name, debitAccountId: gold.id,
      credit: merchant.name, creditAccountId: merchant.id,
      weight: '10', arabicWeight: '10', count: '3',
    });

    const posting = buildCanonicalPosting(row, buildAccountRegistry([gold, merchant], [row]));

    expect(posting.valid).toBe(true);
    expect(posting.dimensions).toEqual(['gold']);
    expect(posting.values.quantity).toBe(0);
    expect(posting.issues.map(issue => issue.code)).not.toContain('dimension_unsupported');
  });

  it('continues posting accessory quantities from the legacy weight field', () => {
    const accessory = account({
      id: 'accessory', name: 'Accessory inventory', type: 'accessory',
      is_inventory: true, quantityStep: 1,
    });
    const cash = account({ id: 'cash', name: 'Cash', type: 'cash' });
    const row = entry({
      debit: accessory.name, debitAccountId: accessory.id,
      credit: cash.name, creditAccountId: cash.id,
      cash: '100', weight: '5', count: '0',
    });

    const posting = buildCanonicalPosting(row, buildAccountRegistry([accessory, cash], [row]));

    expect(posting.valid).toBe(true);
    expect(posting.dimensions).toEqual(['cash', 'quantity']);
    expect(posting.values.quantity).toBe(5);
  });
});
