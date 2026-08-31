import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { buildAccountRegistry, type AccountRegistry } from './accountRegistry';
import {
  CANONICAL_OPERATION_CATALOG,
  buildCanonicalOperationAliasIndex,
  type CanonicalOperationDefinition,
  type CanonicalOperationResolution,
  resolveCanonicalOperationLabel,
  validateCanonicalOperationCatalog,
} from './canonicalOperationCatalog';

export const CENTRAL_ACCOUNTING_REGISTRY_VERSION = 'central-accounting-registry-v1' as const;

export interface CentralAccountingRegistryInput {
  accounts: Account[];
  entries?: Entry[];
  manualAccountDefinitions?: CanonicalAccountDefinition[];
  operationCatalog?: readonly CanonicalOperationDefinition[];
}

export interface RegistryOperationUsage {
  label: string;
  count: number;
  operationId?: string;
  availability?: CanonicalOperationDefinition['availability'];
}

export interface RegistryAccountCoverageIssue {
  accountId: string;
  accountName: string;
  reason: 'historical_account_needs_mapping' | 'classification_conflict' | 'account_needs_approval';
}

export interface CentralAccountingCoverageReport {
  registryVersion: typeof CENTRAL_ACCOUNTING_REGISTRY_VERSION;
  operationCatalogIssues: string[];
  unmappedOperations: RegistryOperationUsage[];
  historicalOnlyOperationsUsed: RegistryOperationUsage[];
  transitionOperationsUsed: RegistryOperationUsage[];
  operationUsage: RegistryOperationUsage[];
  ambiguousAccountAliases: string[];
  historicalAccountsNeedingMapping: RegistryAccountCoverageIssue[];
  accountClassificationConflicts: RegistryAccountCoverageIssue[];
  accountsNeedingApproval: RegistryAccountCoverageIssue[];
  shadowReady: boolean;
  cutoverReady: boolean;
}

export interface CentralAccountingRegistry {
  version: typeof CENTRAL_ACCOUNTING_REGISTRY_VERSION;
  mode: 'read_only';
  accountRegistry: AccountRegistry;
  operations: readonly CanonicalOperationDefinition[];
  operationsById: Map<string, CanonicalOperationDefinition>;
  operationAliases: Map<string, CanonicalOperationDefinition[]>;
  resolveOperation: (label: string | undefined) => CanonicalOperationResolution;
  coverage: CentralAccountingCoverageReport;
}

const operationUsage = (
  entries: Entry[],
  catalog: readonly CanonicalOperationDefinition[],
): RegistryOperationUsage[] => {
  const counts = new Map<string, number>();
  entries.forEach(entry => {
    const label = String(entry.tx ?? '').trim();
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => {
      const resolution = resolveCanonicalOperationLabel(label, catalog);
      return resolution.status === 'resolved'
        ? { label, count, operationId: resolution.operation.id, availability: resolution.operation.availability }
        : { label, count };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
};

const collectAccountIssues = (registry: AccountRegistry): {
  mapping: RegistryAccountCoverageIssue[];
  conflicts: RegistryAccountCoverageIssue[];
  approvals: RegistryAccountCoverageIssue[];
} => {
  const mapping = registry.accounts
    .filter(account => account.isHistoricalOnly && !account.sourceAccountId && account.approvalStatus !== 'approved')
    .map(account => ({
      accountId: account.id,
      accountName: account.displayName,
      reason: 'historical_account_needs_mapping' as const,
    }));
  const conflicts = registry.accounts
    .filter(account => account.classificationConflicts.length > 0)
    .map(account => ({
      accountId: account.id,
      accountName: account.displayName,
      reason: 'classification_conflict' as const,
    }));
  const approvals = registry.accounts
    .filter(account => account.isActive && account.approvalStatus !== 'approved')
    .map(account => ({
      accountId: account.id,
      accountName: account.displayName,
      reason: 'account_needs_approval' as const,
    }));
  return { mapping, conflicts, approvals };
};

export const buildCentralAccountingCoverageReport = (
  accountRegistry: AccountRegistry,
  entries: Entry[],
  operationCatalog: readonly CanonicalOperationDefinition[] = CANONICAL_OPERATION_CATALOG,
): CentralAccountingCoverageReport => {
  const usage = operationUsage(entries, operationCatalog);
  const operationCatalogIssues = validateCanonicalOperationCatalog(operationCatalog);
  const unmappedOperations = usage.filter(item => !item.operationId);
  const historicalOnlyOperationsUsed = usage.filter(item => item.availability === 'historical_only');
  const transitionOperationsUsed = usage.filter(item => item.availability === 'transition_only');
  const ambiguousAccountAliases = [...accountRegistry.ambiguousAliases.keys()].sort((a, b) => a.localeCompare(b, 'ar'));
  const accountIssues = collectAccountIssues(accountRegistry);
  const shadowReady = operationCatalogIssues.length === 0
    && unmappedOperations.length === 0
    && ambiguousAccountAliases.length === 0
    && accountIssues.conflicts.length === 0;
  const cutoverReady = shadowReady
    && accountIssues.mapping.length === 0
    && accountIssues.approvals.length === 0
    && transitionOperationsUsed.length === 0;
  return {
    registryVersion: CENTRAL_ACCOUNTING_REGISTRY_VERSION,
    operationCatalogIssues,
    unmappedOperations,
    historicalOnlyOperationsUsed,
    transitionOperationsUsed,
    operationUsage: usage,
    ambiguousAccountAliases,
    historicalAccountsNeedingMapping: accountIssues.mapping,
    accountClassificationConflicts: accountIssues.conflicts,
    accountsNeedingApproval: accountIssues.approvals,
    shadowReady,
    cutoverReady,
  };
};

/**
 * Single read-only discovery boundary for Phase 1.
 *
 * This function has no persistence side effects and deliberately does not
 * activate canonical posting. Existing Production write/save behavior remains
 * authoritative until a separately approved cutover phase.
 */
export const buildCentralAccountingRegistry = ({
  accounts,
  entries = [],
  manualAccountDefinitions = [],
  operationCatalog = CANONICAL_OPERATION_CATALOG,
}: CentralAccountingRegistryInput): CentralAccountingRegistry => {
  const accountRegistry = buildAccountRegistry(accounts, entries, manualAccountDefinitions);
  const operationsById = new Map(operationCatalog.map(operation => [operation.id, operation]));
  const operationAliases = buildCanonicalOperationAliasIndex(operationCatalog);
  return {
    version: CENTRAL_ACCOUNTING_REGISTRY_VERSION,
    mode: 'read_only',
    accountRegistry,
    operations: operationCatalog,
    operationsById,
    operationAliases,
    resolveOperation: label => resolveCanonicalOperationLabel(label, operationCatalog),
    coverage: buildCentralAccountingCoverageReport(accountRegistry, entries, operationCatalog),
  };
};
