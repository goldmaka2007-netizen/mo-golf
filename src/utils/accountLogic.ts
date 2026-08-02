import { Account, AccountNature, AccountCategories, Entry } from '../types';
import { parseWeight } from '../lib/accounting';
import { canCalculateGoldEquivalent21, calculateGoldEquivalent21, inferGoldKaratFromMultiplier, isSupportedGoldKarat } from '../lib/goldEquivalent';

const textIncludesAny = (value: string | undefined, needles: string[]): boolean =>
    needles.some(needle => (value || '').includes(needle));

const getEntryCalculationKarat = (entry: Partial<Entry>) => {
    if (isSupportedGoldKarat(entry.karat)) return entry.karat;
    return inferGoldKaratFromMultiplier(entry.multiplier);
};

const getLegacyArabicWeightValue = (entry: Partial<Entry>): number => parseFloat(entry.arabicWeight || '0') || 0;

const getCalculatedGoldValue = (entry: Entry): number => {
    if (entry.goldEquivalent21Snapshot && Number.isSafeInteger(entry.goldEquivalent21Snapshot.equivalent21Units)) {
        return entry.goldEquivalent21Snapshot.equivalent21Units / 100;
    }

    const karat = getEntryCalculationKarat(entry);
    if (karat && canCalculateGoldEquivalent21(entry.weight || '0', karat)) {
        return calculateGoldEquivalent21(entry.weight || '0', karat).equivalent21Units / 100;
    }

    return getLegacyArabicWeightValue(entry);
};

export interface LegacyNatureFallbackWarning {
    accountId: string;
    accountName: string;
    missingStructuralFields: string[];
    legacyLabel: string;
    nature: AccountNature;
}

interface ResolvedAccount {
    account?: Account;
}

const legacyNatureFallbackWarnings: LegacyNatureFallbackWarning[] = [];
const legacyNatureFallbackKeys = new Set<string>();
let legacyNatureWarningEmitted = false;

export const getLegacyNatureFallbackWarnings = (): LegacyNatureFallbackWarning[] =>
    legacyNatureFallbackWarnings.map(warning => ({ ...warning, missingStructuralFields: [...warning.missingStructuralFields] }));

export const clearLegacyNatureFallbackWarnings = (): void => {
    legacyNatureFallbackWarnings.length = 0;
    legacyNatureFallbackKeys.clear();
    legacyNatureWarningEmitted = false;
};

const resolveAccount = (
    accountName: string | undefined,
    accountsDb: Account[],
    accountId?: string,
): ResolvedAccount => {
    if (accountId) {
        return { account: accountsDb.find(account => account.id === accountId) };
    }
    if (!accountName) return {};
    const matches = accountsDb.filter(account => account.name === accountName);
    return matches.length === 1
        ? { account: matches[0] }
        : {};
};

interface LegacyNatureInference {
    nature: AccountNature;
    label: string;
}

const inferNatureFromLegacyLabels = (account: Account): LegacyNatureInference | undefined => {
    const candidates: Array<{ value: string; field: string; tokens: string[]; nature: AccountNature }> = [
        { value: account.balanceNature || '', field: 'balanceNature', tokens: ['\u062c\u0631\u0627\u0645 \u0630\u0647\u0628'], nature: AccountNature.GOLD },
        { value: account.subType || '', field: 'subType', tokens: ['\u062a\u062c\u0627\u0631 \u0630\u0647\u0628'], nature: AccountNature.GOLD },
        { value: account.balanceNature || '', field: 'balanceNature', tokens: ['\u062c\u0631\u0627\u0645 \u0641\u0636\u0629'], nature: AccountNature.SILVER },
        { value: account.subType || '', field: 'subType', tokens: ['\u062a\u062c\u0627\u0631 \u0641\u0636\u0629'], nature: AccountNature.SILVER },
        { value: account.balanceNature || '', field: 'balanceNature', tokens: ['\u0642\u0637\u0639\u0629'], nature: AccountNature.ACC },
        { value: account.balanceNature || '', field: 'balanceNature', tokens: ['\u0645\u062e\u062a\u0644\u0637 (\u0630\u0647\u0628 + \u0646\u0642\u062f\u064a)'], nature: AccountNature.MIXED_GOLD },
        { value: account.balanceNature || '', field: 'balanceNature', tokens: ['\u0645\u062e\u062a\u0644\u0637 (\u0641\u0636\u0629 + \u0646\u0642\u062f\u064a)'], nature: AccountNature.MIXED_SILVER },
        { value: account.balanceNature || '', field: 'balanceNature', tokens: ['\u062c\u0646\u064a\u0629 \u0645\u0635\u0631\u064a', '\u062c\u0646\u064a\u0647 \u0645\u0635\u0631\u064a', 'cash'], nature: AccountNature.CASH },
    ];
    const matched = candidates.find(candidate => textIncludesAny(candidate.value, candidate.tokens));
    return matched ? { nature: matched.nature, label: `${matched.field}:${matched.value}` } : undefined;
};

const natureFromSubType = (account: Account): AccountNature | undefined => {
    const subType = account.canonicalSubType ?? account.subType;
    if (['merchant_gold', 'inventory_gold'].includes(subType)) return AccountNature.GOLD;
    if (['merchant_silver', 'inventory_silver'].includes(subType)) return AccountNature.SILVER;
    if (subType === 'inventory_accessory') return AccountNature.ACC;
    if (subType === 'cash') return AccountNature.CASH;
    return undefined;
};

const natureFromType = (account: Account): AccountNature | undefined => {
    if (['gold_raw', 'gold_product', 'gold_direct'].includes(account.type ?? '')) return AccountNature.GOLD;
    if (account.type === 'silver') return AccountNature.SILVER;
    if (account.type === 'accessory') return AccountNature.ACC;
    if (account.type === 'cash') return AccountNature.CASH;
    return undefined;
};

const recordLegacyNatureFallback = (account: Account, inference: LegacyNatureInference): void => {
    const key = account.id || account.name;
    if (!legacyNatureFallbackKeys.has(key)) {
        legacyNatureFallbackKeys.add(key);
        legacyNatureFallbackWarnings.push({
            accountId: account.id ?? '',
            accountName: account.name,
            missingStructuralFields: [
                !account.metal ? 'metal' : '',
                !account.canonicalSubType ? 'canonicalSubType' : '',
                !account.type || account.type === 'other' ? 'type' : '',
            ].filter(Boolean),
            legacyLabel: inference.label,
            nature: inference.nature,
        });
    }
    if (!legacyNatureWarningEmitted) {
        legacyNatureWarningEmitted = true;
        console.warn('Legacy account nature fallbacks', legacyNatureFallbackWarnings);
    }
};

/**
 * 1. ACCOUNT NATURE IDENTIFICATION
 * Structural account metadata is authoritative; legacy labels are diagnostic fallback only.
 */
export const getDynamicAccountNature = (
    accountName: string,
    accountsDb: Account[],
    accountId?: string,
): AccountNature => {
    const found = resolveAccount(accountName, accountsDb, accountId).account;
    if (!found) return AccountNature.UNKNOWN;

    if (found.metal === 'gold') return AccountNature.GOLD;
    if (found.metal === 'silver') return AccountNature.SILVER;

    const subTypeNature = natureFromSubType(found);
    if (subTypeNature !== undefined) return subTypeNature;

    const typeNature = natureFromType(found);
    if (typeNature !== undefined) return typeNature;

    const legacyInference = inferNatureFromLegacyLabels(found);
    if (!legacyInference) return AccountNature.UNKNOWN;
    recordLegacyNatureFallback(found, legacyInference);
    return legacyInference.nature;
};

const resolveEntryAccount = (accountId: string | undefined, accountName: string | undefined, accountsDb: Account[]) =>
    resolveAccount(accountName, accountsDb, accountId).account;

/** Merchant cash/workmanship payments are cash-ledger movements, not metal movements. */
export const isCashOnlyMerchantSettlementEntry = (entry: Partial<Entry>, accountsDb: Account[] = []): boolean => {
    const isMerchantSettlement = entry.operationKind === 'merchant_settlement'
        || entry.tx === 'حساب تاجر ذهب'
        || entry.tx === 'حساب تاجر فضة';
    if (!isMerchantSettlement) return false;
    const debit = resolveEntryAccount(entry.debitAccountId, entry.debit, accountsDb);
    const credit = resolveEntryAccount(entry.creditAccountId, entry.credit, accountsDb);
    const sides = [debit, credit];
    return sides.some(account => account?.type === 'merchant') && sides.some(account => account?.type === 'cash');
};
export const isGoldEquivalentEntry = (entry: Partial<Entry>, accountsDb: Account[] = []): boolean => {
    if (isCashOnlyMerchantSettlementEntry(entry, accountsDb)) return false;
    const debitNature = getDynamicAccountNature(entry.debit || '', accountsDb, entry.debitAccountId);
    const creditNature = getDynamicAccountNature(entry.credit || '', accountsDb, entry.creditAccountId);
    const hasGoldAcc = [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(debitNature) || [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(creditNature);
    const hasSilverAcc = [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(debitNature) || [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(creditNature);
    const hasAccessoryAcc = debitNature === AccountNature.ACC || creditNature === AccountNature.ACC;
    return hasGoldAcc && !hasSilverAcc && !hasAccessoryAcc && !!getEntryCalculationKarat(entry);
};
/**
 * 2. LEDGER ROUTING
 * Determines if a transaction value should be recorded in a specific Ledger (Metric).
 */
export type Metric = 'cash' | 'gold' | 'silver' | 'accs';
export const belongsToMetric = (accountName: string, metric: Metric, accountsDb: Account[], accountId?: string): boolean => {
    const nature = getDynamicAccountNature(accountName, accountsDb, accountId);
    if (nature === AccountNature.UNKNOWN) return false;
    
    switch(metric) {
        case 'cash': 
            return [AccountNature.CASH, AccountNature.MIXED_GOLD, AccountNature.MIXED_SILVER].includes(nature);
        case 'gold': 
            return [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(nature);
        case 'silver': 
            return [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(nature);
        case 'accs': 
            return nature === AccountNature.ACC;
        default: return false;
    }
};

/**
 * 3. METRIC VALUE EXTRACTION
 * Safely extracts the numeric value for a specific ledger from an entry.
 */
export const getMetricValue = (entry: Entry, metric: 'cash' | 'gold' | 'silver' | 'accs', accountsDb?: Account[], options?: { useActualWeight?: boolean }): number => {
    if (metric === 'cash') return parseFloat(entry.cash || '0') || 0;
    if (metric === 'accs') return parseWeight(entry.weight) || parseFloat(entry.count || '0') || 0;

    const debitAcc = entry.debit || '';
    const creditAcc = entry.credit || '';
    const db = accountsDb || [];
    const debitNature = getDynamicAccountNature(debitAcc, db, entry.debitAccountId);
    const creditNature = getDynamicAccountNature(creditAcc, db, entry.creditAccountId);
    const hasGoldAcc = [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(debitNature) || [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(creditNature);
    const hasSilverAcc = [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(debitNature) || [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(creditNature);
    const hasAccessoryAcc = debitNature === AccountNature.ACC || creditNature === AccountNature.ACC;

    if (metric === 'gold') {
        if (!hasGoldAcc || hasSilverAcc || hasAccessoryAcc) return 0;
    }

    if (metric === 'silver') {
        if (!hasSilverAcc || hasGoldAcc || hasAccessoryAcc) return 0;
    }

    let w = 0;
    if (options?.useActualWeight) {
        w = parseWeight(entry.weight) || 0;
        if (metric === 'gold' && w === 0 && entry.arabicWeight) {
            const arabicW = parseFloat(entry.arabicWeight) || 0;
            if (arabicW !== 0) {
                const m = entry.multiplier || (entry.karat ? (entry.karat / 21) : 1);
                w = arabicW / m;
            }
        }
    } else {
        w = metric === 'gold' ? getCalculatedGoldValue(entry) : (parseWeight(entry.weight) || 0);
    }

    if (w === 0) return 0;

    if (metric === 'gold') return w;
    if (metric === 'silver') return w;

    return 0;
};

export const getMetricActualValue = (entry: Entry, metric: 'gold' | 'silver' | 'accs', accountsDb?: Account[]): number => {
    return getMetricValue(entry, metric as any, accountsDb, { useActualWeight: true });
};

/**
 * 4. ACCOUNT CLASSIFICATION
 * Maps Arabic main types to system category nodes.
 */
export const getAccountTypeDetails = (accountName: string, accountsDb: Account[], accountId?: string) => {
    const found = resolveAccount(accountName, accountsDb, accountId).account;
    if (!found) return { main: 'others' as const, sub: 'unclassified', nature: AccountNature.UNKNOWN };

    const typeMap: Record<string, keyof AccountCategories> = {
        asset: 'assets',
        assets: 'assets',
        '\u0627\u0635\u0648\u0644': 'assets',
        '\u0623\u0635\u0648\u0644': 'assets',
        '\u0627\u0644\u0623\u0635\u0648\u0644': 'assets',
        '\u0627\u0644\u0627\u0635\u0648\u0644': 'assets',
        liability: 'liabilities',
        liabilities: 'liabilities',
        '\u062e\u0635\u0648\u0645': 'liabilities',
        '\u0627\u0644\u062e\u0635\u0648\u0645': 'liabilities',
        equity: 'equity',
        '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629': 'equity',
        '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629': 'equity',
        revenue: 'revenue',
        revenues: 'revenue',
        '\u0627\u064a\u0631\u0627\u062f\u0627\u062a': 'revenue',
        '\u0625\u064a\u0631\u0627\u062f\u0627\u062a': 'revenue',
        '\u0627\u0644\u0627\u064a\u0631\u0627\u062f\u0627\u062a': 'revenue',
        '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a': 'revenue',
        expense: 'expenses',
        expenses: 'expenses',
        '\u0645\u0635\u0631\u0648\u0641\u0627\u062a': 'expenses',
        '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a': 'expenses',
    };

    const rawMainType = found.canonicalMainType ?? found.mainType;
    let main: keyof AccountCategories | 'others' = typeMap[rawMainType] ?? 'others';
    if (main === 'others' && found.merchantDirection) {
        main = found.merchantDirection === 'payable' ? 'liabilities' : 'assets';
    }
    const directionConflict = found.merchantDirection === 'payable'
        ? main !== 'liabilities'
        : found.merchantDirection === 'receivable'
            ? main !== 'assets'
            : false;
    if (main === 'others' || directionConflict || found.canonicalSubType === 'unclassified') {
        return { main: 'others' as const, sub: 'unclassified', nature: getDynamicAccountNature(accountName, accountsDb, accountId) };
    }

    return {
        main,
        sub: found.canonicalSubType ?? found.subType ?? 'unclassified',
        nature: getDynamicAccountNature(accountName, accountsDb, accountId),
    };
};
