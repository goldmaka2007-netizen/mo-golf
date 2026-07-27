import type { IncomeStatementReport, IncomeStatementSection } from './incomeStatementReport';

export interface IncomeStatementExcelSheet { name: string; data: Record<string, string | number>[] }

const cashRow = (
  main: string,
  sub: string,
  account: string,
  amount: number,
  metrics: IncomeStatementSection | IncomeStatementSection['categories'][string] | IncomeStatementSection['categories'][string]['details'][number],
): Record<string, string | number> => ({
  'التصنيف الرئيسي': main,
  'التصنيف الفرعي': sub,
  'الحساب': account,
  'المبلغ (ج.م)': amount,
  'وزن الذهب (جم عيار 21)': metrics.goldWeight,
  'متوسط الذهب (ج.م/جم)': metrics.goldAverage ?? '-',
  'وزن الفضة (جم)': metrics.silverWeight,
  'متوسط الفضة (ج.م/جم)': metrics.silverAverage ?? '-',
  'عدد الملحقات': metrics.accessoryCount,
});

const buildCashRows = (report: IncomeStatementReport): Record<string, string | number>[] => {
  const rows: Record<string, string | number>[] = [];
  const processSection = (sectionName: string, section: IncomeStatementSection) => {
    Object.entries(section.categories).forEach(([sub, category]) => {
      category.details.forEach(detail => rows.push(cashRow(sectionName, sub, detail.name, detail.val, detail)));
      rows.push(cashRow(`إجمالي ${sub}`, '', '', category.total, category));
      rows.push({ 'التصنيف الرئيسي': '' });
    });
    rows.push(cashRow(`إجمالي ${sectionName}`, '', '', section.total, section));
    rows.push({ 'التصنيف الرئيسي': '' });
  };

  processSection('الإيرادات', report.cash.revenue);
  processSection('المصروفات', report.cash.expenses);
  rows.push({
    'التصنيف الرئيسي': 'صافي الربح / الخسارة',
    'التصنيف الفرعي': '',
    'الحساب': '',
    'المبلغ (ج.م)': report.cash.net,
    'وزن الذهب (جم عيار 21)': '',
    'متوسط الذهب (ج.م/جم)': '',
    'وزن الفضة (جم)': '',
    'متوسط الفضة (ج.م/جم)': '',
    'عدد الملحقات': '',
  });
  return rows;
};

const buildMetricRows = (report: IncomeStatementReport, metric: 'gold' | 'silver' | 'accs', unit: string): Record<string, string | number>[] => {
  const rows: Record<string, string | number>[] = [];
  const processSection = (sectionName: string, section: IncomeStatementSection) => {
    Object.entries(section.categories).forEach(([sub, category]) => {
      category.details.forEach(detail => rows.push({
        'التصنيف الرئيسي': sectionName,
        'التصنيف الفرعي': sub,
        'الحساب': detail.name,
        [`القيمة (${unit})`]: detail.val,
      }));
      rows.push({ 'التصنيف الرئيسي': `إجمالي ${sub}`, 'التصنيف الفرعي': '', 'الحساب': '', [`القيمة (${unit})`]: category.total });
      rows.push({ 'التصنيف الرئيسي': '' });
    });
    rows.push({ 'التصنيف الرئيسي': `إجمالي ${sectionName}`, 'التصنيف الفرعي': '', 'الحساب': '', [`القيمة (${unit})`]: section.total });
    rows.push({ 'التصنيف الرئيسي': '' });
  };

  processSection('الإيرادات', report[metric].revenue);
  processSection('المصروفات', report[metric].expenses);
  rows.push({ 'التصنيف الرئيسي': 'صافي الربح / الخسارة', 'التصنيف الفرعي': '', 'الحساب': '', [`القيمة (${unit})`]: report[metric].net });
  return rows;
};

export const buildIncomeStatementExcelSheets = (report: IncomeStatementReport): IncomeStatementExcelSheet[] => [
  { name: 'قائمة الدخل - نقدي', data: buildCashRows(report) },
  { name: 'قائمة الدخل - ذهب', data: buildMetricRows(report, 'gold', 'جم عربي') },
  { name: 'قائمة الدخل - فضة', data: buildMetricRows(report, 'silver', 'جرام') },
  { name: 'قائمة الدخل - ملحقات', data: buildMetricRows(report, 'accs', 'قطعة') },
];
