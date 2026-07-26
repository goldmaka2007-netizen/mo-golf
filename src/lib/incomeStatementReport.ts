import type { Account, Entry } from '../types';
import { belongsToMetric, getAccountTypeDetails, getMetricValue } from '../utils/accountLogic';

export type IncomeStatementMetric = 'cash' | 'gold' | 'silver' | 'accs';
export interface IncomeStatementDetail { name: string; val: number; weight: number }
export interface IncomeStatementCategory { total: number; totalWeight: number; details: IncomeStatementDetail[] }
export interface IncomeStatementDimension {
  revenue: { categories: Record<string, IncomeStatementCategory>; total: number };
  expenses: { categories: Record<string, IncomeStatementCategory>; total: number };
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

const addLine = (categories: Record<string, IncomeStatementCategory>, categoryName: string, detailName: string, value: number, weight: number): void => {
  if (!categories[categoryName]) categories[categoryName] = { total: 0, totalWeight: 0, details: [] };
  const category = categories[categoryName];
  const existing = category.details.find(detail => detail.name === detailName);
  if (existing) { existing.val += value; existing.weight += weight; }
  else category.details.push({ name: detailName, val: value, weight });
  category.total += value;
  category.totalWeight += weight;
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
        addLine(revenueCats, 'إيراد مبيعات تجارة', `مبيعات نقدية (${entry.credit})`, val, entryWeight);
        totalRev += val;
      }
      if (belongsToMetric(entry.credit, 'cash', accounts) && isProduct(entry.debit) && debitDetails.main === 'assets') {
        addLine(expenseCats, 'تكلفة مشتريات تجارة', `مشتريات نقدية (${entry.debit})`, val, entryWeight);
        totalExp += val;
      }
    } else {
      if (belongsToMetric(entry.debit, metric, accounts) && debitDetails.main === 'assets' && !belongsToMetric(entry.credit, metric, accounts)) {
        const category = metric === 'accs' ? 'وارد عدد (مشتريات ملحقات)' : `وزن ${metric === 'gold' ? 'ذهب' : 'فضة'} وارد (مشتريات)`;
        const label = `${metric === 'accs' ? 'شراء عدد' : 'شراء وزن'} (${entry.debit})`;
        addLine(revenueCats, category, label, val, entryWeight);
        totalRev += val;
      }
      if (belongsToMetric(entry.credit, metric, accounts) && creditDetails.main === 'assets' && !belongsToMetric(entry.debit, metric, accounts)) {
        const category = metric === 'accs' ? 'صادر عدد (مبيعات ملحقات)' : `وزن ${metric === 'gold' ? 'ذهب' : 'فضة'} صادر (مبيعات)`;
        const label = `${metric === 'accs' ? 'بيع عدد' : 'بيع وزن'} (${entry.credit})`;
        addLine(expenseCats, category, label, val, entryWeight);
        totalExp += val;
      }
    }
  });

  [revenueCats, expenseCats].forEach(categories => Object.values(categories).forEach(category => category.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))));
  return { revenue: { categories: revenueCats, total: totalRev }, expenses: { categories: expenseCats, total: totalExp }, net: totalRev - totalExp };
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