import type { Account, Entry } from '../types';
import { belongsToMetric, getAccountTypeDetails, getMetricValue } from '../utils/accountLogic';

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
  startDate: string | null;
  endDate: string | null;
  cash: IncomeStatementDimension;
  gold: IncomeStatementDimension;
  silver: IncomeStatementDimension;
  accs: IncomeStatementDimension;
}

type CashBreakdownInput = Pick<IncomeStatementCashBreakdown, 'goldAmount' | 'goldWeight' | 'silverAmount' | 'silverWeight' | 'accessoryCount'>;

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
  target.goldAverage = Number.isFinite(target.goldWeight) && target.goldWeight > 0 && Number.isFinite(target.goldAmount)
    ? target.goldAmount / target.goldWeight
    : null;
  target.silverAverage = Number.isFinite(target.silverWeight) && target.silverWeight > 0 && Number.isFinite(target.silverAmount)
    ? target.silverAmount / target.silverWeight
    : null;
  return target;
};

const goldTradeBreakdownFor = (entry: Entry, weight: number, accounts: Account[]): CashBreakdownInput => {
  const cashAmount = getMetricValue(entry, 'cash', accounts);
  return {
    goldAmount: Number.isFinite(cashAmount) ? cashAmount : 0,
    goldWeight: Number.isFinite(weight) && weight > 0 ? weight : 0,
    silverAmount: 0,
    silverWeight: 0,
    accessoryCount: 0,
  };
};

const cashBreakdownFor = (entry: Entry, accountName: string, amount: number, accounts: Account[]): CashBreakdownInput => {
  const breakdown = emptyCashBreakdown();
  if (belongsToMetric(accountName, 'gold', accounts)) {
    breakdown.goldAmount = amount;
    breakdown.goldWeight = getMetricValue(entry, 'gold', accounts);
  } else if (belongsToMetric(accountName, 'silver', accounts)) {
    breakdown.silverAmount = amount;
    breakdown.silverWeight = getMetricValue(entry, 'silver', accounts);
  } else if (belongsToMetric(accountName, 'accs', accounts)) {
    breakdown.accessoryCount = parseFloat(entry.count || '0') || getMetricValue(entry, 'accs', accounts);
  }
  return breakdown;
};

const addLine = (
  categories: Record<string, IncomeStatementCategory>,
  categoryName: string,
  detailName: string,
  value: number,
  weight: number,
  cashBreakdown: CashBreakdownInput = emptyCashBreakdown(),
): void => {
  if (!categories[categoryName]) categories[categoryName] = { total: 0, totalWeight: 0, details: [], ...emptyCashBreakdown() };
  const category = categories[categoryName];
  const existing = category.details.find(detail => detail.name === detailName);
  if (existing) {
    existing.val += value;
    existing.weight += weight;
    addCashBreakdown(existing, cashBreakdown);
  } else {
    category.details.push({ name: detailName, val: value, weight, ...emptyCashBreakdown(), ...cashBreakdown });
  }
  category.total += value;
  category.totalWeight += weight;
  addCashBreakdown(category, cashBreakdown);
};

const buildSection = (categories: Record<string, IncomeStatementCategory>, total: number): IncomeStatementSection => {
  const section: IncomeStatementSection = { categories, total, ...emptyCashBreakdown() };
  Object.values(categories).forEach(category => {
    category.details.forEach(calculateAverages);
    calculateAverages(category);
    addCashBreakdown(section, category);
  });
  return calculateAverages(section);
};

const buildDimension = (entries: Entry[], accounts: Account[], metric: IncomeStatementMetric): IncomeStatementDimension => {
  const revenueCats: Record<string, IncomeStatementCategory> = {};
  const expenseCats: Record<string, IncomeStatementCategory> = {};
  let totalRev = 0;
  let totalExp = 0;

  entries.forEach(entry => {
    const val = getMetricValue(entry, metric, accounts);
    if (val === 0) return;
    const isEntrySilver = (entry.tx || '').includes('فضة') || (entry.debit || '').includes('فضة') || (entry.credit || '').includes('فضة');
    const weightRaw = isEntrySilver ? parseFloat(entry.weight || '0') : parseFloat(entry.arabicWeight || entry.weight || '0');
    const entryWeight = Number.isNaN(weightRaw) ? 0 : weightRaw;
    const debitDetails = getAccountTypeDetails(entry.debit, accounts);
    const creditDetails = getAccountTypeDetails(entry.credit, accounts);

    if (belongsToMetric(entry.credit, metric, accounts) && creditDetails.main === 'revenue') {
      addLine(revenueCats, creditDetails.sub, entry.credit, val, entryWeight);
      totalRev += val;
    }
    if (belongsToMetric(entry.debit, metric, accounts) && debitDetails.main === 'expenses') {
      addLine(expenseCats, debitDetails.sub, entry.debit, val, entryWeight);
      totalExp += val;
    }

    if (metric === 'cash') {
      const isProduct = (accountName: string): boolean => belongsToMetric(accountName, 'gold', accounts) || belongsToMetric(accountName, 'silver', accounts) || belongsToMetric(accountName, 'accs', accounts);
      if (belongsToMetric(entry.debit, 'cash', accounts) && isProduct(entry.credit) && creditDetails.main === 'assets') {
        addLine(revenueCats, 'إيراد مبيعات تجارة', `مبيعات نقدية (${entry.credit})`, val, 0, cashBreakdownFor(entry, entry.credit, val, accounts));
        totalRev += val;
      }
      if (belongsToMetric(entry.credit, 'cash', accounts) && isProduct(entry.debit) && debitDetails.main === 'assets') {
        addLine(expenseCats, 'تكلفة مشتريات تجارة', `مشتريات نقدية (${entry.debit})`, val, 0, cashBreakdownFor(entry, entry.debit, val, accounts));
        totalExp += val;
      }
    } else {
      if (belongsToMetric(entry.debit, metric, accounts) && debitDetails.main === 'assets' && !belongsToMetric(entry.credit, metric, accounts)) {
        const category = metric === 'accs' ? 'وارد عدد (مشتريات ملحقات)' : `وزن ${metric === 'gold' ? 'ذهب' : 'فضة'} وارد (مشتريات)`;
        const label = `${metric === 'accs' ? 'شراء عدد' : 'شراء وزن'} (${entry.debit})`;
        addLine(revenueCats, category, label, val, entryWeight, metric === 'gold' ? goldTradeBreakdownFor(entry, val, accounts) : undefined);
        totalRev += val;
      }
      if (belongsToMetric(entry.credit, metric, accounts) && creditDetails.main === 'assets' && !belongsToMetric(entry.debit, metric, accounts)) {
        const category = metric === 'accs' ? 'صادر عدد (مبيعات ملحقات)' : `وزن ${metric === 'gold' ? 'ذهب' : 'فضة'} صادر (مبيعات)`;
        const label = `${metric === 'accs' ? 'بيع عدد' : 'بيع وزن'} (${entry.credit})`;
        addLine(expenseCats, category, label, val, entryWeight, metric === 'gold' ? goldTradeBreakdownFor(entry, val, accounts) : undefined);
        totalExp += val;
      }
    }
  });

  [revenueCats, expenseCats].forEach(categories => Object.values(categories).forEach(category => category.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))));
  return { revenue: buildSection(revenueCats, totalRev), expenses: buildSection(expenseCats, totalExp), net: totalRev - totalExp };
};

export const buildIncomeStatementReport = (entries: Entry[], accounts: Account[], startDate?: string, endDate?: string): IncomeStatementReport => {
  const periodEntries = entries.filter(entry => (!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate));
  const dates = periodEntries.map(entry => entry.date).filter(Boolean).sort();
  return {
    startDate: startDate ?? dates[0] ?? null,
    endDate: endDate ?? dates[dates.length - 1] ?? null,
    cash: buildDimension(periodEntries, accounts, 'cash'),
    gold: buildDimension(periodEntries, accounts, 'gold'),
    silver: buildDimension(periodEntries, accounts, 'silver'),
    accs: buildDimension(periodEntries, accounts, 'accs'),
  };
};
