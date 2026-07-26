import { Entry } from '../types';
import { AccountRegistry } from './accountRegistry';

export type MigrationSideStatus = 'already_linked' | 'matched_unique_alias' | 'unknown' | 'ambiguous';
export interface MigrationSidePlan {
  side: 'debit' | 'credit';
  legacyName: string;
  currentAccountId?: string;
  targetAccountId?: string;
  sourceAccountId?: string;
  status: MigrationSideStatus;
  candidates: { id: string; name: string }[];
}
export interface EntryMigrationPlan {
  entryId: string;
  entry: Entry;
  debit: MigrationSidePlan;
  credit: MigrationSidePlan;
  canMigrate: boolean;
  changed: boolean;
}
export interface AccountMigrationReport {
  migrationVersion: number;
  totalEntries: number;
  alreadyMigrated: number;
  ready: number;
  blocked: number;
  unknownSides: number;
  ambiguousSides: number;
  plans: EntryMigrationPlan[];
}

const VERSION = 1;
const sidePlan = (entry: Entry, side: 'debit' | 'credit', registry: AccountRegistry): MigrationSidePlan => {
  const currentAccountId = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const legacyName = entry[side];
  const resolution = registry.resolve(currentAccountId, legacyName);
  if (resolution.status === 'resolved') {
    return {
      side, legacyName, currentAccountId,
      targetAccountId: resolution.account.sourceAccountId ?? resolution.account.id,
      sourceAccountId: resolution.account.sourceAccountId,
      status: currentAccountId ? 'already_linked' : 'matched_unique_alias',
      candidates: [{ id: resolution.account.sourceAccountId ?? resolution.account.id, name: resolution.account.displayName }],
    };
  }
  return {
    side, legacyName, currentAccountId,
    status: resolution.status,
    candidates: resolution.status === 'ambiguous' ? resolution.candidates.map(account => ({ id: account.sourceAccountId ?? account.id, name: account.displayName })) : [],
  };
};
export const planAccountIdMigration = (entries: Entry[], registry: AccountRegistry): AccountMigrationReport => {
  const plans = entries.map(entry => {
    const debit = sidePlan(entry, 'debit', registry);
    const credit = sidePlan(entry, 'credit', registry);
    const canMigrate = !!debit.targetAccountId && !!credit.targetAccountId;
    const changed = canMigrate && (debit.currentAccountId !== debit.targetAccountId || credit.currentAccountId !== credit.targetAccountId || entry.accountMigrationVersion !== VERSION);
    return { entryId: entry.id || String(entry.seq), entry, debit, credit, canMigrate, changed };
  });
  const allSides = plans.flatMap(plan => [plan.debit, plan.credit]);
  return {
    migrationVersion: VERSION,
    totalEntries: plans.length,
    alreadyMigrated: plans.filter(plan => plan.canMigrate && !plan.changed).length,
    ready: plans.filter(plan => plan.canMigrate && plan.changed).length,
    blocked: plans.filter(plan => !plan.canMigrate).length,
    unknownSides: allSides.filter(side => side.status === 'unknown').length,
    ambiguousSides: allSides.filter(side => side.status === 'ambiguous').length,
    plans,
  };
};

/** Produces the exact idempotent patch. The legacy debit/credit text is never overwritten. */
export const buildMigrationPatch = (plan: EntryMigrationPlan, migratedAt = new Date().toISOString()): Partial<Entry> => {
  if (!plan.canMigrate || !plan.debit.targetAccountId || !plan.credit.targetAccountId) throw new Error('لا يمكن ترحيل حركة تحتوي طرفًا مجهولًا أو Alias غامضًا.');
  return {
    debitAccountId: plan.debit.targetAccountId,
    creditAccountId: plan.credit.targetAccountId,
    debitLegacySnapshot: plan.entry.debitLegacySnapshot ?? plan.entry.debit,
    creditLegacySnapshot: plan.entry.creditLegacySnapshot ?? plan.entry.credit,
    accountMigrationVersion: VERSION,
    accountMigratedAt: plan.entry.accountMigratedAt ?? migratedAt,
  };
};
