import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, ClipboardPaste, Database, Download, PlusCircle, Scale, TrendingUp, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { AccountingLeg } from '../../lib/canonicalAccounting';
import { buildDailyJournalReport, DailyJournalDiagnosticGroup, DailyJournalDimension } from '../../lib/dailyJournalReport';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store';
import { Entry } from '../../types';

const dimensions: { id: DailyJournalDimension; title: string; unit: string; icon: React.ElementType; accent: string }[] = [
  { id: 'gold', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0630\u0647\u0628 (21)', unit: '\u062c\u0645', icon: Scale, accent: 'text-[#c9a84c]' },
  { id: 'silver', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0641\u0636\u0629', unit: '\u062c\u0645', icon: Database, accent: 'text-[#6a8a9e]' },
  { id: 'cash', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0646\u0642\u062f\u064a\u0629', unit: '\u062c.\u0645', icon: Wallet, accent: 'text-[#6a9e6a]' },
];

const entryKey = (entry: Entry) => entry.id || String(entry.seq);
const unique = (items: string[]) => [...new Set(items)].filter(Boolean);
const amount = (value: number, dimension: DailyJournalDimension) => value.toLocaleString(undefined, dimension === 'cash' || dimension === 'quantity' ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export type DailyJournalExportRow = Record<string, string | number | undefined>;

export const createDailyJournalWorkbook = async (summary: DailyJournalExportRow[], operations: DailyJournalExportRow[]) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Journal Summary');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(operations), 'Operations');
  return { XLSX, workbook };
};

export const DailyJournalView = React.memo(() => {
  const { entries, setEditingEntry, accountsDb, setView, journalDate: selectedDate, setJournalDate: setSelectedDate } = useAppStore();

  useEffect(() => {
    if (selectedDate) return;
    const dates = entries.map(entry => entry.date).filter(Boolean);
    setSelectedDate(dates.length ? dates.reduce((latest, date) => latest > date ? latest : date) : format(new Date(), 'yyyy-MM-dd'));
  }, [entries, selectedDate]);

  const report = useMemo(() => buildDailyJournalReport(entries, accountsDb, selectedDate), [entries, accountsDb, selectedDate]);
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
  const exportToExcel = async () => {
    const summary = dimensions.map(meta => {
      const data = report.dimensions[meta.id];
      return { dimension: meta.title, openingDebit: data.openingDebit, openingCredit: data.openingCredit, periodDebit: data.periodDebit, periodCredit: data.periodCredit, closingDebit: data.closingDebit, closingCredit: data.closingCredit };
    });
    const operations = rawEntries.map(entry => ({ date: entry.date, operation: entry.invoiceNumber || entry.seq, tx: entry.tx, debit: entry.debit, credit: entry.credit, cash: entry.cash, weight: entry.weight, count: entry.count, notes: entry.notes }));
    const { XLSX, workbook } = await createDailyJournalWorkbook(summary, operations);
    XLSX.writeFile(workbook, `Journal_${selectedDate}.xlsx`);
  };

  return <div className="space-y-6 pb-10" dir="rtl">
    <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black text-[#c9a84c]"><Calendar className="h-5 w-5" />{'\u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0627\u0644\u0639\u0627\u0645\u0629'}</h2>
        <button type="button" onClick={exportToExcel} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9a84c22] bg-[#c9a84c11] text-[#c9a84c]"><Download className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button type="button" onClick={() => { const date = new Date(selectedDate); date.setDate(date.getDate() - 1); setSelectedDate(format(date, 'yyyy-MM-dd')); }} className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc]"><ChevronRight className="h-5 w-5" /></button>
        <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="h-11 rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-center text-sm font-black text-[#ddd8cc] outline-none [color-scheme:dark]" />
        <button type="button" onClick={() => { const date = new Date(selectedDate); date.setDate(date.getDate() + 1); setSelectedDate(format(date, 'yyyy-MM-dd')); }} className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc]"><ChevronLeft className="h-5 w-5" /></button>
      </div>
      <button type="button" onClick={openEntryForSelectedDate} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-4 py-3 text-sm font-black text-[#080a0f] shadow-lg shadow-[#c9a84c]/10 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#f5f1e8]">
        <PlusCircle className="h-4 w-4" />
        {'إضافة عملية لهذا اليوم'}
      </button>
    </div>

    {import.meta.env.DEV && report.diagnostics.groups.length > 0 && <DevelopmentDiagnostics groups={report.diagnostics.groups} total={report.diagnostics.entries.length} />}

    <section className="rounded-3xl border border-[#1a1e2a] bg-[#0e1018] p-6 shadow-2xl">
      <div className="grid gap-5 lg:grid-cols-3">
        {dimensions.map(meta => <DimensionSummary key={meta.id} {...meta} report={report.dimensions[meta.id]} />)}
      </div>
    </section>

    <div className="space-y-8">
      <EntrySection title={'\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a'} entries={groups.sale} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<TrendingUp className="h-3 w-3 text-[#6a9e6a]" />} />
      <EntrySection title={'\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a'} entries={groups.purchase} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<TrendingUp className="h-3 w-3 rotate-180 text-[#9e6a6a]" />} />
      <EntrySection title={'\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641'} entries={groups.expense} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<TrendingUp className="h-3 w-3 text-[#9e6a6a]" />} />
      <EntrySection title={'\u062d\u0631\u0643\u0627\u062a \u0623\u062e\u0631\u0649'} entries={groups.other} legsByEntry={legsByEntry} setEditingEntry={setEditingEntry} icon={<Database className="h-3 w-3 text-[#c9a84c]" />} />
      {rawEntries.length === 0 && <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] py-20 text-center text-sm text-[#5a5548]">{'\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0645\u0644\u064a\u0627\u062a \u0645\u0633\u062c\u0644\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645'}</div>}
    </div>
  </div>;
});

const DimensionSummary = ({ id, title, unit, icon: Icon, accent, report }: { id: DailyJournalDimension; title: string; unit: string; icon: React.ElementType; accent: string; report: ReturnType<typeof buildDailyJournalReport>['dimensions'][DailyJournalDimension]; key?: React.Key }) => {
  const closing = report.closingDebit - report.closingCredit;
  return <div className="space-y-3 rounded-2xl border border-[#1a1e2a] bg-[#080a0f] p-4">
    <div className={cn('flex items-center gap-2 text-xs font-black', accent)}><Icon className="h-4 w-4" />{title}</div>
    <div className="grid grid-cols-2 gap-2 text-xs"><Metric label={'\u0631\u0635\u064a\u062f \u0623\u0648\u0644 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.openingDebit - report.openingCredit, id)} ${unit}`} /><Metric label={'\u0648\u0627\u0631\u062f \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.periodDebit, id)} ${unit}`} /><Metric label={'\u0635\u0627\u062f\u0631 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.periodCredit, id)} ${unit}`} /><Metric label={'\u0631\u0635\u064a\u062f \u0622\u062e\u0631 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(closing, id)} ${unit}`} strong /></div>
  </div>;
};
const Metric = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => <div className="rounded-xl bg-[#0e1018] p-2"><div className="text-[10px] text-[#8a8172]">{label}</div><div className={cn('mt-1 font-mono text-sm text-[#ddd8cc]', strong && 'font-black text-[#c9a84c]')}>{value}</div></div>;

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
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#ddd8cc]"><span>{'\u0646\u0642\u062f: '}{amount(parseFloat(entry.cash || '0'), 'cash')}</span><span>{'\u0648\u0632\u0646/\u0639\u062f\u062f: '}{entry.weight || '0'}</span>{entry.karat && <span>{'\u0639\u064a\u0627\u0631: '}{entry.karat}</span>}</div>
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