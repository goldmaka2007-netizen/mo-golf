import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildCentralAccountingReadOnlyRuntimeTrialBalance } from '../centralAccountingReadOnlyRuntime';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';

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

const build = (entries: Entry[], sourceAccounts: Account[] = accounts) => buildCentralAccountingReadOnlyRuntimeTrialBalance({
  accounts: sourceAccounts,
  entries,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
});

describe('Central Accounting Read-Only Runtime Phase 4A', () => {
  it('runs Trial Balance only after exact Central Shadow and preserves source Entries', () => {
    const rows = [entry({ operationKind: undefined })];
    const before = JSON.stringify(rows);

    const report = build(rows);

    expect(report.status).toBe('ready');
    expect(report.shadow.status).toBe('compared');
    expect(report.shadow.exactParity).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.trialBalance).not.toBeNull();
    expect(report.trialBalance?.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0].operationKind).toBeUndefined();
  });

  it('resolves referenced inactive historical accounts in Shadow without reactivating report presentation', () => {
    const historicalAccounts: Account[] = [
      account({ id: 'cash', name: 'الخزنة', type: 'cash' }),
      account({
        id: 'silver-old',
        name: 'كسر فضة قديم',
        type: 'silver',
        metal: 'silver',
        is_inventory: true,
        balanceNature: 'جرام فضة',
        isActive: false,
      }),
    ];
    const rows = [entry({
      debit: 'كسر فضة قديم',
      debitAccountId: 'silver-old',
      operationKind: undefined,
    })];
    const accountsBefore = JSON.stringify(historicalAccounts);
    const rowsBefore = JSON.stringify(rows);

    const report = build(rows, historicalAccounts);
    const legacyReport = buildUnifiedTrialBalance(
      rows,
      historicalAccounts.filter(sourceAccount => sourceAccount.isActive !== false),
      '2026-01-01',
      '2026-12-31',
    );

    expect(report.status).toBe('ready');
    expect(report.shadow.status).toBe('compared');
    expect(report.shadow.exactParity).toBe(true);
    expect(report.shadow.parity?.rows[0]?.canonicalResult.issues.map(issue => issue.code)).not.toContain('unknown_account');
    expect(report.shadow.parity?.rows[0]?.canonicalResult.legs.some(leg => leg.dimension === 'silver')).toBe(true);
    expect(report.trialBalance).toEqual(legacyReport);
    expect(report.trialBalance?.rows.some(row => row.entityId === 'account:silver-old')).toBe(false);
    expect(JSON.stringify(historicalAccounts)).toBe(accountsBefore);
    expect(JSON.stringify(rows)).toBe(rowsBefore);
    expect(historicalAccounts[1].isActive).toBe(false);
  });

  it('fails closed when stored operation identity contradicts the Registry', () => {
    const report = build([entry({ operationKind: 'sale' })]);

    expect(report.status).toBe('blocked');
    expect(report.trialBalance).toBeNull();
    expect(report.shadow.blockers.map(blocker => blocker.code)).toContain('operation_identity_mismatch');
    expect(report.blockers.map(blocker => blocker.code)).toContain('central_shadow_not_exact');
  });

  it('fails closed for an unknown operation instead of using a legacy fallback', () => {
    const report = build([entry({ tx: 'عملية غير معروفة', operationKind: 'other' })]);

    expect(report.status).toBe('blocked');
    expect(report.trialBalance).toBeNull();
    expect(report.shadow.status).toBe('blocked');
  });

  it('keeps runtime light and historical compatibility temporary/read-only', () => {
    const source = readFileSync(new URL('../centralAccountingReadOnlyRuntime.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/buildCentralAccountingShadowReport/);
    expect(source).toMatch(/buildHistoricalShadowAccounts/);
    expect(source).toMatch(/referencedAccountIds/);
    expect(source).toMatch(/canonicalResult\.operationKind/);
    expect(source).toMatch(/buildUnifiedTrialBalance/);
    expect(source).toMatch(/\{ \.\.\.account, isActive: true \}/);
    expect(source).toMatch(/accounts\.filter\(account => account\.isActive !== false\)/);
    expect(source).not.toMatch(/buildCentralAccountingReadOnlyOutputEvidence/);
    expect(source).not.toMatch(/buildFinancialStatementsEgp|buildLegacyLedgerLegs/);
    expect(source).not.toMatch(/\?\?\s*entry\.operationKind/);
    expect(source).not.toMatch(/RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
    expect(source).not.toMatch(/from ['"]react|EntryForm|from ['"]\.\.\/store/);
  });
});
