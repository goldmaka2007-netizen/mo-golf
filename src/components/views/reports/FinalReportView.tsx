import { formatWeight } from '../../../lib/formatting';
import React, { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { Entry } from '../../../types';
import { computeAccountBalances } from '../../../lib/engine';
import { buildIncomeStatementReport } from '../../../lib/incomeStatementReport';
import { buildEquityStatementReport } from '../../../lib/equityStatementReport';
import { buildFinancialPositionReport } from '../../../lib/financialPositionReport';

interface FinalReportViewProps {
  entries: Entry[];
  balanceEntries: Entry[];
}

export const FinalReportView: React.FC<FinalReportViewProps> = ({ entries, balanceEntries }) => {
  const { goldPrice, silverPrice, accountsDb } = useAppStore();

  const reportData = useMemo(() => {
    const incomeBalances = computeAccountBalances(entries, accountsDb);
    const positionBalances = computeAccountBalances(balanceEntries, accountsDb);
    const income = buildIncomeStatementReport(incomeBalances);
    const equity = buildEquityStatementReport(positionBalances, income);
    const position = buildFinancialPositionReport(positionBalances, equity);
    const assets = {
      cash: position.cash.assets.total,
      gold: position.gold.assets.total,
      silver: position.silver.assets.total,
    };
    const liabilities = {
      cash: position.cash.liabilities.total,
      gold: position.gold.liabilities.total,
      silver: position.silver.liabilities.total,
    };
    const equityBalances = {
      cash: position.cash.equity.total,
      gold: position.gold.equity.total,
      silver: position.silver.equity.total,
    };
    const valuePosition = (values: typeof assets) => Math.abs(values.cash)
      + Math.abs(values.gold) * (goldPrice || 0)
      + Math.abs(values.silver) * (silverPrice || 0);
    return {
      incomeData: {
        cashNet: income.cash.net,
        goldNetWeight: income.gold.net,
        silverNetWeight: income.silver.net,
        accNetCount: income.accs.net,
      },
      positionData: {
        totalAssets: valuePosition(assets),
        totalLiabilities: valuePosition(liabilities),
        totalEquity: valuePosition(equityBalances),
        assets,
        liabilities,
        equity: equityBalances,
      },
    };
  }, [entries, balanceEntries, accountsDb, goldPrice, silverPrice]);

  const { incomeData, positionData } = reportData;
  const totalIncomeProfits = incomeData.cashNet
    + incomeData.goldNetWeight * (goldPrice || 0)
    + incomeData.silverNetWeight * (silverPrice || 0);

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-xl font-bold text-[#c9a84c] border-r-4 border-[#c9a84c] pr-3 flex items-center gap-2">
         التقرير المالي المتكامل
      </h2>
      
      {/* 1. Income Statement Section */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-[#1a1e2a] px-6 py-3 border-b border-[#c9a84c22] flex justify-between items-center">
           <h3 className="text-lg font-bold text-[#c9a84c]">١. قائمة الدخل (الأرباح والخسائر)</h3>
           <span className="text-xs text-[#5a5548]">للفترة المحددة</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
              <div className="text-xs text-[#5a5548] font-bold">صافي النقدية</div>
              <div className="text-xl font-black text-[#6a9e6a]">{incomeData.cashNet.toLocaleString()} ج.م</div>
            </div>
            <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
              <div className="text-xs text-[#5a5548] font-bold">قيمة فائض الذهب ({formatWeight(incomeData.goldNetWeight, 3)} ج)</div>
              <div className="text-xl font-black text-[#c9a84c]">{(incomeData.goldNetWeight * (goldPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</div>
            </div>
            <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
              <div className="text-xs text-[#5a5548] font-bold">قيمة فائض الفضة ({formatWeight(incomeData.silverNetWeight)} ج)</div>
              <div className="text-xl font-black text-[#6a8a9e]">{(incomeData.silverNetWeight * (silverPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-[#6a9e6a22] to-transparent p-5 rounded-xl border border-[#6a9e6a44]">
            <div className="text-sm text-[#6a9e6a] font-bold mb-1">صافي ربح الفترة التقريبي</div>
            <div className="text-3xl font-black text-[#ddd8cc]">{totalIncomeProfits.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-sm font-normal">ج.م</span></div>
          </div>
        </div>
      </div>

      {/* 2. Equity Statement Section */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-[#1a1e2a] px-6 py-3 border-b border-[#c9a84c22]">
           <h3 className="text-lg font-bold text-[#c9a84c]">٢. قائمة حقوق الملكية</h3>
        </div>
        <div className="p-6">
          <div className="bg-[#080a0f] p-5 rounded-2xl border-2 border-[#c9a84c33] flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="space-y-1">
               <div className="text-sm text-[#5a5548] font-bold uppercase">إجمالي حقوق الملكية (رأس المال + أرباح)</div>
               <div className="text-xs text-[#5a5548]">(نقدية + ذهب + فضة) مقومة بالسوق</div>
             </div>
             <div className="text-4xl md:text-5xl font-black text-[#c9a84c]">
               {positionData.totalEquity.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-base font-normal">ج.م</span>
             </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
             <div className="bg-[#080a0f] p-2 rounded-lg border border-[#1a1e2a]">
               <div className="text-[10px] text-[#5a5548]">نقدي</div>
               <div className="text-sm font-bold text-[#ddd8cc]">{Math.abs(positionData.equity.cash).toLocaleString()}</div>
             </div>
             <div className="bg-[#080a0f] p-2 rounded-lg border border-[#1a1e2a]">
               <div className="text-[10px] text-[#5a5548]">ذهب</div>
               <div className="text-sm font-bold text-[#c9a84c]">{formatWeight(Math.abs(positionData.equity.gold), 3)} ج</div>
             </div>
             <div className="bg-[#080a0f] p-2 rounded-lg border border-[#1a1e2a]">
               <div className="text-[10px] text-[#5a5548]">فضة</div>
               <div className="text-sm font-bold text-[#6a8a9e]">{formatWeight(Math.abs(positionData.equity.silver))} ج</div>
             </div>
          </div>
        </div>
      </div>

      {/* 3. Balance Sheet Section */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-[#1a1e2a] px-6 py-3 border-b border-[#c9a84c22]">
           <h3 className="text-lg font-bold text-[#c9a84c]">٣. المركز المالي (Asset vs Liabilities)</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-[#6a9e6a]">
                <span>إجمالي الأصول</span>
                <span>{positionData.totalAssets.toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span>
              </div>
              <div className="w-full bg-[#1a1e2a] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#6a9e6a] h-full" style={{ width: '100%' }}></div>
              </div>
              <div className="text-[10px] text-[#5a5548] space-y-1">
                <div className="flex justify-between"><span>نقدية:</span> <span>{positionData.assets.cash.toLocaleString()} ج.م</span></div>
                <div className="flex justify-between"><span>ذهب ({formatWeight(positionData.assets.gold, 3)} ج):</span> <span>{(positionData.assets.gold * (goldPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
                <div className="flex justify-between"><span>فضة ({formatWeight(positionData.assets.silver)} ج):</span> <span>{(positionData.assets.silver * (silverPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
              </div>
           </div>

           <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-[#9e6a6a]">
                <span>إجمالي الخصوم</span>
                <span>{positionData.totalLiabilities.toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span>
              </div>
              <div className="w-full bg-[#1a1e2a] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#9e6a6a] h-full" style={{ width: `${Math.min(100, (positionData.totalLiabilities / positionData.totalAssets) * 100)}%` }}></div>
              </div>
              <div className="text-[10px] text-[#5a5548] space-y-1">
                <div className="flex justify-between"><span>نقدية:</span> <span>{Math.abs(positionData.liabilities.cash).toLocaleString()} ج.م</span></div>
                <div className="flex justify-between"><span>ذهب ({formatWeight(Math.abs(positionData.liabilities.gold), 3)} ج):</span> <span>{(Math.abs(positionData.liabilities.gold) * (goldPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
                <div className="flex justify-between"><span>فضة ({formatWeight(Math.abs(positionData.liabilities.silver))} ج):</span> <span>{(Math.abs(positionData.liabilities.silver) * (silverPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
              </div>
           </div>

           <div className="md:col-span-2 pt-4 border-t border-[#1a1e2a]">
              <div className="flex justify-between items-center font-black">
                <span className="text-[#ddd8cc]">صافي المركز المالي (Net Asset Value)</span>
                <span className="text-2xl text-[#c9a84c]">{(positionData.totalAssets - positionData.totalLiabilities).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
