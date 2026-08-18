import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, ClipboardPaste, Database, Download, PlusCircle, Scale, TrendingUp, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AccountingLeg } from '../../lib/canonicalAccounting';
import { buildDailyJournalReport, DailyJournalDiagnosticGroup, DailyJournalDimension } from '../../lib/dailyJournalReport';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store';
import { Entry } from '../../types';
import { formatEgpNumber, formatQuantity, formatWeight } from '../../lib/formatting';
import { downloadCsv } from '../../utils/csv';
import { buildDailyJournalSmartDashboard, resolveDailyJournalMarketPrice } from '../../lib/dailyJournalSmartDashboard';
import { DailyJournalSmartSupplementalCards } from './DailyJournalSmartSupplementalCards';

const dimensions: { id: DailyJournalDimension; title: string; unit: string; icon: React.ElementType; accent: string }[] = [
  { id: 'gold', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0630\u0647\u0628 (21)', unit: '\u062c\u0645', icon: Scale, accent: 'text-[#c9a84c]' },
  { id: 'silver', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0641\u0636\u0629', unit: '\u062c\u0645', icon: Database, accent: 'text-[#6a8a9e]' },
  { id: 'cash', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0646\u0642\u062f\u064a\u0629', unit: '\u062c.\u0645', icon: Wallet, accent: 'text-[#6a9e6a]' },
];

const entryKey = (entry: Entry) => entry.id || String(entry.seq);
const unique = (items: string[]) => [...new Set(items)].filter(Boolean);
const amount = (value: number, dimension: DailyJournalDimension) => dimension === 'cash' ? formatEgpNumber(value) : dimension === 'quantity' ? formatQuantity(value, 3) : formatWeight(value, 2);
export type DailyJournalExportRow = Record<string, string | number | undefined>;

export const createDailyJournalCsvRows = (summary: DailyJournalExportRow[], operations: DailyJournalExportRow[]) => [
  ...summary.map(row => ({ التقرير: 'Journal Summary', ...row })),
  ...operations.map(row => ({ التقرير: 'Operations', ...row })),
];

export const DailyJournalView = React.memo(() => {
  const { entries, setEditingEntry, accountsDb, setView, goldPrice, smartMarginSettings } = useAppStore();
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    if (selectedDate) return;
    const dates = entries.map(entry => entry.date).filter(Boolean);
    setSelectedDate(dates.length ? dates.reduce((latest, date) => latest > date ? latest : date) : format(new Date(), 'yyyy-MM-dd'));
  }, [entries, selectedDate]);

  const report = useMemo(() => buildDailyJournalReport(entries, accountsDb, selectedDate), [entries, accountsDb, selectedDate]);
  const smart = useMemo(() => buildDailyJournalSmartDashboard(entries, accountsDb, selectedDate, smartMarginSettings, resolveDailyJournalMarketPrice(selectedDate, format(new Date(), 'yyyy-MM-dd'), goldPrice)), [entries, accountsDb, selectedDate, smartMarginSettings, goldPrice]);
  useEffect(() => {
    document.querySelectorAll('p').forEach(node => {
      if (node.textContent?.includes('historical')) node.textContent = node.textContent.replace('historical', '\u0647\u0627\u0645\u0634 \u0627\u0644\u062a\u062f\u0627\u0648\u0644 \u0627\u0644\u062a\u0627\u0631\u064a\u062e\u064a');
    });
  }, [smart.decision.binding]);
  const readableSelectedDate = selectedDate ? format(new Date(`${selectedDate}T00:00:00`), 'd MMMM yyyy', { locale: ar }) : 'اختر التاريخ';
  const rawEntries = useMemo(() => entries.filter(entry => entry.date === selectedDate), [entries, selectedDate]);
  const legsByEntry = useMemo(() => {
    const result = new Map<string, AccountingLeg[]>();
    (['cash', 'gold', 'silver', 'quantity'] as DailyJournalDimension[]).flatMap(dimension => report.dimensions[dimension].periodLegs).forEach(leg => {
      const rows = result.get(leg.sourceEntryId) || [];
      rows.push(leg);
      result.set(leg.sourceEntryId, rows);
    });
    return result;
  }, [report]);
  const groups = useMemo(() => {
    const next: Record<'sale' | 'purchase' | 'expense' | 'other', Entry[]> = { sale: [], purchase: [], expense: [], other: [] };
    rawEntries.forEach(entry => {
      const kind = legsByEntry.get(entryKey(entry))?.[0]?.operationKind;
      if (kind === 'sale' || kind === 'purchase' || kind === 'expense') next[kind].push(entry); else next.other.push(entry);
    });
    return next;
  }, [rawEntries, legsByEntry]);

  const openEntryForSelectedDate = () => {
    const targetDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
    setEditingEntry({ date: targetDate });
    setView('entry');
  };
  const exportToCsv = () => {
    const summary = dimensions.map(meta => {
      const data = report.dimensions[meta.id];
      return { dimension: meta.title, openingDebit: data.openingDebit, openingCredit: data.openingCredit, periodDebit: data.periodDebit, periodCredit: data.periodCredit, closingDebit: data.closingDebit, closingCredit: data.closingCredit };
    });
    const operations = rawEntries.map(entry => ({ date: entry.date, operation: entry.invoiceNumber || entry.seq, tx: entry.tx, debit: entry.debit, credit: entry.credit, cash: entry.cash, weight: entry.weight, count: entry.count, notes: entry.notes }));
    downloadCsv(createDailyJournalCsvRows(summary, operations), `Journal_${selectedDate}.csv`);
  };

  return <div className="space-y-6 pb-10" dir="rtl">
    <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black text-[#c9a84c]"><Calendar className="h-5 w-5" />{'\u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0627\u0644\u0639\u0627\u0645\u0629'}</h2>
        <button type="button" onClick={exportToCsv} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9a84c22] bg-[#c9a84c11] text-[#c9a84c]"><Download className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button type="button" onClick={() => { const date = new Date(selectedDate); date.setDate(date.getDate() - 1); setSelectedDate(format(date, 'yyyy-MM-dd')); }} className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc]"><ChevronRight className="h-5 w-5" /></button>
        <div className="relative h-11"><div className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-center text-sm font-black text-[#ddd8cc]" aria-hidden="true"><bdi dir="rtl">{readableSelectedDate}</bdi></div><input type="date" value={selectedDate} aria-label="اختيار تاريخ اليومية" onChange={event => setSelectedDate(event.target.value)} className="absolute inset-0 h-11 w-full cursor-pointer opacity-0" /></div>
        <button type="button" onClick={() => { const date = new Date(selectedDate); date.setDate(date.getDate() + 1); setSelectedDate(format(date, 'yyyy-MM-dd')); }} className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc]"><ChevronLeft className="h-5 w-5" /></button>
      </div>
      <button type="button" onClick={openEntryForSelectedDate} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-4 py-3 text-sm font-black text-[#080a0f] shadow-lg shadow-[#c9a84c]/10 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#f5f1e8]">
        <PlusCircle className="h-4 w-4" />
        {'إضافة عملية لهذا اليوم'}
      </button>
    </div>

    {import.meta.env.DEV && report.diagnostics.groups.length > 0 && <DevelopmentDiagnostics groups={report.diagnostics.groups} total={report.diagnostics.entries.length} />}

    <CashClosingCard cash={smart.cash} />

    <div className="space-y-8">
      <EntrySection title={'\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a'} entries={groups.sale} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<TrendingUp className="h-3 w-3 text-[#6a9e6a]" />} />
      <EntrySection title={'\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a'} entries={groups.purchase} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<TrendingUp className="h-3 w-3 rotate-180 text-[#9e6a6a]" />} />
      <EntrySection title={'\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641'} entries={groups.expense} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<TrendingUp className="h-3 w-3 text-[#9e6a6a]" />} />
      <EntrySection title={'\u062d\u0631\u0643\u0627\u062a \u0623\u062e\u0631\u0649'} entries={groups.other} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<Database className="h-3 w-3 text-[#c9a84c]" />} />
      {rawEntries.length === 0 && <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] py-20 text-center text-sm text-[#5a5548]">{'\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0645\u0644\u064a\u0627\u062a \u0645\u0633\u062c\u0644\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645'}</div>}
    </div>
    <SmartDashboard report={smart} />
    <DailyJournalSmartSupplementalCards report={smart} />
  </div>;
});

const CashClosingCard = ({ cash }: { cash: ReturnType<typeof buildDailyJournalSmartDashboard>['cash'] }) => <section className="rounded-3xl border border-[#6a9e6a66] bg-[#0e1018] p-5 shadow-2xl" dir="rtl"><h3 className="flex items-center gap-2 text-sm font-black text-[#6a9e6a]"><Wallet className="h-4 w-4" />رصيد وإقفال الخزنة</h3><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5"><Metric label="رصيد أول اليوم" value={formatEgpNumber(cash.opening)} /><Metric label="إجمالي الداخل النقدي" value={formatEgpNumber(cash.cashIn)} /><Metric label="الرصيد + الداخل" value={formatEgpNumber(cash.availableBeforeOut)} /><Metric label="إجمالي الخارج النقدي" value={formatEgpNumber(cash.cashOut)} /><Metric label="رصيد آخر اليوم" value={formatEgpNumber(cash.closing)} strong /></div></section>;

const SmartDashboard = ({ report }: { report: ReturnType<typeof buildDailyJournalSmartDashboard> }) => { const money = (v: number | null) => v === null ? 'غير متاح' : `${formatEgpNumber(v)} ج/جم E21`; const row = (label: string, w: ReturnType<typeof buildDailyJournalSmartDashboard>['gold']['sales']['today']) => <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#080a0f] p-2 text-[10px]"><span>{label}</span><span>{formatWeight(w.e21, 2)} E21</span><span>{formatEgpNumber(w.egp)} ج</span><span>{money(w.average)}</span></div>; const secondary = [
    `التجار — ذهب مستلم: ${formatWeight(report.merchants.goldReceivedPhysical, 2)} جم / ${formatWeight(report.merchants.goldReceived, 2)} E21`,
    `التجار — ذهب مسلم: ${formatWeight(report.merchants.goldDeliveredPhysical, 2)} جم / ${formatWeight(report.merchants.goldDelivered, 2)} E21`,
    `التجار — تحويلات (بدون أثر صافي على المخزون): ${formatWeight(report.merchants.goldTransfers, 2)} E21`,
    `التجار — صافي حركة محل الذهب: ${formatWeight(report.merchants.goldNet, 2)} E21`,
    `التجار — مصنعية / رصيد نقدي: ${formatEgpNumber(report.merchants.workmanshipCash)} ج`,
    `فضة العملاء: بيع ${formatWeight(report.silver.salesWeight, 2)} جم / ${formatEgpNumber(report.silver.salesEgp)} ج — شراء ${formatWeight(report.silver.purchasesWeight, 2)} جم / ${formatEgpNumber(report.silver.purchasesEgp)} ج — صافي داخلي ${formatWeight(report.silver.netMovement, 2)} جم`,
    `فضة التجار: مستلم ${formatWeight(report.silver.merchantReceived, 2)} جم / مسلم ${formatWeight(report.silver.merchantDelivered, 2)} جم`,
    `تحويلات داخلية: ${report.internal.transfers} — كسر داخل ${formatWeight(report.internal.scrapIn, 2)} E21 — خارج ${formatWeight(report.internal.scrapOut, 2)} E21`,
    `اتجاهات داخلية: ${Object.entries(report.internal.directions).map(([key, value]) => `${key}: ${formatWeight(value.e21, 2)} E21`).join('، ') || 'لا يوجد'}`,
    `التجار حسب العيار: ${Object.entries(report.merchants.goldByKarat).filter(([, value]) => value.movements > 0).map(([key, value]) => `${key}: ${formatWeight(value.physical, 2)} جم/${formatWeight(value.e21, 2)} E21`).join('، ') || 'لا يوجد'}`,
    `الحركة الداخلية حسب العيار: ${Object.entries(report.internal.goldByKarat).filter(([, value]) => value.movements > 0).map(([key, value]) => `${key}: ${formatWeight(value.physical, 2)} جم/${formatWeight(value.e21, 2)} E21`).join('، ') || 'لا يوجد'}`,
    `حركات عيارها غير مؤكدة: ${report.merchants.karatConflicts + report.internal.karatConflicts}`,
  ]; return <section className="space-y-4" dir="rtl"><h2 className="text-base font-black text-[#c9a84c]">Smart Daily Management Dashboard</h2><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-[#c9a84c66] bg-[#0e1018] p-5"><h3 className="font-black text-[#f0cc6b]">قرار شراء الذهب الآن</h3><Metric label="متوسط البيع المدمج" value={money(report.decision.blendedSell)} /><Metric label="سقف الشراء المقترح" value={money(report.decision.suggestedPurchase)} strong /><p className="mt-3 text-[11px] text-[#8a8172]">الحاجز الملزم: {report.decision.binding || 'غير متاح'} — ليس ربحًا محاسبيًا.</p><p className="mt-2 text-[10px] text-[#8a8172]">سعر السوق 21: {report.marketPrice === null ? 'سعر السوق لهذا التاريخ غير متاح' : `${formatEgpNumber(report.marketPrice)} ج/جم — مرجع فقط`}</p></div><div className="rounded-3xl border border-[#c9a84c33] bg-[#0e1018] p-5"><h3 className="font-black text-[#f0cc6b]">تحليل الذهب التجاري — هامش التداول</h3><h4 className="mt-3 text-xs text-[#6a9e6a]">مبيعات العملاء</h4>{row('اليوم', report.gold.sales.today)}{row('آخر 7 أيام', report.gold.sales.last7Days)}{row('آخر 30 يومًا', report.gold.sales.last30Days)}<h4 className="mt-3 text-xs text-[#9e6a6a]">مشتريات العملاء</h4>{row('اليوم', report.gold.purchases.today)}{row('آخر 7 أيام', report.gold.purchases.last7Days)}{row('آخر 30 يومًا', report.gold.purchases.last30Days)}<p className="mt-3 text-xs">هامش التداول التاريخي: {money(report.decision.historicalSpread)}</p></div></div><div className="grid gap-4 lg:grid-cols-3"><SmartCard title="ملخص ذهب اليوم" lines={[`الداخل: ${formatWeight(report.gold.physicalIn, 2)} جم / ${formatWeight(report.gold.movementIn, 2)} E21`,`الخارج: ${formatWeight(report.gold.physicalOut, 2)} جم / ${formatWeight(report.gold.movementOut, 2)} E21`,`الصافي: ${formatWeight(report.gold.movementIn - report.gold.movementOut, 2)} E21`]} /><SmartCard title="شرح النقدية" lines={report.cash.categories.map(c => `${c.label}: +${formatEgpNumber(c.cashIn)} / -${formatEgpNumber(c.cashOut)}`)} /><SmartCard title="التجار والفضة والتحويلات" lines={secondary} /><SmartCard title="بيانات مستبعدة" lines={[`حركات غير مؤهلة للتحليل التجاري: ${report.gold.excluded}`, 'لا تؤثر على إقفال الخزنة.']} /></div></section>; };
const SmartCard = ({ title, lines, details }: { title: string; lines: string[]; details?: string[] }) => { const visibleLines = [...new Set(lines)].filter(line => !line.endsWith('لا يوجد') && !/[:\u0020]0(?:\.00)?(?:\u0020|$)/.test(line)); const displayLines = visibleLines.length ? visibleLines : title.includes('التجار') ? ['لا توجد حركة تجار اليوم'] : []; return displayLines.length ? <div className="rounded-3xl border border-[#1a1e2a] bg-[#0e1018] p-4"><h3 className="text-xs font-black text-[#c9a84c]">{title}</h3><div className="mt-3 space-y-2 text-[11px] text-[#ddd8cc]">{displayLines.map(line => <div key={line}><bdi dir="ltr">{line}</bdi></div>)}</div>{details?.length ? <details className="mt-3 text-[10px] text-[#8a8172]"><summary className="cursor-pointer">تفاصيل الاتجاه والعيار</summary><div className="mt-2 space-y-1">{details.map(line => <div key={line}><bdi dir="ltr">{line}</bdi></div>)}</div></details> : null}</div> : null; };

const DimensionSummary = ({ id, title, unit, icon: Icon, accent, report }: { id: DailyJournalDimension; title: string; unit: string; icon: React.ElementType; accent: string; report: ReturnType<typeof buildDailyJournalReport>['dimensions'][DailyJournalDimension]; key?: React.Key }) => {
  const closing = report.closingDebit - report.closingCredit;
  return <div className="space-y-3 rounded-2xl border border-[#1a1e2a] bg-[#080a0f] p-4">
    <div className={cn('flex items-center gap-2 text-xs font-black', accent)}><Icon className="h-4 w-4" />{title}</div>
    <div className="grid grid-cols-2 gap-2 text-xs"><Metric label={'\u0631\u0635\u064a\u062f \u0623\u0648\u0644 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.openingDebit - report.openingCredit, id)} ${unit}`} /><Metric label={'\u0648\u0627\u0631\u062f \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.periodDebit, id)} ${unit}`} /><Metric label={'\u0635\u0627\u062f\u0631 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.periodCredit, id)} ${unit}`} /><Metric label={'\u0631\u0635\u064a\u062f \u0622\u062e\u0631 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(closing, id)} ${unit}`} strong /></div>
  </div>;
};
const Metric = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => <div className="rounded-xl bg-[#0e1018] p-2"><div className="text-[10px] text-[#8a8172]">{label}</div><div className={cn('mt-1 font-mono text-sm text-[#ddd8cc]', strong && 'font-black text-[#c9a84c')}><bdi dir="ltr">{value}</bdi></div></div>;

const EntrySection = ({ title, entries, legsByEntry, setEditingEntry, icon }: { title: string; entries: Entry[]; legsByEntry: Map<string, AccountingLeg[]>; setEditingEntry: (entry: Entry) => void; icon: React.ReactNode; key?: React.Key }) => entries.length ? <section className="space-y-3"><div className="flex items-center gap-2 px-2">{icon}<h3 className="text-[10px] font-bold uppercase text-[#5a5548]">{title}</h3></div>{entries.map(entry => <JournalEntryRow key={entryKey(entry)} entry={entry} legs={legsByEntry.get(entryKey(entry)) || []} setEditingEntry={setEditingEntry} />)}</section> : null;

const JournalEntryRow = ({ entry, legs, setEditingEntry }: { entry: Entry; legs: AccountingLeg[]; setEditingEntry: (entry: Entry) => void; key?: React.Key }) => {
  const [copied, setCopied] = useState(false);
  const debit = unique(legs.filter(leg => leg.side === 'debit').map(leg => leg.accountName));
  const credit = unique(legs.filter(leg => leg.side === 'credit').map(leg => leg.accountName));
  const posting = legs.length ? `${debit.join(' + ')} ← ${credit.join(' + ')}` : `${entry.debit} ← ${entry.credit}`;
  const copy = (event: React.MouseEvent) => { event.stopPropagation(); navigator.clipboard.writeText(`${entry.tx}: ${posting}`); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return <div className="relative w-full rounded-2xl border border-[#1a1e2a] bg-[#0e1018] text-right transition-all hover:border-[#c9a84c33]">
    <button type="button" aria-label={`فتح القيد ${entry.tx}`} onClick={() => setEditingEntry(entry)} className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#c9a84c]" />
    <div className="relative z-0 p-5 pl-14 pointer-events-none">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><span className="font-bold text-[#c9a84c]">{entry.tx}</span>{entry.invoiceNumber && <span className="rounded-lg bg-[#1a1e2a] px-2 py-0.5 font-mono text-[10px] text-[#6a8a9e]">#{entry.invoiceNumber}</span>}<span className="text-[10px] text-[#8a8172]">{legs.length ? '\u0642\u064a\u062f \u0642\u0627\u0646\u0648\u0646\u064a' : '\u0642\u064a\u062f \u062e\u0627\u0645'}</span></div><div className="text-xs font-bold text-[#ddd8cc]">{posting}</div>{entry.notes && <div className="mt-2 text-[10px] italic text-[#8a8172]">{entry.notes}</div>}</div></div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#ddd8cc]"><span>{'\u0646\u0642\u062f: '}{entry.cash || '0'}</span><span>{'\u0648\u0632\u0646/\u0639\u062f\u062f: '}{entry.weight || '0'}</span>{entry.karat && <span>{'\u0639\u064a\u0627\u0631: '}{entry.karat}</span>}</div>
    </div>
    <button type="button" onClick={copy} className="absolute left-5 top-5 z-10 rounded-lg bg-[#1a1e2a] p-2 text-[#8a8172] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]">{copied ? <CheckCircle2 className="h-3 w-3 text-[#6a9e6a]" /> : <ClipboardPaste className="h-3 w-3" />}</button>
  </div>;};
const reasonLabels: Record<DailyJournalDiagnosticGroup['reason'], string> = {
  missing_debit_account: '\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u062f\u064a\u0646 \u0645\u0641\u0642\u0648\u062f', missing_credit_account: '\u062d\u0633\u0627\u0628 \u0627\u0644\u062f\u0627\u0626\u0646 \u0645\u0641\u0642\u0648\u062f',
  unresolved_debit_account_id: 'Debit Account ID \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f', unresolved_credit_account_id: 'Credit Account ID \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f',
  unsupported_operation_kind: 'operationKind \u063a\u064a\u0631 \u0645\u062f\u0639\u0648\u0645', missing_canonical_amount: '\u0642\u064a\u0645\u0629 \u062a\u0631\u062d\u064a\u0644 \u0645\u0641\u0642\u0648\u062f\u0629',
  cash_dimension_unavailable: '\u0628\u0639\u062f \u0627\u0644\u0646\u0642\u062f\u064a\u0629 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d', metal_dimension_unavailable: '\u0628\u0639\u062f \u0627\u0644\u0645\u0639\u062f\u0646 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d',
  missing_debit_metal_leg: '\u0631\u062c\u0644 \u0645\u062f\u064a\u0646 \u0645\u0639\u062f\u0646\u064a \u0645\u0641\u0642\u0648\u062f', missing_credit_metal_leg: '\u0631\u062c\u0644 \u062f\u0627\u0626\u0646 \u0645\u0639\u062f\u0646\u064a \u0645\u0641\u0642\u0648\u062f',
};
const DevelopmentDiagnostics = ({ groups, total }: { groups: DailyJournalDiagnosticGroup[]; total: number }) => <section className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"><div className="font-black">{'\u062a\u0634\u062e\u064a\u0635 Canonical Legs: '}{total} {'\u0642\u064a\u062f \u0645\u062a\u0623\u062b\u0631'}</div>{groups.map(group => <details key={group.reason} className="rounded-xl border border-amber-500/20 bg-[#080a0f]/40 p-3"><summary className="cursor-pointer font-bold text-amber-200">{reasonLabels[group.reason]} ({group.entries.length})</summary><p className="mt-2 text-xs text-amber-100/80">{group.recommendation}</p><div className="mt-3 space-y-2">{group.entries.map(entry => <details key={`${group.reason}-${entry.id}`} className="rounded-lg bg-black/20 p-2"><summary className="cursor-pointer text-xs"><span className="font-mono text-amber-300">{entry.id}</span> — {entry.tx} — {entry.debit} {'\u2190'} {entry.credit}</summary><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#ddd8cc]"><span>date: {entry.date}</span><span>operationKind: {entry.operationKind}</span><span>debitAccountId: {entry.debitAccountId || '-'}</span><span>creditAccountId: {entry.creditAccountId || '-'}</span><span>cash: {entry.cash}</span><span>weight: {entry.weight}</span><span>arabicWeight: {entry.arabicWeight}</span><span>karat: {entry.karat ?? '-'}</span></div></details>)}</div></details>)}</section>;
