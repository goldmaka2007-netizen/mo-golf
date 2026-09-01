import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildCentralAccountingReadOnlyRuntimeEquityStatement } from '../centralAccountingReadOnlyRuntime';
import { computeAccountBalances } from '../engine';
import { buildEquityStatementEgp } from '../equityStatementEgp';

const accounts: Account[] = [
  {
    id: 'cash',
    name: 'الخزنة',
    mainType: 'اصول',
    subType: 'نقدية',
    canonicalMainType: 'assets',
    canonicalSubType: 'cash',
    balanceNature: 'جنية مصري',
    type: 'cash',
    userId: 'test',
  },
  {
    id: 'capital',
    name: 'رأس المال',
    mainType: 'حقوق الملكية',
    subType: 'رأس المال',
    canonicalMainType: 'equity',
    canonicalSubType: 'capital',
    balanceNature: 'جنية مصري',
    type: 'other',
    userId: 'test',
  },
];

const opening = (patch: Partial<Entry> = {}): Entry => ({
  id: 'opening',
  seq: 1,
  tx: 'قيد افتتاحي',
  operationKind: undefined,
  debit: 'الخزنة',
  debitAccountId: 'cash',
  credit: 'رأس المال',
  creditAccountId: 'capital',
  date: '2026-01-01',
  cash: '1000',
  weight: '0',
  arabicWeight: '0',
  count: '0',
  notes: '',
  userId: 'test',
  ...patch,
});

const args = (entries: Entry[]) => ({
  accounts,
  entries,
  canonicalDefinitions: [],
  openingCostConfig: [],
  cutoffDate: '2026-08-31',
});

describe('Central Accounting Read-Only Runtime Phase 4C — Equity Statement', () => {
  it('matches the existing Equity Statement and Balance Engine diagnostic after Registry-approved identity', () => {
    const rows = [opening()];
    const before = JSON.stringify(rows);

    const runtime = buildCentralAccountingReadOnlyRuntimeEquityStatement(args(rows));
    const legacy = buildEquityStatementEgp(args(rows));
    const legacyBalanceEngineVersion = computeAccountBalances(rows, accounts).balanceEngineVersion;

    expect(runtime.status).toBe('ready');
    expect(runtime.shadow.status).toBe('compared');
    expect(runtime.shadow.exactParity).toBe(true);
    expect(runtime.equityStatement).toEqual(legacy);
    expect(runtime.balanceEngineVersion).toBe(legacyBalanceEngineVersion);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0].operationKind).toBeUndefined();
  });

  it('excludes later irrelevant rows before Equity Shadow without changing the requested cutoff', () => {
    const valid = opening();
    const futureUnknown = opening({
      id: 'future',
      seq: 2,
      tx: 'عملية مستقبلية غير معروفة',
      operationKind: 'other',
      date: '2026-09-15',
    });

    const runtime = buildCentralAccountingReadOnlyRuntimeEquityStatement(args([valid, futureUnknown]));
    const legacy = buildEquityStatementEgp(args([valid]));

    expect(runtime.status).toBe('ready');
    expect(runtime.shadow.parity?.rows).toHaveLength(1);
    expect(runtime.equityStatement).toEqual(legacy);
  });

  it('fails closed on relevant contradictory or unknown operation identity', () => {
    [
      opening({ operationKind: 'sale' }),
      opening({ tx: 'عملية غير معروفة', operationKind: 'other' }),
      opening({ tx: '', operationKind: undefined }),
      opening({ tx: '   ', operationKind: undefined }),
    ].forEach(row => {
      const runtime = buildCentralAccountingReadOnlyRuntimeEquityStatement(args([row]));
      expect(runtime.status).toBe('blocked');
      expect(runtime.equityStatement).toBeNull();
      expect(runtime.balanceEngineVersion).toBeNull();
    });
  });

  it('keeps source Account and Entry objects immutable', () => {
    const rows = [opening()];
    const accountsBefore = JSON.stringify(accounts);
    const rowsBefore = JSON.stringify(rows);

    buildCentralAccountingReadOnlyRuntimeEquityStatement(args(rows));

    expect(JSON.stringify(accounts)).toBe(accountsBefore);
    expect(JSON.stringify(rows)).toBe(rowsBefore);
  });
});
