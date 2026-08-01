import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  APPROVED_RUNTIME_INVENTORY_ACCOUNT_ALIAS_AUDIT,
  prepareRuntimeCostAccountInputs,
  resolveRuntimeCostAccountInputs,
  RUNTIME_COST_ACCOUNT_RESOLVER_VERSION,
} from '../runtimeCostAccountResolver';

const inventory: Account = {
  id: 'runtime-inventory-random', userId: 'runtime-test', name: 'runtime inventory',
  mainType: 'assets', subType: 'inventory', balanceNature: 'piece',
  is_inventory: true, inventoryKind: 'accessory', measurementDimension: 'quantity',
  costingMethod: 'fixed-opening-cost',
};

describe('runtime cost account resolver', () => {
  it('uses the actual accounts id without rewriting source records', () => {
    const sourceEntry = { id: 'runtime-entry-1', date: '2026-01-01', tx: 'purchase', debit: inventory.name, credit: 'cash', cash: '100', weight: '0', count: '1', notes: '', userId: 'runtime-test' } as Entry;
    const resolution = resolveRuntimeCostAccountInputs([sourceEntry], [inventory]);
    expect(resolution.errors).toEqual([]);
    expect(resolution.entries[0].debitAccountId).toBe(inventory.id);
    expect(resolution.accounts[0].id).toBe(inventory.id);
    expect(sourceEntry.debitAccountId).toBeUndefined();
  });

  it('prepares arbitrary inventory ids for save-time validation', () => {
    const prepared = prepareRuntimeCostAccountInputs([], [inventory]);
    expect(prepared.errors).toEqual([]);
    expect(prepared.accounts[0].id).toBe('runtime-inventory-random');
  });

  it('does not use names as a metadata allowlist', () => {
    const arbitrary = { ...inventory, id: 'another-random-id', name: 'another random name' };
    expect(resolveRuntimeCostAccountInputs([], [arbitrary]).errors).toEqual([]);
  });

  it('keeps the legacy alias allowlist empty', () => {
    expect(RUNTIME_COST_ACCOUNT_RESOLVER_VERSION).toBe('runtime-account-metadata-v2');
    expect(APPROVED_RUNTIME_INVENTORY_ACCOUNT_ALIAS_AUDIT).toEqual([]);
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
