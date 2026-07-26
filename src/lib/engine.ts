import { Entry, Account, AccountingOperationKind, AccountNature } from '../types';
import { OPERATION_RULES } from '../constants';
import { parseWeight, normalizeNumerals } from './accounting';
import { canCalculateGoldEquivalent21, calculateGoldEquivalent21 } from './goldEquivalent';
import { rebuildCostTimeline, getOperationId, compareEntriesForCost, ACCESSORY_QUANTITY_SCALE, type CostTimelineResult, type OperationCostResult, type OpeningCostConfig } from './weightedAverageCost';
import { getAccountTypeDetails } from '../utils/accountLogic';

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
