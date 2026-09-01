import React, { useMemo, useState } from 'react';
import { ChevronDown, Landmark } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import type { EquityMovementDetail } from '../../../lib/equityStatementEgp';
import { buildCentralAccountingReadOnlyRuntimeEquityStatement } from '../../../lib/centralAccountingReadOnlyRuntime';
import { visibleFinancialPositionMonths } from '../../../lib/monthlyFinancialPosition';
import { formatEgpAmount, formatWeight } from '../../../lib/formatting';

const money = (value: number) => formatEgpAmount(value);
const Drilldown = ({ label, amount, rows, tone = '' }: { label: string; amount: number; rows: EquityMovementDetail[]; tone?: string }) => {
  const [open, setOpen] = useState(false);
  return <div className="rounded-xl border border-[#1a1e2a] bg-[#0e1018]"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-right"><span className="font-bold">{label}</span><span className={`font-mono font-bold ${tone}`}>{money(amount)} <ChevronDown className={`mr-2 inline h-4 w-4 ${open ? 'rotate-180' : ''}`} /></span></button>{open && <div className="space-y-1 border-t border-[#1a1e2a] p-2">{rows.length ? rows.map(row => <div key={row.id} className="flex justify-between rounded-lg bg-[#080a0f] p-2 text-sm"><span>{row.label}</span><span className="font-mono">{money(row.amount)}</span></div>) : <div className="p-2 text-sm text-[#8a8172]">لا توجد حركة خلال الفترة.</div>}</div>}</div>;
};

export const EquityStatementView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, canonicalAccounts, openingCostConfig, goldPrice, silverPrice } = useAppStore();
  const year = new Date().getFullYear();
  const months = useMemo(() => visibleFinancialPositionMonths(entries, year), [entries, year]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const selected = months.find(month => month.month === selectedMonth) ?? months.at(-1);
  const runtime = useMemo(() => selected && buildCentralAccountingReadOnlyRuntimeEquityStatement({
    entries,
    accounts: accountsDb,
    canonicalDefinitions: canonicalAccounts,
    openingCostConfig,
    cutoffDate: selected.cutoffDate,
    goldPriceEgp: goldPrice,
    silverPriceEgp: silverPrice,
  }), [selected, entries, accountsDb, canonicalAccounts, openingCostConfig, goldPrice, silverPrice]);

  if (!selected) return <div className="rounded-2xl bg-[#0e1018] p-4" dir="rtl">لا توجد بيانات للسنة الحالية.</div>;
  if (!runtime || runtime.status === 'blocked' || !runtime.equityStatement) return <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100" dir="rtl"><p className="font-bold">تعذر تشغيل قائمة التغيرات في حقوق الملكية عبر المسار المركزي الآمن.</p><p className="mt-1 text-xs text-amber-200/80">لم يتم الرجوع للمسار القديم. الحالة: {runtime?.blockers[0]?.code ?? 'central_read_only_blocked'}</p></div>;
  const result = runtime.equityStatement;
  if (!result.available) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100" dir="rtl">{result.diagnostic}</div>;
  const r = result.report;
  return <section dir="rtl" data-balance-engine={runtime.balanceEngineVersion ?? undefined} className="space-y-4 pb-20"><header className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4"><h3 className="flex items-center gap-2 text-lg font-black"><Landmark className="h-5 w-5 text-[#c9a84c]" />قائمة التغيرات في حقوق الملكية — جنيه مصري</h3><p className="mt-2 text-xs text-[#8a8172]">من {year}-01-01 حتى {selected.cutoffDate}</p><div className="mt-3 flex gap-2 overflow-x-auto">{months.map(month => <button key={month.month} onClick={() => setSelectedMonth(month.month)} className={`min-h-11 shrink-0 rounded-xl px-4 ${month.month === selected.month ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#080a0f]'}`}>{month.label}</button>)}</div></header><div className="rounded-2xl border border-green-400/30 bg-[#0e1018] p-4"><div className="font-black">إجمالي حقوق الملكية المتراكمة</div><div className="mt-2 font-mono text-2xl font-black">{money(r.endingEquity)}</div><div className="mt-3 border-t border-[#1a1e2a] pt-3 text-xs"><div className="text-[#c9a84c]">صافي ملكية الذهب (مؤشر داعم): {formatWeight(r.ownership.netGoldOwnership21, 3)} جرام عيار 21</div><div className="mt-1 text-slate-300">صافي ملكية الفضة (مؤشر داعم): {formatWeight(r.ownership.netSilverOwnershipGrams, 3)} جرام</div></div></div><div className="space-y-2"><Drilldown label="حقوق الملكية أول السنة" amount={r.openingEquity} rows={r.openingDetails} /><Drilldown label="إضافات رأس المال" amount={r.capitalAdditions.reduce((sum, row) => sum + row.amount, 0)} rows={r.capitalAdditions} tone="text-[#6a9e6a]" /><Drilldown label="المسحوبات" amount={r.drawings.reduce((sum, row) => sum + row.amount, 0)} rows={r.drawings} tone="text-[#9e6a6a]" /><Drilldown label="حركات مباشرة على حقوق الملكية" amount={r.directMovements.reduce((sum, row) => sum + row.amount, 0)} rows={r.directMovements} /><Drilldown label="صافي ربح / خسارة الفترة" amount={r.currentYtdProfit} rows={r.currentProfitDetails} /><Drilldown label="حقوق الملكية آخر الفترة" amount={r.endingEquity} rows={r.endingDetails} /></div></section>;
});
