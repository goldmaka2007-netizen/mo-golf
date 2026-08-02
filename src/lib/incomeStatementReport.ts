import type { AccountBalanceResult, AccountBalancesResult } from './engine';

export type IncomeStatementMetric = 'cash' | 'gold' | 'silver' | 'accs';
export interface IncomeStatementCashBreakdown {
  goldAmount: number;
  goldWeight: number;
  goldAverage: number | null;
  silverAmount: number;
  silverWeight: number;
  silverAverage: number | null;
  accessoryCount: number;
}
export interface IncomeStatementDetail extends IncomeStatementCashBreakdown { name: string; val: number; weight: number }
export interface IncomeStatementCategory extends IncomeStatementCashBreakdown { total: number; totalWeight: number; details: IncomeStatementDetail[] }
export interface IncomeStatementSection extends IncomeStatementCashBreakdown { categories: Record<string, IncomeStatementCategory>; total: number }
export interface IncomeStatementDimension {
  revenue: IncomeStatementSection;
  expenses: IncomeStatementSection;
  net: number;
}
export interface IncomeStatementReport {
  balanceEngineVersion: string;
  startDate: string | null;
  endDate: string | null;
  cash: IncomeStatementDimension;
  gold: IncomeStatementDimension;
  silver: IncomeStatementDimension;
  accs: IncomeStatementDimension;
}

type CashBreakdownInput = Pick<IncomeStatementCashBreakdown, 'goldAmount' | 'goldWeight' | 'silverAmount' | 'silverWeight' | 'accessoryCount'>;
const DISPLAY_TOLERANCE = 1e-12;

const emptyCashBreakdown = (): IncomeStatementCashBreakdown => ({
  goldAmount: 0,
  goldWeight: 0,
  goldAverage: null,
  silverAmount: 0,
  silverWeight: 0,
  silverAverage: null,
  accessoryCount: 0,
});

const addCashBreakdown = (target: IncomeStatementCashBreakdown, source: CashBreakdownInput): void => {
  target.goldAmount += source.goldAmount;
  target.goldWeight += source.goldWeight;
  target.silverAmount += source.silverAmount;
  target.silverWeight += source.silverWeight;
  target.accessoryCount += source.accessoryCount;
};

const calculateAverages = <T extends IncomeStatementCashBreakdown>(target: T): T => {
  target.goldAverage = target.goldWeight > 0 ? target.goldAmount / target.goldWeight : null;
  target.silverAverage = target.silverWeight > 0 ? target.silverAmount / target.silverWeight : null;
  return target;
};

const dimensionValue = (balance: AccountBalanceResult, metric: IncomeStatementMetric): number => {
  if (metric === 'cash') return balance.cashBalance;
  if (metric === 'gold') return balance.goldE21Balance;
  if (metric === 'silver') return balance.silverBalance;
  return balance.quantityBalance;
};

const breakdownFor = (balance: AccountBalanceResult): CashBreakdownInput => ({
  goldAmount: balance.metal === 'gold' ? balance.cashBalance : 0,
  goldWeight: balance.metal === 'gold' ? balance.goldE21Balance : 0,
  silverAmount: balance.metal === 'silver' ? balance.cashBalance : 0,
  silverWeight: balance.metal === 'silver' ? balance.silverBalance : 0,
  accessoryCount: balance.quantityBalance,
});

const addLine = (
  categories: Record<string, IncomeStatementCategory>,
  balance: AccountBalanceResult,
  value: number,
  metric: IncomeStatementMetric,
): void => {
  const categoryName = balance.subType;
  if (!categories[categoryName]) categories[categoryName] = { total: 0, totalWeight: 0, details: [], ...emptyCashBreakdown() };
  const category = categories[categoryName];
  const weight = metric === 'gold' ? balance.goldActualBalance
    : metric === 'silver' ? balance.silverBalance
      : metric === 'accs' ? balance.quantityBalance
        : balance.metal === 'gold' ? balance.goldActualBalance
          : balance.metal === 'silver' ? balance.silverBalance
            : balance.quantityBalance;
  const cashBreakdown = breakdownFor(balance);
  category.details.push({ name: balance.accountName, val: value, weight, ...emptyCashBreakdown(), ...cashBreakdown });
  category.total += value;
  category.totalWeight += weight;
  addCashBreakdown(category, cashBreakdown);
};

const buildSection = (categories: Record<string, IncomeStatementCategory>): IncomeStatementSection => {
  const section: IncomeStatementSection = { categories, total: 0, ...emptyCashBreakdown() };
  Object.values(categories).forEach(category => {
    category.details.sort((left, right) => Math.abs(right.val) - Math.abs(left.val));
    category.details.forEach(calculateAverages);
    calculateAverages(category);
    section.total += category.total;
    addCashBreakdown(section, category);
  });
  return calculateAverages(section);
};

const buildDimension = (computed: AccountBalancesResult, metric: IncomeStatementMetric): IncomeStatementDimension => {
  const revenueCategories: Record<string, IncomeStatementCategory> = {};
  const expenseCategories: Record<string, IncomeStatementCategory> = {};
  computed.balances.forEach(balance => {
    if (balance.mainType !== 'revenue' && balance.mainType !== 'expense') return;
    const value = dimensionValue(balance, metric);
    if (Math.abs(value) <= DISPLAY_TOLERANCE) return;
    addLine(balance.mainType === 'revenue' ? revenueCategories : expenseCategories, balance, value, metric);
  });
  const revenue = buildSection(revenueCategories);
  const expenses = buildSection(expenseCategories);
  return { revenue, expenses, net: revenue.total - expenses.total };
};

/** Pure projection over computeAccountBalances(); JournalEntry[] is intentionally not accepted. */
export const buildIncomeStatementReport = (
  computed: AccountBalancesResult,
  startDate: string | null = null,
  endDate: string | null = null,
): IncomeStatementReport => ({
  balanceEngineVersion: computed.balanceEngineVersion,
  startDate,
  endDate,
  cash: buildDimension(computed, 'cash'),
  gold: buildDimension(computed, 'gold'),
  silver: buildDimension(computed, 'silver'),
  accs: buildDimension(computed, 'accs'),
});