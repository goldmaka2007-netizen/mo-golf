import type { Account, AnnualOpeningCostConfig, CanonicalAccountDefinition, Entry } from '../types';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import {
  buildCentralAccountingShadowReport,
  type CentralAccountingShadowReport,
} from './centralAccountingShadow';
import { computeAccountBalances, computePeriodAccountBalances } from './engine';
import {
  buildEquityStatementEgp,
  type EquityStatementEgpResult,
} from './equityStatementEgp';
import {
  buildFinancialStatementsEgp,
  type BuildFinancialStatementsEgpOptions,
  type FinancialStatementsEgp,
} from './financialStatementsEgp';
import {
  buildMonthlyFinancialPosition,
  type MonthlyFinancialPositionResult,
} from './monthlyFinancialPosition';
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

export interface CentralFinancialStatementsRuntimeInput {
  accounts: Account[];
  entries: Entry[];
  options?: BuildFinancialStatementsEgpOptions;
}

export interface CentralFinancialStatementsRuntimeReport {
  version: typeof CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION;
  mode: 'read_only_runtime_financial_statements';
  status: 'ready' | 'blocked';
  shadow: CentralAccountingShadowReport;
  blockers: CentralReadOnlyRuntimeBlocker[];
  financialStatements: FinancialStatementsEgp | null;
}

/**
 * Phase 4C read-only runtime adapter for EGP Financial Statements.
 * Entries after the requested income end date are excluded before Shadow because
 * they cannot affect the displayed income period. Earlier rows remain available so
 * the existing cost timeline and historical context are preserved.
 */
export const buildCentralAccountingReadOnlyRuntimeFinancialStatements = ({
  accounts,
  entries,
  options = {},
}: CentralFinancialStatementsRuntimeInput): CentralFinancialStatementsRuntimeReport => {
  const runtimeEntries = options.incomeEndDate
    ? entries.filter(entry => entry.date <= options.incomeEndDate!)
    : entries;
  const manualAccountDefinitions = options.canonicalDefinitions ?? [];
  const identity = buildCentralRuntimeIdentity(accounts, runtimeEntries, manualAccountDefinitions);
  if (!identity.normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_financial_statements',
      status: 'blocked',
      shadow: identity.shadow,
      blockers: blocked(identity.shadow, 'Complete exact Central Shadow identity is required before Financial Statements runtime execution.'),
      financialStatements: null,
    };
  }

  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_financial_statements',
    status: 'ready',
    shadow: identity.shadow,
    blockers: [],
    financialStatements: buildFinancialStatementsEgp(identity.normalizedEntries, accounts, options),
  };
};

export interface CentralMonthlyFinancialPositionRuntimeInput {
  accounts: Account[];
  entries: Entry[];
  canonicalDefinitions: CanonicalAccountDefinition[];
  openingCostConfig: AnnualOpeningCostConfig[];
  cutoffDate: string;
  goldPriceEgp?: number | null;
  silverPriceEgp?: number | null;
}

export interface CentralMonthlyFinancialPositionRuntimeReport {
  version: typeof CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION;
  mode: 'read_only_runtime_monthly_financial_position';
  status: 'ready' | 'blocked';
  shadow: CentralAccountingShadowReport;
  blockers: CentralReadOnlyRuntimeBlocker[];
  financialPosition: MonthlyFinancialPositionResult | null;
}

/**
 * Phase 4C read-only runtime adapter for the monthly EGP Financial Position.
 * Only rows on/before the selected cutoff enter Shadow, matching the existing
 * monthly engine's own cutoff contract and preventing irrelevant future rows from
 * blocking an earlier statement.
 */
export const buildCentralAccountingReadOnlyRuntimeMonthlyFinancialPosition = ({
  accounts,
  entries,
  canonicalDefinitions,
  openingCostConfig,
  cutoffDate,
  goldPriceEgp = null,
  silverPriceEgp = null,
}: CentralMonthlyFinancialPositionRuntimeInput): CentralMonthlyFinancialPositionRuntimeReport => {
  const cutoffEntries = entries.filter(entry => entry.date <= cutoffDate);
  const identity = buildCentralRuntimeIdentity(accounts, cutoffEntries, canonicalDefinitions);
  if (!identity.normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_monthly_financial_position',
      status: 'blocked',
      shadow: identity.shadow,
      blockers: blocked(identity.shadow, 'Complete exact Central Shadow identity is required before Financial Position runtime execution.'),
      financialPosition: null,
    };
  }

  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_monthly_financial_position',
    status: 'ready',
    shadow: identity.shadow,
    blockers: [],
    financialPosition: buildMonthlyFinancialPosition({
      entries: identity.normalizedEntries,
      accounts,
      canonicalDefinitions,
      openingCostConfig,
      cutoffDate,
      goldPriceEgp,
      silverPriceEgp,
    }),
  };
};

export interface CentralEquityStatementRuntimeInput {
  accounts: Account[];
  entries: Entry[];
  canonicalDefinitions: CanonicalAccountDefinition[];
  openingCostConfig: AnnualOpeningCostConfig[];
  cutoffDate: string;
  goldPriceEgp?: number | null;
  silverPriceEgp?: number | null;
}

export interface CentralEquityStatementRuntimeReport {
  version: typeof CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION;
  mode: 'read_only_runtime_equity_statement';
  status: 'ready' | 'blocked';
  shadow: CentralAccountingShadowReport;
  blockers: CentralReadOnlyRuntimeBlocker[];
  equityStatement: EquityStatementEgpResult | null;
  balanceEngineVersion: string | null;
}

/**
 * Phase 4C read-only runtime adapter for the EGP Statement of Changes in Equity.
 * It preserves the existing equity roll-forward engine while moving operation
 * identity and the UI Balance Engine diagnostic behind the same exact Shadow gate.
 */
export const buildCentralAccountingReadOnlyRuntimeEquityStatement = ({
  accounts,
  entries,
  canonicalDefinitions,
  openingCostConfig,
  cutoffDate,
  goldPriceEgp = null,
  silverPriceEgp = null,
}: CentralEquityStatementRuntimeInput): CentralEquityStatementRuntimeReport => {
  const cutoffEntries = entries.filter(entry => entry.date <= cutoffDate);
  const identity = buildCentralRuntimeIdentity(accounts, cutoffEntries, canonicalDefinitions);
  if (!identity.normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_equity_statement',
      status: 'blocked',
      shadow: identity.shadow,
      blockers: blocked(identity.shadow, 'Complete exact Central Shadow identity is required before Equity Statement runtime execution.'),
      equityStatement: null,
      balanceEngineVersion: null,
    };
  }

  const normalizedEntries = identity.normalizedEntries;
  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_equity_statement',
    status: 'ready',
    shadow: identity.shadow,
    blockers: [],
    equityStatement: buildEquityStatementEgp({
      entries: normalizedEntries,
      accounts,
      canonicalDefinitions,
      openingCostConfig,
      cutoffDate,
      goldPriceEgp,
      silverPriceEgp,
    }),
    balanceEngineVersion: computeAccountBalances(normalizedEntries, accounts).balanceEngineVersion,
  };
};