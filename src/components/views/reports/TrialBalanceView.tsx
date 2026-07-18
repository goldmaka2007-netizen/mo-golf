import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Scale, 
  Coins,
  BookOpen
} from 'lucide-react';
import { Entry, AccountNature } from '../../../types';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store';
import { belongsToMetric, getMetricValue, getDynamicAccountNature, getAccountTypeDetails } from '../../../utils/accountLogic';

export const TrialBalanceView = React.memo(({ entries }: { entries: Entry[] }) => {
  const [activeTab, setActiveTab] = useState<'cash' | 'gold' | 'silver'>('cash');

  const { accountsDb } = useAppStore();
  
  const trialBalanceData = useMemo(() => {
    const buildLedger = (metric: 'cash' | 'gold' | 'silver') => {
      const balances: Record<string, { debit: number; credit: number; mainType: string; subType: string }> = {};

      // 1. Accumulate balances from entries
      entries.forEach(entry => {
        const val = getMetricValue(entry, metric, accountsDb);
        if (val === 0) return;

        // Debit side
        if (belongsToMetric(entry.debit, metric, accountsDb)) {
          if (!balances[entry.debit]) {
            const details = getAccountTypeDetails(entry.debit, accountsDb);
            balances[entry.debit] = { debit: 0, credit: 0, mainType: details.main, subType: details.sub };
          }
          balances[entry.debit].debit += val;
        }

        // Credit side
        if (belongsToMetric(entry.credit, metric, accountsDb)) {
          if (!balances[entry.credit]) {
            const details = getAccountTypeDetails(entry.credit, accountsDb);
            balances[entry.credit] = { debit: 0, credit: 0, mainType: details.main, subType: details.sub };
          }
          balances[entry.credit].credit += val;
        }
      });

      // 2. Calculate Net Balances and apply "Adjustment" if needed
      const resultAccounts: any[] = [];
      let runningTotalDebit = 0;
      let runningTotalCredit = 0;

      Object.entries(balances).forEach(([account, data]) => {
        const net = data.debit - data.credit;
        if (Math.abs(net) < 0.00001) return; // Skip zero balances

        const row = {
          account,
          mainType: data.mainType,
          subType: data.subType,
          debit: net > 0 ? net : 0,
          credit: net < 0 ? Math.abs(net) : 0
        };

        resultAccounts.push(row);
        runningTotalDebit += row.debit;
        runningTotalCredit += row.credit;
      });

      // 3. Self-Balancing: Calculate Difference (Profit/Loss)
      const diff = runningTotalDebit - runningTotalCredit;
      if (Math.abs(diff) > 0.00001) {
        const isLoss = diff > 0; // If Debit > Credit, we need more Credit (Loss/Adjustment)
        resultAccounts.push({
          account: isLoss ? "فارق ميزان (عجز/خسارة)" : "فارق ميزان (زيادة/ربح)",
          mainType: "تسوية",
          subType: "ميزان المراجعة",
          debit: isLoss ? 0 : Math.abs(diff),
          credit: isLoss ? Math.abs(diff) : 0,
          isAdjustment: true
        });
        
        if (isLoss) runningTotalCredit += Math.abs(diff);
        else runningTotalDebit += Math.abs(diff);
      }

      // Sort: Assets -> Liabilities -> Equity -> Revenue -> Expenses
      // Within each category, sort by largest balance first
      const typeOrder: Record<string, number> = { "اصول": 1, "خصوم": 2, "حقوق ملكية": 3, "ايرادات": 4, "مصروفات": 5 };
      resultAccounts.sort((a, b) => {
        if (a.isAdjustment) return 1;
        if (b.isAdjustment) return -1;
        const mainA = typeOrder[a.mainType] || 99;
        const mainB = typeOrder[b.mainType] || 99;
        if (mainA !== mainB) return mainA - mainB;
        
        const valA = Math.max(a.debit, a.credit);
        const valB = Math.max(b.debit, b.credit);
        if (valA !== valB) return valB - valA;
        
        return a.account.localeCompare(b.account, 'ar');
      });

      return { accounts: resultAccounts, totalDebit: runningTotalDebit, totalCredit: runningTotalCredit };
    };

    return {
      cash: buildLedger('cash'),
      gold: buildLedger('gold'),
      silver: buildLedger('silver')
    };
  }, [entries, accountsDb]);

  const renderTable = () => {
    const data = trialBalanceData[activeTab];
    const unit = activeTab === 'cash' ? 'ج.م' : (activeTab === 'gold' ? 'جم عربي' : 'جرام');
    const colorClass = activeTab === 'cash' ? 'text-[#c9a84c]' : (activeTab === 'gold' ? 'text-[#c9a84c]' : 'text-[#6a8a9e]');

    return (
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 space-y-6 shadow-xl overflow-x-auto"
      >
        <div className="flex items-center justify-between border-b border-[#1a1e2a] pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#c9a84c]" />
            <h3 className="text-lg font-bold text-[#ddd8cc]">ميزان المراجعة بالمجاميع الصافية ({unit})</h3>
          </div>
          <div className="text-sm text-[#5a5548] bg-[#1a1e2a] px-3 py-1 rounded-full font-mono uppercase">
            Double-Entry Verification
          </div>
        </div>

        <table className="w-full text-right border-collapse min-w-[400px]">
          <thead>
            <tr className="border-b-2 border-[#1a1e2a]">
              <th className="py-3 px-1 text-sm font-bold text-[#5a5548] uppercase tracking-wider">الحساب</th>
              <th className="py-3 px-1 text-sm font-bold text-[#6a9e6a] text-left uppercase tracking-wider">أرصدة مدينة (Debit)</th>
              <th className="py-3 px-1 text-sm font-bold text-[#9e6a6a] text-left uppercase tracking-wider">أرصدة دائنة (Credit)</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((row, i) => (
              <tr key={i} className={cn(
                "border-b border-[#1a1e2a] transition-colors group",
                row.isAdjustment ? "bg-[#c9a84c08]" : "hover:bg-[#1a1e2a]"
              )}>
                <td className="py-3 px-2">
                  <div className={cn("text-base font-bold", row.isAdjustment ? "text-[#c9a84c]" : "text-[#ddd8cc]")}>
                    {row.account}
                  </div>
                  <div className="text-xs text-[#5a5548] font-medium opacity-60 group-hover:opacity-100 transition-opacity mt-1">
                    {row.mainType} <span className="mx-1">•</span> {row.subType}
                  </div>
                </td>
                <td className="py-3 px-2 text-base text-[#6a9e6a] text-left font-mono font-medium">
                  {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 3, maximumFractionDigits: 3 }) : '-'}
                </td>
                <td className="py-3 px-2 text-base text-[#9e6a6a] text-left font-mono font-medium">
                  {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 3, maximumFractionDigits: 3 }) : '-'}
                </td>
              </tr>
            ))}
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-10 text-base text-[#5a5548] italic">
                  لا توجد حركة مالية مسجلة لهذه الفئة حالياً
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={cn("bg-[#1a1e2a] border-t-2 border-[#c9a84c33] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]")}>
              <td className="py-5 px-3 text-base md:text-lg font-bold text-[#ddd8cc] flex items-center gap-2">
                <Scale className="w-6 h-6 text-[#c9a84c]" />
                إجمالي الأرصدة المتزنة
              </td>
              <td className={cn("py-5 px-3 text-lg md:text-xl text-left font-bold font-mono", colorClass)}>
                {data.totalDebit.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 3, maximumFractionDigits: 3 })}
              </td>
              <td className={cn("py-5 px-3 text-lg md:text-xl text-left font-bold font-mono", colorClass)}>
                {data.totalCredit.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 3, maximumFractionDigits: 3 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex gap-2 p-1 bg-[#0e1018] border border-[#1a1e2a] rounded-2xl shadow-lg overflow-x-auto">
        <button onClick={() => setActiveTab('cash')} className={cn("flex-1 whitespace-nowrap min-w-[100px] py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'cash' ? "bg-[#c9a84c] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Wallet className="w-5 h-5" /> ميزان السيولة
        </button>
        <button onClick={() => setActiveTab('gold')} className={cn("flex-1 whitespace-nowrap min-w-[100px] py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'gold' ? "bg-[#c9a84c] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Scale className="w-5 h-5" /> ميزان أوزان الذهب
        </button>
        <button onClick={() => setActiveTab('silver')} className={cn("flex-1 whitespace-nowrap min-w-[100px] py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'silver' ? "bg-[#6a8a9e] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:text-[#ddd8cc]")}>
          <Coins className="w-5 h-5" /> ميزان أوزان الفضة
        </button>
      </div>

      <AnimatePresence mode="wait">
        {renderTable()}
      </AnimatePresence>
    </div>
  );
});
