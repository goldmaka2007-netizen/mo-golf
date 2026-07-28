import { MONTHLY_DECISION_THRESHOLDS as T } from './monthlyDecisionConfig';
import type {
  MonthlyDecisionInsight,
  MonthlyHealthStatus,
  MonthlyMetricUnit,
  MonthlyReportData,
  MonthlySnapshot,
} from './monthlyReportTypes';

const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;

const metric = (label: string, value: number, unit: MonthlyMetricUnit) => ({ label, value, unit });

export const buildMonthlyDecisionInsights = (
  data: Pick<MonthlyReportData, 'current' | 'previous' | 'rolling3'>,
): MonthlyDecisionInsight[] => {
  const { current, previous, rolling3 } = data;
  if (!current.hasActivity) return [];

  const insights: MonthlyDecisionInsight[] = [];
  const salesChange = percentChange(current.sales, previous.sales);
  const purchasesChange = percentChange(current.purchases, previous.purchases);
  const inventoryChange = percentChange(current.goldInventory21, previous.goldInventory21);
  const expenseChange = percentChange(current.operatingExpenses, previous.operatingExpenses);
  const liabilityChange = percentChange(current.merchantGoldLiabilities21, previous.merchantGoldLiabilities21);
  const cashCoverage = current.operatingExpenses > 0 ? current.closingCash / current.operatingExpenses : null;
  const rollingMargins = rolling3
    .map(snapshot => snapshot.grossMargin.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const rollingMargin = rollingMargins.length
    ? rollingMargins.reduce((sum, value) => sum + value, 0) / rollingMargins.length
    : null;

  if (salesChange !== null && purchasesChange !== null
    && salesChange <= T.salesDeclineWarningPercent && purchasesChange > 0) {
    insights.push({
      severity: 'warning',
      title: 'التريث في زيادة المشتريات',
      reason: `المبيعات تغيرت ${salesChange.toFixed(1)}% بينما المشتريات تغيرت ${purchasesChange.toFixed(1)}%.`,
      supportingMetrics: [
        metric('تغير المبيعات', salesChange, 'percent'),
        metric('تغير المشتريات', purchasesChange, 'percent'),
      ],
      suggestedAction: 'راجع خطة الشراء حسب سرعة دوران الأصناف وركز على تصريف المخزون الحالي.',
    });
  }

  if (inventoryChange !== null && salesChange !== null
    && inventoryChange >= T.inventoryGrowthWarningPercent && salesChange < 0) {
    insights.push({
      severity: 'warning',
      title: 'مراجعة تراكم المخزون',
      reason: `المخزون العربي ارتفع ${inventoryChange.toFixed(1)}% مع انخفاض المبيعات ${Math.abs(salesChange).toFixed(1)}%.`,
      supportingMetrics: [
        metric('تغير مخزون الذهب', inventoryChange, 'percent'),
        metric('تغير المبيعات', salesChange, 'percent'),
      ],
      suggestedAction: 'حدد الأصناف الأبطأ حركة قبل إصدار أوامر شراء جديدة.',
    });
  }

  if (cashCoverage !== null && cashCoverage < T.warningCashCoverageMonths) {
    insights.push({
      severity: cashCoverage < T.criticalCashCoverageMonths ? 'critical' : 'warning',
      title: 'حماية السيولة',
      reason: `الرصيد النقدي يغطي ${cashCoverage.toFixed(2)} شهر فقط من مصروفات التشغيل الحالية.`,
      supportingMetrics: [
        metric('تغطية السيولة', cashCoverage, 'months'),
        metric('الرصيد النقدي', current.closingCash, 'currency'),
        metric('مصروفات التشغيل', current.operatingExpenses, 'currency'),
      ],
      suggestedAction: 'رتب المدفوعات حسب الأولوية وراجع توقيت المشتريات النقدية.',
    });
  }

  if (expenseChange !== null && expenseChange >= T.expenseGrowthWarningPercent) {
    insights.push({
      severity: 'warning',
      title: 'مراجعة المصروفات',
      reason: `مصروفات التشغيل ارتفعت ${expenseChange.toFixed(1)}% عن الشهر السابق.`,
      supportingMetrics: [
        metric('تغير المصروفات', expenseChange, 'percent'),
        metric('مصروفات التشغيل', current.operatingExpenses, 'currency'),
      ],
      suggestedAction: 'راجع البنود الأعلى زيادة وافصل المصروف المتكرر عن الاستثنائي.',
    });
  }

  if (liabilityChange !== null && liabilityChange >= T.merchantLiabilityGrowthWarningPercent
    && (inventoryChange === null || liabilityChange > inventoryChange)) {
    insights.push({
      severity: 'warning',
      title: 'مراجعة التزامات التجار',
      reason: `التزامات تجار الذهب ارتفعت ${liabilityChange.toFixed(1)}% وبمعدل أعلى من المخزون.`,
      supportingMetrics: [
        metric('تغير التزامات التجار', liabilityChange, 'percent'),
        metric('التزامات تجار الذهب', current.merchantGoldLiabilities21, 'gold21'),
      ],
      suggestedAction: 'طابق أرصدة التجار وحدد جدول سداد لا يضغط السيولة أو صافي الذهب المملوك.',
    });
  }

  if (current.grossMargin.value !== null && rollingMargin !== null
    && current.grossMargin.value < rollingMargin - T.marginDeclineWarningPoints) {
    insights.push({
      severity: 'warning',
      title: 'مراجعة هامش الربح',
      reason: `هامش الشهر ${current.grossMargin.value.toFixed(1)}% أقل من مرجع الفترة.`,
      supportingMetrics: [
        metric('هامش الربح', current.grossMargin.value, 'percent'),
      ],
      suggestedAction: 'راجع التسعير والمصنعية وتكلفة الأصناف المباعة قبل زيادة حجم البيع.',
    });
  }

  return insights.slice(0, 3);
};

export const deriveMonthlyHealthStatus = (
  current: MonthlySnapshot,
  insights: MonthlyDecisionInsight[],
): MonthlyHealthStatus => {
  if (insights.some(insight => insight.severity === 'critical')) return 'خطر';
  if (insights.length >= 2) return 'يحتاج انتباه';
  if (!current.hasActivity || current.netOperatingProfit.value === null) return 'مستقر';
  const margin = current.netMargin.value;
  const coverage = current.operatingExpenses > 0 ? current.closingCash / current.operatingExpenses : null;
  if (margin !== null && margin >= T.strongNetMarginPercent
    && (coverage === null || coverage >= T.strongCashCoverageMonths)) return 'ممتاز';
  return insights.length ? 'يحتاج انتباه' : 'مستقر';
};
