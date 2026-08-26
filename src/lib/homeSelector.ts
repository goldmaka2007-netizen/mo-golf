import type { Account, AnnualOpeningCostConfig, CanonicalAccountDefinition, Entry } from '../types';
import { computeAccountBalances } from './engine';
import { buildFinancialPositionGoldSummary, type FinancialPositionGoldSummary } from './monthlyFinancialPosition';

export interface HomeOperationalSnapshot {
  treasuryCash: number;
  goldOwnership: FinancialPositionGoldSummary | null;
  goldOwnershipDiagnostic?: string;
}

/** Lightweight operational read model; gold ownership comes from the Financial Position projection. */
export const buildHomeOperationalSnapshot = (args: {
  entries: Entry[];
  accounts: Account[];
  canonicalDefinitions: CanonicalAccountDefinition[];
  openingCostConfig: AnnualOpeningCostConfig[];
  goldPriceEgp?: number | null;
  silverPriceEgp?: number | null;
}): HomeOperationalSnapshot => {
  const { entries, accounts } = args;
  const balances = computeAccountBalances(entries, accounts).balances.values();
  let treasuryCash = 0;

  for (const balance of balances) {
    if (balance.mainType === 'assets' && balance.subType === 'cash') treasuryCash += balance.cashBalance;
  }

  const cutoffDate = entries.map(entry => entry.date).filter(Boolean).sort().at(-1);
  const goldProjection = cutoffDate
    ? buildFinancialPositionGoldSummary({ ...args, cutoffDate })
    : null;
  const goldOwnership = goldProjection?.available === true ? goldProjection.gold : null;
  const goldOwnershipDiagnostic = goldProjection && goldProjection.available !== true
    ? goldProjection.diagnostic.message
    : !cutoffDate ? 'لا توجد قيود لبناء ملخص الذهب.' : undefined;

  return {
    treasuryCash,
    goldOwnership,
    ...(goldOwnershipDiagnostic ? { goldOwnershipDiagnostic } : {}),
  };
};
