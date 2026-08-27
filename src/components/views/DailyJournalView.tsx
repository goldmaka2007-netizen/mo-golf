import React, { useEffect, useMemo, useState } from 'react';
import { Database, Scale, TrendingUp, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AccountingLeg } from '../../lib/canonicalAccounting';
import { buildDailyJournalReport, DailyJournalDimension } from '../../lib/dailyJournalReport';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store';
import { Entry } from '../../types';
import { formatEgpNumber, formatQuantity, formatWeight } from '../../lib/formatting';
import { downloadCsv } from '../../utils/csv';
import { buildDailyJournalSmartDashboard, resolveDailyJournalMarketPrice } from '../../lib/dailyJournalSmartDashboard';
import { DailyJournalSmartSupplementalCards } from './DailyJournalSmartSupplementalCards';
import { DailyJournalDateControls } from './daily-journal/DailyJournalDateControls';
import { createDailyJournalCsvRows, entryKey, groupDailyJournalEntries } from './daily-journal/dailyJournalPresentation';
import { CashClosingCard, SmartDashboard } from './daily-journal/DailyJournalDashboardPresentation';
import { DevelopmentDiagnostics, EntrySection } from './daily-journal/DailyJournalEntryPresentation';

const dimensions: { id: DailyJournalDimension; title: string; unit: string; icon: React.ElementType; accent: string }[] = [
  { id: 'gold', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0630\u0647\u0628 (21)', unit: '\u062c\u0645', icon: Scale, accent: 'text-[#c9a84c]' },
  { id: 'silver', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0641\u0636\u0629', unit: '\u062c\u0645', icon: Database, accent: 'text-[#6a8a9e]' },
  { id: 'cash', title: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0646\u0642\u062f\u064a\u0629', unit: '\u062c.\u0645', icon: Wallet, accent: 'text-[#6a9e6a]' },
];

const amount = (value: number, dimension: DailyJournalDimension) => dimension === 'cash' ? formatEgpNumber(value) : dimension === 'quantity' ? formatQuantity(value, 3) : formatWeight(value, 2);
export type { DailyJournalExportRow } from './daily-journal/dailyJournalPresentation';
export { createDailyJournalCsvRows } from './daily-journal/dailyJournalPresentation';

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
    return groupDailyJournalEntries(rawEntries, legsByEntry);
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
    <DailyJournalDateControls selectedDate={selectedDate} readableSelectedDate={readableSelectedDate} onDateChange={setSelectedDate} onExport={exportToCsv} onAddEntry={openEntryForSelectedDate} />

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
