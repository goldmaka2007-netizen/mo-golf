import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  ShieldCheck, 
  Scale, 
  Wallet,
  Landmark,
  Coins,
  Package,
  Download
} from 'lucide-react';
import { Entry, AccountNature } from '../../../types';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { getDynamicAccountNature, belongsToMetric, getMetricValue, getAccountTypeDetails, getMetricActualValue } from '../../../utils/accountLogic';
import { parseWeight } from '../../../lib/accounting';
import { exportToExcel } from '../../../utils/exportUtils';

type LedgerType = 'cash' | 'gold' | 'silver' | 'accs';

export const BalanceSheetView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountCategories, accountsDb } = useAppStore();
  const [activeTab, setActiveTab] = useState<LedgerType>('gold');

  const balanceSheet = useMemo(() => {
    const createLedger = (metric: LedgerType) => {
      const assetsCats: Record<string, { total: number; totalCount: number; details: { name: string; val: number; actualVal: number; countVal: number }[] }> = {};
      const liabilitiesCats: Record<string, { total: number; totalCount: number; details: { name: string; val: number; actualVal: number; countVal: number }[] }> = {};
      const equityCats: Record<string, { total: number; totalCount: number; details: { name: string; val: number; actualVal: number; countVal: number }[] }> = {};
      
      let totalAss = 0;
      let totalLiab = 0;
      let totalEquity = 0;

      // 1. Accumulate Account Balances
      const accountBalances: Record<string, number> = {};
      const actualBalances: Record<string, number> = {};

      entries.forEach(entry => {
        const val = getMetricValue(entry, metric, accountsDb);
        const actualVal = (metric === 'gold' || metric === 'silver' || metric === 'accs') 
          ? getMetricActualValue(entry, metric as any, accountsDb) 
          : val;

        if (val === 0 && actualVal === 0) return;

        if (belongsToMetric(entry.debit, metric, accountsDb)) {
          accountBalances[entry.debit] = (accountBalances[entry.debit] || 0) + val;
          actualBalances[entry.debit] = (actualBalances[entry.debit] || 0) + actualVal;
        }
        if (belongsToMetric(entry.credit, metric, accountsDb)) {
          accountBalances[entry.credit] = (accountBalances[entry.credit] || 0) - val;
          actualBalances[entry.credit] = (actualBalances[entry.credit] || 0) - actualVal;
        }
      });

      // 2. Classify Accounts
      Object.entries(accountBalances).forEach(([account, balance]) => {
        const actualBalance = actualBalances[account] || 0;
        
        let correctedBalance = balance;
        // Fix for ghost balances: if the physical weight is 0 (or close to 0 due to precision), 
        // force the Arabic conversion balance to 0 so we don't end up with e.g. -0.03 in balance sheet.
        if ((metric === 'gold' || metric === 'silver') && Math.abs(actualBalance) < 0.001) {
            correctedBalance = 0;
        }

        if (Math.abs(correctedBalance) < 0.00001 && Math.abs(actualBalance) < 0.00001) return;
        
        const details = getAccountTypeDetails(account, accountsDb);
        let finalVal = 0;
        let finalActual = 0;
        let targetGroup: any = null;

        if (details.main === 'assets') {
          targetGroup = assetsCats;
          finalVal = correctedBalance;
          finalActual = actualBalance;
        } else if (details.main === 'liabilities') {
          targetGroup = liabilitiesCats;
          finalVal = -correctedBalance;
          finalActual = -actualBalance;
        } else if (details.main === 'equity') {
          targetGroup = equityCats;
          finalVal = -correctedBalance;
          finalActual = -actualBalance;
        }

        if (targetGroup) {
          if (!targetGroup[details.sub]) targetGroup[details.sub] = { total: 0, totalCount: 0, details: [] };
          
          const displayVal = finalVal;

          targetGroup[details.sub].details.push({ 
            name: account, 
            val: displayVal, 
            actualVal: finalActual, 
            countVal: 0 
          });
          targetGroup[details.sub].total += displayVal;
          
          if (details.main === 'assets') totalAss += displayVal;
          else if (details.main === 'liabilities') totalLiab += displayVal;
          else totalEquity += displayVal;
        }
      });

      // 3. Calculate Net Profit/Loss (Consistent with Income/Equity Statements)
      let totalRev = 0;
      let totalExp = 0;

      entries.forEach(entry => {
        const val = getMetricValue(entry, metric, accountsDb);
        const actualVal = (metric === 'gold' || metric === 'silver' || metric === 'accs') 
          ? getMetricActualValue(entry, metric as any, accountsDb) 
          : val;
          
        if (val === 0 && actualVal === 0) return;

        const debitDetails = getAccountTypeDetails(entry.debit, accountsDb);
        const creditDetails = getAccountTypeDetails(entry.credit, accountsDb);
        const currentVal = val;

        // Standard Revenue/Expense
        if (belongsToMetric(entry.credit, metric, accountsDb) && creditDetails.main === 'revenue') totalRev += currentVal;
        if (belongsToMetric(entry.debit, metric, accountsDb) && debitDetails.main === 'expenses') totalExp += currentVal;

        // Trade flows
        if (metric === 'cash') {
          const isGold = (acc: string) => belongsToMetric(acc, 'gold', accountsDb);
          const isSilver = (acc: string) => belongsToMetric(acc, 'silver', accountsDb);
          const isAccs = (acc: string) => belongsToMetric(acc, 'accs', accountsDb);
          const isProduct = (acc: string) => isGold(acc) || isSilver(acc) || isAccs(acc);

          if (belongsToMetric(entry.debit, 'cash', accountsDb) && isProduct(entry.credit) && creditDetails.main === 'assets') totalRev += val;
          if (belongsToMetric(entry.credit, 'cash', accountsDb) && isProduct(entry.debit) && debitDetails.main === 'assets') totalExp += val;
        } else if (metric === 'gold' || metric === 'silver') {
          if (belongsToMetric(entry.debit, metric, accountsDb) && debitDetails.main === 'assets' && !belongsToMetric(entry.credit, metric, accountsDb)) totalRev += currentVal;
          if (belongsToMetric(entry.credit, metric, accountsDb) && creditDetails.main === 'assets' && !belongsToMetric(entry.debit, metric, accountsDb)) totalExp += currentVal;
        } else if (metric === 'accs') {
          // Accessories trade (if any accessories weight/count is tracked as asset)
          if (belongsToMetric(entry.debit, 'accs', accountsDb) && debitDetails.main === 'assets' && !belongsToMetric(entry.credit, 'accs', accountsDb)) totalRev += currentVal;
          if (belongsToMetric(entry.credit, 'accs', accountsDb) && creditDetails.main === 'assets' && !belongsToMetric(entry.debit, 'accs', accountsDb)) totalExp += currentVal;
        }
      });

      const metricProLoss = totalRev - totalExp;

      // Inject Net Profit into Equity
      if (Math.abs(metricProLoss) > 0.00001) {
        const label = metricProLoss >= 0 ? "صافي نتائج أعمال الفترة (أرباح)" : "صافي نتائج أعمال الفترة (خسائر)";
        if (!equityCats["نتائج الأعمال"]) equityCats["نتائج الأعمال"] = { total: 0, totalCount: 0, details: [] };
        equityCats["نتائج الأعمال"].details.push({ 
          name: label, 
          val: metricProLoss, 
          actualVal: metricProLoss, // Profits are usually in the unified unit or just numeric
          countVal: 0 
        });
        equityCats["نتائج الأعمال"].total += metricProLoss;
        totalEquity += metricProLoss;
      }

      const sortCats = (cats: Record<string, { details: { val: number }[] }>) => {
        Object.values(cats).forEach((cat) => {
          cat.details.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));
        });
      };

      sortCats(assetsCats);
      sortCats(liabilitiesCats);
      sortCats(equityCats);

      return {
        assets: { categories: assetsCats, total: totalAss, totalCount: 0 },
        liabilities: { categories: liabilitiesCats, total: totalLiab, totalCount: 0 },
        equity: { categories: equityCats, total: totalEquity, totalCount: 0 },
        uncategorized: []
      };
    };

    return {
      cash: createLedger('cash'),
      gold: createLedger('gold'),
      silver: createLedger('silver'),
      accs: createLedger('accs')
    };
  }, [entries, accountsDb]);

  const handleExport = () => {
    const unitMap = { cash: 'ج.م', gold: 'جم عربي', silver: 'جرام', accs: 'قطعة' };
    const tabNames = { cash: 'نقدي', gold: 'ذهب', silver: 'فضة', accs: 'ملحقات' };
    const sheets: { name: string, data: any[] }[] = [];

    (['cash', 'gold', 'silver', 'accs'] as const).forEach(tab => {
      const data = balanceSheet[tab];
      const rows: any[] = [];
      const unit = unitMap[tab];

      const processSection = (sectionName: string, groupData: any) => {
        Object.entries(groupData.categories).forEach(([sub, cat]: [string, any]) => {
          cat.details.forEach((d: any) => {
            rows.push({
              "التصنيف الرئيسي": sectionName,
              "التصنيف الفرعي": sub,
              "الحساب": d.name,
              [`الرصيد (${unit})`]: d.val,
            });
          });
          
          rows.push({
            "التصنيف الرئيسي": `إجمالي ${sub}`,
            "التصنيف الفرعي": "",
            "الحساب": "",
            [`الرصيد (${unit})`]: cat.total,
          });
          rows.push({ "التصنيف الرئيسي": "" }); // Empty row spacer
        });
        
        rows.push({
          "التصنيف الرئيسي": `إجمالي ${sectionName}`,
          "التصنيف الفرعي": "",
          "الحساب": "",
          [`الرصيد (${unit})`]: groupData.total,
        });
        rows.push({ "التصنيف الرئيسي": "" }); // Empty row spacer
      };

      processSection('الأصول', data.assets);
      processSection('الخصوم / الالتزامات', data.liabilities);
      processSection('حقوق الملكية', data.equity);

      sheets.push({ name: `المركز المالي - ${tabNames[tab]}`, data: rows });
    });

    exportToExcel(sheets, 'المركز_المالي');
  };

  const renderSection = (title: string, data: any, icon: any, colorClass: string, unit: string) => (
    <div className="space-y-4">
      <div className={cn("flex items-center gap-2 border-b border-[#1a1e2a] pb-2", colorClass)}>
        {icon}
        <h4 className="text-base font-bold">{title}</h4>
      </div>
      <div className="space-y-4">
        {Object.entries(data.categories).map(([catName, catData]: any) => (
          <div key={catName} className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 space-y-3 shadow-md hover:border-[#c9a84c33] transition-all">
            <div className="flex justify-between items-center bg-[#1a1e2a]/30 p-2 rounded-xl border border-[#1a1e2a]/50">
              <span className="text-sm font-bold text-[#c9a84c]">{catName}</span>
              <div className="flex gap-4">
                {catData.totalCount !== 0 && activeTab !== 'cash' && (
                  <span className="text-sm font-bold text-[#8a8578]">
                    {catData.totalCount} <span className="text-xs text-[#5a5548] font-sans ml-1">قطعة</span>
                  </span>
                )}
                <span className="text-base font-bold text-[#ddd8cc]">
                  {catData.total.toLocaleString(undefined, {minimumFractionDigits: unit === 'ج.م' || unit === 'قطعة' ? 0 : 2, maximumFractionDigits: 2})} <span className="text-xs text-[#5a5548] font-sans ml-1">{unit}</span>
                </span>
              </div>
            </div>
            <div className="space-y-1 pr-3 border-r-2 border-[#1a1e2a]">
              {catData.details.map((item: any) => (
                <div key={item.name} className="flex justify-between text-xs hover:bg-[#1a1e2a]/20 p-1.5 rounded-lg transition-colors">
                  <span className="text-[#8a8578] font-bold flex-1">{item.name}</span>
                  <div className="flex gap-4">
                    {item.countVal !== 0 && activeTab !== 'cash' && (
                       <span className="text-[#8a8578] font-mono font-bold">
                         {item.countVal} <span className="text-[10px] font-sans">قطعة</span>
                       </span>
                    )}
                    <span className="text-[#ddd8cc] font-mono font-bold min-w-[60px] text-left">
                      {item.val.toLocaleString(undefined, {minimumFractionDigits: unit === 'ج.م' || unit === 'قطعة' ? 0 : 2, maximumFractionDigits: 2})}
                      {(activeTab === 'gold' && Math.abs(item.val - (item.actualVal || 0)) > 0.01) && (
                        <span className="text-[10px] text-[#5a5548] mr-1">
                          ({(item.actualVal || 0).toFixed(2)} جرام فعلي)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(data.categories).length === 0 && (
          <div className="text-center py-6 text-[#5a5548] text-xs border border-dashed border-[#1a1e2a] rounded-2xl">لا توجد حركات في هذا القسم</div>
        )}
        <div className={cn("p-4 rounded-xl flex justify-between items-center shadow-lg", colorClass.replace('text-', 'bg-').concat(' bg-opacity-10 border border-opacity-20 ').concat(colorClass.replace('text-', 'border-')))}>
          <span className="text-sm font-bold uppercase tracking-widest text-[#ddd8cc]">إجمالي {title}</span>
          <div className="flex gap-4 items-center">
            {data.totalCount !== 0 && activeTab !== 'cash' && (
              <span className="text-xl font-bold font-mono text-[#8a8578]">
                {data.totalCount} <span className="text-xs font-sans opacity-75">قطعة</span>
              </span>
            )}
            <span className="text-2xl font-bold font-mono text-[#ddd8cc]">
              {data.total.toLocaleString(undefined, {minimumFractionDigits: unit === 'ج.م' || unit === 'قطعة' ? 0 : 2, maximumFractionDigits: 2})} <span className="text-sm font-sans opacity-75">{unit}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentLedger = () => {
    const data = balanceSheet[activeTab];
    let unit = 'ج.م';
    let accent = 'text-[#c9a84c]';
    let title = '';
    
    if (activeTab === 'cash') { unit = 'ج.م'; accent = 'text-[#6a9e6a]'; title = 'نقدية (الأموال)'; }
    if (activeTab === 'gold') { 
      unit = 'ع'; 
      accent = 'text-[#c9a84c]'; 
      title = `ذهب (عيار ٢١)`; 
    }
    if (activeTab === 'silver') { unit = 'جرام'; accent = 'text-[#6a8a9e]'; title = 'فضة'; }
    if (activeTab === 'accs') { unit = 'قطعة'; accent = 'text-[#9e8a6a]'; title = 'ملحقات (عدد القطع)'; }

    return (
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-10"
      >
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className={cn("flex-1 bg-[#0e1018] p-4 rounded-xl border border-[#1a1e2a] text-center text-[10px] text-[#5a5548] shadow-inner")}>
            هذا الجرد مخصص لحركة <span className={cn("font-bold", accent)}>{title}</span> المعزولة في الأصول، الخصوم وحقوق الملكية
          </div>
        </div>

        {renderSection("الأصول (Assets)", data.assets, <Briefcase className="w-5 h-5" />, accent, unit)}
        {renderSection("الخصوم / الالتزامات (Liabilities)", data.liabilities, <ShieldCheck className="w-5 h-5" />, "text-[#9e6a6a]", unit)}
        {renderSection("حقوق الملكية (Equity)", data.equity, <Landmark className="w-5 h-5" />, "text-[#8a6820]", unit)}

        {data.uncategorized.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-red-500">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="text-sm font-bold">حسابات غير مصنفة</h4>
            </div>
            {data.uncategorized.map((item: any) => (
              <div key={item.name} className="flex justify-between text-xs text-red-400">
                <span>{item.name}</span>
                <span>{item.val.toLocaleString(undefined, {minimumFractionDigits: unit === 'ج.م' || unit === 'قطعة' ? 0 : 2, maximumFractionDigits: 2})} {unit}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0e1018] p-4 rounded-2xl border border-[#1a1e2a]">
        <div>
          <h3 className="font-bold text-[#ddd8cc] flex items-center gap-2 text-lg">
            <Briefcase className="w-5 h-5 text-[#c9a84c]" />
            المركز المالي
          </h3>
          <p className="text-[#5a5548] text-xs mt-1">عرض الأصول والخصوم وحقوق الملكية بشكل مفصل</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center justify-center gap-2 bg-[#1a1e2a] hover:bg-[#c9a84c] hover:text-[#080a0f] text-[#c9a84c] px-5 py-2.5 rounded-xl text-sm font-bold transition-all border border-[#c9a84c33] hover:border-[#c9a84c] w-full sm:w-auto"
        >
          <Download className="w-4 h-4" />
          تصدير Excel (الكل)
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0e1018] border border-[#1a1e2a] p-2 rounded-2xl shadow-lg">
        <button onClick={() => setActiveTab('gold')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'gold' ? "bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Scale className="w-4 h-4" /> مخزون الذهب
        </button>
        <button onClick={() => setActiveTab('silver')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'silver' ? "bg-gradient-to-r from-[#6a8a9e] to-[#4a6a7e] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Coins className="w-4 h-4" /> مخزون الفضة
        </button>
        <button onClick={() => setActiveTab('accs')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'accs' ? "bg-gradient-to-r from-[#9e8a6a] to-[#7e6a4a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Package className="w-4 h-4" /> مخزون الملحقات
        </button>
        <button onClick={() => setActiveTab('cash')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'cash' ? "bg-gradient-to-r from-[#6a9e6a] to-[#4a7e4a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Wallet className="w-4 h-4" /> مخزون النقدية
        </button>
      </div>

      <AnimatePresence mode="wait">
        {renderCurrentLedger()}
      </AnimatePresence>
    </div>
  );
});
