import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waves, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Scale, 
  Coins, 
  Package 
} from 'lucide-react';
import { Entry } from '../../../types';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store';
import { belongsToMetric, getMetricValue, getAccountTypeDetails } from '../../../utils/accountLogic';

type LedgerType = 'cash' | 'gold' | 'silver' | 'accs';

export const CashFlowView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb } = useAppStore();
  const [activeTab, setActiveTab] = useState<LedgerType>('cash');

  const flowData = useMemo(() => {
    const calculateFlow = (metric: LedgerType) => {
      const report = {
        inflow: { total: 0, categories: {} as Record<string, number> },
        outflow: { total: 0, categories: {} as Record<string, number> },
        netChange: 0
      };

      entries.forEach(e => {
        const val = getMetricValue(e, metric, accountsDb);
        if (val === 0) return;

        // Inflow: Debit is our metric account
        if (belongsToMetric(e.debit, metric, accountsDb)) {
          report.inflow.total += val;
          const details = getAccountTypeDetails(e.credit, accountsDb);
          const group = details.sub || 'أخرى';
          report.inflow.categories[group] = (report.inflow.categories[group] || 0) + val;
        }

        // Outflow: Credit is our metric account
        if (belongsToMetric(e.credit, metric, accountsDb)) {
          report.outflow.total += val;
          const details = getAccountTypeDetails(e.debit, accountsDb);
          const group = details.sub || 'أخرى';
          report.outflow.categories[group] = (report.outflow.categories[group] || 0) + val;
        }
      });

      report.netChange = report.inflow.total - report.outflow.total;
      return report;
    };

    return {
      cash: calculateFlow('cash'),
      gold: calculateFlow('gold'),
      silver: calculateFlow('silver'),
      accs: calculateFlow('accs')
    };
  }, [entries, accountsDb]);

  const renderCurrentFlow = () => {
    const data = flowData[activeTab];
    let unit = 'ج.م';
    let accentColor = 'text-[#6a9e6a]';
    let labelIn = 'المقبوضات (الداخل)';
    let labelOut = 'المدفوعات (الخارج)';
    let title = 'النقدية';

    if (activeTab === 'cash') { title = 'السيولة النقدية'; accentColor = 'text-[#6a9e6a]'; unit = 'ج.م'; }
    if (activeTab === 'gold') { title = 'الذهب (أوزان)'; accentColor = 'text-[#c9a84c]'; unit = 'جم عربي'; labelIn = 'وارد أوزان (زيادة)'; labelOut = 'صادر أوزان (نقص)'; }
    if (activeTab === 'silver') { title = 'الفضة (أوزان)'; accentColor = 'text-[#6a8a9e]'; unit = 'جرام'; labelIn = 'وارد أوزان (زيادة)'; labelOut = 'صادر أوزان (نقص)'; }
    if (activeTab === 'accs') { title = 'الملحقات'; accentColor = 'text-[#9e8a6a]'; unit = 'قطعة'; labelIn = 'وارد عدد (زيادة)'; labelOut = 'صادر عدد (نقص)'; }

    const isPositive = data.netChange >= 0;

    return (
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-8"
      >
        <div className="space-y-6">
          {/* Inflows */}
          <div className="space-y-4">
            <div className={cn("flex items-center gap-2 font-bold text-base", activeTab === 'cash' ? "text-[#6a9e6a]" : accentColor)}>
              <ArrowUpRight className="w-5 h-5" />
              <span>{labelIn}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(data.inflow.categories).map(([name, val]) => (
                <div key={name} className="bg-[#111420] p-4 rounded-xl border border-[#1a1e2a] flex justify-between items-center group hover:border-[#c9a84c33] transition-colors">
                  <span className="text-xs text-[#5a5548] font-bold">{name}</span>
                  <span className="text-base font-bold text-[#ddd8cc] font-mono">
                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 }).format(val as number)}
                  </span>
                </div>
              ))}
              {Object.keys(data.inflow.categories).length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-[#5a5548] border border-dashed border-[#1a1e2a] rounded-xl">لا توجد تدفقات داخلة</div>
              )}
            </div>
          </div>

          {/* Outflows */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#9e6a6a] font-bold text-base">
              <ArrowDownLeft className="w-5 h-5" />
              <span>{labelOut}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(data.outflow.categories).map(([name, val]) => (
                <div key={name} className="bg-[#111420] p-4 rounded-xl border border-[#1a1e2a] flex justify-between items-center group hover:border-[#9e6a6a33] transition-colors">
                  <span className="text-xs text-[#5a5548] font-bold">{name}</span>
                  <span className="text-base font-bold text-[#ddd8cc] font-mono">
                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 }).format(val as number)}
                  </span>
                </div>
              ))}
              {Object.keys(data.outflow.categories).length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-[#5a5548] border border-dashed border-[#1a1e2a] rounded-xl">لا توجد تدفقات خارجة</div>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className={cn(
          "bg-[#080a0f] p-6 rounded-2xl border flex justify-between items-center shadow-xl",
          isPositive ? "border-green-500/20" : "border-red-500/20"
        )}>
           <div className="flex flex-col">
              <span className="text-sm font-bold text-[#ddd8cc] uppercase tracking-wider">صافي تغير {title}</span>
              <span className="text-xs text-[#5a5548]">إجمالي الوارد - إجمالي الصادر</span>
           </div>
           <div className="text-right">
              <span className={cn("text-4xl font-bold font-mono", isPositive ? "text-[#6a9e6a]" : "text-[#9e6a6a]")}>
                {isPositive ? '+' : ''}{new Intl.NumberFormat('en-US', { minimumFractionDigits: activeTab === 'cash' ? 0 : 2, maximumFractionDigits: 2 }).format(data.netChange)}
              </span>
              <span className="text-sm text-[#5a5548] mr-2">{unit}</span>
           </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-[#1a1e2a] pb-4">
          <Waves className="w-6 h-6 text-[#c9a84c]" />
          <div>
            <h3 className="text-lg font-bold text-[#ddd8cc]">تحليل التدفقات (Cash & Weight Flows)</h3>
            <p className="text-xs text-[#5a5548]">تتبع حركة السيولة والوزن الداخل والخارج من المركز المالي</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0a0c14] p-2 rounded-2xl border border-[#1a1e2a]">
          <button onClick={() => setActiveTab('cash')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'cash' ? "bg-[#6a9e6a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
            <Wallet className="w-4 h-4" /> تدفق النقدية
          </button>
          <button onClick={() => setActiveTab('gold')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'gold' ? "bg-[#c9a84c] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
            <Scale className="w-4 h-4" /> تدفق الذهب
          </button>
          <button onClick={() => setActiveTab('silver')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'silver' ? "bg-[#6a8a9e] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
            <Coins className="w-4 h-4" /> تدفق الفضة
          </button>
          <button onClick={() => setActiveTab('accs')} className={cn("py-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'accs' ? "bg-[#9e8a6a] text-[#080a0f] shadow-lg" : "text-[#5a5548] hover:bg-[#1a1e2a]")}>
            <Package className="w-4 h-4" /> تدفق الملحقات
          </button>
        </div>

        <AnimatePresence mode="wait">
          {renderCurrentFlow()}
        </AnimatePresence>
      </div>
    </div>
  );
});
