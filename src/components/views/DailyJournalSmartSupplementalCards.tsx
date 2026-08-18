import React from 'react';
import { formatEgpNumber, formatWeight } from '../../lib/formatting';
import type { SmartDashboardReport } from '../../lib/dailyJournalSmartDashboard';

type Dashboard = SmartDashboardReport;

const Card = ({ title, lines }: { title: string; lines: string[] }) => lines.length ? <div className="rounded-3xl border border-[#1a1e2a] bg-[#0e1018] p-4" dir="rtl"><h3 className="text-xs font-black text-[#c9a84c]">{title}</h3><div className="mt-3 space-y-2 text-[11px] text-[#ddd8cc]">{lines.map(line => <div key={line}><bdi dir="ltr">{line}</bdi></div>)}</div></div> : null;

const nonZero = (value: number) => Math.abs(value) > 0.000001;


export const DailyJournalSmartSupplementalCards = ({ report }: { report: Dashboard }) => {
  const silverLines = [
    nonZero(report.silver.salesWeight) || nonZero(report.silver.salesEgp) ? `مبيعات فضة: ${formatWeight(report.silver.salesWeight, 2)} جم / ${formatEgpNumber(report.silver.salesEgp)} ج` : '',
    nonZero(report.silver.purchasesWeight) || nonZero(report.silver.purchasesEgp) ? `مشتريات فضة: ${formatWeight(report.silver.purchasesWeight, 2)} جم / ${formatEgpNumber(report.silver.purchasesEgp)} ج` : '',
    nonZero(report.silver.internalMovement) ? `حركة فضة داخلية: ${formatWeight(report.silver.internalMovement, 2)} جم` : '',
    nonZero(report.silver.netMovement) ? `صافي حركة الفضة: ${formatWeight(report.silver.netMovement, 2)} جم` : '',
  ].filter(Boolean);
  const traderLines = [
    nonZero(report.merchants.goldReceived) ? `التجار — ذهب مستلم: ${formatWeight(report.merchants.goldReceivedPhysical, 2)} جم / ${formatWeight(report.merchants.goldReceived, 2)} E21` : '',
    nonZero(report.merchants.goldDelivered) ? `التجار — ذهب مسلم: ${formatWeight(report.merchants.goldDeliveredPhysical, 2)} جم / ${formatWeight(report.merchants.goldDelivered, 2)} E21` : '',
    nonZero(report.merchants.goldTransfers) ? `التجار — تحويلات: ${formatWeight(report.merchants.goldTransfers, 2)} E21` : '',
    nonZero(report.merchants.goldNet) ? `التجار — صافي حركة ذهب المحل: ${formatWeight(report.merchants.goldNet, 2)} E21` : '',
    nonZero(report.merchants.workmanshipCash) ? `التجار — مصنعية / رصيد نقدي: ${formatEgpNumber(report.merchants.workmanshipCash)} ج` : '',
    nonZero(report.merchants.silverReceived) || nonZero(report.merchants.silverDelivered) ? `الفضة مع التجار: مستلم ${formatWeight(report.merchants.silverReceived, 2)} جم / مسلم ${formatWeight(report.merchants.silverDelivered, 2)} جم` : '',
  ].filter(Boolean);
  const internalLines = [
    report.internal.transfers > 0 ? `تحويلات داخلية: ${report.internal.transfers}` : '',
    nonZero(report.internal.scrapIn) ? `كسر داخل: ${formatWeight(report.internal.scrapIn, 2)} E21` : '',
    nonZero(report.internal.scrapOut) ? `كسر خارج: ${formatWeight(report.internal.scrapOut, 2)} E21` : '',
    nonZero(report.internal.netScrap) ? `صافي حركة الكسر: ${formatWeight(report.internal.netScrap, 2)} E21` : '',
    ...Object.entries(report.internal.directions).filter(([, value]) => value.movements > 0).map(([direction, value]) => `${direction}: ${formatWeight(value.physical, 2)} جم / ${formatWeight(value.e21, 2)} E21`),
  ].filter(Boolean);
  if (!silverLines.length && !traderLines.length && !internalLines.length) return null;
  return <div className="grid gap-4 lg:grid-cols-3"><Card title="الفضة" lines={silverLines} /><Card title="التجار" lines={traderLines} /><Card title="تحويلات داخلية / كسر" lines={internalLines} /></div>;
};
