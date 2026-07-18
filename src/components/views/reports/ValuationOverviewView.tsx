import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Wallet, Scale, Coins, Package, BarChart3, TrendingUp, ShieldCheck } from 'lucide-react';
import { Entry, AccountNature, Account } from '../../../types';
import { useAppStore } from '../../../store';
import { VALUATION_PRICES } from '../../../constants';
import { getDynamicAccountNature, belongsToMetric, getMetricValue, getAccountTypeDetails } from '../../../utils/accountLogic';
import { cn } from '../../../lib/utils';

export const ValuationOverviewView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, goldPrice, silverPrice } = useAppStore();
  
  const valuation = useMemo(() => {
    // 1. Calculate Balances by Account
    const accountBalances: Record<string, { cash: number, gold: number, silver: number, accs: number }> = {};
    
    entries.forEach(entry => {
      // Debit side
      if (!accountBalances[entry.debit]) accountBalances[entry.debit] = { cash: 0, gold: 0, silver: 0, accs: 0 };
      accountBalances[entry.debit].cash += getMetricValue(entry, 'cash', accountsDb);
      accountBalances[entry.debit].gold += getMetricValue(entry, 'gold', accountsDb);
      accountBalances[entry.debit].silver += getMetricValue(entry, 'silver', accountsDb);
      accountBalances[entry.debit].accs += getMetricValue(entry, 'accs', accountsDb);
      
      // Credit side
      if (!accountBalances[entry.credit]) accountBalances[entry.credit] = { cash: 0, gold: 0, silver: 0, accs: 0 };
      accountBalances[entry.credit].cash -= getMetricValue(entry, 'cash', accountsDb);
      accountBalances[entry.credit].gold -= getMetricValue(entry, 'gold', accountsDb);
      accountBalances[entry.credit].silver -= getMetricValue(entry, 'silver', accountsDb);
      accountBalances[entry.credit].accs -= getMetricValue(entry, 'accs', accountsDb);
    });

    const metrics = {
      assets: { cash: 0, gold: 0, silver: 0, accsCount: 0, accsVal: 0, totalVal: 0 },
      liabilities: { cash: 0, gold: 0, silver: 0, accsCount: 0, accsVal: 0, totalVal: 0 },
      netVal: 0
    };

    const goldFactor = (goldPrice || 0); // Assuming goldPrice is the 21K price
    const silverFactor = (silverPrice || 0);

    Object.entries(accountBalances).forEach(([name, bals]) => {
      if (Math.abs(bals.cash) < 0.01 && Math.abs(bals.gold) < 0.01 && Math.abs(bals.silver) < 0.01 && Math.abs(bals.accs) < 0.01) return;
      
      const details = getAccountTypeDetails(name, accountsDb);
      const isAsset = details.main === 'assets';
      const isLiab = details.main === 'liabilities';
      
      const specificAccFactor = (VALUATION_PRICES.ACCS as Record<string, number>)[name] || 0;
      const accVal = (bals.accs * specificAccFactor);
      
      const val = bals.cash + (bals.gold * goldFactor) + (bals.silver * silverFactor) + accVal;

      if (isAsset) {
        metrics.assets.cash += bals.cash;
        metrics.assets.gold += bals.gold;
        metrics.assets.silver += bals.silver;
        metrics.assets.accsCount += bals.accs;
        metrics.assets.accsVal += accVal;
        metrics.assets.totalVal += val;
      } else if (isLiab) {
        metrics.liabilities.cash += bals.cash;
        metrics.liabilities.gold += bals.gold;
        metrics.liabilities.silver += bals.silver;
        metrics.liabilities.accsCount += bals.accs;
        metrics.liabilities.accsVal += accVal;
        metrics.liabilities.totalVal += val;
      }
    });

    metrics.netVal = metrics.assets.totalVal + metrics.liabilities.totalVal; // Liabs are negative in credits usually, but here we calculate balance

    return metrics;
  }, [entries, accountsDb, goldPrice, silverPrice]);

  const cards = [
    { title: 'تقييم الأصول', val: valuation.assets.totalVal, icon: <ShieldCheck />, color: 'text-[#6a9e6a]', sub: 'ما يمتلكه المحل حالياً' },
    { title: 'تقييم الخصوم', val: Math.abs(valuation.liabilities.totalVal), icon: <TrendingUp />, color: 'text-[#9e6a6a]', sub: 'ديون ومستحقات الموردين' },
    { title: 'صافي حقوق الملكية', val: valuation.netVal, icon: <LayoutDashboard />, color: 'text-[#c9a84c]', sub: 'رأس المال + أرباح الفترة' },
  ];

  const breakdown = [
    { title: 'السيولة النقدية', val: valuation.assets.cash + valuation.liabilities.cash, unit: 'ج.م', icon: <Wallet />, color: 'bg-[#6a9e6a]' },
    { title: 'الذهب الموحد (ع٢١)', val: valuation.assets.gold + valuation.liabilities.gold, unit: 'جم', icon: <Scale />, color: 'bg-[#c9a84c]' },
    { title: 'الفضة الحرة', val: valuation.assets.silver + valuation.liabilities.silver, unit: 'جم', icon: <Coins />, color: 'bg-[#6a8a9e]' },
    { title: 'الملحقات', val: valuation.assets.accsCount + valuation.liabilities.accsCount, unit: 'قطعة', icon: <Package />, color: 'bg-[#9e8a6a]' },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Section */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#c9a84c]/5 rounded-full blur-3xl -mr-40 -mt-40" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#c9a84c] to-[#9a7830] rounded-2xl flex items-center justify-center text-[#080a0f] shadow-xl shadow-[#c9a84c22]">
              <BarChart3 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-3xl lg:text-4xl font-black text-[#ddd8cc]">نظرة السوق الشاملة</h3>
              <p className="text-sm text-[#5a5548] max-w-md leading-relaxed mt-2">تقييم لحظي لجميع أرصدة المخازن والسيولة والديون بناءً على متوسط أسعار السوق.</p>
            </div>
          </div>
          <div className="text-center md:text-left bg-[#080a0f] p-6 rounded-2xl border border-[#c9a84c11]">
            <p className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest mb-2 opacity-80">إجمالي القيمة التقديرية (صافي)</p>
            <div className="flex items-baseline gap-2 justify-center md:justify-end">
              <span className="text-5xl lg:text-6xl font-black text-[#ddd8cc] font-mono tracking-tighter">
                {new Intl.NumberFormat('en-US').format(Math.round(valuation.netVal))}
              </span>
              <span className="text-base font-bold text-[#5a5548]">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 shadow-xl space-y-4 hover:border-[#c9a84c33] transition-colors"
          >
            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center bg-opacity-10", card.color.replace('text-', 'bg-'), card.color)}>
              {React.cloneElement(card.icon as React.ReactElement, { className: "w-8 h-8" })}
            </div>
            <div>
              <div className="text-xs text-[#5a5548] font-bold uppercase mb-1">{card.title}</div>
              <div className="flex justify-between items-baseline mb-1">
                <span className={cn("text-3xl font-black font-mono", card.color)}>
                  {new Intl.NumberFormat('en-US').format(Math.round(card.val))}
                </span>
                <span className="text-xs text-[#5a5548] font-bold">ج.م</span>
              </div>
              <div className="text-xs text-[#3a3530] font-bold">{card.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Breakdown by Type */}
      <h4 className="text-sm font-bold text-[#5a5548] uppercase tracking-[0.2em] px-2">توزيع الأرصدة الفعلية</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {breakdown.map((item, i) => (
          <div key={i} className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-5 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-[#ddd8cc] bg-opacity-20 shadow-inner", item.color)}>
              {React.cloneElement(item.icon as React.ReactElement, { className: "w-6 h-6" })}
            </div>
            <div className="flex-1">
              <div className="text-xs text-[#5a5548] font-bold mb-1">{item.title}</div>
              <div className="text-base md:text-lg font-bold text-[#ddd8cc] font-mono">
                {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(item.val)}
                <span className="text-xs font-sans text-[#5a5548] mr-1">{item.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composition Bar */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex justify-between items-center">
            <h4 className="text-base font-bold text-[#ddd8cc] flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-[#c9a84c]" /> نسب التوزيع المالي
            </h4>
            <span className="text-xs text-[#5a5548] font-mono">التقييم حسب سعر الإقفال</span>
        </div>
        
        <div className="h-4 bg-[#1a1e2a] rounded-full flex overflow-hidden shadow-inner">
          {[
            { metric: 'السيولة', val: valuation.assets.cash + valuation.liabilities.cash, color: 'bg-[#6a9e6a]' },
            { metric: 'الذهب', val: (valuation.assets.gold + valuation.liabilities.gold) * (goldPrice || 0), color: 'bg-[#c9a84c]' },
            { metric: 'الفضة', val: (valuation.assets.silver + valuation.liabilities.silver) * (silverPrice || 0), color: 'bg-[#6a8a9e]' },
            { metric: 'الملحقات', val: valuation.assets.accsVal + valuation.liabilities.accsVal, color: 'bg-[#9e8a6a]' },
          ].map((item, i) => {
             const grow = Math.max(0, (item.val / valuation.netVal) * 100);
             if (grow < 1) return null;
             return (
               <div 
                 key={i} 
                 style={{ width: `${grow}%` }} 
                 className={cn("h-full transition-all duration-1000", item.color)} 
                 title={`${item.metric}: ${grow.toFixed(1)}%`}
               />
             );
          })}
        </div>

        <div className="flex flex-wrap gap-6 justify-center">
           {[
             { label: 'نقدية', color: 'bg-[#6a9e6a]' },
             { label: 'ذهب', color: 'bg-[#c9a84c]' },
             { label: 'فضة', color: 'bg-[#6a8a9e]' },
             { label: 'ملحقات', color: 'bg-[#9e8a6a]' },
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-2 text-xs text-[#5a5548] font-bold">
               <div className={cn("w-3 h-3 rounded-full", item.color)} />
               <span>{item.label}</span>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
});
