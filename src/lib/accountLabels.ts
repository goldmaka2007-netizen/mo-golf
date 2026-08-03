const ARABIC_ACCOUNT_LABELS: Record<string, string> = {
  assets: 'الأصول',
  liabilities: 'الخصوم',
  equity: 'حقوق الملكية',
  revenue: 'الإيرادات',
  expenses: 'المصروفات',
  fixed_asset: 'الأصول الثابتة',
  cash: 'الخزنة',
  customer: 'العملاء',
  capital: 'رأس المال',
  retained_earnings: 'الأرباح المحتجزة',
  withdrawals: 'المسحوبات',
  merchant_gold: 'التزامات تجار الذهب',
  merchant_silver: 'التزامات تجار الفضة',
  merchant_cash: 'التزامات التجار النقدية',
  other_due: 'ذمم أخرى',
  inventory_gold: 'مخزون الذهب',
  inventory_silver: 'مخزون الفضة',
  inventory_accessory: 'مخزون الملحقات',
  inventory_accessories: 'مخزون الملحقات',
  cogs: 'تكلفة البضاعة المباعة',
  expense: 'مصروف',
  unclassified: 'غير مصنف',
};

const TECHNICAL_KEY = /^[a-z][a-z0-9_:-]*$/i;

export const arabicAccountLabel = (key: string | null | undefined, fallback?: string): string => {
  const normalized = String(key ?? '').trim();
  if (ARABIC_ACCOUNT_LABELS[normalized]) return ARABIC_ACCOUNT_LABELS[normalized];
  if (fallback && !TECHNICAL_KEY.test(fallback)) return fallback;
  if (normalized && !TECHNICAL_KEY.test(normalized)) return normalized;
  return fallback || ARABIC_ACCOUNT_LABELS.unclassified;
};

export const hasTechnicalAccountLabel = (value: string): boolean =>
  TECHNICAL_KEY.test(value.trim()) && !ARABIC_ACCOUNT_LABELS[value.trim()];

export const ACCOUNT_LABELS_AR = Object.freeze({ ...ARABIC_ACCOUNT_LABELS });