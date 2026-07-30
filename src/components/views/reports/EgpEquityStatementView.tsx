import React, { useMemo } from 'react';
import { Landmark } from 'lucide-react';
import type { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { buildFinancialStatementsEgp } from '../../../lib/financialStatementsEgp';
import { CostDataBlockedView } from './CostDataBlockedView';

const money = (value: number) => value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const Row = ({ label, value, deduction = false, total = false }: { label: string; value: number; deduction?: boolean; total?: boolean }) => (
  <div className={total ? 'flex justify-between rounded-xl border border-[#c9a84c33] bg-[#c9a84c0d] p-3 font-black' : 'flex justify-between rounded-xl bg-[#080a0f] px-3 py-2 text-sm'}>
    <span>{label}</span><span className="font-mono tabular-nums">{deduction ? '-' : ''}{money(value)} ج.م</span>
  </div>
);

export const EquityStatementView = React.memo(({ entries }: { entries: Entry[] }) => {
  const { accountsDb, canonicalAccounts, costCalculationRun, goldPrice, silverPrice } = useAppStore();
  const dates = entries.map(entry => entry.date).filter(Boolean).sort();
  const report = useMemo(() => buildFinancialStatementsEgp(entries, accountsDb, {
    canonicalDefinitions: canonicalAccounts,
    timeline: costCalculationRun.timeline,
    goldPriceEgp: goldPrice,
    silverPriceEgp: silverPrice,
    incomeStartDate: dates[0],
    incomeEndDate: dates.at(-1),
    balanceEndDate: dates.at(-1),
  }), [entries, accountsDb, canonicalAccounts, costCalculationRun.timeline, goldPrice, silverPrice, dates]);
  const equity = report.balanceSheet.equity;

  if (!report.costBasisAvailable) return <div className="space-y-4 pb-20" dir="rtl"><CostDataBlockedView timeline={costCalculationRun.timeline} /></div>;

  return <div className="space-y-4 pb-20" dir="rtl">
    <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
      <h3 className="flex items-center gap-2 text-lg font-black text-[#f5f1e8]"><Landmark className="h-5 w-5 text-[#c9a84c]" />قائمة التغيرات في حقوق الملكية</h3>
      <p className="mt-1 text-xs text-[#8a8172]">مشتقة من نفس Posting Projection والقوائم المالية EGP.</p>
    </div>
    <section className="space-y-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
      <Row label="رأس المال والمساهمات" value={equity.capital} />
      <Row label="الأرباح المحتجزة" value={equity.retainedEarnings} />
      <Row label="صافي ربح الفترة" value={equity.currentProfit} />
      <Row label="احتياطي إعادة التقييم" value={equity.valuationReserve} />
      <Row label="مسحوبات المالك" value={equity.ownerWithdrawals} deduction />
      <Row label="إجمالي حقوق الملكية" value={equity.total} total />
    </section>
  </div>;
});