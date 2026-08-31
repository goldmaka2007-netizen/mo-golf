import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, XCircle } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import type { LedgerDimension } from '../../../lib/ledgerReport';
import { buildUnifiedTrialBalanceCsv, type UnifiedTrialBalanceRow } from '../../../lib/unifiedTrialBalance';
import { buildCentralAccountingReadOnlyRuntimeTrialBalance } from '../../../lib/centralAccountingReadOnlyRuntime';
import { formatEgpNumber, formatQuantity, formatWeight } from '../../../lib/formatting';

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const money = (value: number) => formatEgpNumber(value);
export const formatTrialDisplayAmount = (value: number, dimension: LedgerDimension): string => {
  if (dimension === 'cash' || dimension === 'book_value') return formatEgpNumber(value);
  if (dimension === 'quantity') return formatQuantity(value, 3);
  return formatWeight(value, 2);
};

export const TrialBalanceView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, canonicalAccounts, costCalculationRun } = useAppStore();
  const [from, setFrom] = useState(yearStart); const [to, setTo] = useState(today);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const activeAccounts = useMemo(() => accountsDb.filter(account => account.isActive !== false), [accountsDb]);
  const runtimeEntries = useMemo(() => entries.filter(entry => entry.date <= to), [entries, to]);
  const runtime = useMemo(() => buildCentralAccountingReadOnlyRuntimeTrialBalance({
    accounts: activeAccounts,
    entries: runtimeEntries,
    startDate: from,
    endDate: to,
    manualAccountDefinitions: canonicalAccounts,
    timeline: costCalculationRun.status === 'valid' ? costCalculationRun.timeline : null,
  }), [activeAccounts, runtimeEntries, canonicalAccounts, costCalculationRun, from, to]);
  const report = runtime.trialBalance;
  const groups = useMemo(() => report ? [...new Set(report.rows.map(row => row.group))].map(group => ({ group, label: report.rows.find(row => row.group === group)?.groupLabel ?? group, rows: report.rows.filter(row => row.group === group) })) : [], [report]);
  const exportCsv = () => { if (!report) return; const url = URL.createObjectURL(new Blob([buildUnifiedTrialBalanceCsv(report)], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `unified-trial-balance_${from}_${to}.csv`; link.click(); URL.revokeObjectURL(url); };
  const periodControls = <section className="space-y-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
    <div className="flex items-center justify-between gap-2"><div><h3 className="font-black text-[#f5f1e8]">ميزان المراجعة الموحد</h3><p className="text-[11px] text-[#8a8172]">EGP والقيمة الدفترية والأوزان في عقد واحد دون جمع الوحدات المختلفة.</p></div>{report && <button type="button" onClick={exportCsv} className="flex min-h-10 items-center gap-1 text-xs font-bold text-[#c9a84c]"><Download className="h-4 w-4" />CSV</button>}</div>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs text-[#8a8172]">من<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className="mt-1 w-full rounded-lg bg-[#080a0f] p-2 text-[#ddd8cc]" /></label><label className="text-xs text-[#8a8172]">إلى<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} className="mt-1 w-full rounded-lg bg-[#080a0f] p-2 text-[#ddd8cc]" /></label></div>
  </section>;

  if (!report) return <section className="space-y-3 pb-[calc(var(--bottom-nav-height,5rem)+env(safe-area-inset-bottom)+24px)]" dir="rtl">
    {periodControls}
    <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0" /><div><p className="font-bold">تعذر تشغيل ميزان المراجعة عبر المسار المركزي الآمن.</p><p className="mt-1 text-xs text-amber-200/80">لم يتم الرجوع للمسار القديم. الحالة: {runtime.blockers[0]?.code ?? 'central_read_only_blocked'}</p></div></div>
  </section>;

  return <section className="space-y-3 pb-[calc(var(--bottom-nav-height,5rem)+env(safe-area-inset-bottom)+24px)]" dir="rtl">
    {periodControls}
    <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${report.financialBalanced ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{report.financialBalanced ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}<span className="font-bold">{report.financialBalanced ? `متزن: ${money(report.financialDebit)} ج.م مدين = دائن` : `غير متزن: فرق ${money(report.financialDifference)} ج.م`}</span></div>
    {groups.map(group => { const open = expanded.has(group.group); return <section key={group.group} className="overflow-hidden rounded-2xl border border-[#1a1e2a] bg-[#0e1018]"><button type="button" aria-expanded={open} onClick={() => setExpanded(current => { const next = new Set(current); next.has(group.group) ? next.delete(group.group) : next.add(group.group); return next; })} className="flex min-h-14 w-full items-center gap-2 px-3 text-right"><span className="flex-1 font-black text-[#c9a84c]">{group.label} <small className="text-[#8a8172]">({group.rows.length})</small></span><ChevronDown className={`h-5 w-5 transition-transform ${open ? '' : '-rotate-90'}`} /></button>{open && <div className="border-t border-[#1a1e2a] p-3"><div className="space-y-3 md:hidden">{group.rows.map(row => <MobileRow key={row.entityId} row={row} />)}</div><DesktopRows rows={group.rows} /></div>}</section>; })}
  </section>;
});

const Cell = ({ label, value, unit = 'ج.م', dimension = 'cash' }: { label: string; value: number; unit?: string; dimension?: LedgerDimension }) => value ? <div className="flex justify-between gap-3 border-b border-[#1a1e2a]/70 py-1.5 last:border-0"><span className="text-[#8a8172]">{label}</span><span className="font-mono tabular-nums text-[#f5f1e8]">{formatTrialDisplayAmount(value, dimension)} {unit}</span></div> : null;
const MobileRow = ({ row }: { key?: React.Key; row: UnifiedTrialBalanceRow }) => <article className="rounded-xl bg-[#080a0f] p-3"><div className="mb-2 flex items-start justify-between gap-2"><div><h4 className="break-words font-bold text-[#f5f1e8]">{row.accountName}</h4><p className="text-[10px] text-[#8a8172]">طبيعته: {row.normalBalance === 'debit' ? 'مدين' : 'دائن'}</p></div>{row.classificationWarning && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />}</div><Cell label="مدين EGP" value={row.cash.debit} /><Cell label="دائن EGP" value={row.cash.credit} /><Cell label="رصيد EGP" value={row.cash.balance} /><Cell label="ذهب مكافئ 21" value={row.goldBalance} dimension="gold" unit="جم ع21" /><Cell label="فضة" value={row.silverBalance} dimension="silver" unit="جم" /><Cell label="كمية" value={row.quantityBalance} dimension="quantity" unit="قطعة" /><Cell label="مدين قيمة دفترية" value={row.bookValue.debit} /><Cell label="دائن قيمة دفترية" value={row.bookValue.credit} /><Cell label="رصيد قيمة دفترية" value={row.bookValue.balance} />{row.effectiveGramPrice !== null && <Cell label="سعر الجرام" value={row.effectiveGramPrice} />}{row.classificationWarning && <p className="mt-2 text-[10px] text-amber-300">{row.classificationWarning}</p>}</article>;
const DesktopRows = ({ rows }: { rows: UnifiedTrialBalanceRow[] }) => <div className="hidden md:block overflow-x-auto"><table className="min-w-[1280px] w-full text-xs"><thead className="text-[#c9a84c]"><tr>{['الحساب', 'الطبيعة', 'مدين EGP', 'دائن EGP', 'رصيد EGP', 'ذهب ع21', 'فضة', 'كمية', 'مدين Book Value', 'دائن Book Value', 'رصيد Book Value', 'سعر الجرام'].map(label => <th key={label} className="whitespace-nowrap p-2 text-right">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.entityId} className="border-t border-[#1a1e2a]"><td className="max-w-56 whitespace-normal break-words p-2 font-bold">{row.accountName}</td><td className="p-2">{row.normalBalance === 'debit' ? 'مدين' : 'دائن'}</td><td className="p-2 font-mono">{money(row.cash.debit)}</td><td className="p-2 font-mono">{money(row.cash.credit)}</td><td className="p-2 font-mono">{money(row.cash.balance)}</td><td className="p-2 font-mono">{formatWeight(row.goldBalance, 2)}</td><td className="p-2 font-mono">{formatWeight(row.silverBalance, 2)}</td><td className="p-2 font-mono">{formatQuantity(row.quantityBalance, 3)}</td><td className="p-2 font-mono">{money(row.bookValue.debit)}</td><td className="p-2 font-mono">{money(row.bookValue.credit)}</td><td className="p-2 font-mono">{money(row.bookValue.balance)}</td><td className="p-2 font-mono">{row.effectiveGramPrice === null ? '\u2014' : formatEgpNumber(row.effectiveGramPrice)}</td></tr>)}</tbody></table></div>;
