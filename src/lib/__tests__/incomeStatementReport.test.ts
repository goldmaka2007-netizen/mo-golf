import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { belongsToMetric, getAccountTypeDetails, getMetricValue } from '../../utils/accountLogic';
import { buildIncomeStatementReport, type IncomeStatementMetric } from '../incomeStatementReport';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'نقدية', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'ذهب 21', mainType: 'asset', subType: 'مخزون ذهب', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
  { id: 'silver', name: 'فضة', mainType: 'asset', subType: 'مخزون فضة', balanceNature: 'silver', type: 'silver', metal: 'silver', userId: 'u' },
  { id: 'accs', name: 'ملحقات', mainType: 'asset', subType: 'مخزون ملحقات', balanceNature: 'piece', type: 'accessory', userId: 'u' },
  { id: 'cash-revenue', name: 'إيراد خدمة', mainType: 'revenue', subType: 'إيرادات أخرى', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'cash-expense', name: 'مصروف إيجار', mainType: 'expense', subType: 'مصروفات تشغيل', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold-revenue', name: 'زيادة ذهب', mainType: 'revenue', subType: 'زيادات ذهب', balanceNature: 'gold', metal: 'gold', userId: 'u' },
  { id: 'silver-expense', name: 'عجز فضة', mainType: 'expense', subType: 'عجز معادن', balanceNature: 'silver', metal: 'silver', userId: 'u' },
];

const entry = (patch: Partial<Entry>): Entry => ({
  id: patch.id, tx: patch.tx || 'عملية', date: patch.date || '2026-01-10', debit: '', credit: '', cash: '0', weight: '0',
  count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});

const dataset: Entry[] = [
  entry({ id: 'gold-buy', debit: 'ذهب 21', credit: 'الخزنة', cash: '1000', weight: '10', arabicWeight: '10', karat: 21 }),
  entry({ id: 'gold-sale', debit: 'الخزنة', credit: 'ذهب 21', cash: '1500', weight: '4', arabicWeight: '4', karat: 21 }),
  entry({ id: 'silver-buy', tx: 'شراء فضة', debit: 'فضة', credit: 'الخزنة', cash: '300', weight: '30' }),
  entry({ id: 'silver-sale', tx: 'بيع فضة', debit: 'الخزنة', credit: 'فضة', cash: '450', weight: '12' }),
  entry({ id: 'acc-buy', debit: 'ملحقات', credit: 'الخزنة', cash: '100', weight: '5', count: '5' }),
  entry({ id: 'acc-sale', debit: 'الخزنة', credit: 'ملحقات', cash: '180', weight: '2', count: '2' }),
  entry({ id: 'service', debit: 'الخزنة', credit: 'إيراد خدمة', cash: '75' }),
  entry({ id: 'rent', debit: 'مصروف إيجار', credit: 'الخزنة', cash: '25' }),
  entry({ id: 'gold-gain', debit: 'ذهب 21', credit: 'زيادة ذهب', weight: '1.5', arabicWeight: '1.5', karat: 21 }),
  entry({ id: 'silver-loss', tx: 'عجز فضة', debit: 'عجز فضة', credit: 'فضة', weight: '2' }),
  entry({ id: 'outside', date: '2026-02-01', debit: 'الخزنة', credit: 'ذهب 21', cash: '9999', weight: '99', arabicWeight: '99', karat: 21 }),
];

type LegacyCategory = { total: number; totalWeight: number; details: { name: string; val: number; weight: number }[] };
const legacyDimensionFromParent = (entries: Entry[], metric: IncomeStatementMetric) => {
  const revenueCats: Record<string, LegacyCategory> = {};
  const expenseCats: Record<string, LegacyCategory> = {};
  let totalRev = 0;
  let totalExp = 0;
  const add = (cats: Record<string, LegacyCategory>, category: string, name: string, val: number, weight: number) => {
    if (!cats[category]) cats[category] = { total: 0, totalWeight: 0, details: [] };
    const existing = cats[category].details.find(detail => detail.name === name);
    if (existing) { existing.val += val; existing.weight += weight; }
    else cats[category].details.push({ name, val, weight });
    cats[category].total += val;
    cats[category].totalWeight += weight;
  };

  entries.forEach(item => {
    const val = getMetricValue(item, metric, accounts);
    if (val === 0) return;
    const isSilver = (item.tx || '').includes('فضة') || item.debit.includes('فضة') || item.credit.includes('فضة');
    const rawWeight = isSilver ? parseFloat(item.weight || '0') : parseFloat(item.arabicWeight || item.weight || '0');
    const weight = Number.isNaN(rawWeight) ? 0 : rawWeight;
    const debit = getAccountTypeDetails(item.debit, accounts);
    const credit = getAccountTypeDetails(item.credit, accounts);

    if (belongsToMetric(item.credit, metric, accounts) && credit.main === 'revenue') { add(revenueCats, credit.sub, item.credit, val, weight); totalRev += val; }
    if (belongsToMetric(item.debit, metric, accounts) && debit.main === 'expenses') { add(expenseCats, debit.sub, item.debit, val, weight); totalExp += val; }

    if (metric === 'cash') {
      const product = (name: string) => belongsToMetric(name, 'gold', accounts) || belongsToMetric(name, 'silver', accounts) || belongsToMetric(name, 'accs', accounts);
      if (belongsToMetric(item.debit, 'cash', accounts) && product(item.credit) && credit.main === 'assets') {
        add(revenueCats, 'إيراد مبيعات تجارة', `مبيعات نقدية (${item.credit})`, val, weight); totalRev += val;
      }
      if (belongsToMetric(item.credit, 'cash', accounts) && product(item.debit) && debit.main === 'assets') {
        add(expenseCats, 'تكلفة مشتريات تجارة', `مشتريات نقدية (${item.debit})`, val, weight); totalExp += val;
      }
    } else {
      if (belongsToMetric(item.debit, metric, accounts) && debit.main === 'assets' && !belongsToMetric(item.credit, metric, accounts)) {
        const category = metric === 'accs' ? 'وارد عدد (مشتريات ملحقات)' : `وزن ${metric === 'gold' ? 'ذهب' : 'فضة'} وارد (مشتريات)`;
        add(revenueCats, category, `${metric === 'accs' ? 'شراء عدد' : 'شراء وزن'} (${item.debit})`, val, weight); totalRev += val;
      }
      if (belongsToMetric(item.credit, metric, accounts) && credit.main === 'assets' && !belongsToMetric(item.debit, metric, accounts)) {
        const category = metric === 'accs' ? 'صادر عدد (مبيعات ملحقات)' : `وزن ${metric === 'gold' ? 'ذهب' : 'فضة'} صادر (مبيعات)`;
        add(expenseCats, category, `${metric === 'accs' ? 'بيع عدد' : 'بيع وزن'} (${item.credit})`, val, weight); totalExp += val;
      }
    }
  });
  [revenueCats, expenseCats].forEach(cats => Object.values(cats).forEach(cat => cat.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))));
  return { revenue: { categories: revenueCats, total: totalRev }, expenses: { categories: expenseCats, total: totalExp }, net: totalRev - totalExp };
};

describe('income statement parent-regression', () => {
  it('matches the parent UI algorithm for every shop dimension, total, net result, and period', () => {
    const periodEntries = dataset.filter(item => item.date >= '2026-01-01' && item.date <= '2026-01-31');
    const oldResult = {
      startDate: '2026-01-01', endDate: '2026-01-31',
      cash: legacyDimensionFromParent(periodEntries, 'cash'),
      gold: legacyDimensionFromParent(periodEntries, 'gold'),
      silver: legacyDimensionFromParent(periodEntries, 'silver'),
      accs: legacyDimensionFromParent(periodEntries, 'accs'),
    };
    const centralResult = buildIncomeStatementReport(dataset, accounts, '2026-01-01', '2026-01-31');
    expect(centralResult).toEqual(oldResult);
  });

  it('keeps the parent all-period boundaries while excluding no entries', () => {
    const report = buildIncomeStatementReport(dataset, accounts);
    expect(report.startDate).toBe('2026-01-10');
    expect(report.endDate).toBe('2026-02-01');
    expect(report.cash).toEqual(legacyDimensionFromParent(dataset, 'cash'));
    expect(report.gold).toEqual(legacyDimensionFromParent(dataset, 'gold'));
    expect(report.silver).toEqual(legacyDimensionFromParent(dataset, 'silver'));
    expect(report.accs).toEqual(legacyDimensionFromParent(dataset, 'accs'));
  });
});