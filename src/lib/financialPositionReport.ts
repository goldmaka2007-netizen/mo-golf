import {
  goldOwnershipPositionFromBalances,
  type AccountBalanceResult,
  type AccountClassificationWarning,
  type ComputeAccountBalancesResult,
  type GoldOwnershipPosition,
  type LegacyMatchWarning,
} from './engine';
import type { EquityStatementReport } from './equityStatementReport';
import type { IncomeStatementMetric } from './incomeStatementReport';

export interface FinancialPositionDetail {
  accountId?: string;
  name: string;
  val: number;
  actualVal: number;
  countVal: number;
}
export interface FinancialPositionCategory {
  total: number;
  totalCount: number;
  details: FinancialPositionDetail[];
}
export interface FinancialPositionSection {
  categories: Record<string, FinancialPositionCategory>;
  total: number;
  totalCount: number;
}
export interface FinancialPositionDimension {
  assets: FinancialPositionSection;
  liabilities: FinancialPositionSection;
  equity: FinancialPositionSection;
  uncategorized: FinancialPositionDetail[];
}
export interface FinancialPositionReport extends Record<IncomeStatementMetric, FinancialPositionDimension> {
  balanceEngineVersion: string;
  goldPosition: GoldOwnershipPosition;
  balanceDiagnostics: {
    legacyNameMatchedEntries: LegacyMatchWarning[];
    unclassifiedAccounts: AccountClassificationWarning[];
    classificationConflicts: AccountClassificationWarning[];
  };
}

type CategoryMap = Record<string, FinancialPositionCategory>;
const DISPLAY_TOLERANCE = 1e-12;

const cleanForDisplay = (value: number): number =>
  Math.abs(value) < DISPLAY_TOLERANCE ? 0 : value;

const dimensionValues = (
  balance: AccountBalanceResult,
  metric: IncomeStatementMetric,
): { value: number; actualValue: number } => {
  if (metric === 'cash') {
    return { value: balance.cashBalance, actualValue: balance.cashBalance };
  }
  if (metric === 'gold') {
    return { value: balance.goldE21Balance, actualValue: balance.goldActualBalance };
  }
  if (metric === 'silver') {
    return { value: balance.silverBalance, actualValue: balance.silverBalance };
  }
  return { value: balance.quantityBalance, actualValue: balance.quantityBalance };
};

const buildDimension = (
  computed: ComputeAccountBalancesResult,
  metric: IncomeStatementMetric,
  equityResult: EquityStatementReport[IncomeStatementMetric],
): FinancialPositionDimension => {
  const assetsCats: CategoryMap = {};
  const liabilitiesCats: CategoryMap = {};
  const equityCats: CategoryMap = {};
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  const uncategorized: FinancialPositionDetail[] = [];

  computed.balances.forEach(balance => {
    const { value, actualValue } = dimensionValues(balance, metric);
    if (value === 0 && actualValue === 0) return;

    const isMerchantMetalDimension = balance.isMerchant
      && ((metric === 'gold' && balance.metal === 'gold') || (metric === 'silver' && balance.metal === 'silver'));
    const economicMainType = isMerchantMetalDimension
      ? balance.actualMerchantDirection === 'receivable' ? 'assets'
        : balance.actualMerchantDirection === 'payable' ? 'liabilities'
          : balance.mainType
      : balance.mainType;
    const displayValue = isMerchantMetalDimension ? Math.abs(value) : value;
    const displayActualValue = isMerchantMetalDimension ? Math.abs(actualValue) : actualValue;
    const detail: FinancialPositionDetail = {
      accountId: balance.accountId,
      name: balance.accountName,
      val: cleanForDisplay(displayValue),
      actualVal: cleanForDisplay(displayActualValue),
      countVal: 0,
    };

    if (balance.mainType === 'unclassified' || balance.subType === 'unclassified') {
      uncategorized.push(detail);
      return;
    }

    const target = economicMainType === 'assets' ? assetsCats
      : economicMainType === 'liabilities' ? liabilitiesCats
        : economicMainType === 'equity' ? equityCats
          : null;
    if (!target) return;

    const categoryName = balance.subType;
    if (!target[categoryName]) target[categoryName] = { total: 0, totalCount: 0, details: [] };
    target[categoryName].details.push(detail);
    target[categoryName].total += displayValue;
    if (economicMainType === 'assets') totalAssets += displayValue;
    else if (economicMainType === 'liabilities') totalLiabilities += displayValue;
    else totalEquity += displayValue;
  });

  const periodResult = equityResult.netProfit;
  if (Math.abs(periodResult) > 0.00001) {
    const label = periodResult >= 0 ? 'صافي نتائج أعمال الفترة (أرباح)' : 'صافي نتائج أعمال الفترة (خسائر)';
    if (!equityCats['نتائج الأعمال']) equityCats['نتائج الأعمال'] = { total: 0, totalCount: 0, details: [] };
    equityCats['نتائج الأعمال'].details.push({ name: label, val: periodResult, actualVal: periodResult, countVal: 0 });
    equityCats['نتائج الأعمال'].total += periodResult;
    totalEquity += periodResult;
  }

  [assetsCats, liabilitiesCats, equityCats].forEach(categories => {
    Object.values(categories).forEach(category => category.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val)));
  });
  uncategorized.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

  return {
    assets: { categories: assetsCats, total: totalAssets, totalCount: 0 },
    liabilities: { categories: liabilitiesCats, total: totalLiabilities, totalCount: 0 },
    equity: { categories: equityCats, total: totalEquity, totalCount: 0 },
    uncategorized,
  };
};

/** Pure projection over the central balance engine result. */
export const buildFinancialPositionReport = (
  computed: ComputeAccountBalancesResult,
  equityStatement: EquityStatementReport,
): FinancialPositionReport => {
  return {
    balanceEngineVersion: computed.balanceEngineVersion,
    cash: buildDimension(computed, 'cash', equityStatement.cash),
    gold: buildDimension(computed, 'gold', equityStatement.gold),
    silver: buildDimension(computed, 'silver', equityStatement.silver),
    accs: buildDimension(computed, 'accs', equityStatement.accs),
    goldPosition: goldOwnershipPositionFromBalances(computed),
    balanceDiagnostics: {
      legacyNameMatchedEntries: computed.legacyNameMatchedEntries,
      unclassifiedAccounts: computed.unclassifiedAccounts,
      classificationConflicts: computed.classificationConflicts,
    },
  };
};
