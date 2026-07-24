import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  APPROVED_RUNTIME_INVENTORY_ACCOUNT_ALIAS_AUDIT,
  resolveRuntimeCostAccountInputs,
  RUNTIME_COST_ACCOUNT_RESOLVER_VERSION,
} from '../runtimeCostAccountResolver';
import { loadPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';

const legacyBandAccount: Account = {
  id: '09qdBCNEiu9JxX4N6JnK',
  userId: 'runtime-test',
  name: 'دبلة فضة',
  mainType: 'اصول',
  subType: 'مخزون فضة',
  balanceNature: 'جرام فضة',
  type: 'silver',
  is_inventory: true,
  karat: null,
  metal: 'silver',
};

describe('runtime cost account resolver', () => {
  it('resolves the evidenced Firestore id without mutating source records', () => {
    const { accounts: stableAccounts } = loadPhase5GoldenDataset();
    const accounts = stableAccounts.map(account =>
      account.id === 'seed-account-585a165916de021adb5a'
        ? legacyBandAccount
        : account);
    const sourceEntry: Entry = {
      id: 'runtime-entry-1',
      date: '2026-01-01',
      tx: 'قيد افتتاحي',
      debit: 'دبلة فضة',
      credit: 'acct_non_inventory_001',
      cash: '0',
      weight: '701.52',
      arabicWeight: '701.52',
      count: '187',
      imported: true,
      notes: '',
      userId: 'runtime-test',
    };
    const resolution = resolveRuntimeCostAccountInputs([sourceEntry], accounts);

    expect(resolution.errors).toEqual([]);
    expect(resolution.entries[0].debitAccountId)
      .toBe('seed-account-585a165916de021adb5a');
    expect(resolution.accounts.find(account =>
      account.name === 'دبلة فضة')?.id)
      .toBe('seed-account-585a165916de021adb5a');
    expect(sourceEntry.debitAccountId).toBeUndefined();
    expect(legacyBandAccount.id).toBe('09qdBCNEiu9JxX4N6JnK');
  });

  it('fails closed when inventory metadata conflicts with the stable catalog', () => {
    const { accounts: stableAccounts } = loadPhase5GoldenDataset();
    const accounts = stableAccounts.map(account =>
      account.id === 'seed-account-585a165916de021adb5a'
        ? { ...legacyBandAccount, metal: 'gold' as const }
        : account);
    const resolution = resolveRuntimeCostAccountInputs([], accounts);
    expect(resolution.errors).toContain(
      'Inventory metadata mismatch for legacy accountId: 09qdBCNEiu9JxX4N6JnK',
    );
  });

  it('keeps an immutable alias audit note for the reported account', () => {
    expect(APPROVED_RUNTIME_INVENTORY_ACCOUNT_ALIAS_AUDIT).toContainEqual(
      expect.objectContaining({
        legacyAccountId: '09qdBCNEiu9JxX4N6JnK',
        resolvedStableAccountId: 'seed-account-585a165916de021adb5a',
        resolvedAccountName: 'دبلة فضة',
        resolverVersion: RUNTIME_COST_ACCOUNT_RESOLVER_VERSION,
      }),
    );
  });
});

describe('sanitized Phase 5 fixture boundaries', () => {
  it('does not import migration data or raw CSV files', () => {
    const loader = readFileSync(
      new URL('../../test-fixtures/phase5GoldenDataset.ts', import.meta.url),
      'utf8',
    );
    expect(loader).not.toContain('migrationData');
    expect(loader).not.toContain('approved_normalized_preview.csv');
    expect(loader).not.toContain('.csv');
  });

  it('contains no raw payload or common PII fields', () => {
    const fixture = JSON.parse(readFileSync(
      new URL(
        '../../test-fixtures/golden/phase5-cost-fixture-v2-sanitized.json',
        import.meta.url,
      ),
      'utf8',
    )) as { entries: Record<string, unknown>[] };
    for (const entry of fixture.entries) {
      for (const forbidden of [
        'original_raw_values',
        'original_raw_record',
        'email',
        'phone',
        'address',
        'notes',
        'raw_source_payload',
      ]) {
        expect(entry).not.toHaveProperty(forbidden);
      }
    }
  });
});
