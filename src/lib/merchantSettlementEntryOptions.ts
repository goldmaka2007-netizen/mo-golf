import type { Account, TransactionType } from '../types';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';

const GOLD_MERCHANT_OPERATION_TYPES = ['تاجر ذهب', 'حساب تاجر ذهب'];
const ALLOWED_GOLD_SETTLEMENT_SOURCE_TYPES = new Set(['gold_raw', 'gold_direct']);

const isActive = (account: Account): boolean => account.isActive !== false;

const isGoldMerchant = (account: Account): boolean =>
  isActive(account)
  && account.type === 'merchant'
  && account.metal === 'gold'
  && account.is_inventory !== true;

const isAllowedGoldSettlementSource = (account: Account): boolean =>
  isActive(account)
  && account.is_inventory === true
  && account.metal === 'gold'
  && !!account.type
  && ALLOWED_GOLD_SETTLEMENT_SOURCE_TYPES.has(account.type)
  && ['18', '21', '24'].includes(account.karat ?? '');

const uniqueByName = (accounts: Account[]): Account[] => {
  const seen = new Set<string>();
  return accounts.filter(account => {
    if (!account.name || seen.has(account.name)) return false;
    seen.add(account.name);
    return true;
  });
};

export const buildGoldMerchantSettlementEntryRules = (accounts: Account[]): TransactionType[] => {
  const normalizedAccounts = accounts.map(applyRuntimeAccountOverride);
  const merchants = uniqueByName(normalizedAccounts.filter(isGoldMerchant));
  const sources = uniqueByName(normalizedAccounts.filter(isAllowedGoldSettlementSource));

  return GOLD_MERCHANT_OPERATION_TYPES.flatMap(t =>
    merchants.flatMap(merchant =>
      sources.map(source => {
        const karat = Number(source.karat);
        return {
          t,
          d: merchant.name,
          c: source.name,
          k: karat,
          m: karat / 21,
        };
      }),
    ),
  );
};

export const mergeGoldMerchantSettlementEntryRules = (
  existingRules: TransactionType[],
  accounts: Account[],
): TransactionType[] => {
  const seen = new Set(existingRules.map(rule => `${rule.t}\u0000${rule.d}\u0000${rule.c}`));
  const dynamicRules = buildGoldMerchantSettlementEntryRules(accounts).filter(rule => {
    const key = `${rule.t}\u0000${rule.d}\u0000${rule.c}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...existingRules, ...dynamicRules];
};
