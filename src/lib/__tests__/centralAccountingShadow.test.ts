import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildCentralAccountingShadowReport } from '../centralAccountingShadow';

const account = (patch: Partial<Account>): Account => ({
  id: 'account',
  name: 'حساب',
  mainType: 'اصول',
  subType: '',
  balanceNature: 'جنية مصري',
  type: 'other',
  userId: 'test',
  ...patch,
});

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry',
  seq: 1,
  tx: 'شراء فضة',
  operationKind: 'purchase',
  debit: 'كسر فضة',
  debitAccountId: 'silver',
  credit: 'الخزنة',
  creditAccountId: 'cash',
  date: '2026-08-31',
  cash: '1000',
  weight: '2',
  arabicWeight: '2',
  count: '0',
  notes: '',
  userId: 'test',
  ...patch,
});

const accounts: Account[] = [
  account({ id: 'cash', name: 'الخزنة', type: 'cash' }),
  account({
    id: 'silver',
    name: 'كسر فضة',
    type: 'silver',
    metal: 'silver',
    is_inventory: true,
    balanceNature: 'جرام فضة',
  }),
  account({
    id: 'gold',
    name: 'كسر ذهب',
    type: 'gold_raw',
    metal: 'gold',
    karat: '21',
    is_inventory: true,
    balanceNature: 'جرام ذهب',
  }),
  account({
    id: 'customer',
    name: 'عميل اختبار',
    type: 'customer',
    mainType: 'اصول',
    balanceNature: 'جنية مصري',
  }),
];

describe('Central Accounting Shadow Phase 2', () => {
  it('routes a covered operation through the Central Registry before building parity', () => {
    const rows = [entry({})];
    const report = buildCentralAccountingShadowReport({ accounts, entries: rows });

    expect(report.mode).toBe('read_only_shadow');
    expect(report.coverage.shadowReady).toBe(true);
    expect(report.status).toBe('compared');
    expect(report.blockers).toEqual([]);
    expect(report.parity).not.toBeNull();
    expect(report.parity?.total).toBe(1);
  });

  it('fails closed before parity for an unknown operation label', () => {
    const report = buildCentralAccountingShadowReport({
      accounts,
      entries: [entry({ tx: 'عملية غير معروفة', operationKind: 'other' })],
    });

    expect(report.coverage.shadowReady).toBe(false);
    expect(report.status).toBe('blocked');
    expect(report.parity).toBeNull();
    expect(report.exactParity).toBe(false);
    expect(report.blockers.map(blocker => blocker.code)).toContain('operation_unmapped');
  });

  it.each(['', '   '])('fails closed before parity for blank/whitespace tx=%j', tx => {
    const report = buildCentralAccountingShadowReport({
      accounts,
      entries: [entry({ tx, operationKind: 'other' })],
    });

    expect(report.coverage.unmappedOperations).toEqual([{ label: '', count: 1 }]);
    expect(report.coverage.shadowReady).toBe(false);
    expect(report.status).toBe('blocked');
    expect(report.parity).toBeNull();
    expect(report.blockers.map(blocker => blocker.code)).toContain('operation_unmapped');
  });

  it('fails closed when stored operationKind contradicts the Central Registry identity', () => {
    const report = buildCentralAccountingShadowReport({
      accounts,
      entries: [entry({ operationKind: 'sale' })],
    });

    expect(report.coverage.shadowReady).toBe(true);
    expect(report.status).toBe('blocked');
    expect(report.parity).toBeNull();
    expect(report.exactParity).toBe(false);
    expect(report.blockers.map(blocker => blocker.code)).toContain('operation_identity_mismatch');
    expect(report.blockers[0]?.message).toContain('purchase.silver/purchase');
  });

  it('fails the whole Shadow run when any row has an operation identity mismatch', () => {
    const report = buildCentralAccountingShadowReport({
      accounts,
      entries: [entry({ id: 'ok' }), entry({ id: 'bad', seq: 2, operationKind: 'sale' })],
    });

    expect(report.coverage.shadowReady).toBe(true);
    expect(report.status).toBe('blocked');
    expect(report.parity).toBeNull();
    expect(report.exactParity).toBe(false);
    expect(report.blockers.filter(blocker => blocker.code === 'operation_identity_mismatch')).toHaveLength(1);
  });

  it('allows a covered legacy row with no stored operationKind', () => {
    const rows = [entry({ operationKind: undefined })];
    const report = buildCentralAccountingShadowReport({ accounts, entries: rows });

    expect(report.status).toBe('compared');
    expect(report.blockers).toEqual([]);
    expect(report.parity).not.toBeNull();
    expect(rows[0].operationKind).toBeUndefined();
  });

  it.each([
    {
      tx: 'دفع لعميل',
      expectedKind: 'other',
      patch: {
        debit: 'عميل اختبار', debitAccountId: 'customer', credit: 'الخزنة', creditAccountId: 'cash',
        cash: '100', weight: '0', arabicWeight: '0',
      },
    },
    {
      tx: 'مرتجع ذهب',
      expectedKind: 'purchase',
      patch: {
        debit: 'كسر ذهب', debitAccountId: 'gold', credit: 'الخزنة', creditAccountId: 'cash',
        cash: '1000', weight: '2', arabicWeight: '2',
      },
    },
    {
      tx: 'مرتجع فضة',
      expectedKind: 'purchase',
      patch: {
        debit: 'كسر فضة', debitAccountId: 'silver', credit: 'الخزنة', creditAccountId: 'cash',
        cash: '1000', weight: '2', arabicWeight: '2',
      },
    },
  ])('normalizes missing operationKind from the Registry for $tx before parity', ({ tx, expectedKind, patch }) => {
    const row = entry({ tx, operationKind: undefined, ...patch });
    const report = buildCentralAccountingShadowReport({ accounts, entries: [row] });

    expect(report.coverage.shadowReady).toBe(true);
    expect(report.status).toBe('compared');
    expect(report.blockers).toEqual([]);
    expect(report.parity).not.toBeNull();
    expect(report.parity?.rows[0].legacyResult.operationKind).toBe(expectedKind);
    expect(report.parity?.rows[0].canonicalResult.operationKind).toBe(expectedKind);
    expect(row.operationKind).toBeUndefined();
  });

  it('is read-only and leaves source entries unchanged', () => {
    const rows = [entry({ operationKind: undefined })];
    const before = JSON.stringify(rows);

    buildCentralAccountingShadowReport({ accounts, entries: rows });

    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0]).not.toHaveProperty('shadowLegs');
  });

  it('keeps the Phase 2 orchestration boundary free from UI, Firebase persistence, and legacy decision constants', () => {
    const source = readFileSync(new URL('../centralAccountingShadow.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/from ['"][^'"]*constants['"]|RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
    expect(source).not.toMatch(/from ['"]react|EntryForm|from ['"]\.\.\/store/);
  });
});
