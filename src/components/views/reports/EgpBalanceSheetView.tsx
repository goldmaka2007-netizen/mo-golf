import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Download } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildMonthlyFinancialPosition, financialPositionCsvRows, visibleFinancialPositionMonths } from '../../../lib/monthlyFinancialPosition';
import type { FinancialPositionDetailRow, InventoryCategorySummary, InventoryStatementRow, MerchantLiabilityStatementRow } from '../../../lib/financialStatementsEgp';
import { exportToCsv } from '../../../utils/exportUtils';
import { formatEgpAmount, formatWeight } from '../../../lib/formatting';
import { isFinancialPositionRowVisible } from '../../../lib/financialPositionPresentation';

const money = (value: number) => formatEgpAmount(value);
const sameMoney = (left: number, right: number) => Math.abs(left - right) < 0.005;

const Detail = ({ label, value, rows, onOpenLedger }: { label: string; value: number; rows: FinancialPositionDetailRow[]; onOpenLedger?: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return <div className="rounded-xl border border-[#1a1e2a]"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 w-full justify-between gap-3 p-3 text-right font-bold"><span>{label}</span><span className="font-mono">{money(value)}</span></button>{open && <div className="space-y-1 border-t border-[#1a1e2a] p-2">{rows.map(row => <button key={row.id} disabled={!row.accountId} onClick={() => row.accountId && onOpenLedger?.(row.accountId)} className="block min-h-11 w-full rounded-lg bg-[#080a0f] p-2 text-right disabled:cursor-default"><div className="flex justify-between"><span>{row.label}</span><span className="font-mono">{money(row.amount)}</span></div>{row.equivalent21Weight !== undefined && row.equivalent21Weight !== 0 && <span className="mt-1 block text-xs text-[#c9a84c]">ذهب: {formatWeight(row.equivalent21Weight, 3)} جرام عيار 21</span>}{row.silverWeight !== undefined && row.silverWeight !== 0 && <span className="mt-1 block text-xs text-slate-300">فضة: {formatWeight(row.silverWeight, 3)} جرام</span>}</button>)}</div>}</div>;
};

const Inventory = ({ label, summary, rows, onOpenLedger }: { label: string; summary: InventoryCategorySummary; rows: InventoryStatementRow[]; onOpenLedger?: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const meaningfulWeight = summary.kind === 'accessory' ? 0 : summary.weight ?? 0;
  if (!isFinancialPositionRowVisible(summary.bookValue, meaningfulWeight)) return null;
  const weight = summary.kind === 'accessory' || !summary.weight ? null : `${formatWeight(summary.weight, 3)} جرام${summary.kind === 'gold' ? ' عيار 21' : ''}`;
  return <div className="rounded-xl border border-[#1a1e2a]"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full min-h-11 p-3 text-right"><div className="flex justify-between font-bold"><span>{label}</span><span className="font-mono">{money(summary.bookValue)}</span></div>{weight && <span className={`mt-1 block text-xs ${summary.kind === 'gold' ? 'text-[#c9a84c]' : 'text-slate-300'}`}>{weight}</span>}</button>{open && <div className="space-y-1 border-t border-[#1a1e2a] p-2">{rows.map(row => <button key={row.accountId} onClick={() => onOpenLedger?.(row.accountId)} className="block min-h-11 w-full rounded-lg bg-[#080a0f] p-2 text-right"><div className="flex justify-between"><span>{row.label}</span><span className="font-mono">{money(row.bookValue)}</span></div>{row.kind !== 'accessory' && row.weight !== null && <span className="text-xs text-[#c9a84c]">{formatWeight(row.weight, 3)} جرام</span>}</button>)}</div>}</div>;
};

const Merchant = ({ label, value, rows, cash = false, onOpenLedger }: { label: string; value: number; rows: MerchantLiabilityStatementRow[]; cash?: boolean; onOpenLedger?: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const rowValue = (row: MerchantLiabilityStatementRow) => cash ? (row.cashPayable || row.cashReceivable) : row.bookValue;
  const detailTotal = rows.reduce((sum, row) => sum + rowValue(row), 0);
  const goldWeight = cash ? 0 : rows.reduce((sum, row) => sum + row.equivalent21Weight, 0);
  const silverWeight = cash ? 0 : rows.reduce((sum, row) => sum + row.silverWeight, 0);
  if (!isFinancialPositionRowVisible(value, goldWeight + silverWeight)) return null;
  return <div className="rounded-xl border border-[#1a1e2a]"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full min-h-11 p-3 text-right"><div className="flex justify-between font-bold"><span>{label}</span><span className="font-mono">{money(value)}</span></div>{goldWeight > 0 && <span className="text-xs text-[#c9a84c]">{formatWeight(goldWeight, 3)} جرام عيار 21</span>}{silverWeight > 0 && <span className="text-xs text-slate-300">{formatWeight(silverWeight, 3)} جرام فضة</span>}</button>{open && <div className="space-y-1 border-t border-[#1a1e2a] p-2">{rows.map(row => <button key={`${row.id}:${cash ? 'cash' : 'metal'}`} onClick={() => onOpenLedger?.(row.accountId)} className="block min-h-11 w-full rounded-lg bg-[#080a0f] p-2 text-right"><div className="flex justify-between"><span>{row.label}</span><span className="font-mono">{money(rowValue(row))}</span></div>{!cash && row.metal === 'gold' && <span className="text-xs text-[#c9a84c]">{formatWeight(row.equivalent21Weight, 3)} جرام عيار 21</span>}{!cash && row.metal === 'silver' && <span className="text-xs text-slate-300">{formatWeight(row.silverWeight, 3)} جرام فضة</span>}</button>)}{!sameMoney(value, detailTotal) && <p className="p-2 text-xs text-red-300">تعذر تطابق تفاصيل التجار مع الإجمالي المركزي.</p>}</div>}</div>;
};

const Top = ({ title, value, gold, silver, fixedAssets, tone, net = false }: { title: string; value: number; gold: number; silver: number; fixedAssets?: number; tone: string; net?: boolean }) => <div className={`rounded-2xl border p-4 ${tone}`}><b>{title}</b><div className="mt-2 font-mono text-xl font-black">{money(value)}</div>{fixedAssets !== undefined && fixedAssets !== 0 && <div className="mt-2 text-xs text-blue-200">الأصول الثابتة: {money(fixedAssets)}</div>}{gold !== 0 && <div className="mt-2 text-xs text-[#c9a84c]">ذهب{net ? ' (صافي)' : ''}: {formatWeight(gold, 3)} جرام عيار 21</div>}{silver !== 0 && <div className="mt-1 text-xs text-slate-300">فضة{net ? ' (صافي)' : ''}: {formatWeight(silver, 3)} جرام</div>}</div>;

export const BalanceSheetView = React.memo(({ entries, onOpenLedger }: { entries: Entry[]; onOpenLedger?: (accountId: string) => void }) => {
  const { accountsDb, canonicalAccounts, openingCostConfig, goldPrice, silverPrice } = useAppStore();
  const year = new Date().getFullYear();
  const months = useMemo(() => visibleFinancialPositionMonths(entries, year), [entries, year]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [exportDiagnostic, setExportDiagnostic] = useState<string | null>(null);
  useEffect(() => setSelectedMonth(months.at(-1)?.month ?? null), [months]);
  const selected = months.find(month => month.month === selectedMonth) ?? months.at(-1);
  const report = useMemo(() => selected && buildMonthlyFinancialPosition({ entries, accounts: accountsDb, canonicalDefinitions: canonicalAccounts, openingCostConfig, cutoffDate: selected.cutoffDate, goldPriceEgp: goldPrice, silverPriceEgp: silverPrice }), [selected, entries, accountsDb, canonicalAccounts, openingCostConfig, goldPrice, silverPrice]);
  if (!selected || !report) return <div dir="rtl" className="rounded-2xl bg-[#0e1018] p-4">لا توجد بيانات مسجلة لهذه السنة</div>;
  if (!report.available) return <div dir="rtl" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">Book Value غير متاحة حتى يكتمل Cost Timeline صالح: {report.diagnostic.message}</div>;
  const d = report.balanceSheet;
  const m = report.metalSummary;
  const merchantGoldReceivables = d.assets.merchantReceivableDetails.filter(row => row.metal === 'gold' && isFinancialPositionRowVisible(row.bookValue, row.equivalent21Weight));
  const merchantSilverReceivables = d.assets.merchantReceivableDetails.filter(row => row.metal === 'silver' && isFinancialPositionRowVisible(row.bookValue, row.silverWeight));
  const merchantCashReceivables = d.assets.merchantReceivableDetails.filter(row => row.cashReceivable > 0);
  const merchantGoldPayables = d.liabilities.merchantDetails.filter(row => row.metal === 'gold' && isFinancialPositionRowVisible(row.bookValue, row.equivalent21Weight));
  const merchantSilverPayables = d.liabilities.merchantDetails.filter(row => row.metal === 'silver' && isFinancialPositionRowVisible(row.bookValue, row.silverWeight));
  const merchantCashPayables = d.liabilities.merchantDetails.filter(row => row.cashPayable > 0);
  const exportReport = () => {
    const latest = months.at(-1);
    if (!latest) return;
    const latestReport = buildMonthlyFinancialPosition({ entries, accounts: accountsDb, canonicalDefinitions: canonicalAccounts, openingCostConfig, cutoffDate: latest.cutoffDate, goldPriceEgp: goldPrice, silverPriceEgp: silverPrice });
    if ('diagnostic' in latestReport) { setExportDiagnostic(`تعذر التصدير: ${latestReport.diagnostic.message}`); return; }
    const rows = financialPositionCsvRows(latestReport)!;
    setExportDiagnostic(null);
    exportToCsv([{ name: `المركز المالي حتى ${latest.cutoffDate}`, data: rows }], `financial_position_${latest.cutoffDate}`);
  };
  return <section dir="rtl" className="space-y-4 pb-28"><header className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4"><div className="flex justify-between"><h3 className="flex items-center gap-2 text-lg font-black"><Briefcase className="h-5 w-5 text-[#c9a84c]" />قائمة المركز المالي</h3><button onClick={exportReport} className="min-h-11 rounded-xl border px-3 text-[#c9a84c]"><Download className="inline h-4 w-4" /> تصدير CSV</button></div><div className="mt-3 flex gap-2 overflow-x-auto">{months.map(month => <button key={month.month} aria-pressed={month.month === selected.month} onClick={() => setSelectedMonth(month.month)} className={`min-h-11 shrink-0 rounded-xl px-4 ${month.month === selected.month ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#080a0f]'}`}>{month.label}</button>)}</div><p className="mt-2 text-xs text-[#8a8172]">حتى {selected.cutoffDate}</p>{exportDiagnostic && <p role="alert" className="mt-2 text-sm text-red-300">{exportDiagnostic}</p>}</header><div className="grid gap-3 sm:grid-cols-3"><Top title="إجمالي الأصول" value={d.assets.total} gold={m.goldAssetWeight} silver={m.silverAssetWeight} tone="border-blue-400/30" /><Top title="إجمالي الخصوم" value={d.liabilities.total} gold={m.goldLiabilityWeight} silver={m.silverLiabilityWeight} tone="border-red-400/30" /><Top title="إجمالي حقوق الملكية المتراكمة" value={d.equity.total} gold={m.netGoldWeight} silver={m.netSilverWeight} tone="border-green-400/30" net /></div><div className="grid gap-4 lg:grid-cols-3"><div className="space-y-2 rounded-2xl bg-[#0e1018] p-3"><b>الأصول</b><Detail label="النقدية" value={d.assets.cash} rows={d.assets.cashDetails} onOpenLedger={onOpenLedger} /><Inventory label="مخزون الذهب" summary={d.inventoryCategories.gold} rows={d.inventory.filter(row => row.kind === 'gold')} onOpenLedger={onOpenLedger} /><Inventory label="مخزون الفضة" summary={d.inventoryCategories.silver} rows={d.inventory.filter(row => row.kind === 'silver')} onOpenLedger={onOpenLedger} /><Inventory label="مخزون الملحقات" summary={d.inventoryCategories.accessory} rows={d.inventory.filter(row => row.kind === 'accessory')} onOpenLedger={onOpenLedger} /><Detail label="الأصول الثابتة" value={d.assets.fixedAssets} rows={d.assets.fixedAssetDetails} onOpenLedger={onOpenLedger} /><Detail label="الذمم المدينة" value={d.assets.ordinaryReceivables} rows={d.assets.ordinaryReceivableDetails} onOpenLedger={onOpenLedger} /><Merchant label="تجار ذهب مدينون" value={d.assets.merchantGoldReceivables} rows={merchantGoldReceivables} onOpenLedger={onOpenLedger} /><Merchant label="تجار فضة مدينون" value={d.assets.merchantSilverReceivables} rows={merchantSilverReceivables} onOpenLedger={onOpenLedger} /><Merchant label="ذمم نقدية للتجار" value={d.assets.merchantCashReceivables} rows={merchantCashReceivables} cash onOpenLedger={onOpenLedger} /></div><div className="space-y-2 rounded-2xl bg-[#0e1018] p-3"><b>الخصوم</b><Merchant label="التزامات تجار الذهب" value={d.liabilities.merchantGold} rows={merchantGoldPayables} onOpenLedger={onOpenLedger} /><Merchant label="التزامات تجار الفضة" value={d.liabilities.merchantSilver} rows={merchantSilverPayables} onOpenLedger={onOpenLedger} /><Merchant label="التزامات نقدية للتجار" value={d.liabilities.merchantCash} rows={merchantCashPayables} cash onOpenLedger={onOpenLedger} /><Detail label="خصوم أخرى" value={d.liabilities.other} rows={d.liabilities.otherDetails} onOpenLedger={onOpenLedger} /></div><div className="space-y-2 rounded-2xl bg-[#0e1018] p-3"><b>حقوق الملكية</b><Detail label="رأس المال" value={d.equity.capital} rows={d.equity.capitalDetails} onOpenLedger={onOpenLedger} /><Detail label="الأرباح المحتجزة" value={d.equity.retainedEarnings} rows={d.equity.retainedEarningsDetails} onOpenLedger={onOpenLedger} /><Detail label="صافي ربح الفترة" value={d.equity.currentProfit} rows={d.equity.currentProfitDetails} onOpenLedger={onOpenLedger} /></div></div><footer className="rounded-xl bg-[#080a0f] p-3 text-center">فرق الاتزان: <b className="font-mono">{money(d.balances.assetsLessLiabilitiesAndEquity)}</b></footer></section>;
});
