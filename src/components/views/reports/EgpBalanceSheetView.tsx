import { formatQuantity, formatWeight } from '../../../lib/formatting';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Briefcase, Download } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildFinancialStatementsEgp } from '../../../lib/financialStatementsEgp';
import { exportToExcel } from '../../../utils/exportUtils';

const money = (value: number) => value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const Row = ({ label, value, total = false }: { label: string; value: number; total?: boolean }) => <div className={total ? 'flex justify-between rounded-xl border border-[#c9a84c33] bg-[#c9a84c0d] p-3 font-black' : 'flex justify-between rounded-xl bg-[#080a0f] px-3 py-2'}><span>{label}</span><span className="font-mono">{money(value)} ج.م</span></div>;

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
      ['الأصول', 'النقدية', data.assets.cash], ['الأصول', 'مخزون الذهب', data.assets.goldInventory], ['الأصول', 'مخزون الفضة', data.assets.silverInventory], ['الأصول', 'مخزون الملحقات', data.assets.accessoriesInventory], ['الأصول', 'الذمم المدينة', data.assets.receivables],
      ['الخصوم', 'التزامات التجار', data.liabilities.merchant], ['الخصوم', 'خصوم أخرى', data.liabilities.other],
      ['حقوق الملكية', 'رأس المال', data.equity.capital], ['حقوق الملكية', 'الأرباح المحتجزة', data.equity.retainedEarnings], ['حقوق الملكية', 'الربح الحالي', data.equity.currentProfit],
    ].map(([القسم, البيان, amount]) => ({ القسم, البيان, 'القيمة الدفترية (ج.م)': amount })) },
    { name: 'تفاصيل المخزون', data: data.inventory.map(x => ({ الصنف: x.label, الوزن: x.weight, الكمية: x.quantity, 'Book Value': x.bookValue, 'Market Value': x.marketValue, 'Unrealized Difference': x.unrealizedDifference })) },
  ], 'المركز_المالي_EGP');

  return <div className="space-y-4 pb-20" dir="rtl">
    <div className="flex flex-col gap-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="flex items-center gap-2 text-lg font-black"><Briefcase className="h-5 w-5 text-[#c9a84c]" />قائمة المركز المالي</h3><p className="mt-1 text-xs text-[#8a8172]">الإجماليات بالجنيه المصري وتعتمد على Book Value فقط.</p></div><button onClick={exportReport} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c33] px-4 py-2 text-xs font-black text-[#c9a84c]"><Download className="h-4 w-4" />تصدير Excel</button></div>
    {!report.costBasisAvailable && <div className="flex gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"><AlertTriangle className="h-4 w-4" />Book Value غير متاحة حتى يكتمل Cost Run صالح؛ لن تستخدم Market Value كبديل.</div>}
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="space-y-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4"><h4 className="font-black text-[#6a9e6a]">الأصول (Assets)</h4><Row label="النقدية" value={data.assets.cash} /><Row label="مخزون الذهب" value={data.assets.goldInventory} /><Row label="مخزون الفضة" value={data.assets.silverInventory} /><Row label="مخزون الملحقات" value={data.assets.accessoriesInventory} /><Row label="الذمم المدينة" value={data.assets.receivables} /><Row label="إجمالي الأصول" value={data.assets.total} total /></section>
      <section className="space-y-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4"><h4 className="font-black text-[#d08a6a]">الخصوم (Liabilities)</h4><Row label="التزامات التجار" value={data.liabilities.merchant} /><Row label="خصوم أخرى" value={data.liabilities.other} /><Row label="إجمالي الخصوم" value={data.liabilities.total} total /></section>
      <section className="space-y-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4"><h4 className="font-black text-[#c9a84c]">حقوق الملكية (Equity)</h4><Row label="رأس المال" value={data.equity.capital} /><Row label="الأرباح المحتجزة" value={data.equity.retainedEarnings} /><Row label="ربح الفترة الحالية" value={data.equity.currentProfit} /><Row label="إجمالي حقوق الملكية" value={data.equity.total} total /></section>
    </div>
    <section className="space-y-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><h4 className="font-black">تفاصيل تقييم المخزون</h4><p className="text-[10px] text-[#8a8172]">القيمة السوقية والفرق غير المحقق للعرض فقط ولا يدخلان أي إجمالي.</p></div><div className="flex gap-3 text-xs"><label><input type="checkbox" checked={showWeight} onChange={e => setShowWeight(e.target.checked)} /> الوزن</label><label><input type="checkbox" checked={showMarket} onChange={e => setShowMarket(e.target.checked)} /> السوق والفرق</label></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead><tr className="border-b border-[#1a1e2a] text-[#8a8172]"><th className="p-2 text-right">الصنف</th>{showWeight && <th className="p-2 text-left">الوزن / الكمية</th>}<th className="p-2 text-left">Book Value (ج.م)</th>{showMarket && <><th className="p-2 text-left">Market Value (ج.م)</th><th className="p-2 text-left">Unrealized Difference</th></>}</tr></thead><tbody>{data.inventory.map(x => <tr key={`${x.kind}-${x.label}`} className="border-b border-[#1a1e2a]"><td className="p-2 font-bold">{x.label}</td>{showWeight && <td className="p-2 text-left font-mono">{x.weight !== null ? `${formatWeight(x.weight, 3)} جم` : `${formatQuantity(x.quantity ?? 0, 3)} قطعة`}</td>}<td className="p-2 text-left font-mono text-[#c9a84c]">{money(x.bookValue)}</td>{showMarket && <><td className="p-2 text-left font-mono">{x.marketValue === null ? '—' : money(x.marketValue)}</td><td className="p-2 text-left font-mono">{x.unrealizedDifference === null ? '—' : money(x.unrealizedDifference)}</td></>}</tr>)}</tbody></table></div>
    </section>
    <div className="rounded-xl bg-[#080a0f] p-3 text-center text-xs text-[#8a8172]">فرق الاتزان: <b className="font-mono text-[#ddd8cc]">{money(data.balances.assetsLessLiabilitiesAndEquity)} ج.م</b></div>
  </div>;
});
