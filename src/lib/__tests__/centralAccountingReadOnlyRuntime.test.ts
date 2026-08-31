import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildCentralAccountingReadOnlyRuntimeTrialBalance } from '../centralAccountingReadOnlyRuntime';

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
];

const build = (entries: Entry[]) => buildCentralAccountingReadOnlyRuntimeTrialBalance({
  accounts,
  entries,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
});

describe('Central Accounting Read-Only Runtime Phase 4A', () => {
  it('runs Trial Balance only after exact Central evidence and preserves source Entries', () => {
    const rows = [entry({ operationKind: undefined })];
    const before = JSON.stringify(rows);

    const report = build(rows);

    expect(report.status).toBe('ready');
    expect(report.evidence.status).toBe('matched');
    expect(report.evidence.comparison?.exact).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.trialBalance).not.toBeNull();
    expect(report.trialBalance?.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0].operationKind).toBeUndefined();
  });

  it('fails closed when stored operation identity contradicts the Registry', () => {
    const report = build([entry({ operationKind: 'sale' })]);

    expect(report.status).toBe('blocked');
    expect(report.trialBalance).toBeNull();
    expect(report.evidence.shadow.blockers.map(blocker => blocker.code)).toContain('operation_identity_mismatch');
    expect(report.blockers.map(blocker => blocker.code)).toContain('central_evidence_not_matched');
  });

  it('fails closed for an unknown operation instead of using a legacy fallback', () => {
    const report = build([entry({ tx: 'عملية غير معروفة', operationKind: 'other' })]);

    expect(report.status).toBe('blocked');
    expect(report.trialBalance).toBeNull();
    expect(report.evidence.shadow.status).toBe('blocked');
  });

  it('keeps the runtime adapter read-only and free from independent accounting authority', () => {
    const source = readFileSync(new URL('../centralAccountingReadOnlyRuntime.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/buildCentralAccountingReadOnlyOutputEvidence/);
    expect(source).toMatch(/canonicalResult\.operationKind/);
    expect(source).toMatch(/buildUnifiedTrialBalance/);
    expect(source).not.toMatch(/\?\?\s*entry\.operationKind/);
    expect(source).not.toMatch(/RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
    expect(source).not.toMatch(/from ['"]react|EntryForm|from ['"]\.\.\/store/);
  });
});
