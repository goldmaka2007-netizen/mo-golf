import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { type CanonicalLedgerDimension, type CanonicalLedgerLeg, type CanonicalPostingSet, validateCanonicalPostingSet } from './canonicalMappingDesign';
import { buildLegacyJournalProjection, type LegacyJournalProjection } from './legacyLedger';
import { isValidAccountingEntry } from './canonicalAccounting';

export type AccountingEngineMode = 'legacy' | 'canonical_preview';
export interface CanonicalMappingRule { id: string; matches: (entry: Entry) => boolean; build: (entry: Entry) => CanonicalPostingSet; }
export type CanonicalMappingResolution =
  | { status: 'matched'; ruleId: string; approvedVariantId?: string; posting: CanonicalPostingSet }
  | { status: 'unmatched' }
  | { status: 'ambiguous'; ruleIds: string[] }
  | { status: 'invalid'; errors: string[] };
export interface CanonicalMappingResolver { version?: string; resolve: (entry: Entry) => CanonicalMappingResolution; }
export interface CanonicalExecutionIssue {
  sourceOperationId: string;
  code: 'mapping_not_found' | 'mapping_ambiguous' | 'posting_not_executable' | 'posting_invalid';
  message: string;
  ruleIds?: string[];
}
export interface CanonicalRuntimeLeg extends CanonicalLedgerLeg {
  dimension: CanonicalLedgerDimension; sourceOperationId: string; operationType: string;
  fiscalYear: number; date: string; ruleVersion: string;
}
export interface LegacyAccountingEngineResult {
  mode: 'legacy'; source: 'legacy_raw_fields'; ready: true; legacyProjection: LegacyJournalProjection;
  canonicalCatalogVersion: null; canonicalPostings: []; canonicalLegs: []; issues: [];
}
export interface CanonicalPreviewAccountingEngineResult {
  mode: 'canonical_preview'; source: 'canonical_mapping'; ready: boolean; legacyProjection: null;
  canonicalCatalogVersion: string | null;
  canonicalPostings: CanonicalPostingSet[]; canonicalLegs: CanonicalRuntimeLeg[]; issues: CanonicalExecutionIssue[];
}
export type AccountingEngineResult = LegacyAccountingEngineResult | CanonicalPreviewAccountingEngineResult;
export interface AccountingEngineOptions {
  mode?: AccountingEngineMode;
  canonicalDefinitions?: CanonicalAccountDefinition[];
  canonicalResolver?: CanonicalMappingResolver;
}

const operationId = (entry: Entry): string => entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '');
const flattenDimension = (posting: CanonicalPostingSet, dimension: CanonicalLedgerDimension, legs: CanonicalLedgerLeg[], entry: Entry): CanonicalRuntimeLeg[] => legs.map(leg => ({
  ...leg, dimension, sourceOperationId: posting.sourceOperationId, operationType: posting.operationType,
  fiscalYear: posting.fiscalYear, date: entry.date, ruleVersion: posting.ruleVersion,
}));
const flattenPosting = (posting: CanonicalPostingSet, entry: Entry): CanonicalRuntimeLeg[] => [
  ...flattenDimension(posting, 'cash', posting.cashLedgerLegs, entry),
  ...flattenDimension(posting, 'gold', posting.goldLedgerLegs, entry),
  ...flattenDimension(posting, 'silver', posting.silverLedgerLegs, entry),
];

/** Creates a deterministic resolver without array-order precedence. */
export const createCanonicalMappingResolver = (rules: CanonicalMappingRule[]): CanonicalMappingResolver => ({
  resolve: entry => {
    const matches = rules.filter(rule => rule.matches(entry));
    if (matches.length === 0) return { status: 'unmatched' };
    if (matches.length > 1) return { status: 'ambiguous', ruleIds: matches.map(rule => rule.id) };
    return { status: 'matched', ruleId: matches[0].id, posting: matches[0].build(entry) };
  },
});

/**
 * Production accounting integration boundary. Legacy remains the default.
 * Canonical preview is pure/in-memory and fail-closed: one unsafe mapping
 * prevents all canonical legs from being exposed to downstream consumers.
 */
export const buildAccountingEngineProjection = (entries: Entry[], accounts: Account[], options: AccountingEngineOptions = {}): AccountingEngineResult => {
  if ((options.mode ?? 'legacy') === 'legacy') {
    return {
      mode: 'legacy', source: 'legacy_raw_fields', ready: true,
      legacyProjection: buildLegacyJournalProjection(entries, accounts, options.canonicalDefinitions),
      canonicalCatalogVersion: null,
      canonicalPostings: [], canonicalLegs: [], issues: [],
    };
  }
  const resolver = options.canonicalResolver;
  const issues: CanonicalExecutionIssue[] = [];
  const postings: CanonicalPostingSet[] = [];
  const legs: CanonicalRuntimeLeg[] = [];
  entries.filter(isValidAccountingEntry).forEach(entry => {
    const sourceOperationId = operationId(entry);
    if (!resolver) {
      issues.push({ sourceOperationId, code: 'mapping_not_found', message: 'Canonical preview requires an explicit approved mapping resolver.' });
      return;
    }
    const resolution = resolver.resolve(entry);
    if (resolution.status === 'unmatched') {
      issues.push({ sourceOperationId, code: 'mapping_not_found', message: 'No canonical mapping matched this operation.' });
      return;
    }
    if (resolution.status === 'ambiguous') {
      issues.push({ sourceOperationId, code: 'mapping_ambiguous', message: 'More than one canonical mapping matched this operation.', ruleIds: resolution.ruleIds });
      return;
    }
    if (resolution.status === 'invalid') {
      issues.push({ sourceOperationId, code: 'posting_invalid', message: resolution.errors.join('; ') });
      return;
    }
    const posting = resolution.posting;
    if (posting.postingStatus !== 'canonical_balanced' || posting.balancingStatus !== 'balanced') {
      issues.push({ sourceOperationId, code: 'posting_not_executable', message: `Mapping ${resolution.ruleId} has status ${posting.postingStatus}/${posting.balancingStatus}.`, ruleIds: [resolution.ruleId] });
      return;
    }
    const validationErrors = validateCanonicalPostingSet(posting);
    if (validationErrors.length > 0) {
      issues.push({ sourceOperationId, code: 'posting_invalid', message: validationErrors.join('; '), ruleIds: [resolution.ruleId] });
      return;
    }
    postings.push(posting);
    legs.push(...flattenPosting(posting, entry));
  });
  const ready = issues.length === 0;
  return {
    mode: 'canonical_preview',
    source: 'canonical_mapping',
    ready,
    legacyProjection: null,
    canonicalCatalogVersion: resolver?.version ?? null,
    canonicalPostings: postings,
    canonicalLegs: ready ? legs : [],
    issues,
  };
};
