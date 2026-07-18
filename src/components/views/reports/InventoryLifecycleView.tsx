import React, { useMemo, useState } from 'react';
import { Entry, AccountNature } from '../../../types';
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, Factory, Settings2 } from 'lucide-react';
import { getMetricActualValue, getDynamicAccountNature } from '../../../utils/accountLogic';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';

interface Props {
  entries: Entry[];
}

export const InventoryLifecycleView: React.FC<Props> = ({ entries }) => {
  const { accountsDb } = useAppStore();
  const [metal, setMetal] = useState<'gold' | 'silver'>('gold');

  const lifecycle = useMemo(() => {
    let rawPurchases = 0;
    let sentToWorkshop = 0;
    let receivedFromWorkshop = 0;
    let finishedGoodsSold = 0;

    entries.forEach(e => {
      const w = getMetricActualValue(e, metal, accountsDb);
      if (w === 0) return;

      const debitNature = getDynamicAccountNature(e.debit, accountsDb);
      const creditNature = getDynamicAccountNature(e.credit, accountsDb);

      const isScrapDebit = (e.debit.includes('كسر') || e.debit.includes('سكراب') || e.debit.includes('خام') || e.debit.includes('سبائك')) && (metal === 'gold' ? !e.debit.includes('فضة') : e.debit.includes('فضة'));
      const isScrapCredit = (e.credit.includes('كسر') || e.credit.includes('سكراب') || e.credit.includes('خام') || e.credit.includes('سبائك')) && (metal === 'gold' ? !e.credit.includes('فضة') : e.credit.includes('فضة'));

      const isWorkshopDebit = e.debit.includes('تشغيل') || e.debit.includes('ورشة') || e.debit.includes('مصنع') || e.debit.includes('صياغة');
      const isWorkshopCredit = e.credit.includes('تشغيل') || e.credit.includes('ورشة') || e.credit.includes('مصنع') || e.credit.includes('صياغة');

      const isFinishedDebit = e.debit.includes('مشغول') || e.debit.includes('غوايش') || e.debit.includes('خواتم') || ((debitNature === (metal === 'gold' ? AccountNature.GOLD : AccountNature.SILVER) || debitNature === (metal === 'gold' ? AccountNature.MIXED_GOLD : AccountNature.MIXED_SILVER)) && !isScrapDebit && !isWorkshopDebit);
      const isFinishedCredit = e.credit.includes('مشغول') || e.credit.includes('غوايش') || e.credit.includes('خواتم') || ((creditNature === (metal === 'gold' ? AccountNature.GOLD : AccountNature.SILVER) || creditNature === (metal === 'gold' ? AccountNature.MIXED_GOLD : AccountNature.MIXED_SILVER)) && !isScrapCredit && !isWorkshopCredit);
      
      const isSalesCredit = e.tx.includes('بيع') || e.credit.includes('بيع') || e.credit.includes('مبيعات') || e.credit.includes('عميل');
      const isPurchaseCredit = e.tx.includes('شراء') || e.credit.includes('شراء') || e.credit.includes('مشتريات') || e.credit.includes('صندوق') || e.credit.includes('خزينة') || e.credit.includes('تاجر');

      // 1. Raw Purchases
      if (isScrapDebit && (isPurchaseCredit || e.tx.includes('شراء') || e.tx === 'قيد افتتاحي')) {
        rawPurchases += w;
      }
      
      // 2. Sent to workshop
      if (isWorkshopDebit && isScrapCredit) {
        sentToWorkshop += w;
      } else if (isWorkshopDebit && w > 0 && e.tx.includes('تحويل')) {
        sentToWorkshop += w;
      }

      // 3. Received from factory
      if (isFinishedDebit && isWorkshopCredit) {
        receivedFromWorkshop += w;
      } else if (isFinishedDebit && w > 0 && e.tx === 'استلام مشغول') {
        receivedFromWorkshop += w;
      }

      // 4. Sales
      if (isFinishedCredit && isSalesCredit) {
        finishedGoodsSold += w;
      } else if (isFinishedCredit && w > 0 && e.tx.includes('بيع')) {
        finishedGoodsSold += w;
      }
    });

    return { rawPurchases, sentToWorkshop, receivedFromWorkshop, finishedGoodsSold };
  }, [entries, accountsDb, metal]);

  const themeConfig = metal === 'gold' 
    ? { icon: 'text-[#c9a84c]', bg: 'bg-[#c9a84c]/50' } 
    : { icon: 'text-gray-300', bg: 'bg-gray-300/50' };

  return (
    <div className="space-y-6 dir-rtl pb-20">
      <div className="flex items-center gap-2 mb-4 bg-[#0e1018] p-2 rounded-xl w-fit border border-[#1a1e2a]">
        <button
          onClick={() => setMetal('gold')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
            metal === 'gold' ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#8a8578] hover:text-[#f8fafc]"
          )}
        >
          حركة الذهب
        </button>
        <button
          onClick={() => setMetal('silver')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-bold transition-all",
            metal === 'silver' ? "bg-gray-300 text-[#080a0f]" : "text-[#8a8578] hover:text-[#f8fafc]"
          )}
        >
          حركة الفضة
        </button>
      </div>

      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-2 h-full ${themeConfig.bg}`} />
        <h2 className="text-xl font-bold text-[#f8fafc] flex items-center gap-2 mb-6">
          <Factory className={`w-6 h-6 ${themeConfig.icon}`} />
          دورة حياة المخزون ({metal === 'gold' ? 'الذهب' : 'الفضة'})
        </h2>
        
        <div className="text-sm text-[#8a8578] mb-6 border-b border-[#1a1e2a] pb-4 flex items-center justify-between">
          <span>يتبع هذا التقرير حركة الشراء ككسر/خام، ثم الإرسال للورشة للتصنيع، ثم استلامه كمشغول، وأخيراً بيعه للعملاء.</span>
          <Settings2 className="w-5 h-5 text-[#8a8578]/50" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Connector Line for Desktop */}
          <div className="hidden md:block absolute top-[50%] right-[10%] left-[10%] h-[2px] bg-[#1a1e2a] -z-10" />

          {/* 1. Purchases */}
          <div className="bg-[#080a0f] p-5 rounded-2xl border border-[#1a1e2a] flex flex-col items-center justify-center text-center relative z-10 hover:border-green-500/50 transition-colors">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-3">
              <ArrowDownRight className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-[#f8fafc] font-bold mb-1">شراء كسر / خام</h3>
            <p className="text-xs text-[#8a8578] mb-3">دخول للمخزن</p>
            <p className="text-3xl font-mono text-green-400 font-bold">{lifecycle.rawPurchases.toFixed(2)}<span className="text-sm ml-1 text-[#8a8578]">جم</span></p>
          </div>
          
          {/* 2. To Workshop */}
          <div className="bg-[#080a0f] p-5 rounded-2xl border border-[#1a1e2a] flex flex-col items-center justify-center text-center relative z-10 hover:border-yellow-500/50 transition-colors">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mb-3">
              <ArrowLeftRight className="w-6 h-6 text-yellow-500" />
            </div>
            <h3 className="text-[#f8fafc] font-bold mb-1">إرسال للورشة / تصنيع</h3>
            <p className="text-xs text-[#8a8578] mb-3">تحت التشغيل</p>
            <p className="text-3xl font-mono text-yellow-400 font-bold">{lifecycle.sentToWorkshop.toFixed(2)}<span className="text-sm ml-1 text-[#8a8578]">جم</span></p>
          </div>

          {/* 3. From Workshop */}
          <div className="bg-[#080a0f] p-5 rounded-2xl border border-[#1a1e2a] flex flex-col items-center justify-center text-center relative z-10 hover:border-blue-500/50 transition-colors">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-3">
              <ArrowLeftRight className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-[#f8fafc] font-bold mb-1">استلام مشغول</h3>
            <p className="text-xs text-[#8a8578] mb-3">خروج من الورشة</p>
            <p className="text-3xl font-mono text-blue-400 font-bold">{lifecycle.receivedFromWorkshop.toFixed(2)}<span className="text-sm ml-1 text-[#8a8578]">جم</span></p>
          </div>

          {/* 4. Sales */}
          <div className="bg-[#080a0f] p-5 rounded-2xl border border-[#1a1e2a] flex flex-col items-center justify-center text-center relative z-10 hover:border-purple-500/50 transition-colors">
            <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mb-3">
              <ArrowUpRight className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-[#f8fafc] font-bold mb-1">مبيعات مشغول</h3>
            <p className="text-xs text-[#8a8578] mb-3">خروج من المخزن للعملاء</p>
            <p className="text-3xl font-mono text-purple-400 font-bold">{lifecycle.finishedGoodsSold.toFixed(2)}<span className="text-sm ml-1 text-[#8a8578]">جم</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};
