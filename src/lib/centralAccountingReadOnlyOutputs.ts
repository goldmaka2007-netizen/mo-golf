import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { buildCentralAccountingShadowReport, type CentralAccountingShadowReport } from './centralAccountingShadow';
import { buildFinancialStatementsEgp, type FinancialStatementsEgp } from './financialStatementsEgp';
import { buildLegacyLedgerLegs, type LegacyLedgerLeg } from './legacyLedger';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import { buildUnifiedTrialBalance, type UnifiedTrialBalanceReport } from './unifiedTrialBalance';

export const CENTRAL_ACCOUNTING_READ_ONLY_OUTPUT_EVIDENCE_VERSION = 'central-accounting-read-only-output-evidence-v1' as const;

export type CentralReadOnlyOutputBlockerCode =
  | 'shadow_blocked'
  | 'shadow_parity_not_exact'
  | 'projection_mismatch'
  | 'trial_balance_mismatch'
  | 'financial_statements_mismatch';

export interface CentralReadOnlyOutputBlocker {
  code: CentralReadOnlyOutputBlockerCode;
  message: string;
}

export interface CentralReadOnlyOutputSummary {
  projectionLegCount: number;
  trialBalanceRowCount: number;
  trialBalanceFinancialBalanced: boolean;
  trialBalanceFinancialDifference: number;
  financialPositionDifference: number;
  incomeNetProfit: number;
}

export interface CentralReadOnlyOutputComparison {
  projectionExact: boolean;
  trialBalanceExact: boolean;
  financialStatementsExact: boolean;
  exact: boolean;
}

export interface CentralAccountingReadOnlyOutputEvidenceInput {
  accounts: Account[];
  entries: Entry[];
  startDate: string;
  endDate: string;
  manualAccountDefinitions?: CanonicalAccountDefinition[];
  timeline?: InventoryCostTimeline | null;
}

export interface CentralAccountingReadOnlyOutputEvidenceReport {
  version: typeof CENTRAL_ACCOUNTING_READ_ONLY_OUTPUT_EVIDENCE_VERSION;
  mode: 'read_only_output_evidence';
  status: 'blocked' | 'matched' | 'mismatch';
  shadow: CentralAccountingShadowReport;
  blockers: CentralReadOnlyOutputBlocker[];
  comparison: CentralReadOnlyOutputComparison | null;
  sourceSummary: CentralReadOnlyOutputSummary | null;
  centralSummary: CentralReadOnlyOutputSummary | null;
}

interface OutputBundle {
  projection: LegacyLedgerLeg[];
  trialBalance: UnifiedTrialBalanceReport;
  financialStatements: FinancialStatementsEgp;
}

const stableSerialize = (value: unknown): string => {
  const stack = new WeakSet<object>();
  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== 'object') return input;
    if (stack.has(input as object)) return '[Circular]';
    stack.add(input as object);
    const normalized = Array.isArray(input)
      ? input.map(normalize)
      : Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, item]) => [key, normalize(item)]));
    stack.delete(input as object);
    return normalized;
  };
  return JSON.stringify(normalize(value));
};

const projectionSnapshot = (legs: LegacyLedgerLeg[]): unknown[] => legs.map(leg => ({
  entityId: leg.entityId,
  accountName: leg.accountName,
  dimension: leg.dimension,
  side: leg.side,
  amount: leg.amount,
  sourceEntryId: leg.sourceEntryId,
  operationKind: leg.operationKind,
  date: leg.date,
  isOpening: leg.isOpening,
  group: leg.group,
  oppositeAccount: leg.oppositeAccount,
  amountMinor: leg.amountMinor,
  accountId: leg.accountId ?? null,
  canonicalCategory: leg.canonicalCategory ?? null,
  metalType: leg.metalType ?? null,
  quantityBasis: leg.quantityBasis ?? null,
  bookValueSource: leg.bookValueSource ?? null,
  origin: leg.origin,
  generatedLegId: leg.generatedLegId,
  deduplicationId: leg.deduplicationId,
  account: {
    entityId: leg.account.entityId,
    accountName: leg.account.accountName,
    group: leg.account.group,
    description: leg.account.description,
    normalBalance: leg.account.normalBalance,
    sourceAccountId: leg.account.sourceAccount?.id ?? null,
  },
}));

const buildOutputBundle = (
  entries: Entry[],
  accounts: Account[],
  definitions: CanonicalAccountDefinition[],
  timeline: InventoryCostTimeline | null,
  startDate: string,
  endDate: string,
): OutputBundle => ({
  projection: buildLegacyLedgerLegs(
    entries.filter(entry => entry.date <= endDate),
    accounts,
    definitions,
    { enableFinancialProjection: true, costTimeline: timeline },
  ),
  trialBalance: buildUnifiedTrialBalance(entries, accounts, startDate, endDate, {
    canonicalDefinitions: definitions,
    timeline,
  }),
  financialStatements: buildFinancialStatementsEgp(entries, accounts, {
    canonicalDefinitions: definitions,
    timeline,
    incomeStartDate: startDate,
    incomeEndDate: endDate,
    balanceEndDate: endDate,
  }),
});

const summarize = (bundle: OutputBundle): CentralReadOnlyOutputSummary => ({
  projectionLegCount: bundle.projection.length,
  trialBalanceRowCount: bundle.trialBalance.rows.length,
  trialBalanceFinancialBalanced: bundle.trialBalance.financialBalanced,
  trialBalanceFinancialDifference: bundle.trialBalance.financialDifference,
  financialPositionDifference: bundle.financialStatements.balanceSheet.balances.assetsLessLiabilitiesAndEquity,
  incomeNetProfit: bundle.financialStatements.incomeStatement.netProfit,
});

const normalizedEntriesFromShadow = (entries: Entry[], shadow: CentralAccountingShadowReport): Entry[] => {
  if (!shadow.parity) return entries.map(entry => ({ ...entry }));
  return entries.map((entry, index) => ({
    ...entry,
    operationKind: shadow.parity?.rows[index]?.canonicalResult.operationKind ?? entry.operationKind,
  }));
};

/**
 * Phase 3 read-only downstream evidence boundary.
 *
 * No output is compared unless Phase 2 Shadow is both unblocked and exact.
 * Once accepted, only temporary entry copies receive the Registry-approved
 * operation identity already exposed by Shadow parity. Existing projection,
 * Trial Balance, and Financial Statement engines are then run twice: once on
 * the untouched source entries and once on the temporary normalized copies.
 * Any downstream difference fails closed as evidence; no writer or persistence
 * path is activated here.
 */
export const buildCentralAccountingReadOnlyOutputEvidence = ({
  accounts,
  entries,
  startDate,
  endDate,
  manualAccountDefinitions = [],
  timeline = null,
}: CentralAccountingReadOnlyOutputEvidenceInput): CentralAccountingReadOnlyOutputEvidenceReport => {
  const shadow = buildCentralAccountingShadowReport({
    accounts,
    entries,
    manualAccountDefinitions,
  });

  if (shadow.status !== 'compared' || !shadow.parity) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_OUTPUT_EVIDENCE_VERSION,
      mode: 'read_only_output_evidence',
      status: 'blocked',
      shadow,
      blockers: [{
        code: 'shadow_blocked',
        message: 'Central Shadow is blocked; downstream read-only outputs were not evaluated.',
      }],
      comparison: null,
      sourceSummary: null,
      centralSummary: null,
    };
  }

  if (!shadow.exactParity) {
    return {
      version: CENTRAL_ACCOUNTING_READ_ONLY_OUTPUT_EVIDENCE_VERSION,
      mode: 'read_only_output_evidence',
      status: 'blocked',
      shadow,
      blockers: [{
        code: 'shadow_parity_not_exact',
        message: 'Central Shadow parity is not exact; downstream read-only outputs were not evaluated.',
      }],
      comparison: null,
      sourceSummary: null,
      centralSummary: null,
    };
  }

  const definitions = manualAccountDefinitions;
  const normalizedEntries = normalizedEntriesFromShadow(entries, shadow);
  const source = buildOutputBundle(entries, accounts, definitions, timeline, startDate, endDate);
  const central = buildOutputBundle(normalizedEntries, accounts, definitions, timeline, startDate, endDate);

  const projectionExact = stableSerialize(projectionSnapshot(source.projection))
    === stableSerialize(projectionSnapshot(central.projection));
  const trialBalanceExact = stableSerialize(source.trialBalance) === stableSerialize(central.trialBalance);
  const financialStatementsExact = stableSerialize(source.financialStatements) === stableSerialize(central.financialStatements);
  const exact = projectionExact && trialBalanceExact && financialStatementsExact;
  const blockers: CentralReadOnlyOutputBlocker[] = [];
  if (!projectionExact) blockers.push({
    code: 'projection_mismatch',
    message: 'Ledger/financial projection differs after Central Shadow normalization.',
  });
  if (!trialBalanceExact) blockers.push({
    code: 'trial_balance_mismatch',
    message: 'Unified Trial Balance differs after Central Shadow normalization.',
  });
  if (!financialStatementsExact) blockers.push({
    code: 'financial_statements_mismatch',
    message: 'Financial Statements differ after Central Shadow normalization.',
  });

  return {
    version: CENTRAL_ACCOUNTING_READ_ONLY_OUTPUT_EVIDENCE_VERSION,
    mode: 'read_only_output_evidence',
    status: exact ? 'matched' : 'mismatch',
    shadow,
    blockers,
    comparison: { projectionExact, trialBalanceExact, financialStatementsExact, exact },
    sourceSummary: summarize(source),
    centralSummary: summarize(central),
  };
};
