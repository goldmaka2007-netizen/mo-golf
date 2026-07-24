import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { isValidAccountingEntry } from './canonicalAccounting';

export type LegacyLedgerDimension = 'cash' | 'gold' | 'silver';
export type LegacyLedgerSide = 'debit' | 'credit';
export type LegacyLedgerGroup = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';

export interface LegacyLedgerAccountMetadata {
  entityId: string;
  accountName: string;
  group: LegacyLedgerGroup;
  description: string;
  normalBalance: LegacyLedgerSide;
  sourceAccount?: Account;
}

export interface LegacyLedgerLeg {
  entityId: string;
  accountName: string;
  dimension: LegacyLedgerDimension;
  side: LegacyLedgerSide;
  amount: number;
  sourceEntryId: string;
  operationKind: string;
  date: string;
  isOpening: boolean;
  group: LegacyLedgerGroup;
  account: LegacyLedgerAccountMetadata;
  entry: Entry;
  oppositeAccount: string;
}

export interface LegacyLedgerAccountBalance {
  entityId: string;
  accountName: string;
  dimension: LegacyLedgerDimension;
  debit: number;
  credit: number;
  balance: number;
}

export interface LegacyLedgerTotals {
  debit: number;
  credit: number;
  difference: number;
}

export interface LegacyJournalProjection {
  source: 'legacy_raw_fields';
  legs: LegacyLedgerLeg[];
  accountBalances: LegacyLedgerAccountBalance[];
  trialBalanceTotals: Record<LegacyLedgerDimension, LegacyLedgerTotals>;
}

const normalize = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ');
const positive = (value: unknown): number => {
  const amount = Math.abs(Number(value) || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const groupFor = (mainType: string | undefined): LegacyLedgerGroup => {
  const value = normalize(mainType).toLowerCase();
  if (['liability', 'liabilities', 'خصوم', 'الخصوم'].includes(value)) return 'liabilities';
  if (['equity', 'حقوق ملكية', 'حقوق الملكية'].includes(value)) return 'equity';
  if (['revenue', 'revenues', 'إيرادات', 'ايرادات', 'الإيرادات', 'الايرادات'].includes(value)) return 'revenue';
  if (['expense', 'expenses', 'مصروفات', 'المصروفات'].includes(value)) return 'expenses';
  return 'assets';
};

const metalFor = (account: Account | undefined): 'gold' | 'silver' | null => {
  if (!account || account.type === 'accessory') return null;
  if (account.metal === 'silver' || account.type === 'silver' || /فضة|silver/i.test(`${account.balanceNature} ${account.subType}`)) return 'silver';
  if (account.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type ?? '') || /ذهب|gold/i.test(`${account.balanceNature} ${account.subType}`)) return 'gold';
  return null;
};

const descriptionFor = (account: Account | undefined): string => {
  if (!account) return 'حساب تاريخي';
  if (account.type === 'cash') return 'خزنة';
  if (account.type === 'merchant') return account.metal === 'silver' ? 'التزام تاجر فضة' : account.metal === 'gold' ? 'التزام تاجر ذهب' : 'حساب تاجر';
  if (account.is_inventory) return account.metal === 'silver' || account.type === 'silver' ? 'مخزون فضة فعلي' : 'مخزون ذهب فعلي';
  const group = groupFor(account.mainType);
  return group === 'liabilities' ? 'خصوم' : group === 'equity' ? 'حقوق ملكية' : group === 'revenue' ? 'إيراد' : group === 'expenses' ? 'مصروف' : 'حساب أصل';
};

export const legacyLedgerEntityId = (account: Account): string => {
  const prefix = account.type === 'merchant' ? 'merchant' : account.is_inventory || ['gold_product', 'gold_raw', 'gold_direct', 'silver'].includes(account.type ?? '') ? 'product' : 'account';
  return account.id ? `${prefix}:${account.id}` : `legacy-name:${normalize(account.name)}`;
};
interface LegacyAccountIndex {
  byId: Map<string, Account>;
  byName: Map<string, Account>;
  definitionsById: Map<string, CanonicalAccountDefinition>;
  definitionsByName: Map<string, CanonicalAccountDefinition>;
}

const buildIndex = (accounts: Account[], definitions: CanonicalAccountDefinition[] = []): LegacyAccountIndex => ({
  byId: new Map(accounts.flatMap(account => account.id ? [[account.id, account] as const] : [])),
  byName: new Map(accounts.map(account => [normalize(account.name), account])),
  definitionsById: new Map(definitions.map(definition => [definition.sourceAccountId || definition.id, definition])),
  definitionsByName: new Map(definitions.flatMap(definition => [...definition.legacyNames, ...definition.aliases, definition.canonicalName].map(name => [normalize(name), definition] as const))),
});

const metadataFor = (
  entry: Entry,
  side: LegacyLedgerSide,
  index: LegacyAccountIndex,
): LegacyLedgerAccountMetadata => {
  const rawName = side === 'debit' ? entry.debit : entry.credit;
  const accountId = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const account = (accountId ? index.byId.get(accountId) : undefined) ?? index.byName.get(normalize(rawName));
  const definition = (accountId ? index.definitionsById.get(accountId) : undefined) ?? index.definitionsByName.get(normalize(rawName));
  const group = definition?.mainGroup ?? (account ? groupFor(account.mainType) : side === 'credit' ? 'liabilities' : 'assets');
  const entityId = account?.id
    ? legacyLedgerEntityId(account)
    : definition?.sourceAccountId
      ? `account:${definition.sourceAccountId}`
      : `legacy-name:${normalize(rawName)}`;
  return {
    entityId,
    accountName: account?.name ?? rawName,
    group,
    description: definition?.description || definition?.displayName || descriptionFor(account),
    normalBalance: definition?.normalBalanceByDimension.cash ?? (['liabilities', 'equity', 'revenue'].includes(group) ? 'credit' : 'debit'),
    sourceAccount: account,
  };
};

const storedMetalDimension = (entry: Entry, debit: Account | undefined, credit: Account | undefined): 'gold' | 'silver' | null => {
  const metals = [metalFor(debit), metalFor(credit)];
  if (metals.includes('silver')) return 'silver';
  if (metals.includes('gold')) return 'gold';
  if ([debit, credit].some(account => account?.type === 'accessory')) return null;
  if (['expense', 'personal_withdrawal'].includes(entry.operationKind ?? '')) return null;
  // Historical rows with stored metal but incomplete account metadata were
  // imported as gold E21. This is source interpretation, not canonical posting.
  return positive(entry.arabicWeight) > 0 || positive(entry.weight) > 0 ? 'gold' : null;
};

const operationId = (entry: Entry): string => entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '');

/** Builds exactly two historical legs for every dimension physically stored on
 * a valid imported row. No account-dimension eligibility or canonical rule is
 * allowed to suppress either historical side. */
export const buildLegacyLedgerLegs = (
  entries: Entry[],
  accounts: Account[],
  canonicalDefinitions: CanonicalAccountDefinition[] = [],
): LegacyLedgerLeg[] => {
  const index = buildIndex(accounts, canonicalDefinitions);
  const legs: LegacyLedgerLeg[] = [];
  entries.filter(isValidAccountingEntry).forEach(entry => {
    const debitAccount = (entry.debitAccountId ? index.byId.get(entry.debitAccountId) : undefined) ?? index.byName.get(normalize(entry.debit));
    const creditAccount = (entry.creditAccountId ? index.byId.get(entry.creditAccountId) : undefined) ?? index.byName.get(normalize(entry.credit));
    const debit = metadataFor(entry, 'debit', index);
    const credit = metadataFor(entry, 'credit', index);
    const values: Array<[LegacyLedgerDimension, number]> = [];
    const cash = positive(entry.cash);
    if (cash > 0) values.push(['cash', cash]);
    const metal = storedMetalDimension(entry, debitAccount, creditAccount);
    const metalAmount = metal === 'silver' ? positive(entry.weight) : metal === 'gold' ? positive(entry.arabicWeight) : 0;
    if (metal && metalAmount > 0) values.push([metal, metalAmount]);
    values.forEach(([dimension, amount]) => {
      const common = {
        dimension,
        amount,
        sourceEntryId: operationId(entry),
        operationKind: entry.operationKind || 'other',
        date: entry.date,
        isOpening: entry.operationKind === 'opening',
        entry,
      };
      legs.push({ ...common, entityId: debit.entityId, accountName: debit.accountName, side: 'debit', group: debit.group, account: debit, oppositeAccount: credit.accountName });
      legs.push({ ...common, entityId: credit.entityId, accountName: credit.accountName, side: 'credit', group: credit.group, account: credit, oppositeAccount: debit.accountName });
    });
  });
  return legs;
};

export const buildLegacyJournalProjection = (
  entries: Entry[],
  accounts: Account[],
  canonicalDefinitions: CanonicalAccountDefinition[] = [],
): LegacyJournalProjection => {
  const legs = buildLegacyLedgerLegs(entries, accounts, canonicalDefinitions);
  const balances = new Map<string, LegacyLedgerAccountBalance>();
  const totals: LegacyJournalProjection['trialBalanceTotals'] = {
    cash: { debit: 0, credit: 0, difference: 0 },
    gold: { debit: 0, credit: 0, difference: 0 },
    silver: { debit: 0, credit: 0, difference: 0 },
  };
  legs.forEach(leg => {
    totals[leg.dimension][leg.side] += leg.amount;
    const key = `${leg.entityId}:${leg.dimension}`;
    const balance = balances.get(key) ?? { entityId: leg.entityId, accountName: leg.accountName, dimension: leg.dimension, debit: 0, credit: 0, balance: 0 };
    balance[leg.side] += leg.amount;
    balance.balance = balance.debit - balance.credit;
    balances.set(key, balance);
  });
  (Object.keys(totals) as LegacyLedgerDimension[]).forEach(dimension => {
    totals[dimension].difference = totals[dimension].debit - totals[dimension].credit;
  });
  return { source: 'legacy_raw_fields', legs, accountBalances: [...balances.values()], trialBalanceTotals: totals };
};
