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

const inferNatureFromLegacyLabels = (account: Account): AccountNature => {
    const balanceNature = account.balanceNature || '';
    const subType = account.subType || '';

    if (textIncludesAny(balanceNature, ['جرام ذهب']) || textIncludesAny(subType, ['تجار ذهب'])) return AccountNature.GOLD;
    if (textIncludesAny(balanceNature, ['جرام فضة']) || textIncludesAny(subType, ['تجار فضة'])) return AccountNature.SILVER;
    if (textIncludesAny(balanceNature, ['قطعة'])) return AccountNature.ACC;
    if (textIncludesAny(balanceNature, ['مختلط (ذهب + نقدي)'])) return AccountNature.MIXED_GOLD;
    if (textIncludesAny(balanceNature, ['مختلط (فضة + نقدي)'])) return AccountNature.MIXED_SILVER;

    return AccountNature.CASH;
};

/**
 * 1. ACCOUNT NATURE IDENTIFICATION
 * Central logic to determine if an account is Gold, Silver, Cash or Mixed.
 */
export const getDynamicAccountNature = (accountName: string, accountsDb: Account[]): AccountNature => {
    const found = accountsDb.find(a => a.name === accountName);
    if (!found) {
        return AccountNature.UNKNOWN;
    }

    if (found.type === 'cash') return AccountNature.CASH;
    if (found.type === 'accessory') return AccountNature.ACC;
    if (found.metal === 'gold') return AccountNature.GOLD;
    if (found.metal === 'silver') return AccountNature.SILVER;

    return inferNatureFromLegacyLabels(found);
};

const resolveEntryAccount = (accountId: string | undefined, accountName: string | undefined, accountsDb: Account[]) =>
    accountsDb.find(account => (accountId && account.id === accountId) || account.name === accountName);

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
    const debitNature = getDynamicAccountNature(entry.debit || '', accountsDb);
    const creditNature = getDynamicAccountNature(entry.credit || '', accountsDb);
    const hasGoldAcc = [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(debitNature) || [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(creditNature);
    const hasSilverAcc = [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(debitNature) || [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(creditNature);
    const hasAccessoryAcc = debitNature === AccountNature.ACC || creditNature === AccountNature.ACC;
    return hasGoldAcc && !hasSilverAcc && !hasAccessoryAcc && !!getEntryCalculationKarat(entry);
};
/**
 * 2. LEDGER ROUTING
 * Determines if a transaction value should be recorded in a specific Ledger (Metric).
 */
export const belongsToMetric = (accountName: string, metric: 'cash' | 'gold' | 'silver' | 'accs', accountsDb: Account[]): boolean => {
    const nature = getDynamicAccountNature(accountName, accountsDb);
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
    const debitNature = getDynamicAccountNature(debitAcc, db);
    const creditNature = getDynamicAccountNature(creditAcc, db);
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
export const getAccountTypeDetails = (accountName: string, accountsDb: Account[]) => {
    const found = accountsDb.find(a => a.name === accountName);
    if (!found) return { main: 'others', sub: 'others', nature: AccountNature.CASH };

    const typeMap: Record<string, keyof AccountCategories> = {
        'asset': 'assets',
        'assets': 'assets',
        'اصول': 'assets',
        'أصول': 'assets',
        'الأصول': 'assets',
        'الاصول': 'assets',
        'liability': 'liabilities',
        'liabilities': 'liabilities',
        'خصوم': 'liabilities',
        'الخصوم': 'liabilities',
        'equity': 'equity',
        'حقوق ملكية': 'equity',
        'حقوق الملكية': 'equity',
        'revenue': 'revenue',
        'revenues': 'revenue',
        'ايرادات': 'revenue',
        'إيرادات': 'revenue',
        'الايرادات': 'revenue',
        'الإيرادات': 'revenue',
        'expense': 'expenses',
        'expenses': 'expenses',
        'مصروفات': 'expenses',
        'المصروفات': 'expenses'
    };

    return {
        main: typeMap[found.mainType] || 'others',
        sub: found.subType,
        nature: getDynamicAccountNature(accountName, accountsDb)
    };
};
