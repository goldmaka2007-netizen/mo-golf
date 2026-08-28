import React from 'react';
import { Coins, Gem, Save, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store';
import { normalizeMetalPriceInput, parseMetalPrice, saveMetalPrices } from '../../lib/metalPrices';

export const applySavedMetalPrices = (
  goldPrice: number,
  silverPrice: number,
  goldSpread: number,
  silverSpread: number,
  setters: {
    setGoldPrice: (value: number) => void;
    setGoldBuyPrice: (value: number) => void;
    setSilverPrice: (value: number) => void;
    setSilverBuyPrice: (value: number) => void;
  },
) => {
  setters.setGoldPrice(goldPrice);
  setters.setGoldBuyPrice(goldPrice - goldSpread);
  setters.setSilverPrice(silverPrice);
  setters.setSilverBuyPrice(silverPrice - silverSpread);
};
const PriceField = ({ id, label, value, onChange, accent }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  accent: 'gold' | 'silver';
}) => (
  <label htmlFor={id} className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/20 p-2">
    <span className="mb-1 flex min-h-8 items-center gap-1 text-[11px] font-black leading-tight text-[#ddd8cc]">
      {accent === 'gold' ? <Gem className="h-4 w-4 text-[#c9a84c]" /> : <Coins className="h-4 w-4 text-slate-300" />}
      {label}
    </span>
    <span className="relative block min-w-0">
      <input
        id={id}
        aria-label={label}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={event => onChange(normalizeMetalPriceInput(event.target.value))}
        className="w-full min-w-0 rounded-xl border border-white/[0.09] bg-[#080a0f] px-3 py-2 pl-12 text-left font-mono text-lg font-black tabular-nums text-[#f5f1e8] outline-none focus:border-[#c9a84c]/60"
      />
      {value !== '' && <button type="button" aria-label={`مسح ${label}`} onClick={() => onChange('')} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#8a8172] hover:bg-white/10"><X className="h-4 w-4" /></button>}
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#78736a]">ج.م</span>
    </span>
  </label>
);

export const MetalPriceEditor = React.memo(({ goldOnly = false }: { goldOnly?: boolean }) => {
  const {
    user,
    goldPrice,
    silverPrice,
    goldSpread,
    silverSpread,
    setGoldPrice,
    setGoldBuyPrice,
    setSilverPrice,
    setSilverBuyPrice,
  } = useAppStore(useShallow(state => ({
    user: state.user,
    goldPrice: state.goldPrice,
    silverPrice: state.silverPrice,
    goldSpread: state.goldSpread,
    silverSpread: state.silverSpread,
    setGoldPrice: state.setGoldPrice,
    setGoldBuyPrice: state.setGoldBuyPrice,
    setSilverPrice: state.setSilverPrice,
    setSilverBuyPrice: state.setSilverBuyPrice,
  })));
  const [goldDraft, setGoldDraft] = React.useState(String(goldPrice));
  const [silverDraft, setSilverDraft] = React.useState(String(silverPrice));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const goldDraftDirty = React.useRef(false);
  const silverDraftDirty = React.useRef(false);

  React.useEffect(() => { if (!goldDraftDirty.current) setGoldDraft(String(goldPrice)); }, [goldPrice]);
  React.useEffect(() => { if (!silverDraftDirty.current) setSilverDraft(String(silverPrice)); }, [silverPrice]);

  const handleSave = async () => {
    const nextGoldPrice = parseMetalPrice(goldDraft);
    const nextSilverPrice = goldOnly ? silverPrice : parseMetalPrice(silverDraft);
    if (nextGoldPrice === null || nextSilverPrice === null) {
      setMessage({ kind: 'error', text: 'أدخل سعرًا صحيحًا أكبر من صفر.' });
      return;
    }
    if (!user?.uid) {
      setMessage({ kind: 'error', text: 'تعذر تحديد المستخدم الحالي.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveMetalPrices(user.uid, { goldPrice: nextGoldPrice, silverPrice: nextSilverPrice, goldSpread, silverSpread });
      applySavedMetalPrices(nextGoldPrice, nextSilverPrice, goldSpread, silverSpread, {
        setGoldPrice,
        setGoldBuyPrice,
        setSilverPrice,
        setSilverBuyPrice,
      });
      setMessage({ kind: 'success', text: 'تم حفظ الأسعار.' });
    } catch (error) {
      console.error('Error updating metal prices:', error);
      setMessage({ kind: 'error', text: 'تعذر حفظ الأسعار. حاول مرة أخرى.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="metal-price-editor-title" className={`rounded-[20px] border border-[#c9a84c]/20 bg-[#0d1017] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.2)] ${goldOnly ? '[&>div:nth-of-type(2)>label:nth-child(2)]:hidden' : ''}`} dir="rtl">
      <div className="mb-2">
        <h2 id="metal-price-editor-title" className="text-sm font-black text-[#f5f1e8]">{goldOnly ? 'سعر الذهب الرسمي الحالي' : 'أسعار المعادن الحالية'}</h2>
        <p className="mt-1 text-[10px] font-bold text-[#78736a]">سعر بيع الجرام المستخدم للعرض والعمليات الجديدة</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PriceField id="dashboard-gold-price" label="سعر جرام الذهب عيار 21" value={goldDraft} onChange={value => { goldDraftDirty.current = true; setGoldDraft(value); }} accent="gold" />
        <PriceField id="dashboard-silver-price" label="سعر جرام الفضة" value={silverDraft} onChange={value => { silverDraftDirty.current = true; setSilverDraft(value); }} accent="silver" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div aria-live="polite" className={`min-h-5 text-[11px] font-bold ${message?.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
          {message?.text}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-2.5 text-xs font-black text-[#080a0f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'جاري الحفظ...' : goldOnly ? 'حفظ السعر' : 'حفظ الأسعار'}
        </button>
      </div>
    </section>
  );
});

MetalPriceEditor.displayName = 'MetalPriceEditor';
