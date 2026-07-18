import { Entry, Account, AccountingOperationKind } from '../types';
import { OPERATION_RULES } from '../constants';
import { parseWeight, normalizeNumerals } from './accounting';

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
  if (account.metal === 'gold' || account.metal === 'silver') return true;

  return textIncludesAny(account.balanceNature, ['جرام ذهب', 'جرام فضة'])
    || textIncludesAny(account.subType, ['تجار ذهب', 'تجار فضة']);
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
  const karat = account?.metal === 'silver' ? 'silver' : account?.karat ?? entry.karat ?? '21';
  return weight * getKaratMultiplier(karat);
};

export const parseCash = (entry: Entry): number => parseFloat(normalizeNumerals(String(entry.cash ?? '0'))) || 0;

export const resolveOperationKind = (entry: Entry): AccountingOperationKind => {
  if (entry.operationKind) return entry.operationKind;

  const txKey = entry.subTx ? `رصيد افتتاحي ${entry.subTx}` : (entry.tx || '');
  const rule = OPERATION_RULES[txKey] ?? OPERATION_RULES[entry.tx || ''];
  if (rule?.isOpening) return 'opening';
  if (rule?.isPurchase) return 'purchase';
  if (rule?.isSale) return 'sale';

  switch (entry.tx) {
    case 'تيفيت': return 'tifeet';
    case 'تحويل': return 'transfer';
    case 'تسوية':
    case 'تسوية عجز':
    case 'تسوية زيادة':
      return 'adjustment';
    case 'حساب تاجر ذهب':
    case 'حساب تاجر فضة':
      return 'merchant_settlement';
    case 'مسحوبات':
      return 'personal_withdrawal';
    case 'م ت':
    case 'م ا ع':
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
}

export function processInventory(entries: Entry[], accountsDb: Account[]): InventoryEngineResult {
  const index = buildAccountIndex(accountsDb);
  const snapshots: Record<string, InventorySnapshot> = {};
  const merchantWeightLiabilities: Record<string, InventorySnapshot> = {};

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
  });

  entries.forEach(entry => {
    if (!affectsInventory(entry)) return;
    const weight = parseWeight(entry.weight);
    const count = parseFloat(String(entry.count ?? '0')) || 0;
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
    };

    apply(debitAcc, 1);
    apply(creditAcc, -1);
  });

  return { snapshots, merchantWeightLiabilities };
}

export interface CostBasisEngine {
  getCost: (accNameOrId: string) => number;
  avgProductCost: Record<string, number>;
  avgScrapCost: Record<string, number>;
  avgDirectCost: Record<string, number>;
}

const ensureCostBucket = (map: Record<string, { totalWeight: number; totalCost: number }>, key: string) => {
  if (!map[key]) map[key] = { totalWeight: 0, totalCost: 0 };
  return map[key];
};

export function processCostBasis(entries: Entry[], accountsDb: Account[], goldPrice: number, silverPrice: number): CostBasisEngine {
  const index = buildAccountIndex(accountsDb);
  const productCost: Record<string, { totalWeight: number; totalCost: number }> = {};
  const scraps: Record<string, { totalWeight: number; totalCost: number }> = {};
  const directCost: Record<string, { totalWeight: number; totalCost: number }> = {};

  const addCost = (account: Account, weight: number, costValue: number) => {
    if (weight <= 0) return;
    const key = account.name;
    if (account.type === 'gold_raw' || account.type === 'silver') {
      const bucket = ensureCostBucket(scraps, key);
      bucket.totalWeight += weight;
      bucket.totalCost += costValue;
    } else if (account.type === 'gold_direct') {
      const bucket = ensureCostBucket(directCost, key);
      bucket.totalWeight += weight;
      bucket.totalCost += costValue;
    } else if (account.type === 'gold_product') {
      const bucket = ensureCostBucket(productCost, key);
      bucket.totalWeight += weight;
      bucket.totalCost += costValue;
    }
  };

  entries.forEach(entry => {
    const kind = resolveOperationKind(entry);
    const weight = parseWeight(entry.weight);
    const cash = parseCash(entry);
    const debitAcc = resolveAccount(entry, 'debit', index);
    const creditAcc = resolveAccount(entry, 'credit', index);

    if ((kind === 'purchase' || kind === 'opening') && debitAcc && isMetalInventoryAccount(debitAcc) && weight > 0) {
      const defaultPrice = isSilverAccount(debitAcc) ? silverPrice : goldPrice;
      const costValue = cash > 0 ? cash : weight * defaultPrice * getKaratMultiplier(debitAcc.karat);
      addCost(debitAcc, weight, costValue);
    }

    if (kind === 'tifeet' && debitAcc?.type === 'gold_product' && creditAcc && weight > 0) {
      const scrap = scraps[creditAcc.name];
      if (scrap && scrap.totalWeight > 0) {
        const avgCost = scrap.totalCost / scrap.totalWeight;
        const transferred = weight * avgCost;
        scrap.totalWeight -= weight;
        scrap.totalCost -= transferred;
        addCost(debitAcc, weight, transferred);
      }
    }
  });

  const avg = (map: Record<string, { totalWeight: number; totalCost: number }>) =>
    Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value.totalWeight > 0 ? value.totalCost / value.totalWeight : 0]));

  const avgProduct = avg(productCost);
  const avgScrap = avg(scraps);
  const avgDirect = avg(directCost);

  const getCost = (accNameOrId: string): number => {
    const account = index.byName.get(accNameOrId) ?? index.byId.get(accNameOrId);
    const key = account?.name ?? accNameOrId;
    const defaultPrice = account?.metal === 'silver' ? silverPrice : goldPrice;
    return avgProduct[key] ?? avgDirect[key] ?? avgScrap[key] ?? defaultPrice;
  };

  return { avgProductCost: avgProduct, avgScrapCost: avgScrap, avgDirectCost: avgDirect, getCost };
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
): ProfitAnalysisResult {
  const sorted = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const index = buildAccountIndex(accountsDb);
  const costBasis = processCostBasis(sorted, accountsDb, goldPrice, silverPrice);

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
      accData[account.name] = { karat, ...emptyKaratRow(), flowsAr: {} };
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
      const cashValue = cash > 0 ? cash : weight * costBasis.getCost(account.name);

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
    const arWeight = weight * getKaratMultiplier(karat);

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
        flow.tifeetCost += arWeight * costBasis.getCost(debitAcc?.name || '');
      }
      if (creditIsGold) flow.tifeetOut += arWeight;
    } else if (kind === 'transfer') {
      if (debitIsGold) {
        flow.transferIn += arWeight;
        flow.transferMarket += arWeight * goldPrice;
        flow.transferCost += arWeight * costBasis.getCost(debitAcc?.name || '');
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

  return { karatData, accData, flowData, costBasis };
}

