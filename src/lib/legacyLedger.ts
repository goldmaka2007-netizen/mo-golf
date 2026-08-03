import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { resolveOperationKind } from './engine';
import { isValidAccountingEntry } from './canonicalAccounting';
import type { InventoryCostTimeline, OperationCostResultV2 } from './inventoryCostTypes';
import { isOpeningEntry } from './openingEntry';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';

export type LegacyLedgerDimension = 'cash' | 'gold' | 'silver' | 'quantity';
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

export interface LegacyLedgerBuildOptions {
  costTimeline?: InventoryCostTimeline | null;
  enableFinancialProjection?: boolean;
}

const normalize = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ');
const positive = (value: unknown): number => {
  const amount = Math.abs(Number(value) || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const groupFor = (mainType: string | undefined): LegacyLedgerGroup => {
  const value = normalize(mainType).toLowerCase();
  if (['liability', 'liabilities', '\u062e\u0635\u0648\u0645', '\u0627\u0644\u062e\u0635\u0648\u0645'].includes(value)) return 'liabilities';
  if (['equity', '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629', '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629'].includes(value)) return 'equity';
  if (['revenue', 'revenues', '\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0627\u064a\u0631\u0627\u062f\u0627\u062a'].includes(value)) return 'revenue';
  if (['expense', 'expenses', '\u0645\u0635\u0631\u0648\u0641\u0627\u062a', '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a'].includes(value)) return 'expenses';
  return 'assets';
};

const metalFor = (account: Account | undefined): 'gold' | 'silver' | null => {
  if (!account || account.type === 'accessory') return null;
  if (account.metal === 'silver' || account.type === 'silver' || /\u0641\u0636\u0629|silver/i.test(`${account.balanceNature} ${account.subType}`)) return 'silver';
  if (account.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type ?? '') || /\u0630\u0647\u0628|gold/i.test(`${account.balanceNature} ${account.subType}`)) return 'gold';
  return null;
};

const descriptionFor = (account: Account | undefined): string => {
  if (!account) return '\u062d\u0633\u0627\u0628 \u062a\u0627\u0631\u064a\u062e\u064a';
  if (account.type === 'cash') return '\u062e\u0632\u0646\u0629';
  if (account.type === 'merchant') return account.metal === 'silver' ? '\u0627\u0644\u062a\u0632\u0627\u0645 \u062a\u0627\u062c\u0631 \u0641\u0636\u0629' : account.metal === 'gold' ? '\u0627\u0644\u062a\u0632\u0627\u0645 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628' : '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631';
  if (account.is_inventory) return account.metal === 'silver' || account.type === 'silver' ? '\u0645\u062e\u0632\u0648\u0646 \u0641\u0636\u0629 \u0641\u0639\u0644\u064a' : '\u0645\u062e\u0632\u0648\u0646 \u0630\u0647\u0628 \u0641\u0639\u0644\u064a';
  const group = groupFor(account.mainType);
  return group === 'liabilities' ? '\u062e\u0635\u0648\u0645' : group === 'equity' ? '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629' : group === 'revenue' ? '\u0625\u064a\u0631\u0627\u062f' : group === 'expenses' ? '\u0645\u0635\u0631\u0648\u0641' : '\u062d\u0633\u0627\u0628 \u0623\u0635\u0644';
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

const storedQuantityDimension = (debit: Account | undefined, credit: Account | undefined): 'quantity' | null =>
  [debit, credit].some(account => account?.type === 'accessory') ? 'quantity' : null;

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

const virtualAccount = (
  entityId: string,
  accountName: string,
  group: LegacyLedgerGroup,
  description: string,
): LegacyLedgerAccountMetadata => ({
  entityId,
  accountName,
  group,
  description,
  normalBalance: ['liabilities', 'equity', 'revenue'].includes(group) ? 'credit' : 'debit',
});

const virtualSalesRevenue = virtualAccount('system:income:sales-revenue', '\u0625\u064a\u0631\u0627\u062f \u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0645\u062e\u0632\u0648\u0646', 'revenue', '\u0625\u064a\u0631\u0627\u062f \u0645\u0628\u064a\u0639\u0627\u062a \u0645\u0646 \u0625\u0633\u0642\u0627\u0637 \u0645\u062d\u0627\u0633\u0628\u064a \u0645\u0631\u0643\u0632\u064a');
const virtualCogsExpense = virtualAccount('system:income:cogs', '\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629', 'expenses', 'COGS \u0645\u0646 \u0627\u0644\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0645\u0631\u062c\u062d');
const virtualShortageLoss = virtualAccount('system:income:inventory-shortage-loss', '\u062e\u0633\u0627\u0626\u0631 \u062a\u0633\u0648\u064a\u0629 \u0639\u062c\u0632 \u0627\u0644\u0645\u062e\u0632\u0648\u0646', 'expenses', '\u062e\u0633\u0627\u0631\u0629 \u0639\u062c\u0632 \u0645\u0646 \u0627\u0644\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0645\u0631\u062c\u062d');

const isInventoryAccount = (account: Account | undefined): boolean =>
  !!account && (account.is_inventory === true || ['gold_product', 'gold_raw', 'gold_direct', 'silver', 'accessory'].includes(account.type ?? ''));

const ownsDimension = (account: Account | undefined, dimension: LegacyLedgerDimension, financialProjection: boolean): boolean => {
  if (!account) return true;
  if (dimension === 'cash') return !isInventoryAccount(account) || financialProjection;
  if (dimension === 'quantity') return account.type === 'accessory';
  return metalFor(account) === dimension;
};

const legFrom = (
  entry: Entry,
  account: LegacyLedgerAccountMetadata,
  opposite: LegacyLedgerAccountMetadata,
  side: LegacyLedgerSide,
  dimension: LegacyLedgerDimension,
  amount: number,
): LegacyLedgerLeg => ({
  dimension,
  amount,
  sourceEntryId: operationId(entry),
  operationKind: resolveOperationKind(entry),
  date: entry.date,
  isOpening: isOpeningEntry(entry),
  entry,
  entityId: account.entityId,
  accountName: account.accountName,
  side,
  group: account.group,
  account,
  oppositeAccount: opposite.accountName,
});

const costAmount = (result: OperationCostResultV2): number =>
  (result.classification === 'sale' ? result.totalCogsMinor : result.classification === 'shortage' ? result.adjustmentLossMinor : 0) / 100;

const appendCostLegs = (
  legs: LegacyLedgerLeg[],
  accounts: Account[],
  index: LegacyAccountIndex,
  timeline: InventoryCostTimeline | null | undefined,
) => {
  if (!timeline?.valid) return;
  timeline.results.forEach(result => {
    const amount = costAmount(result);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const entry = result.entry;
    const inventoryAccountId = result.sourceInventoryAccountId || result.inventoryAccountId;
    const inventoryAccount = inventoryAccountId ? accounts.find(account => account.id === inventoryAccountId) : undefined;
    const credit = inventoryAccount
      ? metadataFor({ ...entry, credit: inventoryAccount.name, creditAccountId: inventoryAccount.id }, 'credit', index)
      : metadataFor(entry, 'credit', index);
    const debit = result.classification === 'shortage' ? virtualShortageLoss : virtualCogsExpense;
    legs.push(legFrom(entry, debit, credit, 'debit', 'cash', amount));
    legs.push(legFrom(entry, credit, debit, 'credit', 'cash', amount));
  });
};

/** Builds exactly two historical legs for every dimension physically stored on
 * a valid imported row. No account-dimension eligibility or canonical rule is
 * allowed to suppress either historical side. */
export const buildLegacyLedgerLegs = (
  entries: Entry[],
  accounts: Account[],
  canonicalDefinitions: CanonicalAccountDefinition[] = [],
  options: LegacyLedgerBuildOptions = {},
): LegacyLedgerLeg[] => {
  const index = buildIndex(accounts.map(applyRuntimeAccountOverride), canonicalDefinitions);
  const legs: LegacyLedgerLeg[] = [];
  entries.filter(isValidAccountingEntry).forEach(entry => {
    const debitAccount = (entry.debitAccountId ? index.byId.get(entry.debitAccountId) : undefined) ?? index.byName.get(normalize(entry.debit));
    const creditAccount = (entry.creditAccountId ? index.byId.get(entry.creditAccountId) : undefined) ?? index.byName.get(normalize(entry.credit));
    const debit = metadataFor(entry, 'debit', index);
    const credit = metadataFor(entry, 'credit', index);
    const values: Array<[LegacyLedgerDimension, number]> = [];
    const cash = positive(entry.cash);
    if (cash > 0) values.push(['cash', cash]);
    const quantity = storedQuantityDimension(debitAccount, creditAccount);
    const quantityAmount = quantity ? positive(entry.weight) : 0;
    if (quantity && quantityAmount > 0) values.push([quantity, quantityAmount]);
    const metal = storedMetalDimension(entry, debitAccount, creditAccount);
    const metalAmount = metal === 'silver' ? positive(entry.weight) : metal === 'gold' ? positive(entry.arabicWeight) : 0;
    if (metal && metalAmount > 0) values.push([metal, metalAmount]);
    values.forEach(([dimension, amount]) => {
      const projectedCredit = options.enableFinancialProjection
        && dimension === 'cash'
        && (entry.operationKind || '') === 'sale'
        && isInventoryAccount(creditAccount)
          ? virtualSalesRevenue
          : credit;
      if (ownsDimension(debitAccount, dimension, options.enableFinancialProjection === true))
        legs.push(legFrom(entry, debit, projectedCredit, 'debit', dimension, amount));
      if (projectedCredit !== credit || ownsDimension(creditAccount, dimension, options.enableFinancialProjection === true))
        legs.push(legFrom(entry, projectedCredit, debit, 'credit', dimension, amount));
    });
  });
  if (options.enableFinancialProjection) appendCostLegs(legs, accounts, index, options.costTimeline);
  return legs;
};

export const buildLegacyJournalProjection = (
  entries: Entry[],
  accounts: Account[],
  canonicalDefinitions: CanonicalAccountDefinition[] = [],
  options: LegacyLedgerBuildOptions = {},
): LegacyJournalProjection => {
  const legs = buildLegacyLedgerLegs(entries, accounts, canonicalDefinitions, options);
  const balances = new Map<string, LegacyLedgerAccountBalance>();
  const totals: LegacyJournalProjection['trialBalanceTotals'] = {
    cash: { debit: 0, credit: 0, difference: 0 },
    gold: { debit: 0, credit: 0, difference: 0 },
    silver: { debit: 0, credit: 0, difference: 0 },
    quantity: { debit: 0, credit: 0, difference: 0 },
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

