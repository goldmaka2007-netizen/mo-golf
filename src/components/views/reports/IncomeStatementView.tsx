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
import { buildIncomeStatementReport } from '../../../lib/incomeStatementReport';
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
    () => buildIncomeStatementReport(filteredEntries, accountsDb),
    [filteredEntries, accountsDb],
  );

  const handleExport = () => {
    const unitMap = { cash: 'ج.م', gold: 'جم عربي', silver: 'جرام', accs: 'قطعة' };
    const tabNames = { cash: 'نقدي', gold: 'ذهب', silver: 'فضة', accs: 'ملحقات' };
    const sheets: { name: string, data: any[] }[] = [];

    (['cash', 'gold', 'silver', 'accs'] as const).forEach((tab) => {
      const data = financials[tab];
      const rows: any[] = [];
      const unit = unitMap[tab];

      const processSection = (sectionName: string, groupData: any) => {
        Object.entries(groupData.categories).forEach(([sub, cat]: [string, any]) => {
          cat.details.forEach((d: any) => {
            if (tab === 'cash') {
              rows.push({
                "التصنيف الرئيسي": sectionName,
                "التصنيف الفرعي": sub,
                "الحساب": d.name,
                "الوزن (جم/قطعة)": d.weight || 0,
                "متوسط السعر": d.weight > 0 ? (d.val / d.weight).toFixed(2) : "-",
                [`القيمة (${unit})`]: d.val,
              });
            } else {
              rows.push({
                "التصنيف الرئيسي": sectionName,
                "التصنيف الفرعي": sub,
                "الحساب": d.name,
                [`القيمة (${unit})`]: d.val,
              });
            }
          });
          
          if (tab === 'cash') {
            rows.push({
              "التصنيف الرئيسي": `إجمالي ${sub}`,
              "التصنيف الفرعي": "",
              "الحساب": "",
              "الوزن (جم/قطعة)": cat.totalWeight || 0,
              "متوسط السعر": cat.totalWeight > 0 ? (cat.total / cat.totalWeight).toFixed(2) : "-",
              [`القيمة (${unit})`]: cat.total,
            });
          } else {
            rows.push({
              "التصنيف الرئيسي": `إجمالي ${sub}`,
              "التصنيف الفرعي": "",
              "الحساب": "",
              [`القيمة (${unit})`]: cat.total,
            });
          }
          rows.push({ "التصنيف الرئيسي": "" }); // Empty row spacer
        });
        
        let sectionTotalRow: any = {
          "التصنيف الرئيسي": `إجمالي ${sectionName}`,
          "التصنيف الفرعي": "",
          "الحساب": "",
        };
        
        if (tab === 'cash') {
          sectionTotalRow["الوزن (جم/قطعة)"] = "";
          sectionTotalRow["متوسط السعر"] = "";
        }
        sectionTotalRow[`القيمة (${unit})`] = groupData.total;

        rows.push(sectionTotalRow);
        rows.push({ "التصنيف الرئيسي": "" }); // Empty row spacer
      };

      processSection('الإيرادات', data.revenue);
      processSection('المصروفات', data.expenses);
      
      let netRow: any = {
        "التصنيف الرئيسي": "صافي الربح / الخسارة",
        "التصنيف الفرعي": "",
        "الحساب": "",
      };
      
      if (tab === 'cash') {
        netRow["الوزن (جم/قطعة)"] = "";
        netRow["متوسط السعر"] = "";
      }
      netRow[`القيمة (${unit})`] = data.net;

      rows.push(netRow);

      sheets.push({ name: `قائمة الدخل - ${tabNames[tab]}`, data: rows });
    });

    exportToExcel(sheets, `قائمة_الدخل_${selectedMonth === 'all' ? 'الكل' : selectedMonth}`);
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

    const renderSection = (title: string, groupData: any, icon: any, colClass: string) => (
      <div className="space-y-4">
        <div className={cn("flex items-center gap-2 border-b border-[#1a1e2a] pb-2", colClass)}>
          {icon}
          <h4 className="text-lg font-bold">{title}</h4>
        </div>
        
        {activeTab === 'cash' && (
          <div className="flex text-[10px] sm:text-xs font-bold text-[#5a5548] px-2 mb-2 uppercase tracking-widest pl-4">
            <div className="flex-1">البيان</div>
            <div className="w-16 sm:w-20 text-center">الوزن</div>
            <div className="w-16 sm:w-20 text-center">المتوسط</div>
            <div className="w-20 sm:w-28 text-left">المبلغ</div>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(groupData.categories).map(([catName, catData]: any) => (
            <div key={catName} className="space-y-2">
              <div className={cn("flex items-center text-sm sm:text-base font-bold bg-[#1a1e2a]/30 p-2 rounded-xl", colClass)}>
                <span className="flex-1 text-[#ddd8cc]">{catName}</span>
                {activeTab === 'cash' ? (
                  <>
                    <span className="w-16 sm:w-20 text-center text-xs font-mono text-[#8a8578]">{catData.totalWeight > 0 ? catData.totalWeight.toFixed(2) : '-'}</span>
                    <span className="w-16 sm:w-20 text-center text-xs font-mono text-[#8a8578]">{catData.totalWeight > 0 ? (catData.total / catData.totalWeight).toFixed(0) : '-'}</span>
                    <span className="w-20 sm:w-28 text-left">{catData.total.toLocaleString(undefined, {minimumFractionDigits: 0})} {unit}</span>
                  </>
                ) : (
                  <span>{catData.total.toLocaleString(undefined, {minimumFractionDigits: 2})} {unit}</span>
                )}
              </div>
              <div className="pr-4 border-r border-[#1a1e2a] space-y-1">
                {catData.details.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center text-xs sm:text-sm text-[#5a5548] hover:bg-[#1a1e2a]/50 p-1.5 rounded-lg transition-colors">
                    <span className="flex-1 font-bold">{item.name}</span>
                    {activeTab === 'cash' ? (
                      <>
                        <span className="w-16 sm:w-20 text-center font-mono opacity-80">{item.weight > 0 ? item.weight.toFixed(2) : '-'}</span>
                        <span className="w-16 sm:w-20 text-center font-mono opacity-80">{item.weight > 0 ? (item.val / item.weight).toFixed(0) : '-'}</span>
                        <span className="w-20 sm:w-28 text-left font-mono font-bold text-[#ddd8cc]">
                          {item.val.toLocaleString(undefined, {minimumFractionDigits: 0})}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono">{item.val.toLocaleString(undefined, {minimumFractionDigits: 2})} {unit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(groupData.categories).length === 0 && (
            <div className="text-center py-4 text-[#5a5548] text-sm">لا توجد حركات في هذا القسم مخصصة لل{activeTab === 'cash' ? 'نقدية' : (activeTab === 'gold' ? 'ذهب' : 'فضة')}</div>
          )}
          <div className={cn("pt-3 mt-2 border-t border-[#c9a84c33] flex items-center text-sm sm:text-lg font-bold", colClass)}>
            <span className="flex-1">إجمالي {title.split(' ')[0]}</span>
            {activeTab === 'cash' ? (
              (() => {
                const totalCatsWeight = Object.values(groupData.categories).reduce((sum: number, cat: any) => sum + (cat.totalWeight || 0), 0) as number;
                return (
                  <>
                    <span className="w-16 sm:w-20 text-center text-xs sm:text-sm font-mono opacity-80">
                      {totalCatsWeight > 0 ? totalCatsWeight.toFixed(2) : '-'}
                    </span>
                    <span className="w-16 sm:w-20 text-center text-xs sm:text-sm font-mono opacity-80">
                      {totalCatsWeight > 0 ? (groupData.total / totalCatsWeight).toFixed(0) : '-'}
                    </span>
                    <span className="w-20 sm:w-28 text-left font-mono">{groupData.total.toLocaleString(undefined, {minimumFractionDigits: 0})} {unit}</span>
                  </>
                );
              })()
            ) : (
              <span className="font-mono">{groupData.total.toLocaleString(undefined, {minimumFractionDigits: 2})} {unit}</span>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 space-y-8 shadow-xl"
      >
        {renderSection("الإيرادات (الداخل الزائد)", data.revenue, <ArrowUpRight className="w-5 h-5" />, "text-[#6a9e6a]")}
        {renderSection("المصروفات (الخارج المنصرف)", data.expenses, <ArrowDownLeft className="w-5 h-5" />, "text-[#9e6a6a]")}

        <div className={cn("bg-gradient-to-br border p-5 rounded-2xl flex justify-between items-center shadow-xl", bgGradient)}>
          <div className="flex flex-col">
            <span className={cn("text-base md:text-lg font-bold uppercase tracking-wider", colorClass)}>صافي رصيد الدخل ({activeTab === 'cash' ? 'نقدي' : 'أوزان'})</span>
            <span className="text-sm text-[#5a5548]">للفترة المحددة بناءً على الحركات</span>
            {activeTab === 'cash' && (
              <span className="text-[10px] text-blue-400 mt-1 max-w-sm">
                ملاحظة: هذا الصافي يمثل صافي التدفقات النقدية التشغيلية (الأساس النقدي). تكلفة البضاعة المباعة (COGS) الفعلية تتطلب حساب متوسط تكلفة المخزون.
              </span>
            )}
          </div>
          <span className={cn("text-4xl md:text-5xl font-bold font-mono", data.net >= 0 ? colorClass : "text-[#9e6a6a]")}>
            {data.net.toLocaleString(undefined, {minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2})} {unit}
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
