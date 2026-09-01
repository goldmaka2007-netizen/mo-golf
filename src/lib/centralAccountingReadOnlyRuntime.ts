import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import {
  buildCentralAccountingShadowReport,
  type CentralAccountingShadowReport,
} from './centralAccountingShadow';
import { buildUnifiedTrialBalance, type UnifiedTrialBalanceReport } from './unifiedTrialBalance';

export const CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION = 'central-accounting-read-only-runtime-v1' as const;

export type CentralReadOnlyRuntimeBlockerCode =
  | 'central_shadow_not_exact'
  | 'runtime_identity_incomplete';

export interface CentralReadOnlyRuntimeBlocker {
  code: CentralReadOnlyRuntimeBlockerCode;
  message: string;
}

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

/**
 * Phase 4A read-only runtime adapter for the Unified Trial Balance.
 *
 * Phase 3 already proved offline that exact Registry-approved Shadow identity
 * leaves the existing downstream Ledger, Trial Balance, and Financial Statement
 * outputs unchanged. Runtime therefore performs only the required Central
 * Registry/Shadow identity gate, avoiding the cost of recalculating every Phase 3
 * evidence output on each UI refresh.
 *
 * The current Registry intentionally excludes inactive source accounts from its
 * normal definitions. For historical Entries that still reference such accounts,
 * this adapter supplies temporary in-memory account copies with isActive=true to
 * Shadow only, so their stable IDs and stored metadata remain resolvable. The
 * source account records stay unchanged and the final Trial Balance engine still
 * receives only the original active accounts, so inactive accounts are not
 * reactivated or reintroduced into report presentation.
 */
export const buildCentralAccountingReadOnlyRuntimeTrialBalance = ({
  accounts,
  entries,
  startDate,
  endDate,
  manualAccountDefinitions = [],
  timeline = null,
}: CentralTrialBalanceRuntimeInput): CentralTrialBalanceRuntimeReport => {
  const shadowAccounts = buildHistoricalShadowAccounts(accounts, entries);
  const shadow = buildCentralAccountingShadowReport({
    accounts: shadowAccounts,
    entries,
    manualAccountDefinitions,
  });

  if (shadow.status !== 'compared' || !shadow.parity || !shadow.exactParity) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_trial_balance',
      status: 'blocked',
      shadow,
      blockers: [{
        code: 'central_shadow_not_exact',
        message: 'Central Registry-gated Shadow must be complete and exact before Trial Balance runtime execution.',
      }],
      trialBalance: null,
    };
  }

  const normalizedEntries = buildRegistryApprovedRuntimeEntries(entries, shadow);
  if (!normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_trial_balance',
      status: 'blocked',
      shadow,
      blockers: [{
        code: 'runtime_identity_incomplete',
        message: 'Complete Registry-approved Shadow parity identity is required before Trial Balance runtime execution.',
      }],
      trialBalance: null,
    };
  }

  const activeAccounts = accounts.filter(account => account.isActive !== false);
  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_trial_balance',
    status: 'ready',
    shadow,
    blockers: [],
    trialBalance: buildUnifiedTrialBalance(normalizedEntries, activeAccounts, startDate, endDate, {
      canonicalDefinitions: manualAccountDefinitions,
      timeline,
    }),
  };
};
