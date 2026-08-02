import type { Account, Entry, MerchantDirection } from '../types';
import {
  computeAccountBalances,
  type AccountClassificationWarning,
} from './engine';
import { parseWeight } from './accounting';

export type ScrapKaratFilter = 'all' | '18' | '21';

export interface ScrapLegacyFallback {
  entryId: string;
  missingField: string;
  reason: string;
  classification: string;
}

export interface ScrapMovementAnalysis {
  purchased: number;
  othersIn: number;
  totalIn: number;
  toTifit: number;
  toMerchants: number;
  soldAsScrap: number;
  othersOut: number;
  totalOut: number;
  currentBalance: number;
  tifitList: Array<{ name: string; weight: number }>;
  legacyFallbacks: ScrapLegacyFallback[];
}

export interface WeightedPartyBalance {
  accountId: string;
  name: string;
  subType: 'merchant_gold' | 'merchant_silver' | 'other_due';
  metal: 'gold' | 'silver';
  actualBalance: number;
  goldE21Balance: number;
  direction: MerchantDirection;
  directionDescription: string;
}

export interface WeightedPartyBalances {
  merchants: WeightedPartyBalance[];
  otherDues: WeightedPartyBalance[];
  legacyNameMatchedEntries: ReturnType<typeof computeAccountBalances>['legacyNameMatchedEntries'];
  unclassifiedAccounts: AccountClassificationWarning[];
  classificationConflicts: AccountClassificationWarning[];
}

export interface ScrapAnalysisModel {
  movement: ScrapMovementAnalysis;
  weightedParties: WeightedPartyBalances;
  periodEntries: Entry[];
  balanceEntries: Entry[];
}

const directionDescription = (direction: MerchantDirection): string =>
  direction === 'payable'
    ? '\u0639\u0644\u0649 \u0627\u0644\u0645\u062d\u0644'
    : '\u0644\u0635\u0627\u0644\u062d \u0627\u0644\u0645\u062d\u0644';

export const buildWeightedPartyBalances = (
  entries: Entry[],
  accounts: Account[],
): WeightedPartyBalances => {
  const computed = computeAccountBalances(entries, accounts);
  const merchants: WeightedPartyBalance[] = [];
  const otherDues: WeightedPartyBalance[] = [];

  computed.balances.forEach(balance => {
    if (!['merchant_gold', 'merchant_silver', 'other_due'].includes(balance.subType)) return;
    if (!balance.merchantDirection || (balance.metal !== 'gold' && balance.metal !== 'silver')) return;
    const item: WeightedPartyBalance = {
      accountId: balance.accountId,
      name: balance.accountName,
      subType: balance.subType as WeightedPartyBalance['subType'],
      metal: balance.metal,
      actualBalance: balance.metal === 'gold' ? balance.goldActualBalance : balance.silverBalance,
      goldE21Balance: balance.metal === 'gold' ? balance.goldE21Balance : 0,
      direction: balance.merchantDirection,
      directionDescription: directionDescription(balance.merchantDirection),
    };
    if (balance.subType === 'other_due') otherDues.push(item);
    else merchants.push(item);
  });

  const byName = (a: WeightedPartyBalance, b: WeightedPartyBalance): number =>
    a.name.localeCompare(b.name, 'ar');
  merchants.sort(byName);
  otherDues.sort(byName);

  return {
    merchants,
    otherDues,
    legacyNameMatchedEntries: computed.legacyNameMatchedEntries,
    unclassifiedAccounts: computed.unclassifiedAccounts,
    classificationConflicts: computed.classificationConflicts,
  };
};

interface AccountLookup {
  byId: Map<string, Account>;
  byName: Map<string, Account[]>;
}

const buildLookup = (accounts: Account[]): AccountLookup => {
  const byName = new Map<string, Account[]>();
  for (const account of accounts) {
    const named = byName.get(account.name) ?? [];
    named.push(account);
    byName.set(account.name, named);
  }
  return {
    byId: new Map(accounts.filter(account => account.id).map(account => [account.id as string, account])),
    byName,
  };
};

const entryId = (entry: Entry): string =>
  entry.id ?? entry.operationNo ?? entry.invoiceNumber ?? String(entry.seq ?? 'unknown-entry');

const isIncludedEntry = (entry: Entry): boolean => {
  const raw = entry as Entry & Record<string, unknown>;
  if (raw.isDeleted === true || raw.deleted === true || raw.isVoided === true || raw.voided === true
    || raw.isReversed === true || raw.reversed === true) return false;
  return !['voided', 'deleted', 'reversed', 'excluded', 'invalid']
    .includes(String(raw.status ?? '').toLowerCase());
};

const addFallback = (
  fallbacks: ScrapLegacyFallback[],
  seen: Set<string>,
  fallback: ScrapLegacyFallback,
): void => {
  const key = `${fallback.entryId}:${fallback.missingField}:${fallback.classification}`;
  if (seen.has(key)) return;
  seen.add(key);
  fallbacks.push(fallback);
};

const resolveAccountSide = (
  entry: Entry,
  side: 'debit' | 'credit',
  lookup: AccountLookup,
  fallbacks: ScrapLegacyFallback[],
  seen: Set<string>,
): Account | undefined => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  if (id) return lookup.byId.get(id);

  const matches = lookup.byName.get(name) ?? [];
  if (matches.length !== 1) return undefined;
  const account = matches[0];
  addFallback(fallbacks, seen, {
    entryId: entryId(entry),
    missingField: side === 'debit' ? 'debitAccountId' : 'creditAccountId',
    reason: 'Unique legacy account name matched the account master',
    classification: `account:${account.id ?? account.name}`,
  });
  return account;
};

const legacyScrapName = (value: string): boolean =>
  ['\u0643\u0633\u0631', '\u0633\u0643\u0631\u0627\u0628'].some(token => value.includes(token))
  && !value.includes('\u0641\u0636\u0629');

const isGoldScrapAccount = (
  entry: Entry,
  side: 'debit' | 'credit',
  account: Account | undefined,
  fallbacks: ScrapLegacyFallback[],
  seen: Set<string>,
): boolean => {
  if (account?.type && account.metal && typeof account.is_inventory === 'boolean') {
    const subtypeConflicts = Boolean(
      account.canonicalSubType && account.canonicalSubType !== 'inventory_gold',
    );
    return account.type === 'gold_raw'
      && !subtypeConflicts
      && account.metal === 'gold'
      && account.is_inventory;
  }

  const name = account?.name ?? (side === 'debit' ? entry.debit : entry.credit);
  if (!legacyScrapName(name)) return false;
  const missing = [
    !account?.type ? 'account.type' : null,
    !account?.metal ? 'account.metal' : null,
    typeof account?.is_inventory !== 'boolean' ? 'account.is_inventory' : null,
  ].filter(Boolean).join(', ');
  addFallback(fallbacks, seen, {
    entryId: entryId(entry),
    missingField: missing || `${side}AccountId/account metadata`,
    reason: 'Legacy scrap label used only because structural inventory classification is incomplete',
    classification: 'gold_scrap_inventory',
  });
  return true;
};

type ScrapOperationKind = 'opening' | 'purchase' | 'sale' | 'transfer' | 'tifeet' | 'merchant_settlement' | 'other';

const legacyOperationKind = (tx: string): ScrapOperationKind => {
  const mapping: Record<string, ScrapOperationKind> = {
    '\u0634\u0631\u0627\u0621 \u0630\u0647\u0628': 'purchase',
    '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a': 'opening',
    '\u062a\u064a\u0641\u064a\u062a': 'tifeet',
    '\u062a\u062d\u0648\u064a\u0644': 'transfer',
    '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628': 'merchant_settlement',
    '\u0628\u064a\u0639 \u0630\u0647\u0628': 'sale',
  };
  return mapping[tx] ?? 'other';
};

const resolveScrapOperationKind = (
  entry: Entry,
  fallbacks: ScrapLegacyFallback[],
  seen: Set<string>,
): ScrapOperationKind => {
  if (entry.operationKind) {
    return ['opening', 'purchase', 'sale', 'transfer', 'tifeet', 'merchant_settlement']
      .includes(entry.operationKind)
      ? entry.operationKind as ScrapOperationKind
      : 'other';
  }
  const result = legacyOperationKind(entry.tx);
  addFallback(fallbacks, seen, {
    entryId: entryId(entry),
    missingField: 'operationKind',
    reason: 'Legacy tx label used because operationKind is missing',
    classification: result,
  });
  return result;
};

const resolveScrapKarat = (
  entry: Entry,
  scrapAccount: Account | undefined,
  filter: ScrapKaratFilter,
  fallbacks: ScrapLegacyFallback[],
  seen: Set<string>,
): string | undefined => {
  const accountKarat = String(scrapAccount?.karat ?? '').replace('.0', '');
  if (accountKarat) return accountKarat;
  const entryKarat = String(entry.karat ?? '').replace('.0', '');
  if (entryKarat) return entryKarat;
  if (filter === 'all') return undefined;

  const legacyText = `${scrapAccount?.name ?? ''} ${entry.tx}`;
  const inferred = legacyText.includes('18') || legacyText.includes('\u0661\u0668') || legacyText.includes('\u0627\u0641\u0631\u0646\u062c\u064a')
    ? '18'
    : legacyText.includes('21') || legacyText.includes('\u0662\u0661') || legacyText.includes('\u0639\u0631\u0628\u064a')
      ? '21'
      : undefined;
  if (inferred) {
    addFallback(fallbacks, seen, {
      entryId: entryId(entry),
      missingField: 'account.karat, entry.karat',
      reason: 'Legacy karat label used because structural karat is missing',
      classification: `karat:${inferred}`,
    });
  }
  return inferred;
};

export const analyzeGoldScrapMovements = (
  entries: Entry[],
  accounts: Account[],
  filter: ScrapKaratFilter = 'all',
): ScrapMovementAnalysis => {
  const lookup = buildLookup(accounts);
  const legacyFallbacks: ScrapLegacyFallback[] = [];
  const seenFallbacks = new Set<string>();
  const tifitDetails = new Map<string, number>();
  let purchased = 0;
  let othersIn = 0;
  let toTifit = 0;
  let toMerchants = 0;
  let soldAsScrap = 0;
  let othersOut = 0;

  for (const entry of entries) {
    if (!isIncludedEntry(entry)) continue;

    const debitAccount = resolveAccountSide(entry, 'debit', lookup, legacyFallbacks, seenFallbacks);
    const creditAccount = resolveAccountSide(entry, 'credit', lookup, legacyFallbacks, seenFallbacks);
    const scrapDebit = isGoldScrapAccount(entry, 'debit', debitAccount, legacyFallbacks, seenFallbacks);
    const scrapCredit = isGoldScrapAccount(entry, 'credit', creditAccount, legacyFallbacks, seenFallbacks);
    if (!scrapDebit && !scrapCredit) continue;

    const scrapAccount = scrapDebit ? debitAccount : creditAccount;
    const karat = resolveScrapKarat(entry, scrapAccount, filter, legacyFallbacks, seenFallbacks);
    if (filter !== 'all' && karat !== filter) continue;

    const weight = parseWeight(entry.weight);
    if (!Number.isFinite(weight) || weight === 0) continue;
    const operationKind = resolveScrapOperationKind(entry, legacyFallbacks, seenFallbacks);

    if (scrapDebit) {
      if (operationKind === 'purchase' || operationKind === 'opening') purchased += weight;
      else othersIn += weight;
    }

    if (scrapCredit) {
      if (operationKind === 'merchant_settlement') {
        toMerchants += weight;
      } else if (operationKind === 'tifeet' || operationKind === 'transfer') {
        toTifit += weight;
        if (!scrapDebit && debitAccount) {
          tifitDetails.set(debitAccount.name, (tifitDetails.get(debitAccount.name) ?? 0) + weight);
        }
      } else if (operationKind === 'sale') {
        soldAsScrap += weight;
      } else {
        othersOut += weight;
      }
    }
  }

  const totalIn = purchased + othersIn;
  const totalOut = toTifit + toMerchants + soldAsScrap + othersOut;
  return {
    purchased,
    othersIn,
    totalIn,
    toTifit,
    toMerchants,
    soldAsScrap,
    othersOut,
    totalOut,
    currentBalance: totalIn - totalOut,
    tifitList: Array.from(tifitDetails, ([name, weight]) => ({ name, weight }))
      .sort((a, b) => b.weight - a.weight),
    legacyFallbacks,
  };
};

const isOnOrBeforeMonth = (entry: Entry, selectedMonth: string): boolean =>
  !entry.date || entry.date.substring(0, 7) <= selectedMonth;

export const buildScrapAnalysisModel = (
  entries: Entry[],
  accounts: Account[],
  selectedMonth: string,
  karatFilter: ScrapKaratFilter,
): ScrapAnalysisModel => {
  const includedEntries = entries.filter(isIncludedEntry);
  const periodEntries = selectedMonth === 'all'
    ? includedEntries
    : includedEntries.filter(entry => entry.date?.startsWith(selectedMonth));
  const balanceEntries = selectedMonth === 'all'
    ? includedEntries
    : includedEntries.filter(entry => isOnOrBeforeMonth(entry, selectedMonth));

  return {
    movement: analyzeGoldScrapMovements(periodEntries, accounts, karatFilter),
    weightedParties: buildWeightedPartyBalances(balanceEntries, accounts),
    periodEntries,
    balanceEntries,
  };
};
