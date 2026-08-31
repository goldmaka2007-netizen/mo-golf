import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import {
  buildCentralAccountingRegistry,
  type CentralAccountingCoverageReport,
  type CentralAccountingRegistry,
} from './centralAccountingRegistry';
import { buildParityReport, type ParityReport } from './shadowAccounting';

export const CENTRAL_ACCOUNTING_SHADOW_VERSION = 'central-accounting-shadow-v1' as const;

export type CentralAccountingShadowBlockerCode =
  | 'operation_catalog_invalid'
  | 'operation_unmapped'
  | 'operation_identity_mismatch'
  | 'account_alias_ambiguous'
  | 'account_classification_conflict';

export interface CentralAccountingShadowBlocker {
  code: CentralAccountingShadowBlockerCode;
  message: string;
}

export interface CentralAccountingShadowInput {
  accounts: Account[];
  entries: Entry[];
  manualAccountDefinitions?: CanonicalAccountDefinition[];
}

export interface CentralAccountingShadowReport {
  version: typeof CENTRAL_ACCOUNTING_SHADOW_VERSION;
  mode: 'read_only_shadow';
  status: 'blocked' | 'compared';
  coverage: CentralAccountingCoverageReport;
  blockers: CentralAccountingShadowBlocker[];
  parity: ParityReport | null;
  exactParity: boolean;
}

const coverageBlockers = (coverage: CentralAccountingCoverageReport): CentralAccountingShadowBlocker[] => {
  const blockers: CentralAccountingShadowBlocker[] = [];
  if (coverage.operationCatalogIssues.length > 0) {
    blockers.push({
      code: 'operation_catalog_invalid',
      message: `Canonical operation catalog has ${coverage.operationCatalogIssues.length} validation issue(s).`,
    });
  }
  if (coverage.unmappedOperations.length > 0) {
    blockers.push({
      code: 'operation_unmapped',
      message: `${coverage.unmappedOperations.length} operation label(s) are unmapped.`,
    });
  }
  if (coverage.ambiguousAccountAliases.length > 0) {
    blockers.push({
      code: 'account_alias_ambiguous',
      message: `${coverage.ambiguousAccountAliases.length} account alias(es) are ambiguous.`,
    });
  }
  if (coverage.accountClassificationConflicts.length > 0) {
    blockers.push({
      code: 'account_classification_conflict',
      message: `${coverage.accountClassificationConflicts.length} account classification conflict(s) remain.`,
    });
  }
  return blockers;
};

const operationIdentityBlockers = (
  registry: CentralAccountingRegistry,
  entries: Entry[],
): CentralAccountingShadowBlocker[] => entries.flatMap(entry => {
  if (!entry.operationKind) return [];
  const resolution = registry.resolveOperation(entry.tx);
  if (resolution.status !== 'resolved' || resolution.operation.operationKind === entry.operationKind) return [];
  const sourceOperationId = entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '');
  return [{
    code: 'operation_identity_mismatch' as const,
    message: `Operation ${sourceOperationId || '(unknown id)'} resolves tx "${String(entry.tx ?? '').trim()}" to ${resolution.operation.id}/${resolution.operation.operationKind} but stores operationKind=${entry.operationKind}.`,
  }];
});

/**
 * Phase 2 read-only shadow boundary.
 *
 * The Central Accounting Registry is the mandatory preflight gate. If its
 * Shadow readiness checks fail, or stored operation identity contradicts the
 * Registry identity resolved from tx, no canonical parity comparison is
 * exposed. Existing Production posting/save behavior remains authoritative
 * and this function has no persistence side effects.
 */
export const buildCentralAccountingShadowReport = ({
  accounts,
  entries,
  manualAccountDefinitions = [],
}: CentralAccountingShadowInput): CentralAccountingShadowReport => {
  const registry = buildCentralAccountingRegistry({
    accounts,
    entries,
    manualAccountDefinitions,
  });
  const blockers = [
    ...coverageBlockers(registry.coverage),
    ...operationIdentityBlockers(registry, entries),
  ];

  if (!registry.coverage.shadowReady || blockers.length > 0) {
    return {
      version: CENTRAL_ACCOUNTING_SHADOW_VERSION,
      mode: 'read_only_shadow',
      status: 'blocked',
      coverage: registry.coverage,
      blockers,
      parity: null,
      exactParity: false,
    };
  }

  const parity = buildParityReport(entries, accounts, registry.accountRegistry);
  return {
    version: CENTRAL_ACCOUNTING_SHADOW_VERSION,
    mode: 'read_only_shadow',
    status: 'compared',
    coverage: registry.coverage,
    blockers: [],
    parity,
    exactParity: parity.open === 0 && parity.errors === 0,
  };
};
