import {
  Entry,
  Account,
  AccountingOperationKind,
  AccountNature,
  type CanonicalAccountSubType,
  type CanonicalMainType,
  type ExplicitWeightedMetal,
  type MerchantDirection,
} from '../types';
import { OPERATION_RULES } from '../constants';
import { parseWeight, normalizeNumerals } from './accounting';
import { canCalculateGoldEquivalent21, calculateGoldEquivalent21 } from './goldEquivalent';
import { rebuildCostTimeline, getOperationId, compareEntriesForCost, ACCESSORY_QUANTITY_SCALE, type CostTimelineResult, type OperationCostResult, type OpeningCostConfig } from './weightedAverageCost';
import { getAccountTypeDetails } from '../utils/accountLogic';
import { isOpeningEntry } from './openingEntry';

export const KARAT_MULT: Record<string, number> = { '18': 18 / 21, '21': 1, '24': 24 / 21, silver: 1 };

export const getKaratMultiplier = (karat?: string | number | null): number => {
  const key = String(karat ?? '21').replace('.0', '');
  return KARAT_MULT[key] ?? 1;
};

export const isInventoryAccount = (account?: Account | null): boolean => !!account?.is_inventory;
export const isAccessoryAccount = (account?: Account | null): boolean => account?.type === 'accessory';
export const isCashAccount = (account?: Account | null): boolean => account?.type === 'cash';
export const isGoldAccount = (account?: Account | null): boolean => account?.metal === 'gold';
export const isSilverAccount = (account?: Account | null): boolean => account?.metal === 'silver';
export const isMetalInventoryAccount = (account?: Account | null): boolean =>
  isInventoryAccount(account) && !isAccessoryAccount(account) && (isGoldAccount(account) || isSilverAccount(account));

const textIncludesAny = (value: string | undefined, needles: string[]): boolean =>
  needles.some(needle => (value || '').includes(needle));

export const isMerchantWeightAccount = (account?: Account | null): boolean => {
  if (account?.type !== 'merchant') return false;
  return getMerchantMetadataMetal(account) !== undefined;
};

type MerchantMetal = 'gold' | 'silver';
type AccountWithLegacyMetal = Account & Record<string, unknown>;

export const getMerchantMetadataMetal = (account?: Account | null): MerchantMetal | undefined => {
  if (account?.type !== 'merchant') return undefined;
  const raw = account as AccountWithLegacyMetal;
  const explicit = [raw.metal, raw.metalType, raw.weightMetal, raw.inventoryMetal, raw.legacyMetal].map(value => String(value ?? '').toLowerCase()).find(value => value === 'gold' || value === 'silver');
  if (explicit === 'gold' || explicit === 'silver') return explicit;
  if (textIncludesAny(account.balanceNature, ['\u062C\u0631\u0627\u0645 \u0630\u0647\u0628']) || textIncludesAny(account.subType, ['\u062A\u062C\u0627\u0631 \u0630\u0647\u0628'])) return 'gold';
  if (textIncludesAny(account.balanceNature, ['\u062C\u0631\u0627\u0645 \u0641\u0636\u0629']) || textIncludesAny(account.subType, ['\u062A\u062C\u0627\u0631 \u0641\u0636\u0629'])) return 'silver';
  return undefined;
};

const accountMatchesMerchant = (entry: Entry, side: 'debit' | 'credit', merchant: Account): boolean => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  return (!!id && id === merchant.id) || (!id && name === merchant.name);
};

const entryMetal = (entry: Entry, opposite?: Account): MerchantMetal | undefined => {
  const raw = entry as Entry & Record<string, unknown>;
  const explicit = [raw.metal, raw.metalType, raw.weightMetal, raw.inventoryMetal].map(value => String(value ?? '').toLowerCase()).find(value => value === 'gold' || value === 'silver');
  if (explicit === 'gold' || explicit === 'silver') return explicit;
  if (String(entry.karat ?? '').toLowerCase() === 'silver') return 'silver';
  if (opposite?.metal === 'gold' || opposite?.metal === 'silver') return opposite.metal;
  if (entry.tx === '\u062D\u0633\u0627\u0628 \u062A\u0627\u062C\u0631 \u0641\u0636\u0629') return 'silver';
  if (entry.tx === '\u062D\u0633\u0627\u0628 \u062A\u0627\u062C\u0631 \u0630\u0647\u0628') return 'gold';
  return undefined;
};

export const getMerchantMetals = (merchant: Account, entries: Entry[] = [], accounts: Account[] = []): MerchantMetal[] => {
  if (merchant.type !== 'merchant') return [];
  const metals = new Set<MerchantMetal>();
  const metadataMetal = getMerchantMetadataMetal(merchant);
  if (metadataMetal) metals.add(metadataMetal);
  const index = buildAccountIndex(accounts);
  entries.forEach(entry => {
    const debitMatch = accountMatchesMerchant(entry, 'debit', merchant);
    const creditMatch = accountMatchesMerchant(entry, 'credit', merchant);
    if (!debitMatch && !creditMatch) return;
    const opposite = debitMatch ? resolveAccount(entry, 'credit', index) : resolveAccount(entry, 'debit', index);
    const metal = entryMetal(entry, opposite);
    if (metal) metals.add(metal);
  });
  return [...metals];
};
export const isGoldWeightLiabilityAccount = (account?: Account | null): boolean => {
  if (!account || account.is_inventory) return false;

  const details = getAccountTypeDetails(account.name, [account]);
  return details.main === 'liabilities'
    && [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(details.nature);
};

export interface AccountIndex {
  byName: Map<string, Account>;
  byId: Map<string, Account>;
}

export const buildAccountIndex = (accountsDb: Account[]): AccountIndex => ({
  byName: new Map(accountsDb.map(account => [account.name, account])),
  byId: new Map(accountsDb.filter(account => account.id).map(account => [account.id as string, account])),
});

export const resolveAccount = (entry: Entry, side: 'debit' | 'credit', index: AccountIndex): Account | undefined => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  return (id ? index.byId.get(id) : undefined) ?? index.byName.get(name);
};

export const getEntryKaratKey = (entry: Entry, debitAcc?: Account, creditAcc?: Account): string => {
  const raw = String(entry.karat ?? '').replace('.0', '');
  if (raw === '18' || raw === '21' || raw === '24') return raw;
  if (isSilverAccount(debitAcc) || isSilverAccount(creditAcc)) return 'silver';
  return String(debitAcc?.karat ?? creditAcc?.karat ?? '21');
};

export const getEntryArabicWeight = (entry: Entry, account?: Account): number => {
  const weight = parseWeight(entry.weight);
  if (weight <= 0) return 0;
  if (isAccessoryAccount(account)) return 0;
  if (account?.metal === 'silver') return weight;

  const karat = account?.karat ?? entry.karat ?? '21';
  if (entry.goldEquivalent21Snapshot && String(entry.goldEquivalent21Snapshot.karat) === String(karat).replace('.0', '')) {
    return entry.goldEquivalent21Snapshot.equivalent21Units / 100;
  }

  if (canCalculateGoldEquivalent21(entry.weight, karat)) {
    return calculateGoldEquivalent21(entry.weight, karat).equivalent21Units / 100;
  }

  return parseWeight(entry.arabicWeight);
};

export const parseCash = (entry: Entry): number => parseFloat(normalizeNumerals(String(entry.cash ?? '0'))) || 0;

export const resolveOperationKind = (entry: Entry): AccountingOperationKind => {
  if (isOpeningEntry(entry)) return 'opening';
  if (entry.operationKind) return entry.operationKind;

  const txKey = entry.subTx ? `\u0631\u0635\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D\u064A ${entry.subTx}` : (entry.tx || '');
  const rule = OPERATION_RULES[txKey] ?? OPERATION_RULES[entry.tx || ''];
  if (rule?.isOpening) return 'opening';
  if (rule?.isPurchase) return 'purchase';
  if (rule?.isSale) return 'sale';

  switch (entry.tx) {
    case '\u062A\u064A\u0641\u064A\u062A': return 'tifeet';
    case '\u062A\u062D\u0648\u064A\u0644': return 'transfer';
    case '\u062A\u0633\u0648\u064A\u0629':
    case '\u062A\u0633\u0648\u064A\u0629 \u0639\u062C\u0632':
    case '\u062A\u0633\u0648\u064A\u0629 \u0632\u064A\u0627\u062F\u0629':
      return 'adjustment';
    case '\u062D\u0633\u0627\u0628 \u062A\u0627\u062C\u0631 \u0630\u0647\u0628':
    case '\u062D\u0633\u0627\u0628 \u062A\u0627\u062C\u0631 \u0641\u0636\u0629':
      return 'merchant_settlement';
    case '\u0645\u0633\u062D\u0648\u0628\u0627\u062A':
      return 'personal_withdrawal';
    case '\u0645 \u062A':
    case '\u0645 \u0627 \u0639':
      return 'expense';
    default:
      return rule?.affectsInventory ? 'transfer' : 'other';
  }
};
export const affectsInventory = (entry: Entry): boolean => {
  const kind = resolveOperationKind(entry);
  return ['opening', 'purchase', 'sale', 'transfer', 'tifeet', 'adjustment', 'merchant_settlement'].includes(kind);
};

export interface InventorySnapshot {
  weight: number;
  arabicWeight: number;
  count: number;
  karat: string;
}

export interface InventoryEngineResult {
  snapshots: Record<string, InventorySnapshot>;
  merchantWeightLiabilities: Record<string, InventorySnapshot>;
  goldWeightLiabilities: Record<string, InventorySnapshot>;
  goldPosition: GoldOwnershipPosition;
}

export interface GoldOwnershipPosition {
  physicalGoldInventory21: number;
  netGoldLiabilities21: number;
  netShopGoldOwnership21: number;
}

export function processInventory(entries: Entry[], accountsDb: Account[]): InventoryEngineResult {
  const index = buildAccountIndex(accountsDb);
  const snapshots: Record<string, InventorySnapshot> = {};
  const merchantWeightLiabilities: Record<string, InventorySnapshot> = {};
  const goldWeightLiabilities: Record<string, InventorySnapshot> = {};

  accountsDb.forEach(account => {
    const karat = account.karat || (account.metal === 'silver' ? 'silver' : '21');

    if (account.is_inventory) {
      snapshots[account.name] = {
        weight: 0,
        arabicWeight: 0,
        count: 0,
        karat,
      };
    }

    if (isMerchantWeightAccount(account)) {
      merchantWeightLiabilities[account.name] = {
        weight: 0,
        arabicWeight: 0,
        count: 0,
        karat,
      };
    }

    if (isGoldWeightLiabilityAccount(account)) {
      goldWeightLiabilities[account.name] = {
        weight: 0,
        arabicWeight: 0,
        count: 0,
        karat,
      };
    }
  });

  entries.forEach(entry => {
    if (!affectsInventory(entry)) return;
    const weight = parseWeight(entry.weight);
    const count = parseWeight(entry.weight) || (parseFloat(String(entry.count ?? '0')) || 0);
    if (weight === 0 && count === 0) return;

    const debitAcc = resolveAccount(entry, 'debit', index);
    const creditAcc = resolveAccount(entry, 'credit', index);

    const apply = (account: Account | undefined, sign: 1 | -1) => {
      if (account?.is_inventory && snapshots[account.name]) {
        snapshots[account.name].weight += weight * sign;
        snapshots[account.name].count += count * sign;
        snapshots[account.name].arabicWeight += getEntryArabicWeight(entry, account) * sign;
      }

      if (isMerchantWeightAccount(account) && merchantWeightLiabilities[account.name]) {
        merchantWeightLiabilities[account.name].weight -= weight * sign;
        merchantWeightLiabilities[account.name].arabicWeight -= getEntryArabicWeight(entry, account) * sign;
      }

      if (isGoldWeightLiabilityAccount(account) && goldWeightLiabilities[account.name]) {
        goldWeightLiabilities[account.name].weight -= weight * sign;
        goldWeightLiabilities[account.name].arabicWeight -= getEntryArabicWeight(entry, account) * sign;
      }
    };

    apply(debitAcc, 1);
    apply(creditAcc, -1);
  });

  const physicalGoldInventory21 = Object.entries(snapshots).reduce((total, [accountName, snapshot]) => {
    const account = index.byName.get(accountName);
    return account?.metal === 'gold' ? total + snapshot.arabicWeight : total;
  }, 0);
  const netGoldLiabilities21 = Object.values(goldWeightLiabilities).reduce((total, snapshot) => total + snapshot.arabicWeight, 0);
  const goldPosition = {
    physicalGoldInventory21,
    netGoldLiabilities21,
    netShopGoldOwnership21: physicalGoldInventory21 - netGoldLiabilities21,
  };

  return { snapshots, merchantWeightLiabilities, goldWeightLiabilities, goldPosition };
}

export const calculateGoldOwnershipPosition = (entries: Entry[], accountsDb: Account[]): GoldOwnershipPosition =>
  processInventory(entries, accountsDb).goldPosition;

export interface AccountBalanceResult {
  accountId: string;
  accountName: string;
  cashBalance: number;
  goldActualBalance: number;
  goldE21Balance: number;
  silverBalance: number;
  quantityBalance: number;
  mainType: CanonicalMainType | 'unclassified';
  subType: CanonicalAccountSubType;
  isMerchant: boolean;
  merchantDirection?: MerchantDirection;
  metal?: ExplicitWeightedMetal | null;
}

export interface LegacyMatchWarning {
  entryId: string;
  side: 'debit' | 'credit';
  legacyName: string;
  accountId: string;
  accountName: string;
  reason: 'missing_account_id_unique_name_match';
}

export interface AccountClassificationWarning {
  accountId: string;
  accountName: string;
  code:
    | 'missing_canonical_classification'
    | 'classification_conflict'
    | 'unknown_account_id'
    | 'unknown_legacy_name'
    | 'ambiguous_legacy_name';
  message: string;
}

export interface ComputeAccountBalancesResult {
  balances: Map<string, AccountBalanceResult>;
  legacyNameMatchedEntries: LegacyMatchWarning[];
  unclassifiedAccounts: AccountClassificationWarning[];
  classificationConflicts: AccountClassificationWarning[];
}

interface NormalizedBalanceClassification {
  mainType: CanonicalMainType | 'unclassified';
  subType: CanonicalAccountSubType;
  isMerchant: boolean;
  merchantDirection?: MerchantDirection;
  metal?: ExplicitWeightedMetal | null;
  conflict?: string;
  unclassifiedReason?: string;
}

const normalizeStoredMainType = (value?: string): CanonicalMainType | undefined => {
  const normalized = String(value ?? '').trim().toLowerCase();
  const values: Record<string, CanonicalMainType> = {
    asset: 'assets',
    assets: 'assets',
    liability: 'liabilities',
    liabilities: 'liabilities',
    equity: 'equity',
    revenue: 'revenue',
    income: 'revenue',
    expense: 'expense',
    expenses: 'expense',
    '\u0627\u0635\u0648\u0644': 'assets',
    '\u062e\u0635\u0648\u0645': 'liabilities',
    '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629': 'equity',
    '\u0627\u064a\u0631\u0627\u062f\u0627\u062a': 'revenue',
    '\u0645\u0635\u0631\u0648\u0641\u0627\u062a': 'expense',
  };
  return values[normalized];
};

const inferStructuralSubType = (
  account: Account,
  normalizedMainType?: CanonicalMainType,
): CanonicalAccountSubType | undefined => {
  if (account.is_inventory) {
    if (account.type === 'accessory') return 'inventory_accessory';
    if (account.metal === 'gold') return 'inventory_gold';
    if (account.metal === 'silver') return 'inventory_silver';
  }
  if (account.type === 'cash') return 'cash';
  if (account.type === 'merchant' && account.metal === 'gold') return 'merchant_gold';
  if (account.type === 'merchant' && account.metal === 'silver') return 'merchant_silver';
  if (account.subType === '\u0627\u0635\u0648\u0644 \u062b\u0627\u0628\u062a\u0629') return 'fixed_asset';
  if (account.subType === '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644') return 'capital';
  if (account.type === 'other'
    && ['\u0630\u0645\u0645 \u0645\u062f\u064a\u0646\u0629', '\u0630\u0645\u0645 \u062f\u0627\u0626\u0646\u0629'].includes(account.subType)
    && !account.metal) return 'customer';
  if (normalizedMainType === 'revenue') return 'revenue';
  if (normalizedMainType === 'expense') return 'expense';
  return undefined;
};

const expectedMainType = (
  subType: CanonicalAccountSubType,
  direction?: MerchantDirection,
): CanonicalMainType | undefined => {
  if (direction === 'payable') return 'liabilities';
  if (direction === 'receivable') return 'assets';
  if (['inventory_gold', 'inventory_silver', 'inventory_accessory', 'cash', 'fixed_asset'].includes(subType)) return 'assets';
  if (subType === 'capital') return 'equity';
  if (subType === 'revenue') return 'revenue';
  if (subType === 'expense') return 'expense';
  return undefined;
};

const normalizeBalanceClassification = (account: Account): NormalizedBalanceClassification => {
  const storedMainType = account.canonicalMainType ?? normalizeStoredMainType(account.mainType);
  const subType = account.canonicalSubType ?? inferStructuralSubType(account, storedMainType);
  if (!subType || subType === 'unclassified') {
    return {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      metal: account.metal,
      unclassifiedReason: 'Canonical subtype is missing and cannot be derived from structural fields',
    };
  }

  const isMerchant = subType === 'merchant_gold' || subType === 'merchant_silver';
  const isWeightedDue = isMerchant || subType === 'other_due';
  const merchantDirection = account.merchantDirection
    ?? (isWeightedDue && storedMainType === 'liabilities' ? 'payable' : undefined)
    ?? (isWeightedDue && storedMainType === 'assets' ? 'receivable' : undefined);
  const structuralMetal: ExplicitWeightedMetal | null | undefined =
    ['merchant_gold', 'inventory_gold'].includes(subType) ? 'gold'
      : ['merchant_silver', 'inventory_silver'].includes(subType) ? 'silver'
        : account.metal;
  const inferredMainType = expectedMainType(subType, merchantDirection);
  const mainType = storedMainType ?? inferredMainType;

  if (isWeightedDue && account.is_inventory === true) {
    return {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      metal: structuralMetal,
      conflict: 'Merchant and other_due accounts cannot be inventory',
    };
  }
  if (isWeightedDue && !merchantDirection) {
    return {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      metal: structuralMetal,
      unclassifiedReason: 'Weighted due account is missing merchantDirection',
    };
  }
  if (account.metal && structuralMetal && account.metal !== structuralMetal) {
    return {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      metal: account.metal,
      conflict: 'Canonical subtype conflicts with structural metal',
    };
  }
  if (storedMainType && inferredMainType && storedMainType !== inferredMainType) {
    return {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      merchantDirection,
      metal: structuralMetal,
      conflict: 'canonicalMainType conflicts with merchantDirection or canonical subtype',
    };
  }
  if (!mainType) {
    return {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      merchantDirection,
      metal: structuralMetal,
      unclassifiedReason: 'Canonical main type is missing and cannot be derived safely',
    };
  }

  return {
    mainType,
    subType,
    isMerchant,
    merchantDirection,
    metal: structuralMetal,
  };
};

const balanceAccountId = (account: Account): string =>
  account.id ?? account.canonicalAccountId ?? `legacy-account:${account.name}`;

const emptyAccountBalance = (
  accountId: string,
  accountName: string,
  classification: NormalizedBalanceClassification,
): AccountBalanceResult => ({
  accountId,
  accountName,
  cashBalance: 0,
  goldActualBalance: 0,
  goldE21Balance: 0,
  silverBalance: 0,
  quantityBalance: 0,
  mainType: classification.mainType,
  subType: classification.subType,
  isMerchant: classification.isMerchant,
  merchantDirection: classification.merchantDirection,
  metal: classification.metal,
});

const isIncludedBalanceEntry = (entry: Entry): boolean => {
  const raw = entry as Entry & Record<string, unknown>;
  if (raw.isDeleted === true || raw.deleted === true || raw.isVoided === true || raw.voided === true
    || raw.isReversed === true || raw.reversed === true) return false;
  return !['voided', 'deleted', 'reversed', 'excluded', 'invalid']
    .includes(String(raw.status ?? '').toLowerCase());
};

const naturalDebitSign = (mainType: CanonicalMainType | 'unclassified'): 1 | -1 =>
  ['liabilities', 'equity', 'revenue'].includes(mainType) ? -1 : 1;

const explicitEntryMetal = (entry: Entry): ExplicitWeightedMetal | undefined => {
  const raw = entry as Entry & Record<string, unknown>;
  const metal = String(raw.metal ?? raw.metalType ?? raw.weightMetal ?? '').toLowerCase();
  if (metal === 'gold' || metal === 'silver') return metal;
  if (String(entry.karat ?? '').toLowerCase() === 'silver') return 'silver';
  if (entry.karat === 18 || entry.karat === 21 || entry.karat === 24) return 'gold';
  return undefined;
};

export function computeAccountBalances(
  entries: Entry[],
  accounts: Account[],
): ComputeAccountBalancesResult {
  const balances = new Map<string, AccountBalanceResult>();
  const legacyNameMatchedEntries: LegacyMatchWarning[] = [];
  const unclassifiedAccounts: AccountClassificationWarning[] = [];
  const classificationConflicts: AccountClassificationWarning[] = [];
  const warningKeys = new Set<string>();
  const byId = new Map(accounts.filter(account => account.id).map(account => [account.id as string, account]));
  const byName = new Map<string, Account[]>();

  const pushClassificationWarning = (
    target: AccountClassificationWarning[],
    warning: AccountClassificationWarning,
  ): void => {
    const key = `${warning.code}:${warning.accountId}`;
    if (warningKeys.has(key)) return;
    warningKeys.add(key);
    target.push(warning);
  };

  for (const account of accounts) {
    const named = byName.get(account.name) ?? [];
    named.push(account);
    byName.set(account.name, named);

    const accountId = balanceAccountId(account);
    const classification = normalizeBalanceClassification(account);
    balances.set(accountId, emptyAccountBalance(accountId, account.name, classification));

    if (classification.conflict) {
      pushClassificationWarning(classificationConflicts, {
        accountId,
        accountName: account.name,
        code: 'classification_conflict',
        message: classification.conflict,
      });
    } else if (classification.unclassifiedReason) {
      pushClassificationWarning(unclassifiedAccounts, {
        accountId,
        accountName: account.name,
        code: 'missing_canonical_classification',
        message: classification.unclassifiedReason,
      });
    }
  }

  const ensureUnknownBalance = (
    accountId: string,
    accountName: string,
    code: AccountClassificationWarning['code'],
    message: string,
  ): AccountBalanceResult => {
    const existing = balances.get(accountId);
    if (existing) return existing;
    const result = emptyAccountBalance(accountId, accountName, {
      mainType: 'unclassified',
      subType: 'unclassified',
      isMerchant: false,
      unclassifiedReason: message,
    });
    balances.set(accountId, result);
    pushClassificationWarning(unclassifiedAccounts, {
      accountId,
      accountName,
      code,
      message,
    });
    return result;
  };

  const validEntries = entries.filter(isIncludedBalanceEntry);

  for (const account of accounts.filter(account => account.is_inventory)) {
    const accountId = balanceAccountId(account);
    const result = balances.get(accountId);
    if (!result || result.mainType === 'unclassified') continue;
    const inventoryEntries = validEntries.filter(entry => {
      const debitMatches = entry.debitAccountId
        ? entry.debitAccountId === account.id
        : entry.debit === account.name && (byName.get(entry.debit)?.length ?? 0) === 1;
      const creditMatches = entry.creditAccountId
        ? entry.creditAccountId === account.id
        : entry.credit === account.name && (byName.get(entry.credit)?.length ?? 0) === 1;
      return debitMatches || creditMatches;
    });
    const snapshot = processInventory(inventoryEntries, [account]).snapshots[account.name];
    if (!snapshot) continue;
    if (account.type === 'accessory') {
      result.quantityBalance = snapshot.count;
    } else if (account.metal === 'silver') {
      result.silverBalance = snapshot.weight;
    } else if (account.metal === 'gold') {
      result.goldActualBalance = snapshot.weight;
      result.goldE21Balance = snapshot.arabicWeight;
    }
  }

  const resolveSide = (
    entry: Entry,
    side: 'debit' | 'credit',
  ): { account?: Account; balance: AccountBalanceResult } => {
    const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
    const name = side === 'debit' ? entry.debit : entry.credit;
    if (id) {
      const account = byId.get(id);
      if (account) return { account, balance: balances.get(balanceAccountId(account))! };
      return {
        balance: ensureUnknownBalance(
          id,
          name || `Unknown account ${id}`,
          'unknown_account_id',
          'Entry references an account ID that is absent from the account master',
        ),
      };
    }

    const candidates = byName.get(name) ?? [];
    if (candidates.length === 1) {
      const account = candidates[0];
      legacyNameMatchedEntries.push({
        entryId: entry.id ?? String(entry.seq ?? 'unknown-entry'),
        side,
        legacyName: name,
        accountId: balanceAccountId(account),
        accountName: account.name,
        reason: 'missing_account_id_unique_name_match',
      });
      return { account, balance: balances.get(balanceAccountId(account))! };
    }

    const accountId = `legacy-name:${name || '(blank)'}`;
    return {
      balance: ensureUnknownBalance(
        accountId,
        name || '(blank account name)',
        candidates.length > 1 ? 'ambiguous_legacy_name' : 'unknown_legacy_name',
        candidates.length > 1
          ? 'Legacy account name matches more than one account; no guess was made'
          : 'Legacy account name is absent from the account master',
      ),
    };
  };

  for (const entry of validEntries) {
    const cash = parseCash(entry);
    const weight = parseWeight(entry.weight);
    const count = parseFloat(normalizeNumerals(String(entry.count ?? '0'))) || 0;
    if (cash === 0 && weight === 0 && count === 0) continue;

    const debit = resolveSide(entry, 'debit');
    const credit = resolveSide(entry, 'credit');
    const movementMetal = explicitEntryMetal(entry);

    const apply = (
      resolved: { account?: Account; balance: AccountBalanceResult },
      side: 'debit' | 'credit',
    ): void => {
      const { account, balance } = resolved;
      const debitSign = naturalDebitSign(balance.mainType);
      const sign = side === 'debit' ? debitSign : -debitSign;
      if (cash !== 0) balance.cashBalance += cash * sign;
      if (account?.is_inventory) return;

      const metal = balance.metal ?? movementMetal;
      if (!balance.metal && metal) balance.metal = metal;
      if (weight !== 0 && metal === 'gold') {
        balance.goldActualBalance += weight * sign;
        balance.goldE21Balance += getEntryArabicWeight(entry, account) * sign;
      } else if (weight !== 0 && metal === 'silver') {
        balance.silverBalance += weight * sign;
      }
      if (count !== 0 && account?.measurementDimension === 'quantity') {
        balance.quantityBalance += count * sign;
      }
    };

    apply(debit, 'debit');
    apply(credit, 'credit');
  }

  return {
    balances,
    legacyNameMatchedEntries,
    unclassifiedAccounts,
    classificationConflicts,
  };
}

export interface CostBasisEngine {
  getCost: (accNameOrId: string) => number;
  getResult: (operationId: string | undefined) => OperationCostResult | undefined;
  avgProductCost: Record<string, number>;
  avgScrapCost: Record<string, number>;
  avgDirectCost: Record<string, number>;
  timeline: CostTimelineResult;
  hasMissingCostBasis: boolean;
}

const averageCostForDisplay = (quantityUnits: number, totalCostMinor: number, isAccessory: boolean): number => {
  if (quantityUnits <= 0) return 0;
  const minorPerUnit = totalCostMinor / quantityUnits;
  return isAccessory ? (minorPerUnit * ACCESSORY_QUANTITY_SCALE) / 100 : minorPerUnit;
};

export function processCostBasis(entries: Entry[], accountsDb: Account[], _goldPrice: number, _silverPrice: number, openingConfig: OpeningCostConfig = {}): CostBasisEngine {
  const index = buildAccountIndex(accountsDb);
  const timeline = rebuildCostTimeline(entries, accountsDb, openingConfig);
  const avgProductCost: Record<string, number> = {};
  const avgScrapCost: Record<string, number> = {};
  const avgDirectCost: Record<string, number> = {};

  Object.values(timeline.finalStates).forEach(state => {
    const account = index.byName.get(state.accountName) ?? index.byId.get(state.accountId);
    if (!account || state.quantityUnits <= 0 || !state.hasReliableCostBasis) return;
    const avg = averageCostForDisplay(state.quantityUnits, state.totalCostMinor, isAccessoryAccount(account));
    if (account.type === 'gold_raw' || account.type === 'silver') avgScrapCost[account.name] = avg;
    else if (account.type === 'gold_direct') avgDirectCost[account.name] = avg;
    else if (account.type === 'gold_product' || account.type === 'accessory') avgProductCost[account.name] = avg;
  });

  const getCost = (accNameOrId: string): number => {
    const account = index.byName.get(accNameOrId) ?? index.byId.get(accNameOrId);
    const key = account?.name ?? accNameOrId;
    return avgProductCost[key] ?? avgDirectCost[key] ?? avgScrapCost[key] ?? 0;
  };

  const getResult = (operationId: string | undefined): OperationCostResult | undefined => {
    if (!operationId) return undefined;
    return timeline.resultsByOperationId[operationId];
  };

  return {
    avgProductCost,
    avgScrapCost,
    avgDirectCost,
    getCost,
    getResult,
    timeline,
    hasMissingCostBasis: timeline.results.some(result => result.status === 'missing_cost_basis'),
  };
}
export interface ProfitKaratRow {
  openingAr: number;
  purchAr: number;
  purchCash: number;
  salesAr: number;
  salesCash: number;
  closingAr: number;
}

export interface ProfitAccountRow extends ProfitKaratRow {
  karat: string;
  flowsAr: Record<string, number>;
  cogs: number;
  missingCostBasisCount: number;
  invalidCostOperationCount: number;
  affectedSalesCount: number;
  profitStatus: 'valid' | 'incomplete_cost_basis' | 'invalid';
  grossProfit: number | null;
}

export interface ProfitFlowRow {
  opening: number;
  purchase: number;
  purchCash: number;
  merchantIn: number;
  merchantCash: number;
  tifeetIn: number;
  tifeetOut: number;
  transferIn: number;
  transferOut: number;
  surplus: number;
  deficit: number;
  sales: number;
  salesCash: number;
  merchantPay: number;
  closing: number;
  closingMarket: number;
  tifeetCost: number;
  tifeetMarket: number;
  transferCost: number;
  transferMarket: number;
}

export interface ProfitAnalysisResult {
  karatData: Record<string, ProfitKaratRow>;
  accData: Record<string, ProfitAccountRow>;
  flowData: Record<string, ProfitFlowRow>;
  costBasis: CostBasisEngine;
  profitStatus: 'valid' | 'incomplete_cost_basis' | 'invalid';
  missingOpeningCostBasisCount: number;
  missingCostBasisCount: number;
  invalidCostOperationCount: number;
  affectedSalesCount: number;
}

const emptyKaratRow = (): ProfitKaratRow => ({ openingAr: 0, purchAr: 0, purchCash: 0, salesAr: 0, salesCash: 0, closingAr: 0 });
const emptyFlowRow = (): ProfitFlowRow => ({
  opening: 0, purchase: 0, purchCash: 0, merchantIn: 0, merchantCash: 0,
  tifeetIn: 0, tifeetOut: 0, transferIn: 0, transferOut: 0,
  surplus: 0, deficit: 0, sales: 0, salesCash: 0, merchantPay: 0, closing: 0,
  closingMarket: 0, tifeetCost: 0, tifeetMarket: 0, transferCost: 0, transferMarket: 0,
});

export function analyzeProfitability(
  entries: Entry[],
  accountsDb: Account[],
  goldPrice: number,
  silverPrice: number,
  startDate = '2000-01-01',
  endDate = '2099-12-31',
  openingConfig: OpeningCostConfig = {},
): ProfitAnalysisResult {
  const sorted = [...entries].sort(compareEntriesForCost);
  const index = buildAccountIndex(accountsDb);
  const costEntries = sorted.filter(entry => !entry.date || entry.date <= endDate);
  const costBasis = processCostBasis(costEntries, accountsDb, goldPrice, silverPrice, openingConfig);

  const karatData: Record<string, ProfitKaratRow> = {
    '18': emptyKaratRow(),
    '21': emptyKaratRow(),
    '24': emptyKaratRow(),
    silver: emptyKaratRow(),
  };
  const flowData: Record<string, ProfitFlowRow> = {
    '18': emptyFlowRow(),
    '21': emptyFlowRow(),
    '24': emptyFlowRow(),
  };
  const accData: Record<string, ProfitAccountRow> = {};

  const getAccRow = (account: Account, karat: string): ProfitAccountRow => {
    if (!accData[account.name]) {
      accData[account.name] = {
        karat,
        ...emptyKaratRow(),
        flowsAr: {},
        cogs: 0,
        missingCostBasisCount: 0,
        invalidCostOperationCount: 0,
        affectedSalesCount: 0,
        profitStatus: 'valid',
        grossProfit: 0,
      };
    }
    return accData[account.name];
  };

  sorted.forEach(entry => {
    const kind = resolveOperationKind(entry);
    const debitAcc = resolveAccount(entry, 'debit', index);
    const creditAcc = resolveAccount(entry, 'credit', index);
    const weight = parseWeight(entry.weight);
    const cash = parseCash(entry);
    const date = entry.date || '';
    const isOpening = kind === 'opening';
    const isPrePeriod = isOpening || (!!date && date < startDate);
    const isInPeriod = !isOpening && !!date && date >= startDate && date <= endDate;

    const processSide = (account: Account | undefined, sign: 1 | -1) => {
      if (!isMetalInventoryAccount(account)) return;
      const karat = isSilverAccount(account) ? 'silver' : String(account.karat ?? getEntryKaratKey(entry, debitAcc, creditAcc));
      const row = getAccRow(account, karat);
      const kRow = karatData[karat] ?? karatData['21'];
      const arWeight = getEntryArabicWeight(entry, account);
      const operationCost = costBasis.getResult(getOperationId(entry));
      const cashValue = cash;

      if (!date || date <= endDate) {
        row.closingAr += arWeight * sign;
        kRow.closingAr += arWeight * sign;
      }
      if (isInPeriod) {
        row.flowsAr[kind] = (row.flowsAr[kind] || 0) + arWeight * sign;
        if (entry.tx) row.flowsAr[entry.tx] = (row.flowsAr[entry.tx] || 0) + arWeight * sign;
      }
      if (isPrePeriod && sign === 1) {
        row.openingAr += arWeight;
        kRow.openingAr += arWeight;
      }
      if (isInPeriod && kind === 'purchase' && sign === 1) {
        row.purchAr += arWeight;
        row.purchCash += cashValue;
        kRow.purchAr += arWeight;
        kRow.purchCash += cashValue;
      }
      if (isInPeriod && kind === 'sale' && sign === -1) {
        row.salesAr += arWeight;
        row.salesCash += cashValue;
        if (operationCost?.status === 'valid') {
          row.cogs += operationCost.cogsMinor / 100;
        } else {
          row.affectedSalesCount += 1;
          if (operationCost?.status === 'missing_cost_basis') row.missingCostBasisCount += 1;
          else row.invalidCostOperationCount += 1;
        }
        kRow.salesAr += arWeight;
        kRow.salesCash += cashValue;
      }
    };

    processSide(debitAcc, 1);
    processSide(creditAcc, -1);

    const karat = getEntryKaratKey(entry, debitAcc, creditAcc);
    const flow = flowData[karat];
    if (!flow || weight <= 0) return;

    const debitIsGold = isMetalInventoryAccount(debitAcc) && isGoldAccount(debitAcc);
    const creditIsGold = isMetalInventoryAccount(creditAcc) && isGoldAccount(creditAcc);
    const arWeight = canCalculateGoldEquivalent21(entry.weight, karat) ? calculateGoldEquivalent21(entry.weight, karat).equivalent21Units / 100 : parseWeight(entry.arabicWeight);

    if (isPrePeriod) {
      if (debitIsGold) flow.opening += arWeight;
      if (creditIsGold) flow.opening -= arWeight;
    }
    if (!isInPeriod) return;

    if (kind === 'purchase' && debitIsGold) {
      flow.purchase += arWeight;
      flow.purchCash += cash;
    } else if (kind === 'sale' && creditIsGold) {
      flow.sales += arWeight;
      flow.salesCash += cash;
    } else if (kind === 'tifeet') {
      if (debitIsGold) {
        flow.tifeetIn += arWeight;
        flow.tifeetMarket += arWeight * goldPrice;
        flow.tifeetCost += (costBasis.getResult(getOperationId(entry))?.incomingCostMinor || 0) / 100;
      }
      if (creditIsGold) flow.tifeetOut += arWeight;
    } else if (kind === 'transfer') {
      if (debitIsGold) {
        flow.transferIn += arWeight;
        flow.transferMarket += arWeight * goldPrice;
        flow.transferCost += (costBasis.getResult(getOperationId(entry))?.incomingCostMinor || 0) / 100;
      }
      if (creditIsGold) flow.transferOut += arWeight;
    } else if (kind === 'adjustment') {
      if (debitIsGold) flow.surplus += arWeight;
      if (creditIsGold) flow.deficit += arWeight;
    } else if (kind === 'merchant_settlement' && creditIsGold) {
      flow.merchantPay += arWeight;
    }
  });

  Object.entries(flowData).forEach(([karat, flow]) => {
    const mult = getKaratMultiplier(karat);
    flow.closing = flow.opening + flow.purchase + flow.merchantIn
      + flow.tifeetIn - flow.tifeetOut
      + flow.transferIn - flow.transferOut
      + flow.surplus - flow.deficit
      - flow.sales - flow.merchantPay;
    flow.closingMarket = flow.closing * goldPrice * mult;
  });

  let missingCostBasisCount = 0;
  let invalidCostOperationCount = 0;
  let affectedSalesCount = 0;
  Object.values(accData).forEach(row => {
    if (row.affectedSalesCount > 0) {
      row.profitStatus = row.missingCostBasisCount > 0 ? 'incomplete_cost_basis' : 'invalid';
      row.grossProfit = null;
    } else {
      row.profitStatus = 'valid';
      row.grossProfit = row.salesCash - row.cogs;
    }
    missingCostBasisCount += row.missingCostBasisCount;
    invalidCostOperationCount += row.invalidCostOperationCount;
    affectedSalesCount += row.affectedSalesCount;
  });

  const profitStatus = affectedSalesCount === 0
    ? 'valid'
    : missingCostBasisCount > 0 ? 'incomplete_cost_basis' : 'invalid';

  const missingOpeningCostBasisCount = costBasis.timeline.results.filter(result =>
    result.status === 'missing_cost_basis' && resolveOperationKind(result.entry) === 'opening'
  ).length;

  return { karatData, accData, flowData, costBasis, profitStatus, missingOpeningCostBasisCount, missingCostBasisCount, invalidCostOperationCount, affectedSalesCount };
}
