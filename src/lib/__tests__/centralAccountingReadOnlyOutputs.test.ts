import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildCentralAccountingReadOnlyOutputEvidence } from '../centralAccountingReadOnlyOutputs';

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

const build = (entries: Entry[]) => buildCentralAccountingReadOnlyOutputEvidence({
  accounts,
  entries,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
});

describe('Central Accounting Read-Only Output Evidence Phase 3', () => {
  it('proves exact downstream parity after Registry-approved Shadow normalization', () => {
    const rows = [entry({ operationKind: undefined })];
    const before = JSON.stringify(rows);

    const report = build(rows);

    expect(report.mode).toBe('read_only_output_evidence');
    expect(report.shadow.status).toBe('compared');
    expect(report.shadow.exactParity).toBe(true);
    expect(report.status).toBe('matched');
    expect(report.blockers).toEqual([]);
    expect(report.comparison).toEqual({
      projectionExact: true,
      trialBalanceExact: true,
      financialStatementsExact: true,
      exact: true,
    });
    expect(report.sourceSummary).toEqual(report.centralSummary);
    expect(report.sourceSummary?.projectionLegCount).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0].operationKind).toBeUndefined();
  });

  it('fails closed without evaluating downstream outputs when Shadow is blocked', () => {
    const report = build([entry({ tx: 'عملية غير معروفة', operationKind: 'other' })]);

    expect(report.status).toBe('blocked');
    expect(report.shadow.status).toBe('blocked');
    expect(report.blockers.map(blocker => blocker.code)).toContain('shadow_blocked');
    expect(report.comparison).toBeNull();
    expect(report.sourceSummary).toBeNull();
    expect(report.centralSummary).toBeNull();
  });

  it('fails closed on stored operation identity mismatch before downstream output evaluation', () => {
    const report = build([entry({ operationKind: 'sale' })]);

    expect(report.status).toBe('blocked');
    expect(report.shadow.blockers.map(blocker => blocker.code)).toContain('operation_identity_mismatch');
    expect(report.comparison).toBeNull();
  });

  it('keeps Phase 3 free from fallback identity, UI, Firebase persistence, EntryForm, and legacy decision constants', () => {
    const source = readFileSync(new URL('../centralAccountingReadOnlyOutputs.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/buildCentralAccountingShadowReport/);
    expect(source).toMatch(/buildLegacyLedgerLegs/);
    expect(source).toMatch(/buildUnifiedTrialBalance/);
    expect(source).toMatch(/buildFinancialStatementsEgp/);
    expect(source).toMatch(/shadow_parity_incomplete/);
    expect(source).toMatch(/rows\.length === entries\.length/);
    expect(source).not.toMatch(/\?\?\s*entry\.operationKind/);
    expect(source).not.toMatch(/if \(!shadow\.parity\) return entries\.map/);
    expect(source).not.toMatch(/from ['"][^'"]*constants['"]|RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
    expect(source).not.toMatch(/from ['"]react|EntryForm|from ['"]\.\.\/store/);
  });
});
