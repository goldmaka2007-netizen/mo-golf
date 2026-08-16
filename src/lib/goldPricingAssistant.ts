import type { Account, Entry, TransactionRule } from '../types';
import { calculateKaratPrice, normalizeNumerals } from './accounting';
import type { AccountRegistry } from './accountRegistry';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from './inventoryCostCatalog';
import { buildRuntimeStableInventoryIdAliases } from './runtimeCostAccountResolver';

export type GoldAssistantMode = 'sale' | 'purchase';
export type GoldAssistantKarat = 18 | 21 | 24;

export interface GoldSaleTaxStampPerGramEgp {
  18: number;
  21: number;
}

export const DEFAULT_GOLD_SALE_TAX_STAMP_PER_GRAM_EGP: GoldSaleTaxStampPerGramEgp = Object.freeze({
  18: 15,
  21: 12,
});

export interface GoldAssistantProduct {
  accountId: string;
  name: string;
  karat: GoldAssistantKarat;
  multiplier: number;
  tracksQuantity: boolean;
}

export interface GoldAssistantSession {
  mode: GoldAssistantMode;
  gold21PriceSnapshot: number;
  capturedAt: number;
}

export interface GoldAssistantTemporaryState {
  product: GoldAssistantProduct | null;
  weight: string;
  count: string;
  workmanshipPerGram: string;
  pieceWorkmanship: string;
  taxStampEnabled: boolean;
  discountPercent: string;
  discountPerGram: string;
  purchasePricePerGram: string;
  finalTotal: string;
}

export interface PurchaseLinkedValues {
  discountPercent: number;
  discountPerGram: number;
  purchasePricePerGram: number;
}

const SMART_PURCHASE_TAXONOMY_KEYS = new Set([
  'gold.raw.scrap_foreign',
  'gold.raw.scrap_arabic',
  'gold.direct.coin',
  'gold.direct.bar',
]);

const SMART_PURCHASE_STABLE_ACCOUNT_IDS = new Set(
  CURRENT_DATASET_INVENTORY_BINDINGS
    .filter(binding => SMART_PURCHASE_TAXONOMY_KEYS.has(binding.taxonomyKey))
    .map(binding => binding.inventoryAccountId),
);

const approvedSmartPurchaseAccountIds = (accounts: Account[]): Set<string> => new Set(
  [...buildRuntimeStableInventoryIdAliases(accounts)]
    .filter(([, stableAccountId]) => SMART_PURCHASE_STABLE_ACCOUNT_IDS.has(stableAccountId))
    .map(([runtimeAccountId]) => runtimeAccountId),
);

export interface GoldAssistantRule {
  tx: string;
  debit: string;
  credit: string;
  debitAccountId?: string;
  creditAccountId?: string;
  karat?: number | null;
  multiplier?: number;
}

const roundMoney = (value: number): number => Number(value.toFixed(2));

const finiteNonNegative = (value: number): number | null => (
  Number.isFinite(value) && value >= 0 ? value : null
);

export const parseAssistantNumber = (value: string | number | null | undefined): number | null => {
  const normalized = normalizeNumerals(String(value ?? '')).trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeGoldSaleTaxStampPerGramEgp = (value: unknown): GoldSaleTaxStampPerGramEgp => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rate18 = Number(raw[18]);
  const rate21 = Number(raw[21]);
  return {
    18: Number.isFinite(rate18) && rate18 >= 0 ? roundMoney(rate18) : DEFAULT_GOLD_SALE_TAX_STAMP_PER_GRAM_EGP[18],
    21: Number.isFinite(rate21) && rate21 >= 0 ? roundMoney(rate21) : DEFAULT_GOLD_SALE_TAX_STAMP_PER_GRAM_EGP[21],
  };
};

export const createGoldAssistantSession = (
  mode: GoldAssistantMode,
  gold21PriceSnapshot: number,
  capturedAt = Date.now(),
): GoldAssistantSession => ({ mode, gold21PriceSnapshot, capturedAt });

export const createEmptyGoldAssistantState = (
  product: GoldAssistantProduct | null = null,
): GoldAssistantTemporaryState => ({
  product,
  weight: '',
  count: product?.tracksQuantity ? '1' : '0',
  workmanshipPerGram: '',
  pieceWorkmanship: '',
  taxStampEnabled: false,
  discountPercent: '',
  discountPerGram: '',
  purchasePricePerGram: '',
  finalTotal: '',
});

export const resetGoldAssistantState = (): GoldAssistantTemporaryState => createEmptyGoldAssistantState();

export const changeGoldAssistantProduct = (
  product: GoldAssistantProduct,
): GoldAssistantTemporaryState => createEmptyGoldAssistantState(product);

export const transferredCountForProduct = (
  product: GoldAssistantProduct | null,
  count: string | number,
): string => {
  if (!product?.tracksQuantity) return '0';
  const parsed = parseAssistantNumber(count);
  return parsed !== null && parsed >= 1 ? String(parsed) : '1';
};

export const officialGoldKaratPrice = (gold21PriceSnapshot: number, multiplier: number): number | null => {
  if (!(gold21PriceSnapshot > 0) || !Number.isFinite(gold21PriceSnapshot)) return null;
  if (!(multiplier > 0) || !Number.isFinite(multiplier)) return null;
  return calculateKaratPrice(gold21PriceSnapshot, multiplier);
};

export const workmanshipPieceFromPerGram = (weight: number, perGram: number): number | null => {
  if (!(weight > 0) || !Number.isFinite(weight)) return null;
  const safePerGram = finiteNonNegative(perGram);
  return safePerGram === null ? null : roundMoney(weight * safePerGram);
};

export const workmanshipPerGramFromPiece = (weight: number, piece: number): number | null => {
  if (!(weight > 0) || !Number.isFinite(weight)) return null;
  const safePiece = finiteNonNegative(piece);
  return safePiece === null ? null : roundMoney(safePiece / weight);
};

export const goldSaleTaxStampRate = (
  karat: GoldAssistantKarat,
  settings: GoldSaleTaxStampPerGramEgp,
): number => karat === 24 ? 0 : settings[karat];

export const calculateSalePricing = (args: {
  weight: number;
  officialPrice: number;
  workmanshipTotal: number;
  taxStampEnabled: boolean;
  karat: GoldAssistantKarat;
  taxStampSettings: GoldSaleTaxStampPerGramEgp;
}): { goldValue: number; workmanshipTotal: number; taxStampTotal: number; suggestedTotal: number } | null => {
  const { weight, officialPrice, workmanshipTotal, taxStampEnabled, karat, taxStampSettings } = args;
  if (!(weight > 0) || !Number.isFinite(weight) || !(officialPrice > 0) || !Number.isFinite(officialPrice)) return null;
  const safeWorkmanship = finiteNonNegative(workmanshipTotal);
  if (safeWorkmanship === null) return null;
  const taxRate = taxStampEnabled ? goldSaleTaxStampRate(karat, taxStampSettings) : 0;
  const goldValue = roundMoney(weight * officialPrice);
  const taxStampTotal = roundMoney(weight * taxRate);
  return {
    goldValue,
    workmanshipTotal: roundMoney(safeWorkmanship),
    taxStampTotal,
    suggestedTotal: roundMoney(goldValue + safeWorkmanship + taxStampTotal),
  };
};

export const purchaseValuesFromDiscountPercent = (
  officialPrice: number,
  discountPercent: number,
): PurchaseLinkedValues | null => {
  if (!(officialPrice > 0) || !Number.isFinite(officialPrice)) return null;
  const safePercent = finiteNonNegative(discountPercent);
  if (safePercent === null || safePercent > 100) return null;
  const discountPerGram = roundMoney(officialPrice * safePercent / 100);
  const purchasePricePerGram = roundMoney(officialPrice - discountPerGram);
  if (purchasePricePerGram < 0) return null;
  return { discountPercent: roundMoney(safePercent), discountPerGram, purchasePricePerGram };
};

export const purchaseValuesFromDiscountPerGram = (
  officialPrice: number,
  discountPerGram: number,
): PurchaseLinkedValues | null => {
  if (!(officialPrice > 0) || !Number.isFinite(officialPrice)) return null;
  const safeDiscount = finiteNonNegative(discountPerGram);
  if (safeDiscount === null || safeDiscount > officialPrice) return null;
  return {
    discountPercent: roundMoney(safeDiscount / officialPrice * 100),
    discountPerGram: roundMoney(safeDiscount),
    purchasePricePerGram: roundMoney(officialPrice - safeDiscount),
  };
};

export const purchaseValuesFromPricePerGram = (
  officialPrice: number,
  purchasePricePerGram: number,
): PurchaseLinkedValues | null => {
  if (!(officialPrice > 0) || !Number.isFinite(officialPrice)) return null;
  const safePurchasePrice = finiteNonNegative(purchasePricePerGram);
  if (safePurchasePrice === null || safePurchasePrice > officialPrice) return null;
  return purchaseValuesFromDiscountPerGram(officialPrice, officialPrice - safePurchasePrice);
};

export const calculateProposedPurchaseTotal = (weight: number, purchasePricePerGram: number): number | null => {
  if (!(weight > 0) || !Number.isFinite(weight)) return null;
  const safePrice = finiteNonNegative(purchasePricePerGram);
  return safePrice === null ? null : roundMoney(weight * safePrice);
};

export const calculateActualPurchaseValues = (
  finalTotal: number,
  weight: number,
  officialPrice: number,
): PurchaseLinkedValues | null => {
  if (!(finalTotal > 0) || !Number.isFinite(finalTotal) || !(weight > 0) || !Number.isFinite(weight) || !(officialPrice > 0) || !Number.isFinite(officialPrice)) return null;
  const actualPricePerGram = roundMoney(finalTotal / weight);
  const actualDiscountPerGram = roundMoney(officialPrice - actualPricePerGram);
  return {
    discountPercent: roundMoney(actualDiscountPerGram / officialPrice * 100),
    discountPerGram: actualDiscountPerGram,
    purchasePricePerGram: actualPricePerGram,
  };
};

const isGoldInventoryProduct = (account: Account | undefined): account is Account & { id: string } => (
  !!account?.id
  && account.isActive !== false
  && account.is_inventory === true
  && account.metal === 'gold'
  && [18, 21, 24].includes(Number(account.karat))
);

const resolveRuleAccount = (
  registry: AccountRegistry,
  accounts: Account[],
  accountId: string | undefined,
  accountName: string,
): Account | undefined => {
  const resolution = registry.resolve(accountId, accountName);
  if (resolution.status !== 'resolved') return undefined;
  return accounts.find(account => account.id === resolution.account.sourceAccountId || account.name === resolution.account.canonicalName);
};

export const resolveGoldAssistantProducts = (args: {
  mode: GoldAssistantMode;
  accounts: Account[];
  registry: AccountRegistry;
  rules: GoldAssistantRule[] | TransactionRule[];
}): GoldAssistantProduct[] => {
  const { mode, accounts, registry, rules } = args;
  const tx = mode === 'sale' ? 'بيع ذهب' : 'شراء ذهب';
  const products = new Map<string, GoldAssistantProduct>();
  const approvedPurchaseIds = mode === 'purchase'
    ? approvedSmartPurchaseAccountIds(accounts)
    : null;

  for (const rule of rules) {
    if (rule.tx !== tx) continue;
    const productAccount = mode === 'sale'
      ? resolveRuleAccount(registry, accounts, rule.creditAccountId, rule.credit)
      : resolveRuleAccount(registry, accounts, rule.debitAccountId, rule.debit);
    const cashAccount = mode === 'sale'
      ? resolveRuleAccount(registry, accounts, rule.debitAccountId, rule.debit)
      : resolveRuleAccount(registry, accounts, rule.creditAccountId, rule.credit);
    const cashResolution = cashAccount ? registry.resolve(cashAccount.id, cashAccount.name) : null;
    if (
      !isGoldInventoryProduct(productAccount)
      || (approvedPurchaseIds && !approvedPurchaseIds.has(productAccount.id))
      || cashResolution?.status !== 'resolved'
      || cashResolution.account.entityType !== 'cash'
    ) continue;

    const resolution = registry.resolve(productAccount.id, productAccount.name);
    if (resolution.status !== 'resolved') continue;
    const karat = Number(productAccount.karat) as GoldAssistantKarat;
    const ruleMultiplier = Number(rule.multiplier);
    products.set(productAccount.id, {
      accountId: productAccount.id,
      name: productAccount.name,
      karat,
      multiplier: ruleMultiplier > 0 && Number.isFinite(ruleMultiplier) ? ruleMultiplier : karat / 21,
      tracksQuantity: resolution.account.tracksQuantity,
    });
  }

  return [...products.values()].sort((left, right) => left.name.localeCompare(right.name, 'ar'));
};

export const findCashAccount = (accounts: Account[], registry: AccountRegistry): Account | null => {
  const cash = accounts.find(account => {
    if (!account.id) return false;
    const resolution = registry.resolve(account.id, account.name);
    return resolution.status === 'resolved' && resolution.account.entityType === 'cash';
  });
  return cash ?? null;
};

export const buildGoldAssistantEntryPrefill = (args: {
  mode: GoldAssistantMode;
  product: GoldAssistantProduct;
  cashAccount: Account;
  weight: string;
  count: string;
  finalTotal: string;
  officialKaratPrice: number;
}): Partial<Entry> => {
  const { mode, product, cashAccount, weight, count, finalTotal, officialKaratPrice } = args;
  const sale = mode === 'sale';
  return {
    tx: sale ? 'بيع ذهب' : 'شراء ذهب',
    debit: sale ? cashAccount.name : product.name,
    debitAccountId: sale ? cashAccount.id : product.accountId,
    credit: sale ? product.name : cashAccount.name,
    creditAccountId: sale ? product.accountId : cashAccount.id,
    cash: finalTotal,
    weight,
    count: transferredCountForProduct(product, count),
    karat: product.karat,
    multiplier: product.multiplier,
    marketPrice: officialKaratPrice,
  };
};
