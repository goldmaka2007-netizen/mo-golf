import React, { useMemo, useState } from 'react';
import { AlertTriangle, Briefcase, ChevronDown, ChevronLeft, Download } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildFinancialStatementsEgp, type FinancialPositionNode, type FinancialPositionMeasureUnit } from '../../../lib/financialStatementsEgp';
import { CostDataBlockedView } from './CostDataBlockedView';
import { exportToExcel } from '../../../utils/exportUtils';
import { cn } from '../../../lib/utils';

export const formatBalanceSheetMoney = (value: number) => value.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const money = formatBalanceSheetMoney;
const Row = ({ label, value, total = false }: { label: string; value: number; total?: boolean }) => <div className={total ? 'flex justify-between rounded-xl border border-[#c9a84c33] bg-[#c9a84c0d] p-3 font-black' : 'flex justify-between rounded-xl bg-[#080a0f] px-3 py-2'}><span>{label}</span><span className="font-mono">{money(value)} ج.م</span></div>;

export const formatFinancialPositionMeasure = (value: number, unit: FinancialPositionMeasureUnit): string => {
  const formatted = value.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  if (unit === 'gold21') return `${formatted} جم عربي عيار 21`;
  if (unit === 'silverGram') return `${formatted} جم فضة`;
  return `${formatted} قطعة`;
};

const PositionTreeRow: React.FC<{ item: FinancialPositionNode; depth?: number }> = ({ item, depth = 0 }) => {
  const hasChildren = !!item.children?.length;
  const [open, setOpen] = useState(depth === 0);
  return <div className="space-y-1">
    <button
      type="button"
      onClick={() => hasChildren && setOpen(value => !value)}
      aria-expanded={hasChildren ? open : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right transition-colors',
        hasChildren ? 'bg-[#11141c] font-black hover:bg-[#171b25]' : 'bg-[#080a0f]',
      )}
      style={{ paddingInlineStart: `${12 + depth * 14}px` }}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#c9a84c]">
        {hasChildren ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" /> : <span className="h-1 w-1 rounded-full bg-[#5a5548]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{item.label}</span>
        {item.measure && <span className="mt-0.5 block text-[10px] font-normal text-[#8a8172]">{formatFinancialPositionMeasure(item.measure.value, item.measure.unit)}</span>}
      </span>
      <span className="shrink-0 font-mono text-sm tabular-nums">{money(item.amount)} ج.م</span>
    </button>
    {hasChildren && open && <div className="space-y-1 border-r border-[#242938] pr-1">
      {item.children!.map(child => <PositionTreeRow key={child.id} item={child} depth={depth + 1} />)}
    </div>}
  </div>;
};

const PositionTreeSection = ({ title, tone, items, totalLabel, total }: {
  title: string;
  tone: string;
  items: FinancialPositionNode[];
  totalLabel: string;
  total: number;
}) => <section className="space-y-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
  <h4 className={cn('font-black', tone)}>{title}</h4>
  {items.map(item => <PositionTreeRow key={item.id} item={item} />)}
  <Row label={totalLabel} value={total} total />
</section>;
export const BalanceSheetView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, canonicalAccounts, costCalculationRun, goldPrice, silverPrice } = useAppStore();
  const [showWeight, setShowWeight] = useState(true);
  const [showMarket, setShowMarket] = useState(true);
  const endDate = entries.map(e => e.date).sort().at(-1);
  const report = useMemo(() => buildFinancialStatementsEgp(entries, accountsDb, {
    canonicalDefinitions: canonicalAccounts, timeline: costCalculationRun.timeline,
    goldPriceEgp: goldPrice, silverPriceEgp: silverPrice, balanceEndDate: endDate,
  }), [entries, accountsDb, canonicalAccounts, costCalculationRun.timeline, goldPrice, silverPrice, endDate]);
  const data = report.balanceSheet;
  const exportReport = () => exportToExcel([
    { name: 'المركز المالي EGP', data: [
      ['الأصول', 'النقدية', data.assets.cash], ['الأصول', 'مخزون الذهب', data.assets.goldInventory], ['الأصول', 'مخزون الفضة', data.assets.silverInventory], ['الأصول', 'مخزون الملحقات', data.assets.accessoriesInventory], ['الأصول', 'الأصول الثابتة', data.assets.fixedAssets], ['الأصول', 'الذمم المدينة', data.assets.receivables], ['الأصول', 'أصول أخرى', data.assets.otherAssets],
      ['الخصوم', 'التزامات التجار', data.liabilities.merchant], ['الخصوم', 'تسويات نقدية/مصنعية للتجار', data.liabilities.merchantCashSettlements], ['الخصوم', 'خصوم أخرى', data.liabilities.other],
      ['حقوق الملكية', 'رأس المال', data.equity.capital], ['حقوق الملكية', 'الأرباح المحتجزة', data.equity.retainedEarnings], ['حقوق الملكية', 'الربح الحالي', data.equity.currentProfit],
    ].map(([القسم, البيان, amount]) => ({ القسم, البيان, 'القيمة (ج.م)': amount })) },
    { name: 'تفاصيل المخزون', data: data.inventory.map(x => ({ الصنف: x.label, 'الوزن / الكمية': x.kind === 'gold' ? formatFinancialPositionMeasure(x.weight ?? 0, 'gold21') : x.kind === 'silver' ? formatFinancialPositionMeasure(x.weight ?? 0, 'silverGram') : formatFinancialPositionMeasure(x.quantity ?? 0, 'piece'), 'Book Value': x.bookValue, 'Market Value': x.marketValue, 'Unrealized Difference': x.unrealizedDifference })) },
  ], 'المركز_المالي_EGP');

  if (!report.costBasisAvailable) return <div className="space-y-4 pb-20" dir="rtl"><CostDataBlockedView timeline={costCalculationRun.timeline} /></div>;

  return <div className="space-y-4 pb-20" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 text-lg font-black"><Briefcase className="h-5 w-5 text-[#c9a84c]" />قائمة المركز المالي</h3><p className="mt-1 text-xs text-[#8a8172]">الإجماليات بالجنيه المصري، والفروع تعرض الأصناف والحسابات. وزن الذهب المعروض هو الوزن العربي المكافئ عيار 21 فقط.</p></div><button onClick={exportReport} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c33] px-4 py-2 text-xs font-black text-[#c9a84c]"><Download className="h-4 w-4" />تصدير Excel</button></div>
    {!report.costBasisAvailable && <div className="flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"><AlertTriangle className="h-4 w-4" />Book Value غير متاحة حتى يكتمل Cost Run صالح؛ لن تكتمل تقييمات الفضة والملحقات واحتياطي إعادة التقييم.</div>}
    <div className="grid gap-4 lg:grid-cols-3">
      <PositionTreeSection title="الأصول (Assets)" tone="text-[#6a9e6a]" items={data.tree.assets} totalLabel="إجمالي الأصول" total={data.assets.total} />
      <PositionTreeSection title="الخصوم (Liabilities)" tone="text-[#d08a6a]" items={data.tree.liabilities} totalLabel="إجمالي الخصوم" total={data.liabilities.total} />
      <PositionTreeSection title="حقوق الملكية (Equity)" tone="text-[#c9a84c]" items={data.tree.equity} totalLabel="إجمالي حقوق الملكية" total={data.equity.total} />
    </div>    <section className="space-y-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><h4 className="font-black">تفاصيل تقييم المخزون</h4><p className="text-[10px] text-[#8a8172]">وزن الذهب هو الوزن العربي المكافئ عيار 21 فقط، والفضة بالجرام الفعلي، والملحقات بالقطعة. فروق السوق لا تغيّر القيود المحاسبية.</p></div><div className="flex gap-3 text-xs"><label><input type="checkbox" checked={showWeight} onChange={e => setShowWeight(e.target.checked)} /> الوزن</label><label><input type="checkbox" checked={showMarket} onChange={e => setShowMarket(e.target.checked)} /> السوق والفرق</label></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead><tr className="border-b border-[#1a1e2a] text-[#8a8172]"><th className="p-2 text-right">الصنف</th>{showWeight && <th className="p-2 text-left">الوزن / الكمية</th>}<th className="p-2 text-left">Book Value (ج.م)</th>{showMarket && <><th className="p-2 text-left">Market Value (ج.م)</th><th className="p-2 text-left">Unrealized Difference</th></>}</tr></thead><tbody>{data.inventory.map(x => <tr key={`${x.kind}-${x.label}`} className="border-b border-[#1a1e2a]"><td className="p-2 font-bold">{x.label}</td>{showWeight && <td className="p-2 text-left font-mono">{x.kind === 'gold' ? formatFinancialPositionMeasure(x.weight ?? 0, 'gold21') : x.kind === 'silver' ? formatFinancialPositionMeasure(x.weight ?? 0, 'silverGram') : formatFinancialPositionMeasure(x.quantity ?? 0, 'piece')}</td>}<td className="p-2 text-left font-mono text-[#c9a84c]">{money(x.bookValue)}</td>{showMarket && <><td className="p-2 text-left font-mono">{x.marketValue === null ? '—' : money(x.marketValue)}</td><td className="p-2 text-left font-mono">{x.unrealizedDifference === null ? '—' : money(x.unrealizedDifference)}</td></>}</tr>)}</tbody></table></div>
    </section>
    <div className="rounded-xl bg-[#080a0f] p-3 text-center text-xs text-[#8a8172]">فرق الاتزان: <b className="font-mono text-[#ddd8cc]">{money(data.balances.assetsLessLiabilitiesAndEquity)} ج.م</b></div>
  </div>;
});
