import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import {
  buildCentralAccountingReadOnlyOutputEvidence,
  type CentralAccountingReadOnlyOutputEvidenceReport,
} from './centralAccountingReadOnlyOutputs';
import { buildUnifiedTrialBalance, type UnifiedTrialBalanceReport } from './unifiedTrialBalance';

export const CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION = 'central-accounting-read-only-runtime-v1' as const;

export type CentralReadOnlyRuntimeBlockerCode =
  | 'central_evidence_not_matched'
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
  evidence: CentralAccountingReadOnlyOutputEvidenceReport;
  blockers: CentralReadOnlyRuntimeBlocker[];
  trialBalance: UnifiedTrialBalanceReport | null;
}

const buildRegistryApprovedRuntimeEntries = (
  entries: Entry[],
  evidence: CentralAccountingReadOnlyOutputEvidenceReport,
): Entry[] | null => {
  const rows = evidence.shadow.parity?.rows ?? [];
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
 * Runtime use is allowed only after the complete Phase 3 evidence boundary
 * returns an exact match. Operation identity comes exclusively from complete
 * Central Shadow parity and is applied only to temporary in-memory Entry copies.
 * There is no legacy/source-identity fallback and no persistence side effect.
 */
export const buildCentralAccountingReadOnlyRuntimeTrialBalance = ({
  accounts,
  entries,
  startDate,
  endDate,
  manualAccountDefinitions = [],
  timeline = null,
}: CentralTrialBalanceRuntimeInput): CentralTrialBalanceRuntimeReport => {
  const evidence = buildCentralAccountingReadOnlyOutputEvidence({
    accounts,
    entries,
    startDate,
    endDate,
    manualAccountDefinitions,
    timeline,
  });

  if (evidence.status !== 'matched' || evidence.comparison?.exact !== true) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_trial_balance',
      status: 'blocked',
      evidence,
      blockers: [{
        code: 'central_evidence_not_matched',
        message: `Central read-only evidence is ${evidence.status}; Trial Balance runtime wiring did not execute.`,
      }],
      trialBalance: null,
    };
  }

  const normalizedEntries = buildRegistryApprovedRuntimeEntries(entries, evidence);
  if (!normalizedEntries) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
      mode: 'read_only_runtime_trial_balance',
      status: 'blocked',
      evidence,
      blockers: [{
        code: 'runtime_identity_incomplete',
        message: 'Complete Registry-approved Shadow parity identity is required before Trial Balance runtime execution.',
      }],
      trialBalance: null,
    };
  }

  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_RUNTIME_VERSION,
    mode: 'read_only_runtime_trial_balance',
    status: 'ready',
    evidence,
    blockers: [],
    trialBalance: buildUnifiedTrialBalance(normalizedEntries, accounts, startDate, endDate, {
      canonicalDefinitions: manualAccountDefinitions,
      timeline,
    }),
  };
};
