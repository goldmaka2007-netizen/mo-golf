import React from 'react';
import { AlertTriangle, ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  MonthlyDecisionInsight,
  MonthlyInventoryMovement,
  MonthlyKpi,
  MonthlyMetric,
  MonthlyMetricUnit,
  MonthlyTrendPoint,
} from '../../../../lib/monthlyReportTypes';

const unitLabel: Record<MonthlyMetricUnit, string> = {
  currency: 'ج.م',
  gram: 'جم',
  gold21: 'جم عيار 21',
  count: 'قطعة',
  percent: '%',
  operations: 'عملية',
  months: 'شهر',
};

export const formatMonthlyValue = (value: number, unit: MonthlyMetricUnit): string => {
  const digits = unit === 'currency' || unit === 'count' || unit === 'operations' ? 0 : unit === 'percent' ? 1 : 3;
  return `${value.toLocaleString('ar-EG', { maximumFractionDigits: digits })} ${unitLabel[unit]}`;
};

export const EmptyMetricState = ({ metric }: { metric: MonthlyMetric }) => (
  <div className="text-xs leading-5 text-[#8a8172]">
    {metric.status === 'unsupported' ? 'المؤشر غير مدعوم' : metric.reason || 'بيانات غير كافية'}
  </div>
);

export const ReportSection = ({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => (
  <details open={defaultOpen} className="group overflow-hidden rounded-2xl border border-[#1a1e2a] bg-[#0e1018]">
    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[#f5f1e8]">{title}</span>
        {subtitle && <span className="mt-0.5 block text-[10px] text-[#8a8172]">{subtitle}</span>}
      </span>
      <ChevronDown className="h-4 w-4 text-[#c9a84c] transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-[#1a1e2a] p-3">{children}</div>
  </details>
);

export const MetricComparison = ({ kpi }: { kpi: MonthlyKpi }) => {
  if (kpi.current.value === null) return <EmptyMetricState metric={kpi.current} />;
  const change = kpi.comparison.change;
  const Icon = change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
      <span className="text-[#8a8172]">
        السابق: {kpi.comparison.previousValue === null ? 'بيانات غير كافية' : formatMonthlyValue(kpi.comparison.previousValue, kpi.unit)}
      </span>
      <span className={`flex items-center gap-1 font-bold ${change === null || change === 0 ? 'text-[#8a8172]' : change > 0 ? 'text-[#6a9e6a]' : 'text-red-300'}`}>
        <Icon className="h-3 w-3" />
        {kpi.comparison.changePercent === null ? 'غير قابلة للمقارنة' : `${kpi.comparison.changePercent.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`}
      </span>
    </div>
  );
};

export const KpiCard = ({ kpi }: { kpi: MonthlyKpi }) => (
  <article className="min-w-0 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3">
    <div className="text-[11px] font-bold text-[#b8b1a3]">{kpi.label}</div>
    {kpi.current.value === null
      ? <div className="mt-2"><EmptyMetricState metric={kpi.current} /></div>
      : <div className="mt-1 break-words font-mono text-base font-black tabular-nums text-[#f5f1e8]">{formatMonthlyValue(kpi.current.value, kpi.unit)}</div>}
    <MetricComparison kpi={kpi} />
  </article>
);

export const InsightCard = ({ insight }: { insight: MonthlyDecisionInsight }) => {
  const color = insight.severity === 'critical'
    ? 'border-red-500/35 bg-red-500/10'
    : insight.severity === 'warning' ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-blue-500/30 bg-blue-500/10';
  return (
    <article className={`rounded-xl border p-3 ${color}`}>
      <div className="font-black text-[#f5f1e8]">{insight.title}</div>
      <p className="mt-1 text-xs leading-5 text-[#ddd8cc]">{insight.reason}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {insight.supportingMetrics.map(item => (
          <span key={item.label} className="rounded-full bg-[#080a0f]/80 px-2 py-1 text-[9px] text-[#c9a84c]">
            {item.label}: {formatMonthlyValue(item.value, item.unit)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-bold leading-5 text-[#f5f1e8]">{insight.suggestedAction}</p>
    </article>
  );
};

const movementRows: Array<[keyof Omit<MonthlyInventoryMovement, 'unit'>, string, string]> = [
  ['opening', 'رصيد أول المدة', '+',],
  ['inflows', 'وارد', '+'],
  ['outflows', 'صادر', '−'],
  ['adjustments', 'تسويات وصافي التحويلات', '±'],
  ['closing', 'رصيد آخر المدة', '='],
];

export const InventoryMovementCard = ({ title, movement }: { title: string; movement: MonthlyInventoryMovement }) => {
  const unit: MonthlyMetricUnit = movement.unit === 'gold21' ? 'gold21' : movement.unit === 'count' ? 'count' : 'gram';
  return (
    <article className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3">
      <div className="font-black text-[#c9a84c]">{title}</div>
      <div className="mt-2 divide-y divide-[#1a1e2a]">
        {movementRows.map(([key, label, sign]) => (
          <div key={key} className="flex items-center justify-between gap-2 py-2 text-[11px]">
            <span className="text-[#8a8172]">{sign} {label}</span>
            <span className="font-mono font-bold tabular-nums text-[#ddd8cc]">{formatMonthlyValue(movement[key], unit)}</span>
          </div>
        ))}
      </div>
      {movement.internalTransfers > 0 && (
        <div className="mt-2 rounded-lg border border-[#c9a84c]/15 px-2 py-1.5 text-[10px] text-[#8a8172]">
          حركة تحويل داخلي: {formatMonthlyValue(movement.internalTransfers, unit)} — لا تدخل البيع أو الشراء.
        </div>
      )}
    </article>
  );
};

const compact = (value: number) => value.toLocaleString('ar-EG', { notation: 'compact', maximumFractionDigits: 0 });

export const MonthlyTrendCharts = ({ data }: { data: MonthlyTrendPoint[] }) => {
  const hasData = data.some(point => point.sales || point.purchases || point.goldSalesWeight || point.operatingExpenses);
  if (!hasData) return <div className="py-10 text-center text-sm text-[#8a8172]">بيانات غير كافية</div>;
  return (
    <div className="space-y-4 overflow-hidden">
      <div className="h-56 min-w-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 2, left: 2, bottom: 2 }}>
            <CartesianGrid stroke="#1a1e2a" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8a8172', fontSize: 9 }} />
            <YAxis width={46} tickFormatter={compact} tick={{ fill: '#8a8172', fontSize: 9 }} />
            <Tooltip contentStyle={{ background: '#080a0f', border: '1px solid #1a1e2a', direction: 'rtl', fontSize: 11 }} formatter={(value) => Number(value).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} />
            <Legend wrapperStyle={{ fontSize: 10, direction: 'rtl' }} />
            <Bar name="المبيعات" dataKey="sales" fill="#c9a84c" radius={[4, 4, 0, 0]} />
            <Bar name="المشتريات" dataKey="purchases" fill="#6a8a9e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-56 min-w-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 2 }}>
            <CartesianGrid stroke="#1a1e2a" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8a8172', fontSize: 9 }} />
            <YAxis width={46} tickFormatter={compact} tick={{ fill: '#8a8172', fontSize: 9 }} />
            <Tooltip contentStyle={{ background: '#080a0f', border: '1px solid #1a1e2a', direction: 'rtl', fontSize: 11 }} formatter={(value) => Number(value).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} />
            <Legend wrapperStyle={{ fontSize: 10, direction: 'rtl' }} />
            <Line name="النقدية الختامية" type="monotone" dataKey="closingCash" stroke="#6a9e6a" strokeWidth={2} dot={false} />
            <Line name="مصروفات التشغيل" type="monotone" dataKey="operatingExpenses" stroke="#d97777" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const DataIssueWarning = ({ messages }: { messages: string[] }) => messages.length ? (
  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs leading-5 text-yellow-100">
    <div className="flex items-center gap-2 font-black"><AlertTriangle className="h-4 w-4" />تنبيه مصدر البيانات</div>
    {messages.map(message => <div key={message} className="mt-1">{message}</div>)}
  </div>
) : null;

export const AccountingSummaryCard = ({
  title,
  metrics,
  onOpen,
}: {
  title: string;
  metrics: string[];
  onOpen: () => void;
}) => (
  <article className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3">
    <div className="font-black text-[#f5f1e8]">{title}</div>
    <div className="mt-2 space-y-1 text-[11px] text-[#b8b1a3]">{metrics.map(value => <div key={value}>{value}</div>)}</div>
    <button type="button" onClick={onOpen} className="mt-3 min-h-10 w-full rounded-lg border border-[#c9a84c]/30 text-xs font-black text-[#c9a84c]">
      فتح التقرير الأصلي
    </button>
  </article>
);
