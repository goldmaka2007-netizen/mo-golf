import { formatWeight } from '../../../lib/formatting';
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Wallet, 
  Scale, 
  Coins,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Download
} from 'lucide-react';
import { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { buildIncomeStatementReport, type IncomeStatementCashBreakdown, type IncomeStatementSection } from '../../../lib/incomeStatementReport';
import { computeAccountBalances } from '../../../lib/engine';
import { buildIncomeStatementExcelSheets } from '../../../lib/incomeStatementExcel';
import { exportToExcel } from '../../../utils/exportUtils';

export const IncomeStatementView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb } = useAppStore();
  const [activeTab, setActiveTab] = useState<'cash' | 'gold' | 'silver' | 'accs'>('cash');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    entries.forEach(e => {
      if (e.date) {
         const ym = e.date.substring(0, 7);
         months.add(ym);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Sort descending
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (selectedMonth === 'all') return entries;
    return entries.filter(e => e.date && e.date.startsWith(selectedMonth));
  }, [entries, selectedMonth]);

  const financials = useMemo(
    () => buildIncomeStatementReport(
      computeAccountBalances(filteredEntries, accountsDb),
      selectedMonth === 'all' ? null : selectedMonth + '-01',
      selectedMonth === 'all' ? null : selectedMonth + '-31',
    ),
    [filteredEntries, accountsDb, selectedMonth],
  );

  const handleExport = () => {
    exportToExcel(
      buildIncomeStatementExcelSheets(financials),
      `قائمة_الدخل_${selectedMonth === 'all' ? 'الكل' : selectedMonth}`,
    );
  };

  const renderLedger = () => {
    const data = financials[activeTab];
    const unitMap = { cash: 'ج.م', gold: 'جم عربي', silver: 'جرام', accs: 'قطعة' };
    const unit = unitMap[activeTab];
    const colorClassMap = { cash: 'text-[#c9a84c]', gold: 'text-[#c9a84c]', silver: 'text-[#6a8a9e]', accs: 'text-[#9e8a6a]' };
    const colorClass = colorClassMap[activeTab];
    const bgGradientMap = {
      cash: 'from-[#1a1e2a] to-[#080a0f] border-[#c9a84c55]',
      gold: 'from-[#1a1e2a] to-[#080a0f] border-[#c9a84c55]',
      silver: 'from-[#1a1e2a] to-[#080a0f] border-[#6a8a9e55]',
      accs: 'from-[#1a1e2a] to-[#080a0f] border-[#9e8a6a55]'
    };
    const bgGradient = bgGradientMap[activeTab];
    const displayWeight = (value: number) => Number.isFinite(value) && value > 0 ? formatWeight(value) : '—';
    const formatAverage = (value: number | null) => value !== null && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
    const formatCount = (value: number) => Number.isFinite(value) && value > 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—';
    const formatCash = (value: number) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';

    const cashCells = (metrics: IncomeStatementCashBreakdown, amount: number, strong = false) => (
      <>
        <span className={cn('text-left font-mono text-[#ddd8cc]', strong && 'font-bold')}>{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span className="text-center font-mono">{displayWeight(metrics.goldWeight)}</span>
        <span className="text-center font-mono">{formatAverage(metrics.goldAverage)}</span>
        <span className="text-center font-mono">{displayWeight(metrics.silverWeight)}</span>
        <span className="text-center font-mono">{formatAverage(metrics.silverAverage)}</span>
        <span className="text-center font-mono">{formatCount(metrics.accessoryCount)}</span>
      </>
    );

    const renderSection = (title: string, groupData: IncomeStatementSection, icon: React.ReactNode, colClass: string) => (
      <div className="space-y-4">
        <div className={cn('flex items-center gap-2 border-b border-[#1a1e2a] pb-2', colClass)}>
          {icon}
          <h4 className="text-lg font-bold">{title}</h4>
        </div>

        {activeTab === 'cash' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[920px] space-y-4">
              <div className="grid grid-cols-[minmax(220px,1fr)_120px_100px_110px_100px_110px_100px] gap-2 px-2 text-[11px] font-bold text-[#5a5548]">
                <span>البيان</span>
                <span className="text-left">المبلغ</span>
                <span className="text-center">وزن الذهب</span>
                <span className="text-center">متوسط الذهب</span>
                <span className="text-center">وزن الفضة</span>
                <span className="text-center">متوسط الفضة</span>
                <span className="text-center">عدد الملحقات</span>
              </div>
              {Object.entries(groupData.categories).map(([catName, catData]) => (
                <div key={catName} className="space-y-2">
                  <div className={cn('grid grid-cols-[minmax(220px,1fr)_120px_100px_110px_100px_110px_100px] items-center gap-2 rounded-xl bg-[#1a1e2a]/30 p-2 text-sm font-bold', colClass)}>
                    <span className="text-[#ddd8cc]">{catName}</span>
                    {cashCells(catData, catData.total, true)}
                  </div>
                  <div className="space-y-1 border-r border-[#1a1e2a] pr-4">
                    {catData.details.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-[minmax(204px,1fr)_120px_100px_110px_100px_110px_100px] items-center gap-2 rounded-lg p-1.5 text-xs text-[#5a5548] transition-colors hover:bg-[#1a1e2a]/50">
                        <span className="font-bold">{item.name}</span>
                        {cashCells(item, item.val)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(groupData.categories).length === 0 && <div className="py-4 text-center text-sm text-[#5a5548]">لا توجد حركات في هذا القسم</div>}
              <div className={cn('grid grid-cols-[minmax(220px,1fr)_120px_100px_110px_100px_110px_100px] items-center gap-2 border-t border-[#c9a84c33] px-2 pt-3 text-sm font-bold', colClass)}>
                <span>إجمالي {title.split(' ')[0]}</span>
                {cashCells(groupData, groupData.total, true)}
              </div>
              <p className="px-2 text-[10px] text-[#5a5548]">أوزان الذهب محسوبة كجرام مكافئ عيار 21، والفضة بالجرام الفعلي. الإيرادات الأخرى تظهر في المبلغ فقط.</p>
            </div>
          </div>
        ) : activeTab === 'gold' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1 px-1 text-[10px] font-bold text-[#5a5548] sm:gap-2 sm:px-2 sm:text-xs">
              <span>العملية</span>
              <span className="text-center">الوزن</span>
              <span className="text-center">النقدية</span>
              <span className="text-center">سعر الجرام</span>
            </div>
            {Object.entries(groupData.categories).map(([catName, catData]) => (
              <div key={catName} className="space-y-2">
                <div className={cn('grid grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 rounded-xl bg-[#1a1e2a]/30 p-2 text-[11px] font-bold sm:gap-2 sm:text-sm', colClass)}>
                  <span className="min-w-0 break-words text-[#ddd8cc]">{catName}</span>
                  <span className="text-center font-mono">{displayWeight(catData.total)} <span className="text-[9px] sm:text-[10px]">جم عربي</span></span>
                  <span className="text-center font-mono">{formatCash(catData.goldAmount)} <span className="text-[9px] sm:text-[10px]">ج.م</span></span>
                  <span className="text-center font-mono">{formatAverage(catData.goldAverage)} <span className="text-[9px] sm:text-[10px]">ج.م/جم</span></span>
                </div>
                <div className="space-y-1 border-r border-[#1a1e2a] pr-2 sm:pr-4">
                  {catData.details.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 rounded-lg p-1.5 text-[10px] text-[#5a5548] transition-colors hover:bg-[#1a1e2a]/50 sm:gap-2 sm:text-xs">
                      <span className="min-w-0 break-words font-bold">{item.name}</span>
                      <span className="text-center font-mono">{displayWeight(item.val)} <span className="text-[8px] sm:text-[10px]">جم عربي</span></span>
                      <span className="text-center font-mono">{formatCash(item.goldAmount)} <span className="text-[8px] sm:text-[10px]">ج.م</span></span>
                      <span className="text-center font-mono">{formatAverage(item.goldAverage)} <span className="text-[8px] sm:text-[10px]">ج.م/جم</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(groupData.categories).length === 0 && <div className="py-4 text-center text-sm text-[#5a5548]">لا توجد حركات في هذا القسم</div>}
            <div className={cn('grid grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 border-t border-[#c9a84c33] px-1 pt-3 text-[11px] font-bold sm:gap-2 sm:px-2 sm:text-sm', colClass)}>
              <span className="min-w-0 break-words">إجمالي {title.split(' ')[0]}</span>
              <span className="text-center font-mono">{displayWeight(groupData.total)} <span className="text-[9px] sm:text-[10px]">جم عربي</span></span>
              <span className="text-center font-mono">{formatCash(groupData.goldAmount)} <span className="text-[9px] sm:text-[10px]">ج.م</span></span>
              <span className="text-center font-mono">{formatAverage(groupData.goldAverage)} <span className="text-[9px] sm:text-[10px]">ج.م/جم</span></span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupData.categories).map(([catName, catData]) => (
              <div key={catName} className="space-y-2">
                <div className={cn('flex items-center rounded-xl bg-[#1a1e2a]/30 p-2 text-sm font-bold', colClass)}>
                  <span className="flex-1 text-[#ddd8cc]">{catName}</span>
                  <span>{catData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {unit}</span>
                </div>
                <div className="space-y-1 border-r border-[#1a1e2a] pr-4">
                  {catData.details.map((item, idx) => (
                    <div key={idx} className="flex items-center rounded-lg p-1.5 text-xs text-[#5a5548] transition-colors hover:bg-[#1a1e2a]/50">
                      <span className="flex-1 font-bold">{item.name}</span>
                      <span className="font-mono">{item.val.toLocaleString(undefined, { minimumFractionDigits: 2 })} {unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(groupData.categories).length === 0 && <div className="py-4 text-center text-sm text-[#5a5548]">لا توجد حركات في هذا القسم</div>}
            <div className={cn('flex items-center border-t border-[#c9a84c33] pt-3 text-sm font-bold', colClass)}>
              <span className="flex-1">إجمالي {title.split(' ')[0]}</span>
              <span className="font-mono">{groupData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {unit}</span>
            </div>
          </div>
        )}
      </div>
    );

    return (
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-8 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 shadow-xl sm:p-6"
      >
        {renderSection('الإيرادات (الداخل الزائد)', data.revenue, <ArrowUpRight className="h-5 w-5" />, 'text-[#6a9e6a]')}
        {renderSection('المصروفات (الخارج المنصرف)', data.expenses, <ArrowDownLeft className="h-5 w-5" />, 'text-[#9e6a6a]')}

        <div className={cn('flex items-center justify-between rounded-2xl border bg-gradient-to-br p-5 shadow-xl', bgGradient)}>
          <div className="flex flex-col">
            <span className={cn('text-base font-bold uppercase tracking-wider md:text-lg', colorClass)}>صافي رصيد الدخل ({activeTab === 'cash' ? 'نقدي' : 'أوزان'})</span>
            <span className="text-sm text-[#5a5548]">للفترة المحددة بناءً على الحركات</span>
          </div>
          <span className={cn('font-mono text-3xl font-bold md:text-5xl', data.net >= 0 ? colorClass : 'text-[#9e6a6a]')}>
            {data.net.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0e1018] p-4 rounded-2xl border border-[#1a1e2a]">
        <div>
          <h3 className="font-bold text-[#ddd8cc] flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-[#c9a84c]" />
            قائمة الدخل
          </h3>
          <p className="text-[#5a5548] text-xs mt-1">عرض ملخص الإيرادات والمصروفات حسب الدفتر (مبني على الأساس النقدي Cash-Basis)</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center justify-center gap-2 bg-[#1a1e2a] hover:bg-[#c9a84c] hover:text-[#080a0f] text-[#c9a84c] px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-[#c9a84c33] hover:border-[#c9a84c] w-full sm:w-auto"
        >
          <Download className="w-4 h-4" />
          {selectedMonth === 'all' 
            ? 'تصدير Excel (الكل)' 
            : `تصدير Excel (${format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ar })})`}
        </button>
      </div>

      {availableMonths.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          <button
            onClick={() => setSelectedMonth('all')}
            className={cn(
              "whitespace-nowrap px-6 py-3 rounded-xl text-sm font-bold transition-all snap-start shadow-sm border",
              selectedMonth === 'all' 
                ? "bg-[#c9a84c] text-[#080a0f] border-[#c9a84c]" 
                : "bg-[#0e1018] text-[#5a5548] border-[#1a1e2a] hover:border-[#c9a84c55] hover:text-[#ddd8cc]"
            )}
          >
            الكل
          </button>
          {availableMonths.map(ym => {
            const dateObj = parseISO(ym + '-01');
            const label = format(dateObj, 'MMMM yyyy', { locale: ar });
            return (
              <button
                key={ym}
                onClick={() => setSelectedMonth(ym)}
                className={cn(
                  "whitespace-nowrap px-6 py-3 rounded-xl text-sm font-bold transition-all snap-start shadow-sm border capitalize",
                  selectedMonth === ym 
                    ? "bg-[#c9a84c] text-[#080a0f] border-[#c9a84c]" 
                    : "bg-[#0e1018] text-[#5a5548] border-[#1a1e2a] hover:border-[#c9a84c55] hover:text-[#ddd8cc]"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 p-1 bg-[#0e1018] border border-[#1a1e2a] rounded-2xl shadow-lg">
        <button onClick={() => setActiveTab('cash')} className={cn("flex-1 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'cash' ? "bg-[#c9a84c] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Wallet className="w-5 h-5" /> الدخل النقدي
        </button>
        <button onClick={() => setActiveTab('gold')} className={cn("flex-1 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'gold' ? "bg-[#c9a84c] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Scale className="w-5 h-5" /> دخل الذهب
        </button>
        <button onClick={() => setActiveTab('silver')} className={cn("flex-1 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'silver' ? "bg-[#6a8a9e] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Coins className="w-5 h-5" /> دخل الفضة
        </button>
        <button onClick={() => setActiveTab('accs')} className={cn("flex-1 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'accs' ? "bg-[#9e8a6a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Package className="w-5 h-5" /> دخل الملحقات
        </button>
      </div>

      <AnimatePresence mode="wait">
        {renderLedger()}
      </AnimatePresence>
    </div>
  );
});
