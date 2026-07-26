import React, { useMemo } from 'react';
import { useAppStore } from '../../../store';
import { Entry } from '../../../types';
import { getMetricValue, getAccountTypeDetails, belongsToMetric } from '../../../utils/accountLogic';

interface FinalReportViewProps {
  entries: Entry[];
  balanceEntries: Entry[];
}

export const FinalReportView: React.FC<FinalReportViewProps> = ({ entries, balanceEntries }) => {
  const { goldPrice, silverPrice, accountsDb } = useAppStore();

  const calculateFinancials = (dataEntries: Entry[]) => {
    let cashNet = 0;
    let goldNetWeight = 0;
    let silverNetWeight = 0;
    let accNetCount = 0;

    const metrics: ('cash' | 'gold' | 'silver' | 'accs')[] = ['cash', 'gold', 'silver', 'accs'];
    
    metrics.forEach(metric => {
      let totalRev = 0;
      let totalExp = 0;

      dataEntries.forEach(entry => {
        const val = getMetricValue(entry, metric, accountsDb);
        if (val === 0) return;

        const debitDetails = getAccountTypeDetails(entry.debit, accountsDb);
        const creditDetails = getAccountTypeDetails(entry.credit, accountsDb);

        // Logic for Income (Revenue vs Expenses)
        if (belongsToMetric(entry.credit, metric, accountsDb) && creditDetails.main === 'revenue') totalRev += val;
        if (belongsToMetric(entry.debit, metric, accountsDb) && debitDetails.main === 'expenses') totalExp += val;

        // Trade Overlays (Same as IncomeStatementView.tsx)
        if (metric === 'cash') {
          const isGold = (acc: string) => belongsToMetric(acc, 'gold', accountsDb);
          const isSilver = (acc: string) => belongsToMetric(acc, 'silver', accountsDb);
          const isAccs = (acc: string) => belongsToMetric(acc, 'accs', accountsDb);
          const isProduct = (acc: string) => isGold(acc) || isSilver(acc) || isAccs(acc);
          if (belongsToMetric(entry.debit, 'cash', accountsDb) && isProduct(entry.credit) && creditDetails.main === 'assets') totalRev += val;
          if (belongsToMetric(entry.credit, 'cash', accountsDb) && isProduct(entry.debit) && debitDetails.main === 'assets') totalExp += val;
        } else {
          if (belongsToMetric(entry.debit, metric, accountsDb) && debitDetails.main === 'assets' && !belongsToMetric(entry.credit, metric, accountsDb)) totalRev += val;
          if (belongsToMetric(entry.credit, metric, accountsDb) && creditDetails.main === 'assets' && !belongsToMetric(entry.debit, metric, accountsDb)) totalExp += val;
        }
      });

      if (metric === 'cash') cashNet = totalRev - totalExp;
      if (metric === 'gold') goldNetWeight = totalRev - totalExp;
      if (metric === 'silver') silverNetWeight = totalRev - totalExp;
      if (metric === 'accs') accNetCount = totalRev - totalExp;
    });

    return { cashNet, goldNetWeight, silverNetWeight, accNetCount };
  };

  const calculatePosition = (dataEntries: Entry[]) => {
    let assets = { cash: 0, gold: 0, silver: 0 };
    let liabilities = { cash: 0, gold: 0, silver: 0 };
    let equity = { cash: 0, gold: 0, silver: 0 };

    dataEntries.forEach(entry => {
      const debitDetails = getAccountTypeDetails(entry.debit, accountsDb);
      const creditDetails = getAccountTypeDetails(entry.credit, accountsDb);

      const update = (details: any, amount: number, weightG: number, weightS: number, multiplier: number) => {
        if (details.main === 'assets') {
          assets.cash += amount * multiplier;
          assets.gold += weightG * multiplier;
          assets.silver += weightS * multiplier;
        } else if (details.main === 'liabilities') {
          liabilities.cash += amount * multiplier;
          liabilities.gold += weightG * multiplier;
          liabilities.silver += weightS * multiplier;
        } else if (details.main === 'equity') {
          equity.cash += amount * multiplier;
          equity.gold += weightG * multiplier;
          equity.silver += weightS * multiplier;
        }
      };

      const cashVal = getMetricValue(entry, 'cash', accountsDb);
      const goldVal = getMetricValue(entry, 'gold', accountsDb);
      const silverVal = getMetricValue(entry, 'silver', accountsDb);

      update(debitDetails, cashVal, goldVal, silverVal, 1);
      update(creditDetails, cashVal, goldVal, silverVal, -1);
    });

    const valuate = (obj: any) => Math.abs(obj.cash) + (Math.abs(obj.gold) * (goldPrice || 0)) + (Math.abs(obj.silver) * (silverPrice || 0));

    // For Liabilities and Equity, balances are naturally negative (Credit > Debit) in this calculation loop, so we abs or flip
    const totalAssets = valuate(assets);
    const totalLiabilities = Math.abs(valuate(liabilities));
    const totalEquity = Math.abs(valuate(equity));

    return { totalAssets, totalLiabilities, totalEquity, assets, liabilities, equity };
  };

  const incomeData = useMemo(() => calculateFinancials(entries), [entries, goldPrice, silverPrice, accountsDb]);
  const positionData = useMemo(() => calculatePosition(balanceEntries), [balanceEntries, goldPrice, silverPrice, accountsDb]);

  const totalIncomeProfits = incomeData.cashNet + (incomeData.goldNetWeight * (goldPrice || 0)) + (incomeData.silverNetWeight * (silverPrice || 0));

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-xl font-bold text-[#c9a84c] border-r-4 border-[#c9a84c] pr-3 flex items-center gap-2">
         التقرير المالي المتكامل
      </h2>
      
      {/* 1. Income Statement Section */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-[#1a1e2a] px-6 py-3 border-b border-[#c9a84c22] flex justify-between items-center">
           <h3 className="text-lg font-bold text-[#c9a84c]">١. قائمة الدخل (الأرباح والخسائر)</h3>
           <span className="text-xs text-[#5a5548]">لل�?ترة المحددة</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
              <div className="text-xs text-[#5a5548] font-bold">صا�?ي النقدية</div>
              <div className="text-xl font-black text-[#6a9e6a]">{incomeData.cashNet.toLocaleString()} ج.م</div>
            </div>
            <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
              <div className="text-xs text-[#5a5548] font-bold">قيمة �?ائض الذهب ({incomeData.goldNetWeight.toFixed(3)} ج)</div>
              <div className="text-xl font-black text-[#c9a84c]">{(incomeData.goldNetWeight * (goldPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</div>
            </div>
            <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
              <div className="text-xs text-[#5a5548] font-bold">قيمة �?ائض ال�?ضة ({incomeData.silverNetWeight.toFixed(2)} ج)</div>
              <div className="text-xl font-black text-[#6a8a9e]">{(incomeData.silverNetWeight * (silverPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-[#6a9e6a22] to-transparent p-5 rounded-xl border border-[#6a9e6a44]">
            <div className="text-sm text-[#6a9e6a] font-bold mb-1">صا�?ي ربح ال�?ترة التقريبي</div>
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
               <div className="text-xs text-[#5a5548]">(نقدية + ذهب + �?ضة) مقومة بالسوق</div>
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
               <div className="text-sm font-bold text-[#c9a84c]">{Math.abs(positionData.equity.gold).toFixed(3)} ج</div>
             </div>
             <div className="bg-[#080a0f] p-2 rounded-lg border border-[#1a1e2a]">
               <div className="text-[10px] text-[#5a5548]">�?ضة</div>
               <div className="text-sm font-bold text-[#6a8a9e]">{Math.abs(positionData.equity.silver).toFixed(2)} ج</div>
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
                <div className="flex justify-between"><span>ذهب ({positionData.assets.gold.toFixed(3)} ج):</span> <span>{(positionData.assets.gold * (goldPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
                <div className="flex justify-between"><span>�?ضة ({positionData.assets.silver.toFixed(2)} ج):</span> <span>{(positionData.assets.silver * (silverPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
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
                <div className="flex justify-between"><span>ذهب ({Math.abs(positionData.liabilities.gold).toFixed(3)} ج):</span> <span>{(Math.abs(positionData.liabilities.gold) * (goldPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
                <div className="flex justify-between"><span>�?ضة ({Math.abs(positionData.liabilities.silver).toFixed(2)} ج):</span> <span>{(Math.abs(positionData.liabilities.silver) * (silverPrice || 0)).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span></div>
              </div>
           </div>

           <div className="md:col-span-2 pt-4 border-t border-[#1a1e2a]">
              <div className="flex justify-between items-center font-black">
                <span className="text-[#ddd8cc]">صا�?ي المركز المالي (Net Asset Value)</span>
                <span className="text-2xl text-[#c9a84c]">{(positionData.totalAssets - positionData.totalLiabilities).toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
