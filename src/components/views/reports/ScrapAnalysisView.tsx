import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Entry, AccountNature } from '../../../types';
import { RefreshCw, ArrowDownRight, ArrowUpRight, Filter, Box, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getMetricActualValue, getDynamicAccountNature } from '../../../utils/accountLogic';
import { useAppStore } from '../../../store';

interface Props {
  entries: Entry[];
  allEntries?: Entry[];
}

export const ScrapAnalysisView: React.FC<Props> = ({ entries, allEntries }) => {
  const { accountsDb } = useAppStore();
  const [karatFilter, setKaratFilter] = useState<'all' | '18' | '21'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // To build the month selector, use all entries available
  const baseEntries = allEntries && allEntries.length > 0 ? allEntries : entries;

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    baseEntries.forEach(e => {
      if (e.date) {
         const ym = e.date.substring(0, 7);
         months.add(ym);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [baseEntries]);

  // Filter entries to analyze for IN/OUT within the selected period
  const dataToAnalyze = useMemo(() => {
    if (selectedMonth === 'all') return baseEntries;
    return baseEntries.filter(e => e.date && e.date.startsWith(selectedMonth));
  }, [baseEntries, selectedMonth]);

  const analysis = useMemo(() => {
    let purchased = 0;
    
    let toTifit = 0;
    let toMerchants = 0;
    let soldAsScrap = 0;
    let othersOut = 0;
    let othersIn = 0;

    const tifitDetails: Record<string, number> = {};

    dataToAnalyze.forEach(e => {
      const debitNature = getDynamicAccountNature(e.debit, accountsDb);
      const creditNature = getDynamicAccountNature(e.credit, accountsDb);
      
      const isScrapDebit = (e.debit.includes('كسر') || e.debit.includes('سكراب')) && !e.debit.includes('فضة') && (debitNature === AccountNature.GOLD || debitNature === AccountNature.MIXED_GOLD);
      const isScrapCredit = (e.credit.includes('كسر') || e.credit.includes('سكراب')) && !e.credit.includes('فضة') && (creditNature === AccountNature.GOLD || creditNature === AccountNature.MIXED_GOLD);

      const isKarat18 = e.debit.includes('١٨') || e.credit.includes('١٨') || e.debit.includes('18') || e.credit.includes('18') || e.tx.includes('١٨') || e.tx.includes('18') || e.debit.includes('افرنجي') || e.credit.includes('افرنجي');
      const isKarat21 = e.debit.includes('٢١') || e.credit.includes('21') || e.debit.includes('عربي') || e.credit.includes('عربي');

      if (karatFilter === '18' && !isKarat18) return;
      if (karatFilter === '21' && !isKarat21) return;

      const w = getMetricActualValue(e, 'gold', accountsDb);
      if (w === 0) return;

      if (isScrapDebit) {
        if (e.tx === 'شراء ذهب') {
          purchased += w;
        } else if (e.tx === 'قيد افتتاحي') {
          purchased += w; // count opening as incoming for the balance
        } else {
          othersIn += w;
        }
      }

      if (isScrapCredit) {
        if (e.tx === 'تيفيت' || e.tx === 'تحويل') {
          toTifit += w;
          // Record the product name that received this scrap
          if (e.debit && e.debit !== 'كسر عربي' && e.debit !== 'كسر افرنجي') {
            tifitDetails[e.debit] = (tifitDetails[e.debit] || 0) + w;
          }
        } else if (e.tx === 'حساب تاجر ذهب') {
          toMerchants += w;
        } else if (e.tx === 'بيع ذهب') {
          soldAsScrap += w;
        } else {
          othersOut += w;
        }
      }
    });

    const totalIn = purchased + othersIn;
    const totalOut = toTifit + toMerchants + soldAsScrap + othersOut;
    const currentBalance = totalIn - totalOut;

    // Convert tifitDetails to array and sort by weight descending
    const tifitList = Object.entries(tifitDetails)
      .map(([name, weight]) => ({ name, weight }))
      .sort((a, b) => b.weight - a.weight);

    return {
      purchased,
      othersIn,
      totalIn,
      
      toTifit,
      toMerchants,
      soldAsScrap,
      othersOut,
      totalOut,
      
      currentBalance,
      tifitList
    };
  }, [dataToAnalyze, karatFilter]);

  return (
    <div className="space-y-6 dir-rtl pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0e1018] p-4 rounded-2xl border border-[#1a1e2a]">
        <div>
          <h2 className="text-xl font-bold text-[#f8fafc] flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#c9a84c]" />
            تحليل حركة الكسر
          </h2>
          <p className="text-sm text-[#8a8578] mt-1">
            يعرض هذا التقرير كميات الكسر وإجمالي الداخل والخارج للوصول للرصيد الحالي
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#1a1e2a] p-1 rounded-xl">
          <Filter className="w-4 h-4 text-[#8a8578] mx-2" />
          {(['all', '18', '21'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKaratFilter(k)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                karatFilter === k
                  ? 'bg-[#c9a84c] text-[#080a0f]'
                  : 'text-[#8a8578] hover:text-[#f8fafc] hover:bg-[#2a2e3a]'
              }`}
            >
              {k === 'all' ? 'الكل' : k === '18' ? 'كسر إفرنجي (18)' : 'كسر عربي (21)'}
            </button>
          ))}
        </div>
      </div>

      {availableMonths.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          <button
            onClick={() => setSelectedMonth('all')}
            className={cn(
              "whitespace-nowrap px-6 py-3 rounded-xl text-sm font-bold transition-all snap-start shadow-sm border flex items-center gap-2",
              selectedMonth === 'all' 
                ? "bg-[#c9a84c] text-[#080a0f] border-[#c9a84c]" 
                : "bg-[#0e1018] text-[#5a5548] border-[#1a1e2a] hover:border-[#c9a84c55] hover:text-[#ddd8cc]"
            )}
          >
            <Calendar className="w-4 h-4" />
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
                  "whitespace-nowrap px-6 py-3 rounded-xl text-sm font-bold transition-all snap-start shadow-sm border capitalize flex items-center gap-2",
                  selectedMonth === ym 
                    ? "bg-[#c9a84c] text-[#080a0f] border-[#c9a84c]" 
                    : "bg-[#0e1018] text-[#5a5548] border-[#1a1e2a] hover:border-[#c9a84c55] hover:text-[#ddd8cc]"
                )}
              >
                <Calendar className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-[#1a1e2a]/50 border border-[#1a1e2a] rounded-2xl p-4 text-center text-[#f8fafc] font-bold text-lg max-w-4xl mx-auto shadow-sm">
        إجمالي الداخل <span className="text-green-400 font-mono">({Math.abs(analysis.totalIn).toFixed(2)})</span> = إجمالي الخارج <span className="text-blue-400 font-mono">({Math.abs(analysis.totalOut).toFixed(2)})</span>
        {selectedMonth === 'all' && (
          <> + الكسر الموجود حالياً <span className="text-[#c9a84c] font-mono">({Math.abs(analysis.currentBalance).toFixed(2)})</span></>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* المشتريات (الداخل) */}
        <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-green-500/20" />
          <h3 className="text-lg font-bold text-[#f8fafc] mb-6 flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-green-500" />
            إجمالي الداخل
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-[#1a1e2a]">
              <span className="text-[#8a8578] font-medium">مشتريات ورصيد افتتاحي</span>
              <span className="text-xl font-mono font-bold text-green-400">
                {analysis.purchased.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
              </span>
            </div>
            
            {analysis.othersIn > 0 && (
              <div className="flex justify-between items-center py-3 border-b border-[#1a1e2a]">
                <span className="text-[#8a8578] font-medium">أخرى (تسويات ومرتجعات)</span>
                <span className="text-lg font-mono text-green-400">
                  {analysis.othersIn.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
                </span>
              </div>
            )}
            
            <div className="pt-4 flex justify-between items-center">
              <span className="text-[#f8fafc] font-bold">إجمالي الداخل</span>
              <span className="text-2xl font-mono font-bold text-green-500">
                {analysis.totalIn.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
              </span>
            </div>
          </div>
        </div>

        {/* المنصرف (التوزيع) */}
        <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-500/20" />
          <h3 className="text-lg font-bold text-[#f8fafc] mb-6 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-blue-500" />
             إجمالي الخارج {selectedMonth === 'all' && '+ الرصيد الحالي'}
          </h3>

          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center py-3 border-b border-[#1a1e2a]">
              <div className="flex flex-col">
                <span className="text-[#f8fafc] font-bold">تحويل لأصناف (تيفيت)</span>
                <span className="text-xs text-[#8a8578]">يتحول لأصناف جاهزة للبيع</span>
              </div>
              <span className="text-lg font-mono font-bold text-[#f8fafc]">
                {analysis.toTifit.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-[#1a1e2a]">
              <div className="flex flex-col">
                <span className="text-[#f8fafc] font-bold">تسديد حسابات التجار</span>
                <span className="text-xs text-[#8a8578]">تم دفعه للتجار كذهب</span>
              </div>
              <span className="text-lg font-mono font-bold text-[#f8fafc]">
                {analysis.toMerchants.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-[#1a1e2a]">
              <div className="flex flex-col">
                <span className="text-[#f8fafc] font-bold">مبيعات كسر مباشرة</span>
                <span className="text-xs text-[#8a8578]">بيع كما هو للعملاء أو التجار</span>
              </div>
              <span className="text-lg font-mono font-bold text-[#f8fafc]">
                {analysis.soldAsScrap.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
              </span>
            </div>

            {analysis.othersOut > 0 && (
              <div className="flex justify-between items-center py-3 border-b border-[#1a1e2a]">
                <span className="text-[#8a8578] font-medium">منصرف أخرى (تسويات)</span>
                <span className="text-lg font-mono text-[#8a8578]">
                  {analysis.othersOut.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
                </span>
              </div>
            )}
            
            <div className="pt-2 flex justify-between items-center">
              <span className="text-blue-400 font-bold">إجمالي الخارج</span>
              <span className="text-xl font-mono font-bold text-blue-500">
                {analysis.totalOut.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
              </span>
            </div>
            
            {selectedMonth === 'all' && (
              <div className="pt-2 flex justify-between items-center border-t border-[#1a1e2a] mt-2">
                <span className="text-[#c9a84c] font-bold">الكسر الموجود حالياً (بالمخزن)</span>
                <span className="text-2xl font-mono font-bold text-[#c9a84c]">
                  {analysis.currentBalance.toFixed(2)} <span className="text-sm text-[#8a8578]">جم</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {analysis.tifitList.length > 0 && (
        <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#f8fafc] mb-6 flex items-center gap-2">
            <Box className="w-5 h-5 text-purple-500" />
            تفاصيل الأصناف المستلمة (من التيفيت والتحويل)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {analysis.tifitList.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-[#1a1e2a]/50 p-3 rounded-xl border border-[#1a1e2a]">
                <span className="text-[#f8fafc] font-bold">{item.name}</span>
                <span className="text-purple-400 font-mono font-bold">
                  {item.weight.toFixed(2)} <span className="text-xs text-[#8a8578]">جم</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

