import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { resolveOperationKind } from './engine';
import { isValidAccountingEntry } from './canonicalAccounting';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import { isOpeningEntry } from './openingEntry';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';
import { exposeInventoryLinkedAccounts, inventoryAccountDisplayName } from './inventoryAccountLinkage';

export type LegacyLedgerDimension = 'cash' | 'gold' | 'silver' | 'quantity' | 'book_value';
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
  amountMinor: number;
  accountId?: string;
  canonicalCategory?: string;
  metalType?: 'gold' | 'silver' | 'accessory' | null;
  quantityBasis?: 'equivalent21' | 'physical_grams' | 'pieces' | null;
  bookValueSource?: 'stored_egp' | 'wac' | null;
  origin: 'historical' | 'generated';
  generatedLegId: string;
  deduplicationId: string;
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
    accountName: account ? inventoryAccountDisplayName(account) : rawName,
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

const inventoryKind = (account: Account | undefined): 'gold' | 'silver' | 'accessories' =>
  account?.type === 'accessory' ? 'accessories' : metalFor(account) === 'silver' ? 'silver' : 'gold';
const kindLabel = (kind: ReturnType<typeof inventoryKind>): string =>
  kind === 'gold' ? '\u0627\u0644\u0630\u0647\u0628' : kind === 'silver' ? '\u0627\u0644\u0641\u0636\u0629' : '\u0627\u0644\u0645\u0644\u062d\u0642\u0627\u062a';
const configuredCompanion = (
  inventory: Account | undefined,
  accounts: Account[],
  role: 'sales' | 'cost_of_sales',
): LegacyLedgerAccountMetadata | undefined => {
  const configuredId = role === 'sales' ? inventory?.salesAccountId : inventory?.costOfSalesAccountId;
  const account = accounts.find(candidate => candidate.id === configuredId)
    ?? accounts.find(candidate => candidate.accountRole === role && candidate.linkedInventoryAccountId === inventory?.id);
  if (!account) return undefined;
  const accountGroup = groupFor(account.mainType);
  return {
    entityId: legacyLedgerEntityId(account), accountName: account.name, group: accountGroup,
    description: descriptionFor(account), normalBalance: accountGroup === 'revenue' ? 'credit' : 'debit', sourceAccount: account,
  };
};
const virtualSalesRevenueFor = (account: Account | undefined, accounts: Account[]): LegacyLedgerAccountMetadata => {
  const configured = configuredCompanion(account, accounts, 'sales');
  if (configured) return configured;
  const kind = inventoryKind(account);
  return virtualAccount(`system:income:sales-revenue:${kind}`, `\u0625\u064a\u0631\u0627\u062f \u0645\u0628\u064a\u0639\u0627\u062a ${kindLabel(kind)}`, 'revenue', '\u0625\u064a\u0631\u0627\u062f \u0645\u0628\u064a\u0639\u0627\u062a \u0645\u0648\u0644\u062f \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629');
};
const virtualCogsFor = (account: Account | undefined, accounts: Account[]): LegacyLedgerAccountMetadata => {
  const configured = configuredCompanion(account, accounts, 'cost_of_sales');
  if (configured) return configured;
  const kind = inventoryKind(account);
  return virtualAccount(`system:income:cogs:${kind}`, `\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0627\u0644\u0645\u0628\u0627\u0639\u0629 - ${kindLabel(kind)}`, 'expenses', 'COGS \u0645\u0646 WAC');
};
const virtualShortageLoss = virtualAccount('system:income:inventory-shortage-loss', '\u062e\u0633\u0627\u0626\u0631 \u062a\u0633\u0648\u064a\u0629 \u0639\u062c\u0632 \u0627\u0644\u0645\u062e\u0632\u0648\u0646', 'expenses', '\u062e\u0633\u0627\u0631\u0629 \u0639\u062c\u0632 \u0645\u0646 \u0627\u0644\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0645\u0631\u062c\u062d');

const isInventoryAccount = (account: Account | undefined): boolean =>
  !!account && (account.is_inventory === true || ['gold_product', 'gold_raw', 'gold_direct', 'silver', 'accessory'].includes(account.type ?? ''));

const ownsDimension = (account: Account | undefined, dimension: LegacyLedgerDimension, financialProjection: boolean): boolean => {
  // Raw historical projection remains lossless and balanced. Eligibility is
  // applied only by the normalized financial projection.
  if (!financialProjection) return true;
  if (!account) return true;
  if (dimension === 'cash') return !isInventoryAccount(account);
  if (dimension === 'quantity') return account.type === 'accessory';
  return metalFor(account) === dimension;
};

const isOpeningInventoryContribution = (
  entry: Entry,
  debit: LegacyLedgerAccountMetadata,
  credit: LegacyLedgerAccountMetadata,
): boolean => isOpeningEntry(entry)
  && isInventoryAccount(debit.sourceAccount)
  && credit.group === 'equity';

const legFrom = (
  entry: Entry,
  account: LegacyLedgerAccountMetadata,
  opposite: LegacyLedgerAccountMetadata,
  side: LegacyLedgerSide,
  dimension: LegacyLedgerDimension,
  amount: number,
  origin: LegacyLedgerLeg['origin'] = 'historical',
  bookValueSource: LegacyLedgerLeg['bookValueSource'] = null,
): LegacyLedgerLeg => ({
  dimension,
  amount,
  amountMinor: Math.round(amount * 100),
  sourceEntryId: operationId(entry),
  operationKind: resolveOperationKind(entry),
  date: entry.date,
  isOpening: isOpeningEntry(entry),
  entry,
  entityId: account.entityId,
  accountId: account.sourceAccount?.id,
  accountName: account.accountName,
  canonicalCategory: account.sourceAccount?.canonicalSubType ?? account.sourceAccount?.subType,
  metalType: account.sourceAccount?.type === 'accessory' ? 'accessory' : metalFor(account.sourceAccount),
  quantityBasis: dimension === 'gold' ? 'equivalent21' : dimension === 'silver' ? 'physical_grams' : dimension === 'quantity' ? 'pieces' : null,
  bookValueSource: bookValueSource ?? (dimension === 'cash' ? 'stored_egp' : null),
  origin,
  generatedLegId: `${operationId(entry)}:${dimension}:${account.entityId}:${side}:${origin}`,
  deduplicationId: `${operationId(entry)}:${dimension}:${account.entityId}:${side}`,
  side,
  group: account.group,
  account,
  oppositeAccount: opposite.accountName,
});

const appendCostLegs = (
  legs: LegacyLedgerLeg[],
  accounts: Account[],
  index: LegacyAccountIndex,
  timeline: InventoryCostTimeline | null | undefined,
  allowedOperationIds: ReadonlySet<string>,
) => {
  if (!timeline?.valid) return;
  const seen = new Set(legs.map(leg => leg.deduplicationId));
  const pushOne = (
    entry: Entry,
    account: LegacyLedgerAccountMetadata,
    opposite: LegacyLedgerAccountMetadata,
    side: LegacyLedgerSide,
    amountMinor: number,
  ) => {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return;
    const leg = legFrom(entry, account, opposite, side, 'book_value', amountMinor / 100, 'generated', 'wac');
    if (seen.has(leg.deduplicationId)) return;
    seen.add(leg.deduplicationId);
    legs.push(leg);
  };
  const pushGenerated = (
    entry: Entry,
    debit: LegacyLedgerAccountMetadata,
    credit: LegacyLedgerAccountMetadata,
    amountMinor: number,
  ) => {
    pushOne(entry, debit, credit, 'debit', amountMinor);
    pushOne(entry, credit, debit, 'credit', amountMinor);
  };

  timeline.results.filter(result => allowedOperationIds.has(result.operationId || operationId(result.entry))).forEach(result => {
    const entry = result.entry;
    const sourceAccount = result.sourceInventoryAccountId
      ? accounts.find(account => account.id === result.sourceInventoryAccountId)
      : undefined;
    const destinationId = result.destinationInventoryAccountId || result.inventoryAccountId;
    const destinationAccount = destinationId ? accounts.find(account => account.id === destinationId) : undefined;
    const source = sourceAccount
      ? metadataFor({ ...entry, credit: sourceAccount.name, creditAccountId: sourceAccount.id }, 'credit', index)
      : metadataFor(entry, 'credit', index);
    const destination = destinationAccount
      ? metadataFor({ ...entry, debit: destinationAccount.name, debitAccountId: destinationAccount.id }, 'debit', index)
      : metadataFor(entry, 'debit', index);

    if (['opening', 'customer_purchase', 'merchant_receipt'].includes(result.classification)) {
      const counterpart = metadataFor(entry, 'credit', index);
      if (result.classification === 'opening') {
        pushGenerated(entry, destination, counterpart, result.incomingTotalCostMinor);
      } else if (result.classification === 'customer_purchase') {
        // The Treasury/customer credit remains in ordinary EGP; inventory is
        // represented only through carrying value.
        pushOne(entry, destination, counterpart, 'debit', result.incomingTotalCostMinor);
      } else {
        // The inventory debit includes principal plus workmanship. Principal
        // is a metal liability carrying value; workmanship remains the stored
        // cash-denominated merchant payable.
        pushOne(entry, destination, counterpart, 'debit', result.incomingTotalCostMinor);
        pushOne(entry, counterpart, destination, 'credit', result.incomingMetalCostMinor);
      }
      return;
    }
    if (result.classification === 'sale') {
      pushGenerated(entry, virtualCogsFor(sourceAccount ?? source.sourceAccount, accounts), source, result.totalCogsMinor);
      return;
    }
    if (result.classification === 'shortage') {
      pushGenerated(entry, virtualShortageLoss, source, result.adjustmentLossMinor);
      return;
    }
    if (result.classification === 'surplus') {
      const gain = virtualAccount('system:income:inventory-surplus-gain', '\u0645\u0643\u0627\u0633\u0628 \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0645\u062e\u0632\u0648\u0646', 'revenue', '\u062a\u0633\u0648\u064a\u0629 \u0645\u062e\u0632\u0648\u0646');
      pushGenerated(entry, destination, gain, result.adjustmentGainMinor);
      return;
    }
    if (['transfer', 'tafyeet', 'two_sided_adjustment'].includes(result.classification)) {
      pushGenerated(entry, destination, source, Math.min(result.incomingTotalCostMinor, result.outgoingTotalCostMinor));
      return;
    }
    if (result.classification === 'merchant_delivery') {
      pushGenerated(entry, metadataFor(entry, 'debit', index), source, result.outgoingTotalCostMinor);
    }
  });

  (timeline.historicalInventoryOverlays ?? [])
    .filter(overlay => allowedOperationIds.has(overlay.sourceDeficitOperationId))
    .forEach(overlay => {
      const inventoryAccount = accounts.find(account => account.id === overlay.stableInventoryAccountId);
      if (!inventoryAccount) return;
      const entry: Entry = {
        id: overlay.overlayId, operationKind: 'opening', tx: '\u062a\u0633\u0648\u064a\u0629 \u0627\u0641\u062a\u062a\u0627\u062d\u064a\u0629 \u0644\u0644\u0645\u062e\u0632\u0648\u0646', date: overlay.effectiveDate,
        debit: inventoryAccount.name, debitAccountId: inventoryAccount.id, credit: '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629 \u0627\u0641\u062a\u062a\u0627\u062d\u064a\u0629',
        cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: overlay.reasonCode, userId: inventoryAccount.userId,
      };
      const inventory = metadataFor(entry, 'debit', index);
      const equity = virtualAccount('system:equity:inventory-opening', '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629 \u0627\u0641\u062a\u062a\u0627\u062d\u064a\u0629', 'equity', '\u0623\u0633\u0627\u0633 \u062a\u0643\u0644\u0641\u0629 \u062a\u0627\u0631\u064a\u062e\u064a');
      pushGenerated(entry, inventory, equity, overlay.totalCostMinor);
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
  const linkedAccounts = exposeInventoryLinkedAccounts(accounts.map(applyRuntimeAccountOverride));
  const index = buildIndex(linkedAccounts, canonicalDefinitions);
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
      if (options.enableFinancialProjection && dimension === 'cash'
        && isOpeningInventoryContribution(entry, debit, credit)) return;

      const saleFromInventory = options.enableFinancialProjection
        && resolveOperationKind(entry) === 'sale'
        && isInventoryAccount(creditAccount);
      const projectedCredit = saleFromInventory && dimension === 'cash'
          ? virtualSalesRevenueFor(creditAccount, linkedAccounts)
          : credit;
      const projectedDebit = saleFromInventory
        && (dimension === 'gold' || dimension === 'silver' || dimension === 'quantity')
          ? virtualSalesRevenueFor(creditAccount, linkedAccounts)
          : debit;
      if (projectedDebit !== debit || ownsDimension(debitAccount, dimension, options.enableFinancialProjection === true))
        legs.push(legFrom(entry, projectedDebit, projectedCredit, 'debit', dimension, amount, projectedDebit !== debit ? 'generated' : 'historical'));
      if (projectedCredit !== credit || ownsDimension(creditAccount, dimension, options.enableFinancialProjection === true))
        legs.push(legFrom(entry, projectedCredit, projectedDebit, 'credit', dimension, amount, projectedCredit !== credit ? 'generated' : 'historical'));
    });
  });
  if (options.enableFinancialProjection) {
    appendCostLegs(legs, linkedAccounts, index, options.costTimeline, new Set(entries.map(operationId)));
    const unique = new Map<string, LegacyLedgerLeg>();
    legs.forEach(leg => { if (!unique.has(leg.deduplicationId)) unique.set(leg.deduplicationId, leg); });
    return [...unique.values()];
  }
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
    book_value: { debit: 0, credit: 0, difference: 0 },
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

