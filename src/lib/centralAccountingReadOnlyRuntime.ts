import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import {
  buildCentralAccountingShadowReport,
  type CentralAccountingShadowReport,
} from './centralAccountingShadow';
import { computePeriodAccountBalances } from './engine';
import {
  buildLedgerReport,
  getAvailableDimensions,
  type LedgerDimension,
  type LedgerReport,
} from './ledgerReport';
import { buildUnifiedTrialBalance, type UnifiedTrialBalanceReport } from './unifiedTrialBalance';

export const CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION = 'central-accounting-read-only-runtime-v1' as const;

export type CentralReadOnlyRuntimeBlockerCode =
  | 'central_shadow_not_exact'
  | 'runtime_identity_incomplete';

export interface CentralReadOnlyRuntimeBlocker {
  code: CentralReadOnlyRuntimeBlockerCode;
  message: string;
}

interface CentralRuntimeIdentity {
  shadow: CentralAccountingShadowReport;
  normalizedEntries: Entry[] | null;
}

const buildHistoricalShadowAccounts = (accounts: Account[], entries: Entry[]): Account[] => {
  const referencedAccountIds = new Set(entries.flatMap(entry => [
    entry.debitAccountId,
    entry.creditAccountId,
  ]).filter((accountId): accountId is string => Boolean(accountId)));

  return accounts.map(account => account.isActive === false
    && account.id
    && referencedAccountIds.has(account.id)
    ? { ...account, isActive: true }
    : account);
};

const buildRegistryApprovedRuntimeEntries = (
  entries: Entry[],
  shadow: CentralAccountingShadowReport,
): Entry[] | null => {
  const rows = shadow.parity?.rows ?? [];
  if (rows.length !== entries.length) return null;

  const normalized: Entry[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const operationKind = rows[index]?.canonicalResult.operationKind;
    if (!operationKind) return null;
    normalized.push({ ...entries[index], operationKind });
  }
  return normalized;
};

const buildCentralRuntimeIdentity = (
  accounts: Account[],
  entries: Entry[],
  manualAccountDefinitions: CanonicalAccountDefinition[],
): CentralRuntimeIdentity => {
  const shadow = buildCentralAccountingShadowReport({
    accounts: buildHistoricalShadowAccounts(accounts, entries),
    entries,
    manualAccountDefinitions,
  });

  if (shadow.status !== 'compared' || !shadow.parity || !shadow.exactParity) {
    return { shadow, normalizedEntries: null };
  }
  return {
    shadow,
    normalizedEntries: buildRegistryApprovedRuntimeEntries(entries, shadow),
  };
};

const blocked = (
  shadow: CentralAccountingShadowReport,
  message: string,
): CentralReadOnlyRuntimeBlocker[] => [{
  code: shadow.status === 'compared' && shadow.exactParity
    ? 'runtime_identity_incomplete'
    : 'central_shadow_not_exact',
  message,
}];

export interface CentralTrialBalanceRuntimeInput {
  accounts: Account[];
  entries: Entry[];
  startDate: string;
  endDate: string;
  manualAccountDefinitions?: CanonicalAccountDefinition[];
  timeline?: InventoryCostTimeline | null;
}

export interface CentralTrialBalanceRuntimeReport {
  version: typeof CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION;
  mode: 'read_only_runtime_trial_balance';
  status: 'ready' | 'blocked';
  shadow: CentralAccountingShadowReport;
  blockers: CentralReadOnlyRuntimeBlocker[];
  trialBalance: UnifiedTrialBalanceReport | null;
}

/** Phase 4A read-only runtime adapter for the Unified Trial Balance. */
export const buildCentralAccountingReadOnlyRuntimeTrialBalance = ({
  accounts,
  entries,
  startDate,
  endDate,
  manualAccountDefinitions = [],
  timeline = null,
}: CentralTrialBalanceRuntimeInput): CentralTrialBalanceRuntimeReport => {
  const identity = buildCentralRuntimeIdentity(accounts, entries, manualAccountDefinitions);
  if (!identity.normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_trial_balance',
      status: 'blocked',
      shadow: identity.shadow,
      blockers: blocked(identity.shadow, 'Complete exact Central Shadow identity is required before Trial Balance runtime execution.'),
      trialBalance: null,
    };
  }

  const activeAccounts = accounts.filter(account => account.isActive !== false);
  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_trial_balance',
    status: 'ready',
    shadow: identity.shadow,
    blockers: [],
    trialBalance: buildUnifiedTrialBalance(identity.normalizedEntries, activeAccounts, startDate, endDate, {
      canonicalDefinitions: manualAccountDefinitions,
      timeline,
    }),
  };
};

export interface CentralGeneralLedgerRuntimeInput {
  sourceAccounts: Account[];
  reportAccounts: Account[];
  entries: Entry[];
  account: Account;
  startDate: string;
  endDate: string;
  summaryEndDate: string;
  manualAccountDefinitions?: CanonicalAccountDefinition[];
  timeline?: InventoryCostTimeline | null;
}

export interface CentralGeneralLedgerDimensionReport {
  dimension: LedgerDimension;
  report: LedgerReport;
}

export interface CentralGeneralLedgerRuntimeReport {
  version: typeof CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION;
  mode: 'read_only_runtime_general_ledger';
  status: 'ready' | 'blocked';
  shadow: CentralAccountingShadowReport;
  blockers: CentralReadOnlyRuntimeBlocker[];
  dimensions: LedgerDimension[];
  periodReports: CentralGeneralLedgerDimensionReport[];
  summaryReports: CentralGeneralLedgerDimensionReport[];
}

/**
 * Phase 4B read-only runtime adapter for the General Ledger.
 *
 * One exact Registry-gated Shadow run supplies temporary operation identity to all
 * Ledger dimensions. Existing getAvailableDimensions, Balance Engine period
 * balances, and buildLedgerReport remain the only report authorities. Historical
 * inactive source accounts are activated only on temporary Shadow copies; report
 * presentation continues to use the caller's existing report-account set.
 */
export const buildCentralAccountingReadOnlyRuntimeGeneralLedger = ({
  sourceAccounts,
  reportAccounts,
  entries,
  account,
  startDate,
  endDate,
  summaryEndDate,
  manualAccountDefinitions = [],
  timeline = null,
}: CentralGeneralLedgerRuntimeInput): CentralGeneralLedgerRuntimeReport => {
  const identity = buildCentralRuntimeIdentity(sourceAccounts, entries, manualAccountDefinitions);
  if (!identity.normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_general_ledger',
      status: 'blocked',
      shadow: identity.shadow,
      blockers: blocked(identity.shadow, 'Complete exact Central Shadow identity is required before General Ledger runtime execution.'),
      dimensions: [],
      periodReports: [],
      summaryReports: [],
    };
  }

  const normalizedEntries = identity.normalizedEntries;
  const ledgerOptions = { enableFinancialProjection: true, costTimeline: timeline } as const;
  const dimensions = getAvailableDimensions(
    account,
    normalizedEntries,
    reportAccounts,
    manualAccountDefinitions,
    ledgerOptions,
  );
  const periodBalances = computePeriodAccountBalances(normalizedEntries, reportAccounts, startDate, endDate);
  const summaryBalances = computePeriodAccountBalances(normalizedEntries, reportAccounts, '0000-01-01', summaryEndDate);
  const periodReports = dimensions.map(dimension => ({
    dimension,
    report: buildLedgerReport(
      normalizedEntries,
      reportAccounts,
      account,
      dimension,
      startDate,
      endDate,
      manualAccountDefinitions,
      { ...ledgerOptions, balancePeriod: periodBalances },
    ),
  }));
  const summaryReports = dimensions.map(dimension => ({
    dimension,
    report: buildLedgerReport(
      normalizedEntries,
      reportAccounts,
      account,
      dimension,
      '0000-01-01',
      summaryEndDate,
      manualAccountDefinitions,
      { ...ledgerOptions, balancePeriod: summaryBalances },
    ),
  }));

  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_general_ledger',
    status: 'ready',
    shadow: identity.shadow,
    blockers: [],
    dimensions,
    periodReports,
    summaryReports,
  };
};
