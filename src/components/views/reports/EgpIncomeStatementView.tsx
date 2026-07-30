import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronLeft, Download, TrendingUp } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildFinancialStatementsEgp, type FinancialStatementNode } from '../../../lib/financialStatementsEgp';
import { CostDataBlockedView } from './CostDataBlockedView';
import { exportToExcel } from '../../../utils/exportUtils';
import { cn } from '../../../lib/utils';

const money = (value: number) => value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const Row: React.FC<{ label: string; value: number; total?: boolean }> = ({ label, value, total = false }) => (
  <div className={cn('flex justify-between gap-3 rounded-xl px-3 py-2 text-sm', total ? 'border border-[#c9a84c33] bg-[#c9a84c0d] font-black' : 'bg-[#080a0f]')}>
    <span>{label}</span><span className="font-mono tabular-nums">{money(value)} ج.م</span>
  </div>
);

const TreeRow: React.FC<{ item: FinancialStatementNode; depth?: number }> = ({ item, depth = 0 }) => {
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState(depth === 0);
  return <div className="space-y-1">
    <button
      type="button"
      onClick={() => hasChildren && setOpen(value => !value)}
      aria-expanded={hasChildren ? open : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-sm transition-colors',
        hasChildren ? 'bg-[#11141c] font-black hover:bg-[#171b25]' : 'bg-[#080a0f] text-[#d8d2c5]',
      )}
      style={{ paddingInlineStart: `${12 + depth * 14}px` }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#c9a84c]">
        {hasChildren ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" /> : <span className="h-1 w-1 rounded-full bg-[#5a5548]" />}
      </span>
      <span className="min-w-0 flex-1">{item.label}</span>
      <span className="shrink-0 font-mono tabular-nums">{money(item.amount)} ج.م</span>
    </button>
    {hasChildren && open && <div className="space-y-1 border-r border-[#242938] pr-1">
      {item.children!.map(child => <TreeRow key={child.id} item={child} depth={depth + 1} />)}
    </div>}
  </div>;
};

const TreeRows = ({ items }: { items: FinancialStatementNode[] }) => <div className="space-y-1">
  {items.map(item => <TreeRow key={item.id} item={item} />)}
</div>;

const Empty = ({ children }: { children: React.ReactNode }) => <div className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#8a8172]">{children}</div>;

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
    { البيان: 'إجمالي إيرادات المبيعات', 'المبلغ (ج.م)': data.revenueTotal },
    { البيان: 'تكلفة البضاعة المباعة', 'المبلغ (ج.م)': -data.cogs },
    { البيان: 'مجمل الربح', 'المبلغ (ج.م)': data.grossProfit },
    ...data.operatingExpenses.map(x => ({ البيان: x.label, 'المبلغ (ج.م)': -x.amount })),
    ...data.otherIncome.map(x => ({ البيان: `إيرادات أخرى - ${x.label}`, 'المبلغ (ج.م)': x.amount })),
    ...data.otherExpenses.map(x => ({ البيان: `مصروفات أخرى - ${x.label}`, 'المبلغ (ج.م)': -x.amount })),
    { البيان: 'صافي الربح', 'المبلغ (ج.م)': data.netProfit },
  ] }], `قائمة_الدخل_EGP_${month}`);

  if (!report.costBasisAvailable) return <div className="space-y-4 pb-20" dir="rtl"><CostDataBlockedView timeline={costCalculationRun.timeline} /></div>;

  return <div className="space-y-4 pb-20" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="flex items-center gap-2 text-lg font-black text-[#f5f1e8]"><TrendingUp className="h-5 w-5 text-[#c9a84c]" />قائمة الدخل</h3><p className="mt-1 text-xs text-[#8a8172]">مشتقة من نفس Posting Projection المستخدم في ميزان المراجعة.</p></div>
      <button onClick={exportReport} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c33] px-4 py-2 text-xs font-black text-[#c9a84c]"><Download className="h-4 w-4" />تصدير Excel</button>
    </div>
    <div className="flex gap-2 overflow-x-auto">
      <button onClick={() => setMonth('all')} className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black', month === 'all' ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#0e1018] text-[#8a8172]')}>كل الفترة</button>
      {months.map(item => <button key={item} onClick={() => setMonth(item)} className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black', month === item ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#0e1018] text-[#8a8172]')}>{item}</button>)}
    </div>
    {!report.costBasisAvailable && <div className="flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"><AlertTriangle className="h-4 w-4 shrink-0" />COGS غير متاح حتى يكتمل Cost Run صالح. إيراد المبيعات يظل ظاهرًا من Posting Projection، ولم يُستخدم الوزن أو سعر السوق كبديل للتكلفة.</div>}
    <div className="space-y-5 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
      <section className="space-y-2"><h4 className="font-black text-[#6a9e6a]">إيرادات المبيعات (Sales Revenue)</h4><TreeRows items={data.revenueTree} />{!data.revenueTree.length && <Empty>لا توجد مبيعات.</Empty>}<Row label="إجمالي إيرادات المبيعات" value={data.revenueTotal} total /></section>
      <section className="space-y-2"><h4 className="font-black text-[#6a8a9e]">(-) تكلفة البضاعة المباعة (COGS)</h4><TreeRows items={data.cogsTree} />{!data.cogsTree.length && <Empty>لا توجد تكلفة مبيعات.</Empty>}</section>
      <Row label="مجمل الربح (Gross Profit)" value={data.grossProfit} total />
      <section className="space-y-2"><h4 className="font-black text-[#d08a6a]">مصروفات التشغيل (Operating Expenses)</h4><TreeRows items={data.operatingExpensesTree} />{!data.operatingExpensesTree.length && <Empty>لا توجد مصروفات تشغيل.</Empty>}<Row label="إجمالي مصروفات التشغيل" value={data.operatingExpensesTotal} total /></section>
      <section className="space-y-2"><h4 className="font-black text-[#6a8a9e]">إيرادات أخرى (Other Income)</h4><TreeRows items={data.otherIncomeTree} />{!data.otherIncomeTree.length && <Empty>لا توجد إيرادات أخرى.</Empty>}<Row label="إجمالي الإيرادات الأخرى" value={data.otherIncomeTotal} total /></section>
      <section className="space-y-2"><h4 className="font-black text-[#9e6a6a]">مصروفات أخرى (Other Expenses)</h4><TreeRows items={data.otherExpensesTree} />{!data.otherExpensesTree.length && <Empty>لا توجد مصروفات أخرى.</Empty>}<Row label="إجمالي المصروفات الأخرى" value={data.otherExpensesTotal} total /></section>
      <Row label="صافي الربح (Net Profit)" value={data.netProfit} total />
    </div>
    <label className="flex items-center gap-2 rounded-xl bg-[#0e1018] p-3 text-xs text-[#8a8172]"><input type="checkbox" checked={showWeight} onChange={e => setShowWeight(e.target.checked)} />عرض الوزن المباع كمعلومة فقط</label>
    {showWeight && <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[#0e1018] p-3">ذهب مباع: <b>{data.soldWeight.gold.toFixed(3)} جم عيار 21</b></div><div className="rounded-xl bg-[#0e1018] p-3">فضة مباعة: <b>{data.soldWeight.silver.toFixed(3)} جم</b></div></div>}
  </div>;
});
