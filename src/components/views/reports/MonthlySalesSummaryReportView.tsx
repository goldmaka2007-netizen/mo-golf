import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Scale,
  Coins,
  Wrench
} from 'lucide-react';
import { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { getAccountTypeDetails, getMetricValue } from '../../../utils/accountLogic';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

export const MonthlySalesSummaryReportView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb } = useAppStore();

  const monthlyData = useMemo(() => {
    const months: Record<string, {
      goldSales: number;
      goldWeight: number;
      silverSales: number;
      silverWeight: number;
      workmanship: number;
      totalRevenue: number;
      totalExpenses: number;
    }> = {};

    entries.forEach(entry => {
      if (!entry.date) return;
      const monthKey = entry.date.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) {
        months[monthKey] = {
          goldSales: 0,
          goldWeight: 0,
          silverSales: 0,
          silverWeight: 0,
          workmanship: 0,
          totalRevenue: 0,
          totalExpenses: 0
        };
      }

      const cash = getMetricValue(entry, 'cash', accountsDb);
      const goldW = getMetricValue(entry, 'gold', accountsDb);
      const silverW = getMetricValue(entry, 'silver', accountsDb);

      const debitDetails = getAccountTypeDetails(entry.debit, accountsDb);
      const creditDetails = getAccountTypeDetails(entry.credit, accountsDb);

      // Identify transaction types
      const tx = entry.tx || '';
      
      // 1. Gold Sales
      if (tx === 'بيع ذهب') {
        months[monthKey].goldSales += cash;
        months[monthKey].goldWeight += goldW;
      }
      
      // 2. Silver Sales
      if (tx === 'بيع فضة') {
        months[monthKey].silverSales += cash;
        months[monthKey].silverWeight += silverW;
      }

      // 3. Workmanship / Repairs
      if (tx === 'تصليح' || tx === 'ايرادات اخري') {
        months[monthKey].workmanship += cash;
      }

      // 4. Net Profit Calculation (Revenue vs Expenses)
      // Credit is Revenue
      if (creditDetails.main === 'revenue') {
        months[monthKey].totalRevenue += cash;
      }
      
      // Debit is Expense
      if (debitDetails.main === 'expenses') {
        months[monthKey].totalExpenses += cash;
      }

      // Special Trade Overlay for Net Profit (Sales of Assets)
      const isGold = (acc: string) => acc.includes('ذهب') || getAccountTypeDetails(acc, accountsDb).nature === 2; // GOLD
      const isSilver = (acc: string) => acc.includes('فضة') || getAccountTypeDetails(acc, accountsDb).nature === 3; // SILVER
      const isAccs = (acc: string) => acc.includes('ملحقات') || getAccountTypeDetails(acc, accountsDb).nature === 6; // ACC
      const isProduct = (acc: string) => isGold(acc) || isSilver(acc) || isAccs(acc);

      // Purchase of inventory (Cash Expense)
      if (creditDetails.main === 'assets' && creditDetails.nature === 1 && debitDetails.main === 'assets' && isProduct(entry.debit)) {
        // Technically this is a capital expenditure but in gold retail it's COGS for immediate turnover sometimes.
        // However, standard accounting treats it as Asset swap.
        // For "Net Profit" in retail, we usually look at Sales - COGS.
        // But here we follow the user's "Net Profit" which usually aligns with the Income Statement logic.
      }
    });

    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => ({
      month,
      ...data,
      netProfit: data.totalRevenue - data.totalExpenses
    }));
  }, [entries, accountsDb]);

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-[#0e1018] border border-[#c9a84c22] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-[#c9a84c22] rounded-xl text-[#c9a84c]">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#c9a84c]">ملخص المبيعات والأرباح الشهري</h3>
            <p className="text-xs text-[#5a5548] font-bold uppercase tracking-widest">تحليل الأداء المالي للمحل لكل شهر</p>
          </div>
        </div>

        <div className="space-y-4">
          {monthlyData.map((data) => (
            <motion.div 
              key={data.month}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#080a0f] border border-[#1a1e2a] rounded-2xl overflow-hidden shadow-lg"
            >
              {/* Month Header */}
              <div className="bg-[#1a1e2a] px-5 py-4 flex justify-between items-center border-b border-[#c9a84c22]">
                <span className="text-base font-bold text-[#c9a84c]">
                  {format(parseISO(`${data.month}-01`), 'MMMM yyyy', { locale: ar })}
                </span>
                <div className="flex items-center gap-2">
                   <TrendingUp className={data.netProfit >= 0 ? "text-[#6a9e6a] w-5 h-5" : "text-red-500 w-5 h-5"} />
                   <span className={data.netProfit >= 0 ? "text-[#6a9e6a] text-sm font-bold" : "text-red-500 text-sm font-bold"}>
                     صافي الربح: {data.netProfit.toLocaleString()} ج.م
                   </span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gold Sales */}
                <div className="space-y-2 p-4 bg-[#0e1018] rounded-xl border border-[#c9a84c11]">
                  <div className="flex items-center gap-2 text-[#c9a84c]">
                    <Scale className="w-5 h-5" />
                    <span className="text-sm font-bold font-['IBM_Plex_Sans_Arabic']">مبيعات الذهب</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono">{data.goldSales.toLocaleString()} <span className="text-xs opacity-60">ج.م</span></span>
                    <span className="text-xs text-[#5a5548] font-bold">{data.goldWeight.toFixed(2)} جم عربي</span>
                  </div>
                </div>

                {/* Silver Sales */}
                <div className="space-y-2 p-4 bg-[#0e1018] rounded-xl border border-[#6a8a9e11]">
                  <div className="flex items-center gap-2 text-[#6a8a9e]">
                    <Coins className="w-5 h-5" />
                    <span className="text-sm font-bold font-['IBM_Plex_Sans_Arabic']">مبيعات الفضة</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono">{data.silverSales.toLocaleString()} <span className="text-xs opacity-60">ج.م</span></span>
                    <span className="text-xs text-[#5a5548] font-bold">{data.silverWeight.toFixed(2)} جرام</span>
                  </div>
                </div>

                {/* Workmanship */}
                <div className="space-y-2 p-4 bg-[#0e1018] rounded-xl border border-[#9e8a6a11]">
                  <div className="flex items-center gap-2 text-[#9e8a6a]">
                    <Wrench className="w-5 h-5" />
                    <span className="text-sm font-bold font-['IBM_Plex_Sans_Arabic']">المصنعية والأعمال</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold font-mono">{data.workmanship.toLocaleString()} <span className="text-xs opacity-60">ج.م</span></span>
                    <span className="text-xs text-[#5a5548] font-bold">دخل خدمات فنية</span>
                  </div>
                </div>
              </div>

              {/* Bottom Summary Line */}
              <div className="px-5 py-4 bg-[#080a0f] border-t border-[#1a1e2a] flex justify-between items-center text-sm font-bold text-[#5a5548]">
                <span>إجمالي الإيرادات: <span className="text-[#ddd8cc]">{data.totalRevenue.toLocaleString()} ج.م</span></span>
                <span>إجمالي المصروفات: <span className="text-[#ddd8cc]">{data.totalExpenses.toLocaleString()} ج.م</span></span>
              </div>
            </motion.div>
          ))}

          {monthlyData.length === 0 && (
            <div className="text-center py-20 text-[#5a5548] space-y-4">
              <BarChart3 className="w-16 h-16 mx-auto opacity-20" />
              <p className="text-base font-bold">لا توجد مبيعات مسجلة في الفترة المحددة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
