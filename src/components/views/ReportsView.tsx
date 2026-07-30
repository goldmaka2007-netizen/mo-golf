import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BarChart3, Book, BookOpen, Briefcase, ChevronRight, Landmark, PieChart, RefreshCw, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { MonthlyReportView } from './reports/MonthlyReportView';
const IncomeStatementView = lazy(() => import('./reports/EgpIncomeStatementView').then(module => ({ default: module.IncomeStatementView })));
const LegacyIncomeStatementView = lazy(() => import('./reports/IncomeStatementView').then(module => ({ default: module.IncomeStatementView })));
const EquityStatementView = lazy(() => import('./reports/EgpEquityStatementView').then(module => ({ default: module.EquityStatementView })));
const BalanceSheetView = lazy(() => import('./reports/EgpBalanceSheetView').then(module => ({ default: module.BalanceSheetView })));
const LegacyBalanceSheetView = lazy(() => import('./reports/BalanceSheetView').then(module => ({ default: module.BalanceSheetView })));
const TrialBalanceView = lazy(() => import('./reports/TrialBalanceView').then(module => ({ default: module.TrialBalanceView })));
const GeneralLedgerView = lazy(() => import('./reports/GeneralLedgerView').then(module => ({ default: module.GeneralLedgerView })));
const InventoryCheckView = lazy(() => import('./InventoryCheckView').then(module => ({ default: module.InventoryCheckView })));
const FinalReportView = lazy(() => import('./reports/FinalReportView').then(module => ({ default: module.FinalReportView })));
const ScrapAnalysisView = lazy(() => import('./reports/ScrapAnalysisView').then(module => ({ default: module.ScrapAnalysisView })));
const Phase5CostReportView = lazy(() => import('./reports/Phase5CostReportView').then(module => ({ default: module.Phase5CostReportView })));
const FinancialStatementsView = lazy(() => import('./reports/FinancialStatementsView').then(module => ({ default: module.FinancialStatementsView })));
const HistoricalCostReviewView = lazy(() => import('./reports/HistoricalCostReviewView').then(module => ({ default: module.HistoricalCostReviewView })));
import { useAppStore } from '../../store';

const LegacyReportNotice = () => <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">هذا تقرير تشغيلي حسب طريقة العمل القديمة، وليس قائمة مالية محاسبية رسمية.</div>;

type ReportId = 'legacy-income' | 'legacy-position' | 'ledger' | 'trial' | 'income' | 'equity' | 'balance' | 'inventory' | 'lifecycle' | 'profit-analysis' | 'advanced-analytics' | 'final' | 'monthly' | 'scrap' | 'financial-statements' | 'historical-cost-review';
const reports: { id: ReportId; label: string; icon: React.ReactNode }[] = [
  { id: 'ledger', label: 'دفتر الأستاذ', icon: <Book /> },
  { id: 'trial', label: 'ميزان المراجعة', icon: <BookOpen /> },
  { id: 'income', label: 'قائمة الدخل المحاسبية', icon: <TrendingUp /> },
  { id: 'balance', label: 'المركز المالي المحاسبي', icon: <Briefcase /> },
  { id: 'equity', label: 'التغير في حقوق الملكية', icon: <Landmark /> },
  { id: 'legacy-income', label: 'تقرير الدخل التشغيلي القديم', icon: <TrendingUp /> },
  { id: 'legacy-position', label: 'المركز المالي التشغيلي القديم', icon: <Briefcase /> },
  { id: 'inventory', label: 'الجرد', icon: <PieChart /> },
  { id: 'lifecycle', label: 'حركة المخزون', icon: <RefreshCw /> },
  { id: 'profit-analysis', label: 'الربحية', icon: <PieChart /> },
  { id: 'advanced-analytics', label: 'التحليلات', icon: <TrendingUp /> },
  { id: 'monthly', label: 'التقرير الشهري', icon: <TrendingUp /> },
  { id: 'scrap', label: 'تحليل الكسر', icon: <TrendingUp /> },
  { id: 'final', label: 'التقرير النهائي', icon: <BarChart3 /> },
  { id: 'historical-cost-review', label: 'مراجعة بيانات التكلفة التاريخية', icon: <RefreshCw /> },
  { id: 'financial-statements', label: 'القوائم المالية الشاملة', icon: <Briefcase /> },
];

export const ReportsView = React.memo(() => {
  const { entries, reportsTab, setReportsTab, view } = useAppStore();
  const [selected, setSelected] = useState<ReportId | null>(
    view === 'reports' ? null : reportsTab,
  );
  const startDate = format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const filteredEntries = useMemo(() => entries.filter(e => e.date >= startDate && e.date <= endDate), [entries, startDate, endDate]);
  const balanceEntries = useMemo(() => entries.filter(e => e.date <= endDate), [entries, endDate]);


  useEffect(() => {
    const onPopState = () => setSelected(null);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const open = (id: ReportId) => {
    setReportsTab(id);
    setSelected(id);
    window.history.pushState({ makkaReport: id }, '', window.location.href);
  };
  const back = () => {
    setSelected(null);
    if (window.history.state?.makkaReport) window.history.back();
  };

  if (!selected) return <section className="space-y-2 pb-24" dir="rtl">
    <h2 className="px-1 text-sm font-black text-[#f5f1e8]">التقارير</h2>
    <div className="overflow-hidden rounded-2xl border border-[#1a1e2a] bg-[#0e1018]">
      {reports.map(report => <button key={report.id} type="button" onClick={() => open(report.id)} className="flex w-full items-center gap-3 border-b border-[#1a1e2a] px-4 py-4 text-right last:border-b-0 active:bg-[#c9a84c]/10">
        <span className="text-[#c9a84c] [&>svg]:h-4 [&>svg]:w-4">{report.icon}</span><span className="flex-1 text-sm font-bold text-[#f5f1e8]">{report.label}</span><ChevronRight className="h-4 w-4 text-[#8a8172]" />
      </button>)}
    </div>
  </section>;

  const title = reports.find(report => report.id === selected)?.label || 'التقارير';
  return <section className="space-y-3 pb-24" dir="rtl">
    <button type="button" onClick={back} className="flex items-center gap-1 text-sm font-bold text-[#c9a84c]"><ChevronRight className="h-5 w-5" /> رجوع إلى التقارير</button>
    <h2 className="text-lg font-black text-[#f5f1e8]">{title}</h2>
    <Suspense fallback={<div className="min-h-40 animate-pulse rounded-2xl border border-[#1a1e2a] bg-[#0e1018]" />}>
      {selected === 'ledger' && <GeneralLedgerView entries={entries} />}
    {selected === 'trial' && <TrialBalanceView entries={balanceEntries} />}
    {selected === 'income' && <IncomeStatementView entries={filteredEntries} />}
    {selected === 'equity' && <EquityStatementView entries={filteredEntries} />}
    {selected === 'legacy-income' && <div className="space-y-3"><LegacyReportNotice /><LegacyIncomeStatementView entries={filteredEntries} /></div>}
    {selected === 'legacy-position' && <div className="space-y-3"><LegacyReportNotice /><LegacyBalanceSheetView entries={balanceEntries} /></div>}
    {selected === 'balance' && <BalanceSheetView entries={balanceEntries} />}
    {selected === 'inventory' && <InventoryCheckView />}
    {selected === 'lifecycle' && <Phase5CostReportView initialSection="inventory" />}
    {selected === 'profit-analysis' && <Phase5CostReportView initialSection="profit" />}
    {selected === 'advanced-analytics' && <Phase5CostReportView initialSection="profit" />}
    {selected === 'monthly' && <MonthlyReportView entries={entries} onNavigate={target => open(target)} />}
    {selected === 'scrap' && <ScrapAnalysisView entries={filteredEntries} allEntries={entries} />}
      {selected === 'final' && <FinalReportView entries={filteredEntries} balanceEntries={balanceEntries} />}
      {selected === 'historical-cost-review' && <HistoricalCostReviewView />}
      {selected === 'financial-statements' && <FinancialStatementsView incomeEntries={filteredEntries} balanceEntries={balanceEntries} />}
    </Suspense>
  </section>;
});
