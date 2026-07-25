import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart3, Coins, Download, Package, Scale, TrendingUp, Wallet } from 'lucide-react';
import { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildIncomeStatementReport, type IncomeStatementLine, type IncomeStatementReport } from '../../../lib/incomeStatementReport';
import type { LedgerDimension } from '../../../lib/ledgerReport';
import { cn } from '../../../lib/utils';
import { exportToExcel } from '../../../utils/exportUtils';

type IncomeTab = LedgerDimension | 'summary';

const tabMeta: Record<IncomeTab, { label: string; unit: string; icon: React.ReactNode }> = {
  cash: { label: 'الدخل النقدي', unit: 'ج.م', icon: <Wallet className="h-5 w-5" /> },
  gold: { label: 'دخل الذهب', unit: 'جم 21', icon: <Scale className="h-5 w-5" /> },
  silver: { label: 'دخل الفضة', unit: 'جرام', icon: <Coins className="h-5 w-5" /> },
  quantity: { label: 'دخل الملحقات', unit: 'قطعة', icon: <Package className="h-5 w-5" /> },
  summary: { label: 'الملخص الموحد', unit: 'ج.م', icon: <BarChart3 className="h-5 w-5" /> },
};

const money = (value: number | null): string =>
  value === null ? 'غير متاح' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const Section = ({ title, lines, total, unit, tone = 'neutral' }: { title: string; lines: IncomeStatementLine[]; total: number; unit: string; tone?: 'good' | 'bad' | 'neutral' }) => (
  <div className="space-y-3">
    <div className={cn('flex items-center justify-between border-b border-[#1a1e2a] pb-2 font-bold', tone === 'good' ? 'text-[#6a9e6a]' : tone === 'bad' ? 'text-[#9e6a6a]' : 'text-[#ddd8cc]')}>
      <span>{title}</span>
      <span className="font-mono">{money(total)} {unit}</span>
    </div>
    <div className="space-y-1 pr-4">
      {lines.length === 0 ? <div className="py-2 text-sm text-[#5a5548]">لا توجد أرصدة</div> : lines.map(line => (
        <div key={line.entityId} className="flex items-center justify-between rounded-lg p-1.5 text-sm text-[#8a8172] hover:bg-[#1a1e2a]/50">
          <span className="font-bold">{line.accountName}</span>
          <span className="font-mono text-[#ddd8cc]">{money(line.amount)} {unit}</span>
        </div>
      ))}
    </div>
  </div>
);

const ReportBody = ({ report, unit }: { report: IncomeStatementReport; unit: string }) => (
  <>
    {report.cogs.status === 'missing_cost_timeline' && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">تكلفة البضاعة المباعة غير متاحة لأن محرك المتوسط المرجح لم يكتمل بنجاح.</div>}
    <div className="space-y-8 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-6 shadow-xl">
      <Section title="الإيرادات" lines={report.revenue.lines} total={report.revenue.total} unit={unit} tone="good" />
      <Section title="تكلفة البضاعة المباعة" lines={report.cogs.lines} total={report.cogs.total} unit={unit} tone="bad" />
      <div className="flex items-center justify-between border-t border-[#c9a84c33] pt-4 text-lg font-black text-[#c9a84c]"><span>مجمل الربح</span><span className="font-mono">{money(report.grossProfit)} {unit}</span></div>
      <Section title="المصروفات" lines={report.operatingExpenses.lines} total={report.operatingExpenses.total} unit={unit} tone="bad" />
      <div className="flex items-center justify-between rounded-2xl border border-[#c9a84c55] bg-gradient-to-br from-[#1a1e2a] to-[#080a0f] p-5 shadow-xl">
        <span className="text-base font-bold uppercase tracking-wider text-[#c9a84c]">صافي ربح التشغيل</span>
        <span className={cn('font-mono text-4xl font-bold', (report.operatingProfit ?? 0) >= 0 ? 'text-[#c9a84c]' : 'text-[#9e6a6a]')}>{money(report.operatingProfit)} {unit}</span>
      </div>
    </div>
  </>
);

const SummaryBody = ({ reports }: { reports: Record<LedgerDimension, IncomeStatementReport> }) => (
  <div className="space-y-8 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-6 shadow-xl">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(['cash', 'gold', 'silver', 'quantity'] as LedgerDimension[]).map(dimension => {
        const report = reports[dimension];
        const meta = tabMeta[dimension];
        const value = dimension === 'cash' ? report.operatingProfit : report.revenue.total - report.operatingExpenses.total;
        return <div key={dimension} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#c9a84c]">{meta.icon}<span>{meta.label}</span></div>
          <div className="mt-2 font-mono text-2xl font-black text-[#ddd8cc]">{money(value)} {meta.unit}</div>
        </div>;
      })}
    </div>
    <div className="rounded-2xl border border-[#c9a84c55] bg-gradient-to-br from-[#1a1e2a] to-[#080a0f] p-5">
      <div className="text-sm font-bold text-[#c9a84c]">صافي ربح التشغيل النقدي</div>
      <div className="mt-2 font-mono text-4xl font-black text-[#ddd8cc]">{money(reports.cash.operatingProfit)} ج.م</div>
    </div>
  </div>
);

export const IncomeStatementView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, canonicalAccounts, costCalculationRun } = useAppStore();
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<IncomeTab>('cash');

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    entries.forEach(entry => { if (entry.date) months.add(entry.date.substring(0, 7)); });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (selectedMonth === 'all') return entries;
    return entries.filter(entry => entry.date?.startsWith(selectedMonth));
  }, [entries, selectedMonth]);

  const period = useMemo(() => {
    if (selectedMonth !== 'all') return { from: `${selectedMonth}-01`, to: `${selectedMonth}-31` };
    const dates = filteredEntries.map(entry => entry.date).filter(Boolean).sort();
    return { from: dates[0] || '0000-01-01', to: dates[dates.length - 1] || '9999-12-31' };
  }, [filteredEntries, selectedMonth]);

  const costTimeline = costCalculationRun.status === 'valid' && costCalculationRun.timeline?.valid ? costCalculationRun.timeline : null;
  const reportInputs = [filteredEntries, accountsDb.filter(account => account.isActive !== false), period.from, period.to, canonicalAccounts, costTimeline] as const;
  const reports = useMemo(() => ({
    cash: buildIncomeStatementReport(...reportInputs, 'cash'),
    gold: buildIncomeStatementReport(...reportInputs, 'gold'),
    silver: buildIncomeStatementReport(...reportInputs, 'silver'),
    quantity: buildIncomeStatementReport(...reportInputs, 'quantity'),
  }), [filteredEntries, accountsDb, canonicalAccounts, costTimeline, period.from, period.to]);

  const handleExport = () => {
    const sheets = (['cash', 'gold', 'silver', 'quantity'] as LedgerDimension[]).map(dimension => {
      const report = reports[dimension];
      const rows = [
        ...report.revenue.lines.map(line => ({ البند: 'الإيرادات', الحساب: line.accountName, المبلغ: line.amount })),
        ...report.cogs.lines.map(line => ({ البند: 'تكلفة البضاعة المباعة', الحساب: line.accountName, المبلغ: line.amount })),
        { البند: 'مجمل الربح', الحساب: '', المبلغ: report.grossProfit ?? '' },
        ...report.operatingExpenses.lines.map(line => ({ البند: 'المصروفات', الحساب: line.accountName, المبلغ: line.amount })),
        { البند: 'صافي ربح التشغيل', الحساب: '', المبلغ: report.operatingProfit ?? '' },
      ];
      return { name: tabMeta[dimension].label, data: rows };
    });
    exportToExcel(sheets, `income_statement_${selectedMonth === 'all' ? 'all' : selectedMonth}`);
  };

  const activeReport = activeTab === 'summary' ? reports.cash : reports[activeTab];
  const activeUnit = tabMeta[activeTab].unit;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#ddd8cc]"><TrendingUp className="h-5 w-5 text-[#c9a84c]" />قائمة الدخل</h3>
          <p className="mt-1 text-xs text-[#5a5548]">مبنية على أرصدة ميزان المراجعة من المحرك المركزي</p>
        </div>
        <button onClick={handleExport} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c9a84c33] bg-[#1a1e2a] px-5 py-2.5 text-sm font-bold text-[#c9a84c] transition-all hover:border-[#c9a84c] hover:bg-[#c9a84c] hover:text-[#080a0f] sm:w-auto">
          <Download className="h-4 w-4" />
          {selectedMonth === 'all' ? 'تصدير Excel (الكل)' : `تصدير Excel (${format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ar })})`}
        </button>
      </div>

      {availableMonths.length > 0 && <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setSelectedMonth('all')} className={cn('whitespace-nowrap rounded-xl border px-6 py-3 text-sm font-bold', selectedMonth === 'all' ? 'border-[#c9a84c] bg-[#c9a84c] text-[#080a0f]' : 'border-[#1a1e2a] bg-[#0e1018] text-[#5a5548]')}>الكل</button>
        {availableMonths.map(ym => <button key={ym} onClick={() => setSelectedMonth(ym)} className={cn('whitespace-nowrap rounded-xl border px-6 py-3 text-sm font-bold capitalize', selectedMonth === ym ? 'border-[#c9a84c] bg-[#c9a84c] text-[#080a0f]' : 'border-[#1a1e2a] bg-[#0e1018] text-[#5a5548]')}>{format(parseISO(ym + '-01'), 'MMMM yyyy', { locale: ar })}</button>)}
      </div>}

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-1 shadow-lg">
        {(['cash', 'gold', 'silver', 'quantity', 'summary'] as IncomeTab[]).map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={cn('flex min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold transition-all', activeTab === tab ? 'bg-[#c9a84c] text-[#080a0f] shadow-lg' : 'text-[#5a5548] hover:text-[#ddd8cc]')}>
          {tabMeta[tab].icon}{tabMeta[tab].label}
        </button>)}
      </div>

      {activeTab === 'summary' ? <SummaryBody reports={reports} /> : <ReportBody report={activeReport} unit={activeUnit} />}
    </div>
  );
});