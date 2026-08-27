export type AppView =
  | 'home' | 'entry' | 'database' | 'reports' | 'settings' | 'chart-of-accounts'
  | 'journal' | 'guide' | 'inventory' | 'story' | 'profit-analysis'
  | 'advanced-analytics' | 'more';

export const reportViews: AppView[] = ['reports', 'inventory', 'profit-analysis', 'advanced-analytics'];
export const moreViews: AppView[] = ['more', 'story', 'guide', 'settings', 'chart-of-accounts'];

export const getPageTitle = (view: AppView) => {
  if (view === 'entry') return 'العمليات';
  if (view === 'journal') return 'اليومية';
  if (view === 'database') return 'المخزون';
  if (reportViews.includes(view)) return 'التقارير';
  if (view === 'story') return 'حالة واتساب';
  if (view === 'guide') return 'الدليل المحاسبي';
  if (view === 'settings') return 'الإعدادات';
  if (view === 'chart-of-accounts') return 'دليل الحسابات';
  if (view === 'more') return 'المزيد';
  return 'الرئيسية';
};
