import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, TrendingUp } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildFinancialStatementsEgp } from '../../../lib/financialStatementsEgp';
import { exportToExcel } from '../../../utils/exportUtils';
import { cn } from '../../../lib/utils';

const money = (value: number) => value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const Row: React.FC<{ label: string; value: number; total?: boolean }> = ({ label, value, total = false }) => (
  <div className={cn('flex justify-between gap-3 rounded-xl px-3 py-2 text-sm', total ? 'border border-[#c9a84c33] bg-[#c9a84c0d] font-black' : 'bg-[#080a0f]')}>
    <span>{label}</span><span className="font-mono tabular-nums">{money(value)} ج.م</span>
  </div>
);

export const IncomeStatementView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, canonicalAccounts, costCalculationRun } = useAppStore();
  const [month, setMonth] = useState('all');
  const [showWeight, setShowWeight] = useState(false);
  const months = useMemo(() => [...new Set(entries.map(e => e.date.slice(0, 7)))].sort().reverse(), [entries]);
  const periodEntries = useMemo(() => month === 'all' ? entries : entries.filter(e => e.date.startsWith(month)), [entries, month]);
  const dates = periodEntries.map(e => e.date).sort();
  const report = useMemo(() => buildFinancialStatementsEgp(periodEntries, accountsDb, {
    canonicalDefinitions: canonicalAccounts,
    timeline: costCalculationRun.timeline,
    incomeStartDate: dates[0],
    incomeEndDate: dates.at(-1),
  }), [periodEntries, accountsDb, canonicalAccounts, costCalculationRun.timeline, dates]);
  const data = report.incomeStatement;
  const exportReport = () => exportToExcel([{ name: 'قائمة الدخل EGP', data: [
    ...data.revenue.map(x => ({ البيان: x.label, 'المبلغ (ج.م)': x.amount })),
    { البيان: 'إجمالي الإيرادات', 'المبلغ (ج.م)': data.revenueTotal },
    { البيان: 'تكلفة البضاعة المباعة', 'المبلغ (ج.م)': -data.cogs },
    { البيان: 'مجمل الربح', 'المبلغ (ج.م)': data.grossProfit },
    ...data.operatingExpenses.map(x => ({ البيان: x.label, 'المبلغ (ج.م)': -x.amount })),
    { البيان: 'صافي الربح', 'المبلغ (ج.م)': data.netProfit },
  ] }], `قائمة_الدخل_EGP_${month}`);

  return <div className="space-y-4 pb-20" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="flex items-center gap-2 text-lg font-black text-[#f5f1e8]"><TrendingUp className="h-5 w-5 text-[#c9a84c]" />قائمة الدخل</h3><p className="mt-1 text-xs text-[#8a8172]">جميع النتائج بالجنيه المصري فقط؛ الأوزان لا تدخل في الحساب.</p></div>
      <button onClick={exportReport} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c33] px-4 py-2 text-xs font-black text-[#c9a84c]"><Download className="h-4 w-4" />تصدير Excel</button>
    </div>
    <div className="flex gap-2 overflow-x-auto">
      <button onClick={() => setMonth('all')} className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black', month === 'all' ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#0e1018] text-[#8a8172]')}>كل الفترة</button>
      {months.map(item => <button key={item} onClick={() => setMonth(item)} className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black', month === item ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#0e1018] text-[#8a8172]')}>{item}</button>)}
    </div>
    {!report.costBasisAvailable && <div className="flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />COGS غير متاح حتى يكتمل Cost Run صالح. لم يُستخدم الوزن أو سعر السوق كبديل.</div>}
    <div className="space-y-5 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
      <section className="space-y-2"><h4 className="font-black text-[#6a9e6a]">الإيرادات (Revenue)</h4>{data.revenue.map(x => <Row key={x.id} label={x.label} value={x.amount} />)}<Row label="إجمالي الإيرادات" value={data.revenueTotal} total /></section>
      <Row label="(-) تكلفة البضاعة المباعة (COGS)" value={data.cogs} />
      <Row label="مجمل الربح (Gross Profit)" value={data.grossProfit} total />
      <section className="space-y-2"><h4 className="font-black text-[#d08a6a]">مصروفات التشغيل (Operating Expenses)</h4>{data.operatingExpenses.map(x => <Row key={x.id} label={x.label} value={x.amount} />)}{!data.operatingExpenses.length && <div className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#8a8172]">لا توجد مصروفات تشغيل.</div>}<Row label="إجمالي مصروفات التشغيل" value={data.operatingExpensesTotal} total /></section>
      <Row label="صافي الربح (Net Profit)" value={data.netProfit} total />
    </div>
    <label className="flex items-center gap-2 rounded-xl bg-[#0e1018] p-3 text-xs text-[#8a8172]"><input type="checkbox" checked={showWeight} onChange={e => setShowWeight(e.target.checked)} />عرض الوزن المباع كمعلومة فقط</label>
    {showWeight && <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[#0e1018] p-3">ذهب مباع: <b>{data.soldWeight.gold.toFixed(3)} جم</b></div><div className="rounded-xl bg-[#0e1018] p-3">فضة مباعة: <b>{data.soldWeight.silver.toFixed(3)} جم</b></div></div>}
  </div>;
});
