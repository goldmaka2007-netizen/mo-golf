import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Entry } from '../../../types';
import { RefreshCw, ArrowDownRight, ArrowUpRight, Filter, Box, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store';
import {
  buildScrapAnalysisModel,
  type WeightedPartyBalance,
} from '../../../lib/scrapAnalysis';

interface Props {
  entries: Entry[];
  allEntries?: Entry[];
}

const WeightedBalanceSection = ({ title, balances }: {
  title: string;
  balances: WeightedPartyBalance[];
}) => (
  <section className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-5">
    <h3 className="text-lg font-bold text-[#f8fafc] mb-4">{title}</h3>
    <div className="space-y-3">
      {balances.length === 0 && <div className="text-sm text-[#8a8578]">{'\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0631\u0635\u062f\u0629'}</div>}
      {balances.map(balance => (
        <div key={balance.accountId} className="rounded-xl bg-[#1a1e2a]/50 p-3">
          <div className="flex justify-between gap-2">
            <strong className="text-[#f8fafc]">{balance.name}</strong>
            <span className="text-xs text-[#c9a84c]">{balance.direction} - {balance.directionDescription}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[#8a8578]">
            <span>{balance.metal === 'gold' ? '\u0630\u0647\u0628' : '\u0641\u0636\u0629'}: <b className="font-mono text-[#f8fafc]">{balance.actualBalance.toFixed(3)} {'\u062c\u0645'}</b></span>
            {balance.metal === 'gold' && <span>{'\u0645\u0643\u0627\u0641\u0626 21'}: <b className="font-mono text-[#f8fafc]">{balance.goldE21Balance.toFixed(3)} {'\u062c\u0645'}</b></span>}
          </div>
        </div>
      ))}
    </div>
  </section>
);

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

  const model = useMemo(
    () => buildScrapAnalysisModel(baseEntries, accountsDb, selectedMonth, karatFilter),
    [baseEntries, accountsDb, selectedMonth, karatFilter],
  );
  const analysis = model.movement;
  const centralLegacyFallbacks = model.weightedParties.legacyNameMatchedEntries;

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WeightedBalanceSection title={'\u0623\u0631\u0635\u062f\u0629 \u0627\u0644\u062a\u062c\u0627\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629'} balances={model.weightedParties.merchants} />
        <WeightedBalanceSection title={'\u0630\u0645\u0645 \u0648\u0632\u0646\u064a\u0629 \u0623\u062e\u0631\u0649'} balances={model.weightedParties.otherDues} />
      </div>

      {(analysis.legacyFallbacks.length > 0 || centralLegacyFallbacks.length > 0) && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="font-bold text-amber-300">{'\u062a\u062d\u0630\u064a\u0631 Legacy fallback \u0645\u062c\u0645\u0639'}</h3>
          {analysis.legacyFallbacks.map((warning, index) => (
            <div className="text-xs text-amber-100/80" key={'scrap-' + warning.entryId + index}>
              {warning.entryId} - {warning.missingField} - {warning.reason} - {warning.classification}
            </div>
          ))}
          {centralLegacyFallbacks.map((warning, index) => (
            <div className="text-xs text-amber-100/80" key={'balance-' + warning.entryId + index}>
              {warning.entryId} - {warning.side}AccountId - {warning.reason} - account:{warning.accountId}
            </div>
          ))}
        </section>
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
