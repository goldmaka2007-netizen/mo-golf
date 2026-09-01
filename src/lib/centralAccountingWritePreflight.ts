import type {
  Account,
  AnnualOpeningCostConfig,
  CanonicalAccountDefinition,
  Entry,
} from '../types';
import { buildCentralAccountingRegistry, type CentralAccountingCoverageReport } from './centralAccountingRegistry';
import type { CanonicalOperationDefinition } from './canonicalOperationCatalog';
import { buildCanonicalPosting, type CanonicalPostingResult } from './postingMatrix';
import { validateAccountingPolicy } from './accountingPolicy';
import { validateEntryNumberingPolicy } from './entryValidation';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from './goldEquivalent';
import { isGoldEquivalentEntry } from '../utils/accountLogic';
import { isQuantityAlignedToStep } from './weightedAverageCost';
import { buildOpeningCostConfig } from './openingCostConfig';
import { rebuildRuntimeInventoryCostTimeline } from './costRecalculation';

export type CentralWriteSource = 'user' | 'system' | 'setup';
export type CentralWriteMode = 'create' | 'update';

export type CentralWriteBlockerCode =
  | 'registry_not_cutover_ready'
  | 'operation_unknown'
  | 'operation_ambiguous'
  | 'operation_kind_conflict'
  | 'operation_not_writable'
  | 'account_unknown'
  | 'account_ambiguous'
  | 'account_not_writable'
  | 'account_missing_stable_id'
  | 'create_id_conflict'
  | 'update_target_missing'
  | 'accounting_policy'
  | 'numbering_policy'
  | 'posting_invalid'
  | 'gold_equivalent_invalid'
  | 'accessory_quantity_invalid'
  | 'cost_invalid';

export interface CentralWriteBlocker {
  code: CentralWriteBlockerCode;
  message: string;
  side?: 'debit' | 'credit';
}

export interface CentralWritePreflightInput {
  entry: Entry;
  entries: Entry[];
  accounts: Account[];
  openingCostConfig: AnnualOpeningCostConfig[];
  manualAccountDefinitions?: CanonicalAccountDefinition[];
  operationCatalog?: readonly CanonicalOperationDefinition[];
  source: CentralWriteSource;
  mode?: CentralWriteMode;
}

export interface CentralWritePreflightResult {
  ready: boolean;
  blockers: CentralWriteBlocker[];
  coverage: CentralAccountingCoverageReport;
  operation?: CanonicalOperationDefinition;
  preparedEntry?: Entry;
  posting?: CanonicalPostingResult;
}

const coverageSummary = (coverage: CentralAccountingCoverageReport): string => {
  const parts = [
    coverage.unmappedOperations.length > 0 ? `unmapped_operations=${coverage.unmappedOperations.length}` : '',
    coverage.ambiguousAccountAliases.length > 0 ? `ambiguous_aliases=${coverage.ambiguousAccountAliases.length}` : '',
    coverage.historicalAccountsNeedingMapping.length > 0 ? `historical_mappings=${coverage.historicalAccountsNeedingMapping.length}` : '',
    coverage.accountClassificationConflicts.length > 0 ? `classification_conflicts=${coverage.accountClassificationConflicts.length}` : '',
    coverage.accountsNeedingApproval.length > 0 ? `accounts_needing_approval=${coverage.accountsNeedingApproval.length}` : '',
    coverage.transitionOperationsStillWritable.length > 0 ? `transition_writers=${coverage.transitionOperationsStillWritable.join(',')}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'cutover readiness gate is false';
};

const resolveWritableAccount = (
  side: 'debit' | 'credit',
  entry: Entry,
  registry: ReturnType<typeof buildCentralAccountingRegistry>,
  blockers: CentralWriteBlocker[],
): CanonicalAccountDefinition | undefined => {
  const accountId = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const accountName = side === 'debit' ? entry.debit : entry.credit;
  const resolution = registry.accountRegistry.resolve(accountId, accountName);
  if (resolution.status === 'unknown') {
    blockers.push({ code: 'account_unknown', side, message: `${side} account is unknown: ${resolution.value}` });
    return undefined;
  }
  if (resolution.status === 'ambiguous') {
    blockers.push({ code: 'account_ambiguous', side, message: `${side} account alias is ambiguous: ${resolution.value}` });
    return undefined;
  }
  if (!resolution.account.isActive || resolution.account.isHistoricalOnly) {
    blockers.push({ code: 'account_not_writable', side, message: `${side} account is inactive or historical-only: ${resolution.account.displayName}` });
    return undefined;
  }
  if (!resolution.account.sourceAccountId) {
    blockers.push({ code: 'account_missing_stable_id', side, message: `${side} account has no stable source account id: ${resolution.account.displayName}` });
    return undefined;
  }
  return resolution.account;
};

const operationIsWritable = (
  operation: CanonicalOperationDefinition,
  source: CentralWriteSource,
): boolean => {
  if (source === 'user') {
    return operation.userSelectable && operation.availability === 'current_runtime';
  }
  if (source === 'setup') {
    return operation.userSelectable && operation.availability === 'setup_only';
  }
  return operation.systemGenerated && operation.availability === 'current_runtime';
};

const buildCostCandidateEntries = (
  preparedEntry: Entry,
  entries: Entry[],
  mode: CentralWriteMode,
  blockers: CentralWriteBlocker[],
): Entry[] | null => {
  if (mode === 'create') {
    if (preparedEntry.id && entries.some(existing => existing.id === preparedEntry.id)) {
      blockers.push({
        code: 'create_id_conflict',
        message: `Create candidate id already exists: ${preparedEntry.id}`,
      });
      return null;
    }
    return [...entries, { ...preparedEntry, id: preparedEntry.id || '__central_write_preflight__' }];
  }

  if (!preparedEntry.id) {
    blockers.push({ code: 'update_target_missing', message: 'Update preflight requires the existing Entry id.' });
    return null;
  }
  const matchingIndexes = entries
    .map((existing, index) => existing.id === preparedEntry.id ? index : -1)
    .filter(index => index >= 0);
  if (matchingIndexes.length !== 1) {
    blockers.push({
      code: 'update_target_missing',
      message: `Update target must resolve to exactly one existing Entry: ${preparedEntry.id}`,
    });
    return null;
  }
  return entries.map((existing, index) => index === matchingIndexes[0] ? preparedEntry : existing);
};

/**
 * Phase 5A pure write-path preflight.
 *
 * This function performs no persistence and is intentionally not wired to any
 * current writer. It proves whether a create/update candidate can be prepared
 * using Central Registry identity while preserving the existing Posting Matrix,
 * accounting policy, numbering, gold-equivalent, quantity-step, and runtime
 * inventory-cost validators.
 */
export const buildCentralAccountingWritePreflight = ({
  entry,
  entries,
  accounts,
  openingCostConfig,
  manualAccountDefinitions = [],
  operationCatalog,
  source,
  mode = 'create',
}: CentralWritePreflightInput): CentralWritePreflightResult => {
  const registry = buildCentralAccountingRegistry({
    accounts,
    entries,
    manualAccountDefinitions,
    operationCatalog,
  });
  const blockers: CentralWriteBlocker[] = [];

  if (!registry.coverage.cutoverReady) {
    blockers.push({
      code: 'registry_not_cutover_ready',
      message: `Central Registry is not cutover-ready: ${coverageSummary(registry.coverage)}`,
    });
  }

  const operationResolution = registry.resolveOperation(entry.tx);
  let operation: CanonicalOperationDefinition | undefined;
  if (operationResolution.status === 'unknown') {
    blockers.push({ code: 'operation_unknown', message: `Unknown operation: ${operationResolution.label || '<blank>'}` });
  } else if (operationResolution.status === 'ambiguous') {
    blockers.push({ code: 'operation_ambiguous', message: `Ambiguous operation: ${operationResolution.label}` });
  } else {
    operation = operationResolution.operation;
    if (entry.operationKind && entry.operationKind !== operation.operationKind) {
      blockers.push({
        code: 'operation_kind_conflict',
        message: `Stored operationKind ${entry.operationKind} contradicts Central operation ${operation.operationKind}.`,
      });
    }
    if (!operationIsWritable(operation, source)) {
      blockers.push({
        code: 'operation_not_writable',
        message: `Operation ${operation.id} is not writable from source ${source} (availability=${operation.availability}).`,
      });
    }
  }

  const debit = resolveWritableAccount('debit', entry, registry, blockers);
  const credit = resolveWritableAccount('credit', entry, registry, blockers);
  if (!operation || !debit || !credit) {
    return { ready: false, blockers, coverage: registry.coverage, operation };
  }

  const preparedEntry: Entry = {
    ...entry,
    operationKind: operation.operationKind,
    debit: debit.displayName,
    credit: credit.displayName,
    debitAccountId: debit.sourceAccountId,
    creditAccountId: credit.sourceAccountId,
  };

  const accountingPolicyIssues = validateAccountingPolicy(preparedEntry, accounts);
  accountingPolicyIssues.forEach(issue => blockers.push({
    code: 'accounting_policy',
    message: `${issue.code}: ${issue.message}`,
  }));

  const numbering = validateEntryNumberingPolicy(preparedEntry);
  if (!numbering.valid) {
    blockers.push({
      code: 'numbering_policy',
      message: numbering.issues.map(issue => issue.message).join(' — '),
    });
  }

  if (isGoldEquivalentEntry(preparedEntry, accounts)) {
    const calculationKarat = preparedEntry.karat ?? inferGoldKaratFromMultiplier(preparedEntry.multiplier);
    if (!canCalculateGoldEquivalent21(preparedEntry.weight, calculationKarat)) {
      blockers.push({ code: 'gold_equivalent_invalid', message: 'Gold weight/karat cannot produce a valid E21 snapshot.' });
    } else {
      const audit = buildGoldEquivalent21Audit(preparedEntry.weight, calculationKarat);
      if (audit) {
        preparedEntry.arabicWeight = audit.snapshot.equivalent21;
        preparedEntry.goldEquivalent21Snapshot = audit.snapshot;
        if (audit.legacyComparison) preparedEntry.goldEquivalent21LegacyComparison = audit.legacyComparison;
      }
    }
  }

  const accessoryAccount = accounts.find(account =>
    account.type === 'accessory'
    && (account.id === preparedEntry.debitAccountId || account.id === preparedEntry.creditAccountId),
  );
  if (accessoryAccount && !isQuantityAlignedToStep(preparedEntry.count, accessoryAccount.quantityStep ?? 1)) {
    blockers.push({
      code: 'accessory_quantity_invalid',
      message: `Accessory quantity must align to step ${accessoryAccount.quantityStep ?? 1}.`,
    });
  }

  const posting = buildCanonicalPosting(preparedEntry, registry.accountRegistry);
  if (!posting.valid) {
    blockers.push({
      code: 'posting_invalid',
      message: posting.issues.map(issue => issue.message).join(' — '),
    });
  }

  const costEntries = buildCostCandidateEntries(preparedEntry, entries, mode, blockers);
  if (costEntries) {
    const cost = rebuildRuntimeInventoryCostTimeline(
      costEntries,
      accounts,
      buildOpeningCostConfig(openingCostConfig, accounts),
    );
    if (!cost.valid) {
      const diagnostic = cost.diagnostics[0];
      blockers.push({
        code: 'cost_invalid',
        message: `${diagnostic?.code || 'unknown'}: ${diagnostic?.message || 'Runtime inventory cost validation failed.'}`,
      });
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    coverage: registry.coverage,
    operation,
    preparedEntry,
    posting,
  };
};
