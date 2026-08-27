import React, { useEffect, useMemo, useState } from 'react';
import { Database, Scale, TrendingUp, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AccountingLeg } from '../../lib/canonicalAccounting';
import { buildDailyJournalReport, DailyJournalDimension } from '../../lib/dailyJournalReport';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store';
import { formatEgpNumber, formatQuantity, formatWeight } from '../../lib/formatting';
import { downloadCsv } from '../../utils/csv';
import { buildDailyJournalSmartDashboard, resolveDailyJournalMarketPrice } from '../../lib/dailyJournalSmartDashboard';
import { DailyJournalSmartSupplementalCards } from './DailyJournalSmartSupplementalCards';
import { DailyJournalDateControls } from './daily-journal/DailyJournalDateControls';
import { DevelopmentDiagnostics, EntrySection } from './daily-journal/DailyJournalEntryPresentation';
import { createDailyJournalCsvRows, entryKey, groupDailyJournalEntries } from './daily-journal/dailyJournalPresentation';

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
  const readableSelectedDate = selectedDate ? format(new Date(`${selectedDate}T00:00:00`), 'd MMMM yyyy', { locale: ar }) : 'Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã˜Â±Ã™Å Ã˜Â®';
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

const CashClosingCard = ({ cash }: { cash: ReturnType<typeof buildDailyJournalSmartDashboard>['cash'] }) => <section className="rounded-3xl border border-[#6a9e6a66] bg-[#0e1018] p-5 shadow-2xl" dir="rtl"><h3 className="flex items-center gap-2 text-sm font-black text-[#6a9e6a]"><Wallet className="h-4 w-4" />Ã˜Â±Ã˜ÂµÃ™Å Ã˜Â¯ Ã™Ë†Ã˜Â¥Ã™â€šÃ™ÂÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â²Ã™â€ Ã˜Â©</h3><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5"><Metric label="Ã˜Â±Ã˜ÂµÃ™Å Ã˜Â¯ Ã˜Â£Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦" value={formatEgpNumber(cash.opening)} /><Metric label="Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â¯Ã™Å " value={formatEgpNumber(cash.cashIn)} /><Metric label="Ã˜Â§Ã™â€žÃ˜Â±Ã˜ÂµÃ™Å Ã˜Â¯ + Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž" value={formatEgpNumber(cash.availableBeforeOut)} /><Metric label="Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â¯Ã™Å " value={formatEgpNumber(cash.cashOut)} /><Metric label="Ã˜Â±Ã˜ÂµÃ™Å Ã˜Â¯ Ã˜Â¢Ã˜Â®Ã˜Â± Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦" value={formatEgpNumber(cash.closing)} strong /></div></section>;

const SmartDashboard = ({ report }: { report: ReturnType<typeof buildDailyJournalSmartDashboard> }) => { const money = (v: number | null) => v === null ? 'Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­' : `${formatEgpNumber(v)} Ã˜Â¬/Ã˜Â¬Ã™â€¦ E21`; const row = (label: string, w: ReturnType<typeof buildDailyJournalSmartDashboard>['gold']['sales']['today']) => <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#080a0f] p-2 text-[10px]"><span>{label}</span><span>{formatWeight(w.e21, 2)} E21</span><span>{formatEgpNumber(w.egp)} Ã˜Â¬</span><span>{money(w.average)}</span></div>; const secondary = [
    `Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã¢â‚¬â€ Ã˜Â°Ã™â€¡Ã˜Â¨ Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€žÃ™â€¦: ${formatWeight(report.merchants.goldReceivedPhysical, 2)} Ã˜Â¬Ã™â€¦ / ${formatWeight(report.merchants.goldReceived, 2)} E21`,
    `Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã¢â‚¬â€ Ã˜Â°Ã™â€¡Ã˜Â¨ Ã™â€¦Ã˜Â³Ã™â€žÃ™â€¦: ${formatWeight(report.merchants.goldDeliveredPhysical, 2)} Ã˜Â¬Ã™â€¦ / ${formatWeight(report.merchants.goldDelivered, 2)} E21`,
    `Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã¢â‚¬â€ Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª (Ã˜Â¨Ã˜Â¯Ã™Ë†Ã™â€  Ã˜Â£Ã˜Â«Ã˜Â± Ã˜ÂµÃ˜Â§Ã™ÂÃ™Å  Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜Â²Ã™Ë†Ã™â€ ): ${formatWeight(report.merchants.goldTransfers, 2)} E21`,
    `Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã¢â‚¬â€ Ã˜ÂµÃ˜Â§Ã™ÂÃ™Å  Ã˜Â­Ã˜Â±Ã™Æ’Ã˜Â© Ã™â€¦Ã˜Â­Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â°Ã™â€¡Ã˜Â¨: ${formatWeight(report.merchants.goldNet, 2)} E21`,
    `Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã¢â‚¬â€ Ã™â€¦Ã˜ÂµÃ™â€ Ã˜Â¹Ã™Å Ã˜Â© / Ã˜Â±Ã˜ÂµÃ™Å Ã˜Â¯ Ã™â€ Ã™â€šÃ˜Â¯Ã™Å : ${formatEgpNumber(report.merchants.workmanshipCash)} Ã˜Â¬`,
    `Ã™ÂÃ˜Â¶Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ˜Â§Ã˜Â¡: Ã˜Â¨Ã™Å Ã˜Â¹ ${formatWeight(report.silver.salesWeight, 2)} Ã˜Â¬Ã™â€¦ / ${formatEgpNumber(report.silver.salesEgp)} Ã˜Â¬ Ã¢â‚¬â€ Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Â¡ ${formatWeight(report.silver.purchasesWeight, 2)} Ã˜Â¬Ã™â€¦ / ${formatEgpNumber(report.silver.purchasesEgp)} Ã˜Â¬ Ã¢â‚¬â€ Ã˜ÂµÃ˜Â§Ã™ÂÃ™Å  Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€žÃ™Å  ${formatWeight(report.silver.netMovement, 2)} Ã˜Â¬Ã™â€¦`,
    `Ã™ÂÃ˜Â¶Ã˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â±: Ã™â€¦Ã˜Â³Ã˜ÂªÃ™â€žÃ™â€¦ ${formatWeight(report.silver.merchantReceived, 2)} Ã˜Â¬Ã™â€¦ / Ã™â€¦Ã˜Â³Ã™â€žÃ™â€¦ ${formatWeight(report.silver.merchantDelivered, 2)} Ã˜Â¬Ã™â€¦`,
    `Ã˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€žÃ™Å Ã˜Â©: ${report.internal.transfers} Ã¢â‚¬â€ Ã™Æ’Ã˜Â³Ã˜Â± Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž ${formatWeight(report.internal.scrapIn, 2)} E21 Ã¢â‚¬â€ Ã˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬ ${formatWeight(report.internal.scrapOut, 2)} E21`,
    `Ã˜Â§Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™â€¡Ã˜Â§Ã˜Âª Ã˜Â¯Ã˜Â§Ã˜Â®Ã™â€žÃ™Å Ã˜Â©: ${Object.entries(report.internal.directions).map(([key, value]) => `${key}: ${formatWeight(value.e21, 2)} E21`).join('Ã˜Å’ ') || 'Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯'}`,
    `Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¹Ã™Å Ã˜Â§Ã˜Â±: ${Object.entries(report.merchants.goldByKarat).filter(([, value]) => value.movements > 0).map(([key, value]) => `${key}: ${formatWeight(value.physical, 2)} Ã˜Â¬Ã™â€¦/${formatWeight(value.e21, 2)} E21`).join('Ã˜Å’ ') || 'Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯'}`,
    `Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â±Ã™Æ’Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â§Ã˜Â®Ã™â€žÃ™Å Ã˜Â© Ã˜Â­Ã˜Â³Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¹Ã™Å Ã˜Â§Ã˜Â±: ${Object.entries(report.internal.goldByKarat).filter(([, value]) => value.movements > 0).map(([key, value]) => `${key}: ${formatWeight(value.physical, 2)} Ã˜Â¬Ã™â€¦/${formatWeight(value.e21, 2)} E21`).join('Ã˜Å’ ') || 'Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯'}`,
    `Ã˜Â­Ã˜Â±Ã™Æ’Ã˜Â§Ã˜Âª Ã˜Â¹Ã™Å Ã˜Â§Ã˜Â±Ã™â€¡Ã˜Â§ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¤Ã™Æ’Ã˜Â¯Ã˜Â©: ${report.merchants.karatConflicts + report.internal.karatConflicts}`,
  ]; return <section className="space-y-4" dir="rtl"><h2 className="text-base font-black text-[#c9a84c]">Smart Daily Management Dashboard</h2><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-[#c9a84c66] bg-[#0e1018] p-5"><h3 className="font-black text-[#f0cc6b]">Ã™â€šÃ˜Â±Ã˜Â§Ã˜Â± Ã˜Â´Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ˜Â°Ã™â€¡Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜Â¢Ã™â€ </h3><Metric label="Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â³Ã˜Â· Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â¹ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¯Ã™â€¦Ã˜Â¬" value={money(report.decision.blendedSell)} /><Metric label="Ã˜Â³Ã™â€šÃ™Â Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â±Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€šÃ˜ÂªÃ˜Â±Ã˜Â­" value={money(report.decision.suggestedPurchase)} strong /><p className="mt-3 text-[11px] text-[#8a8172]">Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã˜Â¬Ã˜Â² Ã˜Â§Ã™â€žÃ™â€¦Ã™â€žÃ˜Â²Ã™â€¦: {report.decision.binding || 'Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­'} Ã¢â‚¬â€ Ã™â€žÃ™Å Ã˜Â³ Ã˜Â±Ã˜Â¨Ã˜Â­Ã™â€¹Ã˜Â§ Ã™â€¦Ã˜Â­Ã˜Â§Ã˜Â³Ã˜Â¨Ã™Å Ã™â€¹Ã˜Â§.</p><p className="mt-2 text-[10px] text-[#8a8172]">Ã˜Â³Ã˜Â¹Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â³Ã™Ë†Ã™â€š 21: {report.marketPrice === null ? 'Ã˜Â³Ã˜Â¹Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â³Ã™Ë†Ã™â€š Ã™â€žÃ™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã˜Â±Ã™Å Ã˜Â® Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­' : `${formatEgpNumber(report.marketPrice)} Ã˜Â¬/Ã˜Â¬Ã™â€¦ Ã¢â‚¬â€ Ã™â€¦Ã˜Â±Ã˜Â¬Ã˜Â¹ Ã™ÂÃ™â€šÃ˜Â·`}</p></div><div className="rounded-3xl border border-[#c9a84c33] bg-[#0e1018] p-5"><h3 className="font-black text-[#f0cc6b]">Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â°Ã™â€¡Ã˜Â¨ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â±Ã™Å  Ã¢â‚¬â€ Ã™â€¡Ã˜Â§Ã™â€¦Ã˜Â´ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã˜Â§Ã™Ë†Ã™â€ž</h3><h4 className="mt-3 text-xs text-[#6a9e6a]">Ã™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ˜Â§Ã˜Â¡</h4>{row('Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦', report.gold.sales.today)}{row('Ã˜Â¢Ã˜Â®Ã˜Â± 7 Ã˜Â£Ã™Å Ã˜Â§Ã™â€¦', report.gold.sales.last7Days)}{row('Ã˜Â¢Ã˜Â®Ã˜Â± 30 Ã™Å Ã™Ë†Ã™â€¦Ã™â€¹Ã˜Â§', report.gold.sales.last30Days)}<h4 className="mt-3 text-xs text-[#9e6a6a]">Ã™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ˜Â§Ã˜Â¡</h4>{row('Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦', report.gold.purchases.today)}{row('Ã˜Â¢Ã˜Â®Ã˜Â± 7 Ã˜Â£Ã™Å Ã˜Â§Ã™â€¦', report.gold.purchases.last7Days)}{row('Ã˜Â¢Ã˜Â®Ã˜Â± 30 Ã™Å Ã™Ë†Ã™â€¦Ã™â€¹Ã˜Â§', report.gold.purchases.last30Days)}<p className="mt-3 text-xs">Ã™â€¡Ã˜Â§Ã™â€¦Ã˜Â´ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã˜Â§Ã™Ë†Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â§Ã˜Â±Ã™Å Ã˜Â®Ã™Å : {money(report.decision.historicalSpread)}</p></div></div><div className="grid gap-4 lg:grid-cols-3"><SmartCard title="Ã™â€¦Ã™â€žÃ˜Â®Ã˜Âµ Ã˜Â°Ã™â€¡Ã˜Â¨ Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦" lines={[`Ã˜Â§Ã™â€žÃ˜Â¯Ã˜Â§Ã˜Â®Ã™â€ž: ${formatWeight(report.gold.physicalIn, 2)} Ã˜Â¬Ã™â€¦ / ${formatWeight(report.gold.movementIn, 2)} E21`,`Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â§Ã˜Â±Ã˜Â¬: ${formatWeight(report.gold.physicalOut, 2)} Ã˜Â¬Ã™â€¦ / ${formatWeight(report.gold.movementOut, 2)} E21`,`Ã˜Â§Ã™â€žÃ˜ÂµÃ˜Â§Ã™ÂÃ™Å : ${formatWeight(report.gold.movementIn - report.gold.movementOut, 2)} E21`]} /><SmartCard title="Ã˜Â´Ã˜Â±Ã˜Â­ Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â¯Ã™Å Ã˜Â©" lines={report.cash.categories.map(c => `${c.label}: +${formatEgpNumber(c.cashIn)} / -${formatEgpNumber(c.cashOut)}`)} /><SmartCard title="Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã™Ë†Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¶Ã˜Â© Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Ë†Ã™Å Ã™â€žÃ˜Â§Ã˜Âª" lines={secondary} /><SmartCard title="Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â¨Ã˜Â¹Ã˜Â¯Ã˜Â©" lines={[`Ã˜Â­Ã˜Â±Ã™Æ’Ã˜Â§Ã˜Âª Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¤Ã™â€¡Ã™â€žÃ˜Â© Ã™â€žÃ™â€žÃ˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â±Ã™Å : ${report.gold.excluded}`, 'Ã™â€žÃ˜Â§ Ã˜ÂªÃ˜Â¤Ã˜Â«Ã˜Â± Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â¥Ã™â€šÃ™ÂÃ˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â²Ã™â€ Ã˜Â©.']} /></div></section>; };
const SmartCard = ({ title, lines, details }: { title: string; lines: string[]; details?: string[] }) => { const visibleLines = [...new Set(lines)].filter(line => !line.endsWith('Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯') && !/[:\u0020]0(?:\.00)?(?:\u0020|$)/.test(line)); const displayLines = visibleLines.length ? visibleLines : title.includes('Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â±') ? ['Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â­Ã˜Â±Ã™Æ’Ã˜Â© Ã˜ÂªÃ˜Â¬Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦'] : []; return displayLines.length ? <div className="rounded-3xl border border-[#1a1e2a] bg-[#0e1018] p-4"><h3 className="text-xs font-black text-[#c9a84c]">{title}</h3><div className="mt-3 space-y-2 text-[11px] text-[#ddd8cc]">{displayLines.map(line => <div key={line}><bdi dir="ltr">{line}</bdi></div>)}</div>{details?.length ? <details className="mt-3 text-[10px] text-[#8a8172]"><summary className="cursor-pointer">Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â§Ã˜ÂªÃ˜Â¬Ã˜Â§Ã™â€¡ Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¹Ã™Å Ã˜Â§Ã˜Â±</summary><div className="mt-2 space-y-1">{details.map(line => <div key={line}><bdi dir="ltr">{line}</bdi></div>)}</div></details> : null}</div> : null; };

const DimensionSummary = ({ id, title, unit, icon: Icon, accent, report }: { id: DailyJournalDimension; title: string; unit: string; icon: React.ElementType; accent: string; report: ReturnType<typeof buildDailyJournalReport>['dimensions'][DailyJournalDimension]; key?: React.Key }) => {
  const closing = report.closingDebit - report.closingCredit;
  return <div className="space-y-3 rounded-2xl border border-[#1a1e2a] bg-[#080a0f] p-4">
    <div className={cn('flex items-center gap-2 text-xs font-black', accent)}><Icon className="h-4 w-4" />{title}</div>
    <div className="grid grid-cols-2 gap-2 text-xs"><Metric label={'\u0631\u0635\u064a\u062f \u0623\u0648\u0644 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.openingDebit - report.openingCredit, id)} ${unit}`} /><Metric label={'\u0648\u0627\u0631\u062f \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.periodDebit, id)} ${unit}`} /><Metric label={'\u0635\u0627\u062f\u0631 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(report.periodCredit, id)} ${unit}`} /><Metric label={'\u0631\u0635\u064a\u062f \u0622\u062e\u0631 \u0627\u0644\u064a\u0648\u0645'} value={`${amount(closing, id)} ${unit}`} strong /></div>
  </div>;
};
const Metric = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => <div className="rounded-xl bg-[#0e1018] p-2"><div className="text-[10px] text-[#8a8172]">{label}</div><div className={cn('mt-1 font-mono text-sm text-[#ddd8cc]', strong && 'font-black text-[#c9a84c')}><bdi dir="ltr">{value}</bdi></div></div>;
