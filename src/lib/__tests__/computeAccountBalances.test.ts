import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { computeAccountBalances } from '../engine';

const account = (overrides: Partial<Account>): Account => ({
  id: 'account',
  name: 'account',
  mainType: 'legacy',
  subType: 'legacy',
  balanceNature: 'legacy',
  userId: 'test-user',
  is_inventory: false,
  metal: null,
  ...overrides,
});

const cash = account({
  id: 'cash',
  name: 'cash',
  type: 'cash',
  canonicalMainType: 'assets',
  canonicalSubType: 'cash',
});
const inventory = account({
  id: 'gold-inventory',
  name: 'gold-inventory',
  type: 'gold_product',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_gold',
  is_inventory: true,
  metal: 'gold',
  karat: '21',
});
const capital = account({
  id: 'capital',
  name: 'capital',
  canonicalMainType: 'equity',
  canonicalSubType: 'capital',
  metal: 'gold',
});
const merchantA = account({
  id: 'merchant-a',
  name: 'merchant-a',
  type: 'merchant',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_gold',
  merchantDirection: 'payable',
  metal: 'gold',
});
const merchantB = account({
  id: 'merchant-b',
  name: 'merchant-b',
  type: 'merchant',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_gold',
  merchantDirection: 'payable',
  metal: 'gold',
});
const silverMerchant = account({
  id: 'merchant-silver',
  name: 'merchant-silver',
  type: 'merchant',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_silver',
  merchantDirection: 'payable',
  metal: 'silver',
});
const otherDue = account({
  id: 'alaa-yasser',
  name: '\u0627\u0644\u0627\u0621 \u064a\u0627\u0633\u0631',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'other_due',
  merchantDirection: 'payable',
  metal: 'gold',
});
const accounts = [cash, inventory, capital, merchantA, merchantB, silverMerchant, otherDue];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'entry',
  tx: 'test',
  operationKind: 'opening',
  debit: '',
  credit: '',
  date: '2026-01-01',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'test-user',
  ...overrides,
});

describe('computeAccountBalances', () => {
  it('computes a merchant opening balance', () => {
    const result = computeAccountBalances([
      entry({
        id: 'opening',
        debit: capital.name,
        debitAccountId: capital.id,
        credit: merchantA.name,
        creditAccountId: merchantA.id,
        weight: '10',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('merchant-a')).toMatchObject({
      goldActualBalance: 10,
      goldE21Balance: 10,
      mainType: 'liabilities',
      merchantDirection: 'payable',
    });
  });

  it('reduces a merchant balance by a gold settlement', () => {
    const result = computeAccountBalances([
      entry({
        id: 'opening',
        debit: capital.name,
        debitAccountId: capital.id,
        credit: merchantA.name,
        creditAccountId: merchantA.id,
        weight: '10',
        karat: 21,
      }),
      entry({
        id: 'settlement',
        operationKind: 'merchant_settlement',
        debit: merchantA.name,
        debitAccountId: merchantA.id,
        credit: inventory.name,
        creditAccountId: inventory.id,
        weight: '4',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('merchant-a')?.goldActualBalance).toBe(6);
    expect(result.balances.get('merchant-a')?.goldE21Balance).toBe(6);
  });

  it('posts a merchant gold transaction to both inventory and the merchant once', () => {
    const result = computeAccountBalances([
      entry({
        id: 'purchase',
        operationKind: 'purchase',
        debit: inventory.name,
        debitAccountId: inventory.id,
        credit: merchantA.name,
        creditAccountId: merchantA.id,
        weight: '3',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('gold-inventory')?.goldActualBalance).toBe(3);
    expect(result.balances.get('merchant-a')?.goldActualBalance).toBe(3);
  });

  it('moves balances merchant-to-merchant without changing total shop position', () => {
    const result = computeAccountBalances([
      entry({
        id: 'merchant-transfer',
        operationKind: 'transfer',
        debit: merchantA.name,
        debitAccountId: merchantA.id,
        credit: merchantB.name,
        creditAccountId: merchantB.id,
        weight: '2.5',
        karat: 21,
      }),
    ], accounts);
    const a = result.balances.get('merchant-a')!.goldE21Balance;
    const b = result.balances.get('merchant-b')!.goldE21Balance;

    expect(a).toBe(-2.5);
    expect(b).toBe(2.5);
    expect(a + b).toBe(0);
  });

  it('computes the confirmed opening weighted due for alaa yasser', () => {
    const result = computeAccountBalances([
      entry({
        id: 'alaa-opening',
        debit: capital.name,
        debitAccountId: capital.id,
        credit: otherDue.name,
        creditAccountId: otherDue.id,
        weight: '7.25',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('alaa-yasser')).toMatchObject({
      goldActualBalance: 7.25,
      goldE21Balance: 7.25,
      subType: 'other_due',
      isMerchant: false,
      merchantDirection: 'payable',
    });
  });

  it('uses account IDs before contradictory display names', () => {
    const result = computeAccountBalances([
      entry({
        id: 'id-first',
        debit: merchantB.name,
        debitAccountId: capital.id,
        credit: merchantB.name,
        creditAccountId: merchantA.id,
        weight: '5',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('merchant-a')?.goldActualBalance).toBe(5);
    expect(result.balances.get('merchant-b')?.goldActualBalance).toBe(0);
    expect(result.legacyNameMatchedEntries).toEqual([]);
  });

  it('records every successful legacy-name fallback', () => {
    const result = computeAccountBalances([
      entry({
        id: 'legacy-names',
        debit: capital.name,
        credit: merchantA.name,
        weight: '6',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('merchant-a')?.goldActualBalance).toBe(6);
    expect(result.legacyNameMatchedEntries).toEqual([
      expect.objectContaining({ entryId: 'legacy-names', side: 'debit', accountId: 'capital' }),
      expect.objectContaining({ entryId: 'legacy-names', side: 'credit', accountId: 'merchant-a' }),
    ]);
  });

  it('keeps each weighted due account in exactly one balance result', () => {
    const result = computeAccountBalances([
      entry({
        id: 'gold-due',
        debit: inventory.name,
        debitAccountId: inventory.id,
        credit: merchantA.name,
        creditAccountId: merchantA.id,
        operationKind: 'purchase',
        weight: '3',
        karat: 21,
      }),
      entry({
        id: 'other-due',
        debit: capital.name,
        debitAccountId: capital.id,
        credit: otherDue.name,
        creditAccountId: otherDue.id,
        weight: '4',
        karat: 21,
      }),
      entry({
        id: 'silver-due',
        debit: cash.name,
        debitAccountId: cash.id,
        credit: silverMerchant.name,
        creditAccountId: silverMerchant.id,
        weight: '8',
      }),
    ], accounts);

    expect(result.balances.size).toBe(accounts.length);
    expect(result.balances.get('merchant-a')?.goldActualBalance).toBe(3);
    expect(result.balances.get('alaa-yasser')?.goldActualBalance).toBe(4);
    expect(result.balances.get('merchant-silver')?.silverBalance).toBe(8);
    expect(result.balances.get('alaa-yasser')?.isMerchant).toBe(false);
  });

  it('keeps missing and conflicting classifications visible with warnings', () => {
    const legacy = account({ id: 'legacy-due', name: 'legacy-due' });
    const conflict = account({
      id: 'direction-conflict',
      name: 'direction-conflict',
      type: 'merchant',
      canonicalMainType: 'assets',
      canonicalSubType: 'merchant_gold',
      merchantDirection: 'payable',
      metal: 'gold',
    });

    const result = computeAccountBalances([], [legacy, conflict]);

    expect(result.balances.get('legacy-due')?.subType).toBe('unclassified');
    expect(result.balances.get('direction-conflict')?.mainType).toBe('unclassified');
    expect(result.unclassifiedAccounts).toEqual([
      expect.objectContaining({ accountId: 'legacy-due' }),
    ]);
    expect(result.classificationConflicts).toEqual([
      expect.objectContaining({ accountId: 'direction-conflict' }),
    ]);
  });

  it('uses receivable direction as an asset presentation balance', () => {
    const receivable = account({
      id: 'merchant-receivable',
      name: 'merchant-receivable',
      type: 'merchant',
      canonicalMainType: 'assets',
      canonicalSubType: 'merchant_gold',
      merchantDirection: 'receivable',
      metal: 'gold',
    });
    const result = computeAccountBalances([
      entry({
        id: 'receivable-opening',
        debit: receivable.name,
        debitAccountId: receivable.id,
        credit: capital.name,
        creditAccountId: capital.id,
        weight: '2',
        karat: 21,
      }),
    ], [...accounts, receivable]);

    expect(result.balances.get('merchant-receivable')).toMatchObject({
      goldActualBalance: 2,
      mainType: 'assets',
      merchantDirection: 'receivable',
    });
  });

  it('keeps an unknown structural account ID visible without inferring a metal from the entry', () => {
    const result = computeAccountBalances([
      entry({
        id: 'unknown-id-entry',
        debit: capital.name,
        debitAccountId: capital.id,
        credit: inventory.name,
        creditAccountId: 'missing-account-id',
        weight: '1',
        karat: 21,
      }),
    ], accounts);

    expect(result.balances.get('gold-inventory')?.goldActualBalance).toBe(0);
    expect(result.balances.get('missing-account-id')).toMatchObject({
      mainType: 'unclassified',
      subType: 'unclassified',
      goldActualBalance: 0,
    });
    expect(result.unclassifiedAccounts).toContainEqual(
      expect.objectContaining({
        accountId: 'missing-account-id',
        code: 'unknown_account_id',
      }),
    );
    expect(result.legacyNameMatchedEntries).toEqual([]);
  });

  it('normalizes legacy structural merchant fields at the read boundary', () => {
    const legacyMerchant = account({
      id: 'legacy-merchant',
      name: 'legacy-merchant',
      mainType: '\u062e\u0635\u0648\u0645',
      subType: '\u062a\u062c\u0627\u0631 \u0630\u0647\u0628',
      type: 'merchant',
      metal: 'gold',
    });

    const result = computeAccountBalances([], [legacyMerchant]);

    expect(result.balances.get('legacy-merchant')).toMatchObject({
      mainType: 'liabilities',
      subType: 'merchant_gold',
      merchantDirection: 'payable',
      isMerchant: true,
      metal: 'gold',
    });
    expect(result.unclassifiedAccounts).toEqual([]);
    expect(result.classificationConflicts).toEqual([]);
  });
});
