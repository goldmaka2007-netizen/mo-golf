import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  buildCentralAccountingReadOnlyRuntimeGeneralLedger,
  buildCentralAccountingReadOnlyRuntimeTrialBalance,
} from '../centralAccountingReadOnlyRuntime';
import { computePeriodAccountBalances } from '../engine';
import { buildLedgerReport, getAvailableDimensions, type LedgerReport } from '../ledgerReport';
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

const ledgerSemantics = (report: LedgerReport) => ({
  balanceEngineVersion: report.balanceEngineVersion,
  source: report.source,
  normalBalance: report.normalBalance,
  openingBalance: report.openingBalance,
  totalDebit: report.totalDebit,
  totalCredit: report.totalCredit,
  closingBalance: report.closingBalance,
  rows: report.rows.map(row => ({
    entryId: row.entry.id,
    date: row.date,
    operationNumber: row.operationNumber,
    operationType: row.operationType,
    oppositeAccount: row.oppositeAccount,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    originalWeight: row.originalWeight,
    karat: row.karat,
  })),
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
});

describe('Central Accounting Read-Only Runtime Phase 4B — General Ledger', () => {
  it('matches pre-wiring General Ledger semantics using one Registry-approved runtime identity', () => {
    const rows = [entry({ operationKind: undefined })];
    const before = JSON.stringify(rows);
    const cash = accounts[0];
    const reportAccounts = accounts.filter(item => item.isActive !== false);

    const runtime = buildCentralAccountingReadOnlyRuntimeGeneralLedger({
      sourceAccounts: accounts,
      reportAccounts,
      entries: rows,
      account: cash,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      summaryEndDate: '2026-12-31',
    });

    const legacyDimensions = getAvailableDimensions(cash, rows, reportAccounts, [], { enableFinancialProjection: true });
    const periodBalances = computePeriodAccountBalances(rows, reportAccounts, '2026-01-01', '2026-12-31');
    const legacyReports = legacyDimensions.map(dimension => ({
      dimension,
      report: buildLedgerReport(rows, reportAccounts, cash, dimension, '2026-01-01', '2026-12-31', [], {
        enableFinancialProjection: true,
        balancePeriod: periodBalances,
      }),
    }));

    expect(runtime.status).toBe('ready');
    expect(runtime.shadow.status).toBe('compared');
    expect(runtime.shadow.exactParity).toBe(true);
    expect(runtime.dimensions).toEqual(legacyDimensions);
    expect(runtime.periodReports.map(item => ({ dimension: item.dimension, report: ledgerSemantics(item.report) })))
      .toEqual(legacyReports.map(item => ({ dimension: item.dimension, report: ledgerSemantics(item.report) })));
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0].operationKind).toBeUndefined();
  });

  it('keeps inactive historical counterpart accounts Shadow-only while preserving Ledger semantics', () => {
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
    const reportAccounts = historicalAccounts.filter(item => item.isActive !== false);
    const cash = reportAccounts[0];
    const rows = [entry({
      debit: 'كسر فضة قديم',
      debitAccountId: 'silver-old',
      operationKind: undefined,
    })];
    const accountsBefore = JSON.stringify(historicalAccounts);
    const rowsBefore = JSON.stringify(rows);

    const runtime = buildCentralAccountingReadOnlyRuntimeGeneralLedger({
      sourceAccounts: historicalAccounts,
      reportAccounts,
      entries: rows,
      account: cash,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      summaryEndDate: '2026-12-31',
    });
    const balances = computePeriodAccountBalances(rows, reportAccounts, '2026-01-01', '2026-12-31');
    const legacy = buildLedgerReport(rows, reportAccounts, cash, 'cash', '2026-01-01', '2026-12-31', [], {
      enableFinancialProjection: true,
      balancePeriod: balances,
    });

    expect(runtime.status).toBe('ready');
    expect(runtime.shadow.exactParity).toBe(true);
    expect(runtime.shadow.parity?.rows[0]?.canonicalResult.issues.map(issue => issue.code)).not.toContain('unknown_account');
    expect(runtime.periodReports.find(item => item.dimension === 'cash')).toBeDefined();
    expect(ledgerSemantics(runtime.periodReports.find(item => item.dimension === 'cash')!.report)).toEqual(ledgerSemantics(legacy));
    expect(JSON.stringify(historicalAccounts)).toBe(accountsBefore);
    expect(JSON.stringify(rows)).toBe(rowsBefore);
    expect(historicalAccounts[1].isActive).toBe(false);
  });

  it('fails closed before Ledger reports on contradictory, unknown, blank, or whitespace operations', () => {
    [
      entry({ operationKind: 'sale' }),
      entry({ tx: 'عملية غير معروفة', operationKind: 'other' }),
      entry({ tx: '', operationKind: undefined }),
      entry({ tx: '   ', operationKind: undefined }),
    ].forEach(row => {
      const runtime = buildCentralAccountingReadOnlyRuntimeGeneralLedger({
        sourceAccounts: accounts,
        reportAccounts: accounts,
        entries: [row],
        account: accounts[0],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        summaryEndDate: '2026-12-31',
      });
      expect(runtime.status).toBe('blocked');
      expect(runtime.dimensions).toEqual([]);
      expect(runtime.periodReports).toEqual([]);
      expect(runtime.summaryReports).toEqual([]);
    });
  });

  it('keeps Central runtime lightweight and free from fallback accounting authority', () => {
    const source = readFileSync(new URL('../centralAccountingReadOnlyRuntime.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/buildCentralAccountingShadowReport/);
    expect(source).toMatch(/buildHistoricalShadowAccounts/);
    expect(source).toMatch(/canonicalResult\.operationKind/);
    expect(source).toMatch(/buildUnifiedTrialBalance/);
    expect(source).toMatch(/buildLedgerReport/);
    expect(source).toMatch(/getAvailableDimensions/);
    expect(source).toMatch(/computePeriodAccountBalances/);
    expect(source).not.toMatch(/buildCentralAccountingReadOnlyOutputEvidence/);
    expect(source).not.toMatch(/buildFinancialStatementsEgp|buildLegacyLedgerLegs/);
    expect(source).not.toMatch(/\?\?\s*entry\.operationKind/);
    expect(source).not.toMatch(/RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
    expect(source).not.toMatch(/from ['"]react|EntryForm|from ['"]\.\.\/store/);
  });
});
