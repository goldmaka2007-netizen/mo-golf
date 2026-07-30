import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import {
  buildLegacyJournalProjection,
  type LegacyJournalProjection,
  type LegacyLedgerLeg,
} from './legacyLedger';
import type { InventoryCostTimeline } from './inventoryCostTypes';

export interface FinancialPostingProjection {
  source: 'accounting_engine_posting_projection';
  journal: LegacyJournalProjection;
  legs: LegacyLedgerLeg[];
}

/**
 * Single accounting projection consumed by the journal, ledger, trial balance,
 * and financial statements. Reports aggregate these journal legs and never
 * reinterpret raw entries or Cost Engine results independently.
 */
export const buildFinancialPostingProjection = (
  entries: Entry[],
  accounts: Account[],
  canonicalDefinitions: CanonicalAccountDefinition[] = [],
  costTimeline?: InventoryCostTimeline | null,
): FinancialPostingProjection => {
  const excludedOperationIds = new Set(costTimeline?.excludedHistoricalOperationIds ?? []);
  const projectedEntries = excludedOperationIds.size === 0 ? entries : entries.filter(entry =>
    !excludedOperationIds.has(String(entry.id || entry.legacyOperationId || entry.operationNo || '')));
  const journal = buildLegacyJournalProjection(projectedEntries, accounts, canonicalDefinitions, {
    enableFinancialProjection: true,
    costTimeline,
  });
  return {
    source: 'accounting_engine_posting_projection',
    journal,
    legs: journal.legs,
  };
};