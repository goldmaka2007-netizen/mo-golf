import React, { useMemo, useState } from 'react';
import { CalendarDays, Gauge, Sparkles } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildMonthlyReport } from '../../../lib/monthlyReportService';
import type { MonthlyMetricUnit } from '../../../lib/monthlyReportTypes';
import {
  AccountingSummaryCard,
  DataIssueWarning,
  EmptyMetricState,
  formatMonthlyValue,
  InsightCard,
  InventoryMovementCard,
  KpiCard,
  MonthlyTrendCharts,
  ReportSection,
} from './monthly/MonthlyReportComponents';

type ReportTarget = 'trial' | 'income' | 'balance' | 'equity';
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(new Date(2026, index, 1)));

const Metric = ({ label, value, unit, reason }: { label: string; value: number | null; unit: MonthlyMetricUnit; reason?: string }) => (
  <div className="min-w-0 rounded-xl bg-[#080a0f] p-3">
    <div className="text-[10px] font-bold text-[#8a8172]">{label}</div>
    <div className="mt-1 break-words text-sm">
      {value === null
        ? <EmptyMetricState metric={{ value: null, status: 'insufficient_data', reason: reason || 'بيانات غير كافية' }} />
        : <span className="font-mono font-black tabular-nums text-[#f5f1e8]">{formatMonthlyValue(value, unit)}</span>}
    </div>
  </div>
);

export const MonthlyReportView = React.memo(({ entries, onNavigate }: {
  entries: Entry[];
  onNavigate?: (target: ReportTarget) => void;
}) => {
  const { accountsDb, costCalculationRun, goldPrice } = useAppStore();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const years = useMemo(() => {
    const values = new Set(entries.map(entry => Number(entry.date?.slice(0, 4))).filter(Number.isFinite));
    values.add(today.getFullYear());
    return [...values].sort((a, b) => b - a);
  }, [entries, today]);
  const result = useMemo(() => {
    try {
      return { data: buildMonthlyReport({
        entries,
        accounts: accountsDb,
        year,
        month,
        costTimeline: costCalculationRun.status === 'valid' ? costCalculationRun.timeline : null,
        goldPrice,
      }), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'تعذر بناء التقرير الشهري' };
    }
  }, [entries, accountsDb, year, month, costCalculationRun, goldPrice]);

  if (!result.data) return <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100"><b>تعذر تحميل التقرير الشهري</b><div className="mt-2 text-xs">{result.error}</div></div>;
  const data = result.data;
  const current = data.current;
  const average = (field: 'sales' | 'purchases') => data.rolling3.length ? data.rolling3.reduce((sum, item) => sum + item[field], 0) / data.rolling3.length : null;
  const statusClass = data.healthStatus === 'ممتاز' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : data.healthStatus === 'خطر' ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : data.healthStatus === 'يحتاج انتباه' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100'
        : 'border-blue-500/30 bg-blue-500/10 text-blue-100';
  const cashCoverage = current.operatingExpenses ? current.closingCash / current.operatingExpenses : null;
  const liabilityCoverage = current.cashLiabilities > 0 ? current.closingCash / current.cashLiabilities * 100 : null;
  const navigate = (target: ReportTarget) => onNavigate?.(target);

  return <div className="min-w-0 space-y-3 pb-[calc(env(safe-area-inset-bottom)+28px)]" dir="rtl">
    <section className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
      <div className="mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#c9a84c]" /><div><h3 className="text-sm font-black">فترة التقرير</h3><p className="text-[10px] text-[#8a8172]">الحركة التشغيلية داخل الشهر، والأرصدة حتى نهايته.</p></div></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-[#8a8172]">الشهر<select value={month} onChange={event => setMonth(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-sm text-[#f5f1e8]">{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
        <label className="text-[10px] text-[#8a8172]">السنة<select value={year} onChange={event => setYear(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-sm text-[#f5f1e8]">{years.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
    </section>
    <DataIssueWarning messages={data.warnings} />
    <section className="rounded-2xl border border-[#c9a84c]/25 bg-gradient-to-br from-[#15130e] to-[#0e1018] p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-black text-[#c9a84c]"><Sparkles className="h-4 w-4" />الملخص التنفيذي</div><h3 className="mt-2 text-xl font-black">{monthNames[month - 1]} {year}</h3></div><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClass}`}>{data.healthStatus}</span></div>
      {!current.hasActivity && <div className="mt-3 rounded-xl bg-[#080a0f] p-4 text-center text-sm text-[#8a8172]">لا توجد حركة تشغيلية في الشهر المحدد.</div>}
      <div className="mt-3 grid gap-2">{data.highlights.map(item => <div key={item} className="rounded-lg bg-[#080a0f]/70 px-3 py-2 text-xs leading-5 text-[#ddd8cc]">{item}</div>)}</div>
    </section>
    <ReportSection title="أهم مؤشرات الأداء" subtitle="القيمة الحالية مقارنة بالشهر السابق">
      <div className="grid grid-cols-2 gap-2">{data.kpis.slice(0, 8).map(item => <div key={item.id}><KpiCard kpi={item} /></div>)}</div>
      <details className="mt-3"><summary className="cursor-pointer text-center text-xs font-black text-[#c9a84c]">عرض كل المؤشرات</summary><div className="mt-3 grid grid-cols-2 gap-2">{data.kpis.slice(8).map(item => <div key={item.id}><KpiCard kpi={item} /></div>)}</div></details>
    </ReportSection>
    <ReportSection title="إجراءات مقترحة" subtitle="قواعد حتمية مبنية على أرقام التقرير">
      {data.insights.length ? <div className="space-y-2">{data.insights.map(item => <div key={item.title}><InsightCard insight={item} /></div>)}</div> : <div className="py-5 text-center text-xs text-[#8a8172]">لا توجد توصيات مدعومة كفاية لهذا الشهر.</div>}
    </ReportSection>
    <ReportSection title="تحليل البيع والشراء" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="قيمة المبيعات" value={current.sales} unit="currency" /><Metric label="قيمة المشتريات" value={current.purchases} unit="currency" />
        <Metric label="ذهب مباع" value={current.goldSalesWeight} unit="gram" /><Metric label="ذهب مشترى" value={current.goldPurchaseWeight} unit="gram" />
        <Metric label="فضة مباعة" value={current.silverSalesWeight} unit="gram" /><Metric label="فضة مشتراة" value={current.silverPurchaseWeight} unit="gram" />
        <Metric label="عمليات البيع" value={current.saleCount} unit="operations" /><Metric label="عمليات الشراء" value={current.purchaseCount} unit="operations" />
        <Metric label="متوسط عملية البيع" value={current.saleCount ? current.sales / current.saleCount : null} unit="currency" /><Metric label="متوسط عملية الشراء" value={current.purchaseCount ? current.purchases / current.purchaseCount : null} unit="currency" />
        <Metric label="متوسط مبيعات 3 أشهر" value={average('sales')} unit="currency" /><Metric label="متوسط مشتريات 3 أشهر" value={average('purchases')} unit="currency" />
      </div>
    </ReportSection>
    <ReportSection title="الربحية" subtitle="نتيجة التشغيل منفصلة عن إعادة تقييم السوق" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Cash Profit/Loss" value={data.accountingSummary.incomeStatement.cashNet} unit="currency" />
        <Metric label="COGS" value={current.cogs.value} unit="currency" reason={current.cogs.reason} />
        <Metric label="Gross Profit" value={current.grossProfit.value} unit="currency" reason={current.grossProfit.reason} />
        <Metric label="Operating Expenses" value={current.operatingExpenses} unit="currency" />
        <Metric label="Net Operating Profit" value={current.netOperatingProfit.value} unit="currency" reason={current.netOperatingProfit.reason} />
        <Metric label="Gold Profit/Loss" value={current.goldProfitWeight21} unit="gold21" />
        <Metric label="Silver Profit/Loss" value={current.silverProfitWeight} unit="gram" />
      </div>
      <div className="mt-3 rounded-xl border border-[#c9a84c]/20 bg-[#080a0f] p-3"><div className="text-xs font-black text-[#c9a84c]">Market Revaluation — منفصل عن التشغيل</div>{data.marketRevaluation.inventoryMarketValue === null ? <div className="mt-2 text-xs text-[#8a8172]">سعر السوق غير محدد</div> : <div className="mt-2 grid grid-cols-2 gap-2"><Metric label="قيمة المخزون بالسوق" value={data.marketRevaluation.inventoryMarketValue} unit="currency" /><Metric label="فرق إعادة التقييم" value={data.marketRevaluation.revaluationDifference} unit="currency" reason="التكلفة التاريخية غير متاحة" /><div className="col-span-2 text-[10px] text-[#8a8172]">المصدر: {data.marketRevaluation.source}</div></div>}</div>
    </ReportSection>
    <ReportSection title="المخزون والتجار" subtitle="Opening + Inflows − Outflows ± Adjustments = Closing" defaultOpen={false}>
      <div className="grid gap-2 sm:grid-cols-2"><InventoryMovementCard title="ذهب فعلي" movement={current.inventory.gold} /><InventoryMovementCard title="ذهب عربي" movement={current.inventory.gold21} /><InventoryMovementCard title="فضة" movement={current.inventory.silver} /><InventoryMovementCard title="ملحقات" movement={current.inventory.accessories} /><InventoryMovementCard title="التزامات تجار الذهب" movement={current.inventory.merchantGold} />{current.inventory.merchantSilver && <InventoryMovementCard title="التزامات تجار الفضة" movement={current.inventory.merchantSilver} />}</div>
    </ReportSection>
    <ReportSection title="السيولة والالتزامات" defaultOpen={false}>
      <div className="rounded-xl bg-[#080a0f] p-3 text-xs"><div className="flex justify-between py-1"><span>Opening Cash</span><b>{formatMonthlyValue(current.openingCash, 'currency')}</b></div><div className="flex justify-between py-1 text-emerald-300"><span>+ Cash In</span><b>{formatMonthlyValue(current.cashIn, 'currency')}</b></div><div className="flex justify-between py-1 text-red-300"><span>− Cash Out</span><b>{formatMonthlyValue(current.cashOut, 'currency')}</b></div><div className="mt-2 flex justify-between border-t border-[#1a1e2a] pt-2 text-[#c9a84c]"><span>= Closing Cash</span><b>{formatMonthlyValue(current.closingCash, 'currency')}</b></div></div>
      <div className="mt-2 grid grid-cols-2 gap-2"><Metric label="مصروفات التشغيل" value={current.operatingExpenses} unit="currency" /><Metric label="المسحوبات" value={current.personalWithdrawals} unit="currency" /><Metric label="الالتزامات النقدية" value={current.cashLiabilities} unit="currency" /><Metric label="Cash Coverage" value={cashCoverage} unit="months" /><Metric label="تغطية الالتزامات" value={liabilityCoverage} unit="percent" /></div>
    </ReportSection>
    <ReportSection title="الاتجاهات — آخر 6 أشهر" defaultOpen={false}><MonthlyTrendCharts data={data.trends} /></ReportSection>
    <ReportSection title="الملخص المحاسبي" defaultOpen={false}>
      <div className="grid gap-2 sm:grid-cols-2">
        <AccountingSummaryCard title="Trial Balance" metrics={[`فرق النقدية: ${formatMonthlyValue(data.accountingSummary.trialBalance.cashDifference, 'currency')}`, `فرق الذهب: ${formatMonthlyValue(data.accountingSummary.trialBalance.goldDifference, 'gold21')}`]} onOpen={() => navigate('trial')} />
        <AccountingSummaryCard title="Income Statement" metrics={[`الإيرادات: ${formatMonthlyValue(data.accountingSummary.incomeStatement.cashRevenue, 'currency')}`, `الصافي: ${formatMonthlyValue(data.accountingSummary.incomeStatement.cashNet, 'currency')}`]} onOpen={() => navigate('income')} />
        <AccountingSummaryCard title="Financial Position" metrics={[`الأصول النقدية: ${formatMonthlyValue(data.accountingSummary.financialPosition.cashAssets, 'currency')}`, `صافي الذهب: ${formatMonthlyValue(data.accountingSummary.financialPosition.goldOwned21, 'gold21')}`]} onOpen={() => navigate('balance')} />
        <AccountingSummaryCard title="Equity" metrics={[`تغير النقدية: ${formatMonthlyValue(data.accountingSummary.equity.cashChange, 'currency')}`, `تغير الذهب: ${formatMonthlyValue(data.accountingSummary.equity.goldChange, 'gold21')}`]} onOpen={() => navigate('equity')} />
      </div>
    </ReportSection>
    <section className="rounded-xl border border-[#1a1e2a] bg-[#0e1018] p-3"><div className="flex items-center gap-2 text-xs font-black text-[#c9a84c]"><Gauge className="h-4 w-4" />Year-to-Date</div><div className="mt-2 grid grid-cols-2 gap-2"><Metric label="مبيعات YTD" value={data.ytd.sales} unit="currency" /><Metric label="مشتريات YTD" value={data.ytd.purchases} unit="currency" /></div></section>
  </div>;
});
