import React from 'react';
import { ArrowLeft, Gem, HandCoins, Image, ShoppingBag, Vault } from 'lucide-react';
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
  tone: 'blue' | 'green' | 'gold';
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-h-[112px] items-center justify-between gap-3 rounded-[22px] border px-4 text-right shadow-[0_14px_34px_rgba(0,0,0,0.2)] transition-transform active:scale-[0.985] ${tone === 'blue' ? 'border-blue-400/25 bg-blue-950/55' : tone === 'green' ? 'border-emerald-400/25 bg-emerald-950/45' : 'border-[#c9a84c]/45 bg-[#6b501c]/30'}`}
  >
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d8ae45]/35 bg-[#d8ae45]/10 text-[#f1cf72]">
      <Icon className="h-8 w-8" aria-hidden="true" />
    </span>
    <span className="flex min-w-0 items-center gap-2 text-lg font-black text-[#f5f1e8]">
      {label}
      <ArrowLeft className="h-5 w-5 shrink-0 text-[#c9a84c]" aria-hidden="true" />
    </span>
  </button>
));
ActionCard.displayName = 'ActionCard';

const OperationalCard = React.memo(({ title, value, unit, icon: Icon, children, gold }: {
  title: string;
  value?: string;
  unit?: string;
  icon: LucideIcon;
  children?: React.ReactNode;
  gold?: boolean;
}) => (
  <section className={`rounded-[24px] border p-5 shadow-[0_18px_44px_rgba(0,0,0,0.22)] ${gold ? 'border-[#d8ae45]/55 bg-[linear-gradient(145deg,#d8ae45,#9f7423)] text-[#130f08]' : 'border-white/[0.09] bg-[#0d1727] text-[#f5f1e8]'}`}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-black">{title}</h2>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/15"><Icon className="h-7 w-7" aria-hidden="true" /></span>
    </div>
    {value !== undefined && <div className="mt-5 flex items-baseline gap-2"><strong className="font-mono text-4xl font-black tabular-nums">{value}</strong><span className="text-sm font-black">{unit}</span></div>}
    {children}
  </section>
));
OperationalCard.displayName = 'OperationalCard';

export const OperationalHomeView = React.memo(() => {
  const { operational } = useHomeMetrics();
  const { setView, setEntryAssistantMode } = useAppStore(useShallow(state => ({
    setView: state.setView,
    setEntryAssistantMode: state.setEntryAssistantMode,
  })));

  const openAssistant = (mode: 'sale' | 'purchase') => {
    setEntryAssistantMode(mode);
    setView('entry');
  };

  const openStory = () => setView('story');

  return (
    <div className="space-y-4 pb-8" dir="rtl">
      <div className="flex items-center gap-3 px-1 pb-1">
        <Gem className="h-8 w-8 text-[#c9a84c]" aria-hidden="true" />
        <div><p className="text-[10px] font-black tracking-[0.18em] text-[#c9a84c]">MAKKA CENTRAL ACCOUNTING</p><h2 className="mt-1 text-2xl font-black text-[#f5f1e8]">الرئيسية</h2></div>
      </div>

      <MetalPriceEditor />

      <div className="grid grid-cols-2 gap-3">
        <ActionCard label="مساعد البيع" icon={ShoppingBag} tone="blue" onClick={() => openAssistant('sale')} />
        <ActionCard label="مساعد الشراء" icon={HandCoins} tone="green" onClick={() => openAssistant('purchase')} />
        <ActionCard label="حالة واتساب" icon={Image} tone="gold" onClick={openStory} />
      </div>

      <OperationalCard title="الخزنة" value={money(operational.treasuryCash)} unit="ج.م" icon={Vault} />

      <OperationalCard title="الذهب" icon={Gem} gold>
        <div className="mt-5 grid min-w-0 grid-cols-3 divide-x divide-x-reverse divide-black/15">
          {[
            ['الأصول', operational.goldOwnership?.goldAssetWeight],
            ['الخصوم', operational.goldOwnership?.goldLiabilityWeight],
            ['حقوق الملكية', operational.goldOwnership?.netGoldWeight],
          ].map(([label, value]) => <div key={label as string} className="min-w-0 px-1 first:pl-0 last:pr-0"><p className="text-sm font-black">{label as string}</p><p className="mt-2 whitespace-nowrap font-mono text-lg font-black tabular-nums sm:text-xl">{value === undefined ? '—' : money(value as number, 2)}</p><p className="mt-1 whitespace-nowrap text-xs font-black">جم E21</p></div>)}
        </div>
        {operational.goldOwnershipDiagnostic && <p className="mt-3 text-[11px] font-bold">{operational.goldOwnershipDiagnostic}</p>}
      </OperationalCard>
    </div>
  );
});
OperationalHomeView.displayName = 'OperationalHomeView';
