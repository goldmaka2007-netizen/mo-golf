import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, TrendingUp, Calendar, Landmark, Briefcase, BookOpen, PieChart, Book, BookMarked, RefreshCw, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { exportToExcel } from '../../utils/exportUtils';
import { getMetricValue, getDynamicAccountNature } from '../../utils/accountLogic';
import { parseWeight, normalizeNumerals } from '../../lib/accounting';
import { AccountNature } from '../../types';
import { OPERATION_RULES } from '../../constants';
import { processCostBasis } from '../../lib/engine';
import { IncomeStatementView } from './reports/IncomeStatementView';
import { EquityStatementView } from './reports/EquityStatementView';
import { BalanceSheetView } from './reports/BalanceSheetView';
import { TrialBalanceView } from './reports/TrialBalanceView';
import { GeneralLedgerView } from './reports/GeneralLedgerView';
import { InventoryCheckView } from './InventoryCheckView';
import { FinalReportView } from './reports/FinalReportView';
import { ScrapAnalysisView } from './reports/ScrapAnalysisView';
import { MonthlySalesSummaryReportView } from './reports/MonthlySalesSummaryReportView';
import { InventoryLifecycleView } from './reports/InventoryLifecycleView';
import { ProfitAnalysisView } from './ProfitAnalysisView';
import { AdvancedAnalyticsView } from './AdvancedAnalyticsView';

export const ReportsView = React.memo(() => {
  const { entries, accountsDb, reportsTab, setReportsTab } = useAppStore();
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleFullExport = () => {
    const { goldPrice, silverPrice } = useAppStore.getState();

    // 1. Journal Sheet
    const journalData = filteredEntries.map(e => ({
      "التاريخ": e.date,
      "البيان": e.tx,
      "مدين": e.debit,
      "دائن": e.credit,
      "الوزن": e.weight,
      "النقدي": e.cash,
      "ملاحظات": e.notes || ""
    }));

    // 2. Trial Balance Sheet
    const trialData = accountsDb.map(acc => {
      let balanceCash = 0;
      let balanceGold = 0;
      let balanceSilver = 0;

      balanceEntries.forEach(e => {
        if (e.debit === acc.name) {
          balanceCash += (parseFloat(e.cash) || 0);
          balanceGold += getMetricValue(e, 'gold', accountsDb);
          balanceSilver += getMetricValue(e, 'silver', accountsDb);
        }
        if (e.credit === acc.name) {
          balanceCash -= (parseFloat(e.cash) || 0);
          balanceGold -= getMetricValue(e, 'gold', accountsDb);
          balanceSilver -= getMetricValue(e, 'silver', accountsDb);
        }
      });

      return {
        "الحساب": acc.name,
        "التصنيف": acc.mainType,
        "الحساب الفرعي": acc.subType,
        "الرصيد النقدي": balanceCash,
        "رصيد الذهب (21)": balanceGold,
        "رصيد الفضة": balanceSilver
      };
    }).filter(a => a["الرصيد النقدي"] !== 0 || a["رصيد الذهب (21)"] !== 0 || a["رصيد الفضة"] !== 0);

    // 3. Profit Analysis Sheet (Simplified)
    const costBasis = processCostBasis(entries, accountsDb, goldPrice, silverPrice);
    const profitData = accountsDb.filter(a => a.is_inventory).map(acc => {
      let openingAr = 0;
      let purchAr = 0;
      let salesAr = 0;
      let purchCash = 0;
      let salesCash = 0;

      entries.forEach(e => {
        const isOpening = e.tx.includes("رصيد اول") || e.tx.includes("قيد افتتاحي") || (OPERATION_RULES[e.tx]?.isOpening);
        const w = parseWeight(e.weight);
        const k = e.karat ? String(e.karat) : (acc.karat || '21');
        const m = k === "18" ? 18/21 : (k === "24" ? 24/21 : 1);
        const aw = w * m;
        const opRule = OPERATION_RULES[e.tx || ''];

        if (isOpening && (e.debit === acc.name || e.credit === acc.name)) {
          openingAr += (e.debit === acc.name ? aw : -aw);
        } else if (e.date >= startDate && e.date <= endDate) {
          if (e.debit === acc.name && opRule?.isPurchase) {
            purchAr += aw;
            purchCash += (parseFloat(e.cash) || (aw * costBasis.getCost(acc.name)));
          }
          if (e.credit === acc.name && opRule?.isSale) {
            salesAr += aw;
            salesCash += (parseFloat(e.cash) || 0);
          }
        }
      });

      const closingAr = openingAr + purchAr - salesAr;
      const profit = salesCash - (salesAr * costBasis.getCost(acc.name));

      return {
        "الصنف": acc.name,
        "العيار": acc.karat || "N/A",
        "الافتتاحي": openingAr,
        "المشتريات": purchAr,
        "تكلفة الشراء": purchCash,
        "المبيعات": salesAr,
        "قيمة المبيعات": salesCash,
        "الرصيد الحالي": closingAr,
        "الربح التقديري": profit
      };
    });

    exportToExcel([
      { name: "اليومية العامة", data: journalData },
      { name: "ميزان المراجعة", data: trialData },
      { name: "تحليل الربحية", data: profitData }
    ], `full_financial_report_${endDate}`);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => e.date >= startDate && e.date <= endDate);
  }, [entries, startDate, endDate]);

  const balanceEntries = useMemo(() => {
    return entries.filter(e => e.date <= endDate);
  }, [entries, endDate]);

  const subTabs = [
    { id: 'profit-analysis', label: 'الربحية', icon: <PieChart className="w-4 h-4" /> },
    { id: 'advanced-analytics', label: 'التحليلات المتقدمة', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'final', label: 'التقرير النهائي', icon: <PieChart className="w-4 h-4" /> },
    { id: 'monthly', label: 'تقرير شهري', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'scrap', label: 'تحليل الكسر', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'income', label: 'قائمة الدخل', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'ledger', label: 'الأستاذ', icon: <Book className="w-4 h-4" /> },
    { id: 'trial', label: 'ميزان المراجعة', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'equity', label: 'حقوق الملكية', icon: <Landmark className="w-4 h-4" /> },
    { id: 'balance', label: 'المركز المالي', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'inventory', label: 'جرد المخزون', icon: <PieChart className="w-4 h-4" /> },
    { id: 'lifecycle', label: 'دورة المخزون', icon: <RefreshCw className="w-4 h-4" /> },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Date Range Selector */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-[#5a5548] font-bold uppercase mb-1">
            <Calendar className="w-5 h-5 text-[#c9a84c]" />
            تحديد الفترة الزمنية
          </div>
          <button
            onClick={handleFullExport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#c9a84c1a] text-[#c9a84c] rounded-xl border border-[#c9a84c33] hover:bg-[#c9a84c33] transition-all text-xs font-black"
          >
            <Download className="w-4 h-4" />
            تصدير التقرير الشامل (Excel)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[#c9a84c55] font-bold">من تاريخ</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-lg p-3 text-base text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[#c9a84c55] font-bold">إلى تاريخ</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-lg p-3 text-base text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
            />
          </div>
        </div>
      </div>
      {/* Report Navigation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-[#f5f1e8]">التقارير والتحليلات</h2>
          <span className="text-[10px] font-bold text-[#8a8172]">اختر التقرير المناسب</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportsTab(tab.id as any)}
              className={cn(
                "flex min-h-[72px] flex-col items-start justify-between rounded-2xl border p-3 text-right transition-all active:scale-[0.99]",
                reportsTab === tab.id
                  ? "border-[#c9a84c] bg-[#c9a84c] text-[#080a0f] shadow-lg shadow-[#c9a84c22]"
                  : "border-[#1a1e2a] bg-[#0e1018] text-[#8a8172] hover:border-[#c9a84c33] hover:text-[#f5f1e8]"
              )}
            >
              <span className="opacity-90">{tab.icon}</span>
              <span className="text-xs font-black leading-5">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={reportsTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {reportsTab === 'profit-analysis' && <ProfitAnalysisView />}
            {reportsTab === 'advanced-analytics' && <AdvancedAnalyticsView />}
            {reportsTab === 'final' && <FinalReportView entries={filteredEntries} balanceEntries={balanceEntries} />}
            {reportsTab === 'monthly' && <MonthlySalesSummaryReportView entries={filteredEntries} />}
            {reportsTab === 'scrap' && <ScrapAnalysisView entries={filteredEntries} allEntries={entries} />}
            {reportsTab === 'ledger' && <GeneralLedgerView entries={entries} startDate={startDate} endDate={endDate} />}
            {reportsTab === 'trial' && <TrialBalanceView entries={balanceEntries} />}
            {reportsTab === 'income' && <IncomeStatementView entries={filteredEntries} />}
            {reportsTab === 'equity' && <EquityStatementView entries={filteredEntries} />}
            {reportsTab === 'balance' && <BalanceSheetView entries={balanceEntries} />}
            {reportsTab === 'inventory' && <InventoryCheckView />}
            {reportsTab === 'lifecycle' && <InventoryLifecycleView entries={filteredEntries} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
});


