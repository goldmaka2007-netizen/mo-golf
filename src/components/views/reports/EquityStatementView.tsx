import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Scale, 
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Package
} from 'lucide-react';
import { Entry, AccountNature, AccountCategories } from '../../../types';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { getDynamicAccountNature, getAccountTypeDetails, belongsToMetric, getMetricValue } from '../../../utils/accountLogic';

export const EquityStatementView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountCategories, accountsDb } = useAppStore();
  const [activeTab, setActiveTab] = useState<'cash' | 'gold' | 'silver' | 'accs'>('cash');

  const financials = useMemo(() => {
    const calculateEquityLedger = (metric: 'cash' | 'gold' | 'silver' | 'accs') => {
      let capitalAdditions = 0;
      const capitalAccounts: Record<string, number> = {};
      
      let drawings = 0;
      const drawingsAccounts: Record<string, number> = {};

      let totalRevenue = 0;
      let totalExpenses = 0;

      // 1. Process entries for Equity movements and Profit/Loss
      entries.forEach(entry => {
        const val = getMetricValue(entry, metric, accountsDb);
        if (val === 0) return;

        const debitDetails = getAccountTypeDetails(entry.debit, accountsDb);
        const creditDetails = getAccountTypeDetails(entry.credit, accountsDb);

        // -- Equity Movements (Capital / Drawings) --
        if (creditDetails.main === 'equity' && belongsToMetric(entry.credit, metric, accountsDb)) {
          capitalAdditions += val;
          capitalAccounts[entry.credit] = (capitalAccounts[entry.credit] || 0) + val;
        }
        if (debitDetails.main === 'equity' && belongsToMetric(entry.debit, metric, accountsDb)) {
          drawings += val;
          drawingsAccounts[entry.debit] = (drawingsAccounts[entry.debit] || 0) + val;
        }

        // -- Operational P&L (Consistent with Income Statement) --
        // Credit is Revenue
        if (belongsToMetric(entry.credit, metric, accountsDb) && creditDetails.main === 'revenue') {
          totalRevenue += val;
        }
        // Debit is Expense
        if (belongsToMetric(entry.debit, metric, accountsDb) && debitDetails.main === 'expenses') {
          totalExpenses += val;
        }

        // Trade Overlays for Profit Calculation
        if (metric === 'cash') {
          const isGold = (acc: string) => belongsToMetric(acc, 'gold', accountsDb);
          const isSilver = (acc: string) => belongsToMetric(acc, 'silver', accountsDb);
          const isAccs = (acc: string) => belongsToMetric(acc, 'accs', accountsDb);
          const isProduct = (acc: string) => isGold(acc) || isSilver(acc) || isAccs(acc);

          if (belongsToMetric(entry.debit, 'cash', accountsDb) && isProduct(entry.credit) && creditDetails.main === 'assets') {
            totalRevenue += val; // Cash inflow from sales
          }
          if (belongsToMetric(entry.credit, 'cash', accountsDb) && isProduct(entry.debit) && debitDetails.main === 'assets') {
            totalExpenses += val; // Cash outflow for purchases
          }
        } else if (metric === 'gold' || metric === 'silver') {
          // Weight inflows/outflows
          if (belongsToMetric(entry.debit, metric, accountsDb) && debitDetails.main === 'assets' && !belongsToMetric(entry.credit, metric, accountsDb)) {
            totalRevenue += val; // Weight inflow from purchases
          }
          if (belongsToMetric(entry.credit, metric, accountsDb) && creditDetails.main === 'assets' && !belongsToMetric(entry.debit, metric, accountsDb)) {
            totalExpenses += val; // Weight outflow from sales
          }
        }
      });

      const netProfit = totalRevenue - totalExpenses;

      return {
        additions: { total: capitalAdditions, accounts: capitalAccounts },
        deductions: { total: drawings, accounts: drawingsAccounts },
        netProfit,
        totalChange: (capitalAdditions - drawings) + netProfit
      };
    };

    return {
      cash: calculateEquityLedger('cash'),
      gold: calculateEquityLedger('gold'),
      silver: calculateEquityLedger('silver'),
      accs: calculateEquityLedger('accs')
    };
  }, [entries, accountsDb]);

  const renderStatement = () => {
    const data = (financials as any)[activeTab];
    let unit = 'ج.م';
    let accent = 'text-[#c9a84c]';
    let title = '';

    if (activeTab === 'cash') { unit = 'ج.م'; accent = 'text-[#6a9e6a]'; title = 'نقدية (الأموال)'; }
    if (activeTab === 'gold') { unit = 'جم عربي'; accent = 'text-[#c9a84c]'; title = 'ذهب (المشغولات المستحقة)'; }
    if (activeTab === 'silver') { unit = 'جرام'; accent = 'text-[#6a8a9e]'; title = 'فضة'; }
    if (activeTab === 'accs') { unit = 'قطعة'; accent = 'text-[#9e8a6a]'; title = 'ملحقات (عدد القطع)'; }

    return (
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 space-y-8"
      >
        {/* Additions Section */}
        <div className="space-y-4">
          <div className={cn("flex items-center gap-2 border-b border-[#1a1e2a] pb-2", accent)}>
            <ArrowUpRight className="w-6 h-6" />
            <h4 className="text-lg font-bold">إضافات إلى حقوق الملكية (رأس المال، وغيرها)</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-base font-bold text-[#ddd8cc]">
              <span>إجمالي الإضافات المباشرة</span>
              <span>{data.additions.total.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}</span>
            </div>
            <div className="pr-4 space-y-1">
              {(Object.entries(data.additions.accounts) as [string, number][]).map(([acc, val]) => (
                <div key={acc} className="flex justify-between text-sm text-[#5a5548]">
                  <span>{acc}</span>
                  <span className="font-mono">{val.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deductions Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#9e6a6a] border-b border-[#1a1e2a] pb-2">
            <ArrowDownLeft className="w-6 h-6" />
            <h4 className="text-lg font-bold">تخفيضات من حقوق الملكية (مسحوبات، وغيرها)</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-base font-bold text-[#ddd8cc]">
              <span>إجمالي التخفيضات المباشرة</span>
              <span>{data.deductions.total.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}</span>
            </div>
            <div className="pr-4 space-y-1">
              {(Object.entries(data.deductions.accounts) as [string, number][]).map(([acc, val]) => (
                <div key={acc} className="flex justify-between text-sm text-[#5a5548]">
                  <span>{acc}</span>
                  <span className="font-mono">{val.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Net Profit Section */}
        <div className="space-y-4 pt-4 border-t-2 border-[#1a1e2a]">
          <div className={cn("flex items-center gap-2", accent)}>
            <TrendingUp className="w-6 h-6" />
            <h4 className="text-lg font-bold">صافي نتائج أعمال الفترة (Net Profit/Loss)</h4>
          </div>

          <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a] flex justify-between items-center mt-2 group hover:border-[#6a9e6a55] transition-colors">
            <div className="flex flex-col">
              <span className="text-base text-[#ddd8cc] font-bold">صافي الربح أو الخسارة</span>
              <span className="text-sm text-[#5a5548]">المحسوب من الإيرادات والمصروفات والعمليات التجارية</span>
            </div>
            <span className={cn("text-3xl font-bold font-mono", data.netProfit >= 0 ? "text-[#6a9e6a]" : "text-[#9e6a6a]")}>
              {data.netProfit >= 0 ? '+' : ''}{data.netProfit.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}
            </span>
          </div>
          <div className="text-sm text-[#5a5548] italic text-center">
            * تفاصيل الإيرادات والمصروفات متاحة في قائمة الدخل
          </div>
        </div>

        {/* Total Equity at End */}
        <div className={cn("bg-gradient-to-br p-5 rounded-2xl flex justify-between items-center shadow-xl", activeTab === 'cash' ? 'from-[#1a1e2a] to-[#080a0f] border border-[#c9a84c33]' : (activeTab === 'gold' ? 'from-[#1a1e2a] to-[#080a0f] border border-[#c9a84c33]' : 'from-[#1a1e2a] to-[#080a0f] border border-[#6a8a9e33]'))}>
          <div className="flex flex-col">
            <span className={cn("text-base font-bold opacity-80 uppercase tracking-wider", accent)}>إجمالي حقوق الملكية (نهاية الفترة)</span>
            <span className="text-sm text-[#5a5548]">رأس المال + صافي الأرباح التشغيلية</span>
          </div>
          <span className={cn("text-4xl md:text-5xl font-bold font-mono", data.totalChange >= 0 ? accent : "text-[#9e6a6a]")}>
            {data.totalChange.toLocaleString(undefined, { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 })} {unit}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0e1018] border border-[#1a1e2a] p-2 rounded-2xl shadow-lg">
        <button onClick={() => setActiveTab('gold')} className={cn("py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'gold' ? "bg-[#c9a84c] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Scale className="w-5 h-5" /> ملكية الذهب
        </button>
        <button onClick={() => setActiveTab('silver')} className={cn("py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'silver' ? "bg-[#6a8a9e] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Coins className="w-5 h-5" /> ملكية الفضة
        </button>
        <button onClick={() => setActiveTab('accs')} className={cn("py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'accs' ? "bg-[#9e8a6a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Package className="w-5 h-5" /> ملكية الملحقات
        </button>
        <button onClick={() => setActiveTab('cash')} className={cn("py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2", activeTab === 'cash' ? "bg-[#6a9e6a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
          <Wallet className="w-5 h-5" /> ملكية النقدية
        </button>
      </div>

      <AnimatePresence mode="wait">
        {renderStatement()}
      </AnimatePresence>
    </div>
  );
});
