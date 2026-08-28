import React from 'react';
import { ArrowLeft, ClipboardList, Gem, HandCoins, MessageCircle, ShoppingBag, Vault } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';
import { useHomeMetrics } from '../../hooks/useHomeMetrics';
import { MetalPriceEditor } from './MetalPriceEditor';

const money = (value: number, fractionDigits = 0) => value.toLocaleString('ar-EG', {
  minimumFractionDigits: fractionDigits,
  maximumFractionDigits: fractionDigits,
});

const ActionCard = React.memo(({ label, icon: Icon, onClick, tone }: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone: 'blue' | 'green' | 'teal';
}) => (
  <button type="button" onClick={onClick} className={`flex min-h-[154px] min-w-0 flex-col items-center justify-center gap-3 rounded-[22px] border px-2 py-4 text-center shadow-[0_14px_34px_rgba(0,0,0,0.2)] transition-transform active:scale-[0.985] ${tone === 'blue' ? 'border-blue-400/35 bg-blue-950/55' : tone === 'green' ? 'border-emerald-400/35 bg-emerald-950/45' : 'border-cyan-400/35 bg-cyan-950/45'}`}>
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-[#f1cf72]"><Icon className="h-9 w-9" aria-hidden="true" /></span>
    <span className="flex min-w-0 items-center justify-center gap-1 text-[15px] font-black leading-tight text-[#f5f1e8]">{label}<ArrowLeft className="h-4 w-4 shrink-0 text-[#c9a84c]" aria-hidden="true" /></span>
  </button>
));
ActionCard.displayName = 'ActionCard';

const OperationalCard = React.memo(({ title, value, unit, icon: Icon, children, gold, onClick }: {
  title: string;
  value?: string;
  unit?: string;
  icon: LucideIcon;
  children?: React.ReactNode;
  gold?: boolean;
  onClick?: () => void;
}) => {
  const content = <>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">{title}</h2><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/15"><Icon className="h-7 w-7" aria-hidden="true" /></span></div>
    {value !== undefined && <div className="mt-4 flex items-baseline gap-2"><strong className="font-mono text-4xl font-black tabular-nums">{value}</strong><span className="text-sm font-black">{unit}</span></div>}
    {children}
  </>;
  const className = `rounded-[24px] border p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22)] ${gold ? 'border-[#d8ae45]/70 bg-[#18150d] text-[#f5f1e8]' : 'border-white/[0.09] bg-[#0d1727] text-[#f5f1e8]'}`;
  return onClick ? <button type="button" onClick={onClick} className={`${className} block w-full text-right transition-colors active:bg-[#c9a84c]/10`}>{content}</button> : <section className={className}>{content}</section>;
});
OperationalCard.displayName = 'OperationalCard';

export const OperationalHomeView = React.memo(() => {
  const { operational } = useHomeMetrics();
  const { setView, setReportsTab, setEntryAssistantMode } = useAppStore(useShallow(state => ({
    setView: state.setView, setReportsTab: state.setReportsTab, setEntryAssistantMode: state.setEntryAssistantMode,
  })));
  const openAssistant = (mode: 'sale' | 'purchase') => { setEntryAssistantMode(mode); setView('entry'); };
  const openFinancialPosition = () => { setReportsTab('balance'); setView('reports'); };

  return <div className="space-y-4 pb-8" dir="rtl">
    <div className="flex items-center justify-between gap-3 px-1 pb-1">
      <div className="flex items-center gap-3"><Gem className="h-9 w-9 text-[#c9a84c]" aria-hidden="true" /><div><p className="text-[10px] font-black tracking-[0.18em] text-[#c9a84c]">MAKKA CENTRAL ACCOUNTING</p><h2 className="mt-1 text-2xl font-black text-[#f5f1e8]">الرئيسية</h2></div></div>
      <button type="button" onClick={() => setView('story')} aria-label="فتح حالة واتساب" className="flex min-h-[92px] w-[92px] shrink-0 flex-col items-center justify-center gap-1 rounded-3xl border border-emerald-400/35 bg-emerald-950/35 text-emerald-300 shadow-[0_12px_28px_rgba(0,0,0,0.22)] active:scale-95"><MessageCircle className="h-12 w-12" strokeWidth={1.8} /><span className="text-sm font-black text-[#f5f1e8]">واتساب</span></button>
    </div>

    <MetalPriceEditor />

    <div className="grid grid-cols-3 gap-2">
      <ActionCard label="مساعد الشراء" icon={HandCoins} tone="green" onClick={() => openAssistant('purchase')} />
      <ActionCard label="مساعد البيع" icon={ShoppingBag} tone="blue" onClick={() => openAssistant('sale')} />
      <ActionCard label="جرد الأصناف" icon={ClipboardList} tone="teal" onClick={() => setView('database')} />
    </div>

    <OperationalCard title="الخزنة" value={money(operational.treasuryCash)} unit="ج.م" icon={Vault} />
    <OperationalCard title="ملخص الذهب (عيار 21)" icon={Gem} gold onClick={openFinancialPosition}>
      <div className="mt-5 grid min-w-0 grid-cols-3 divide-x divide-x-reverse divide-[#c9a84c]/30">
        {[
          ['الأصول', operational.goldOwnership?.goldAssetWeight], ['الخصوم', operational.goldOwnership?.goldLiabilityWeight], ['حقوق الملكية', operational.goldOwnership?.netGoldWeight],
        ].map(([label, value]) => <div key={label as string} className="min-w-0 px-1 first:pl-0 last:pr-0"><p className="text-xs font-black sm:text-sm">{label as string}</p><p className="mt-2 whitespace-nowrap font-mono text-base font-black tabular-nums sm:text-xl">{value === undefined ? '—' : money(value as number, 2)}</p><p className="mt-1 whitespace-nowrap text-[10px] font-black sm:text-xs">جم E21</p></div>)}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 border-t border-[#c9a84c]/25 pt-3 text-sm font-black text-[#e8bd48]">فتح قائمة المركز المالي <ArrowLeft className="h-5 w-5" /></div>
      {operational.goldOwnershipDiagnostic && <p className="mt-3 text-[11px] font-bold">{operational.goldOwnershipDiagnostic}</p>}
    </OperationalCard>
  </div>;
});
OperationalHomeView.displayName = 'OperationalHomeView';
