import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Book, BookOpen, Briefcase, ChevronRight, Landmark, PieChart, RefreshCw, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '../../store';
import { IncomeStatementView } from './reports/IncomeStatementView';
import { EquityStatementView } from './reports/EquityStatementView';
import { BalanceSheetView } from './reports/BalanceSheetView';
import { TrialBalanceView } from './reports/TrialBalanceView';
import { GeneralLedgerView } from './reports/GeneralLedgerView';
import { InventoryCheckView } from './InventoryCheckView';
import { FinalReportView } from './reports/FinalReportView';
import { ScrapAnalysisView } from './reports/ScrapAnalysisView';
import { MonthlySalesSummaryReportView } from './reports/MonthlySalesSummaryReportView';
import { Phase5CostReportView } from './reports/Phase5CostReportView';

type ReportId = 'ledger' | 'trial' | 'income' | 'equity' | 'balance' | 'inventory' | 'lifecycle' | 'profit-analysis' | 'advanced-analytics' | 'final' | 'monthly' | 'scrap';
const reports: { id: ReportId; label: string; icon: React.ReactNode }[] = [
  { id: 'ledger', label: 'دفتر الأستاذ', icon: <Book /> },
  { id: 'trial', label: 'ميزان المراجعة', icon: <BookOpen /> },
  { id: 'income', label: 'قائمة الدخل', icon: <TrendingUp /> },
  { id: 'balance', label: 'المركز المالي', icon: <Briefcase /> },
  { id: 'equity', label: 'حقوق الملكية', icon: <Landmark /> },
  { id: 'inventory', label: 'الجرد', icon: <PieChart /> },
  { id: 'lifecycle', label: 'حركة المخزون', icon: <RefreshCw /> },
  { id: 'profit-analysis', label: 'الربحية', icon: <PieChart /> },
  { id: 'advanced-analytics', label: 'التحليلات', icon: <TrendingUp /> },
  { id: 'monthly', label: 'تقرير شهري', icon: <TrendingUp /> },
  { id: 'scrap', label: 'تحليل الكسر', icon: <TrendingUp /> },
  { id: 'final', label: 'التقرير النهائي', icon: <BarChart3 /> },
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
    {selected === 'ledger' && <GeneralLedgerView entries={entries} />}
    {selected === 'trial' && <TrialBalanceView entries={balanceEntries} />}
    {selected === 'income' && <IncomeStatementView entries={filteredEntries} />}
    {selected === 'equity' && <EquityStatementView entries={filteredEntries} />}
    {selected === 'balance' && <BalanceSheetView entries={balanceEntries} />}
    {selected === 'inventory' && <InventoryCheckView />}
    {selected === 'lifecycle' && <Phase5CostReportView initialSection="inventory" />}
    {selected === 'profit-analysis' && <Phase5CostReportView initialSection="profit" />}
    {selected === 'advanced-analytics' && <Phase5CostReportView initialSection="profit" />}
    {selected === 'monthly' && <MonthlySalesSummaryReportView entries={filteredEntries} />}
    {selected === 'scrap' && <ScrapAnalysisView entries={filteredEntries} allEntries={entries} />}
    {selected === 'final' && <FinalReportView entries={filteredEntries} balanceEntries={balanceEntries} />}
  </section>;
});
