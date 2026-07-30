import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Boxes,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  Coins,
  Gem,
  Landmark,
  PackageOpen,
  RefreshCw,
  Scale,
  Save,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { LucideIcon } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import type {
  DashboardActivity,
  DashboardInsight,
  DashboardMetric,
  DashboardTone,
} from '../../lib/dashboardSelector';
import { useDashboardMetrics } from '../../hooks/useDashboardMetrics';
import { auth, db } from '../../firebase';

const toneStyles: Record<DashboardTone, string> = {
  positive: 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300',
  negative: 'border-red-500/20 bg-red-500/[0.07] text-red-300',
  warning: 'border-orange-500/20 bg-orange-500/[0.07] text-orange-300',
  neutral: 'border-white/[0.07] bg-white/[0.025] text-[#ddd8cc]',
};

const money = (value: number): string =>
  value.toLocaleString('ar-EG', { maximumFractionDigits: 0 });
const weight = (value: number | null): string =>
  value === null ? 'غير متاح' : `${value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جم`;
const metricMoney = (value: DashboardMetric): string =>
  value.available && value.value !== null ? `${money(value.value)} ج.م` : 'غير متاح';

const metricTone = (value: number): DashboardTone =>
  value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';

const SectionHeading = ({ title, subtitle, icon: Icon }: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}) => (
  <div className="flex items-end justify-between gap-3 px-1">
    <div>
      <div className="flex items-center gap-2 text-sm font-black text-[#f5f1e8]">
        <Icon className="h-4 w-4 text-[#c9a84c]" aria-hidden="true" />
        {title}
      </div>
      {subtitle && <p className="mt-1 text-[10px] font-bold text-[#78736a]">{subtitle}</p>}
    </div>
    <div className="mb-1 h-px min-w-8 flex-1 bg-gradient-to-l from-[#c9a84c]/25 to-transparent" />
  </div>
);

const KpiCard = React.memo(({ label, value, secondary, icon: Icon, tone = 'neutral', featured = false }: {
  label: string;
  value: string;
  secondary?: string;
  icon: LucideIcon;
  tone?: DashboardTone;
  featured?: boolean;
}) => (
  <div className={cn(
    'relative min-w-0 overflow-hidden rounded-[22px] border p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]',
    toneStyles[tone],
    featured && 'col-span-2 min-h-[134px] p-5',
  )}>
    <div className="absolute -left-6 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.035] blur-xl" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-black text-[#8f897e]">{label}</p>
        <p className={cn(
          'mt-2 break-words font-mono text-xl font-black tracking-tight text-current tabular-nums',
          featured && 'text-[30px]',
        )}>{value}</p>
        {secondary && <p className="mt-1.5 text-[10px] font-bold text-[#8f897e]">{secondary}</p>}
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-current/[0.06]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  </div>
));
KpiCard.displayName = 'KpiCard';

const CompactMetric = ({ label, value, tone = 'neutral' }: {
  label: string;
  value: string;
  tone?: DashboardTone;
}) => (
  <div className={cn('rounded-2xl border p-3.5', toneStyles[tone])}>
    <p className="text-[10px] font-black text-[#8f897e]">{label}</p>
    <p className="mt-2 break-words font-mono text-base font-black tabular-nums text-current">{value}</p>
  </div>
);

const InventoryCard = ({ title, icon: Icon, iconClass, weightValue, bookValue, marketValue }: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  weightValue?: number | null;
  bookValue: DashboardMetric;
  marketValue?: DashboardMetric;
}) => (
  <article className="rounded-[24px] border border-white/[0.07] bg-[#0d1017] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-black text-[#f5f1e8]">{title}</h3>
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04]', iconClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
    <div className={cn('mt-4 grid gap-2', marketValue ? 'grid-cols-3' : 'grid-cols-2')}>
      {weightValue !== undefined && <CompactMetric label="الوزن" value={weight(weightValue)} />}
      <CompactMetric label="القيمة الدفترية" value={metricMoney(bookValue)} />
      {marketValue && <CompactMetric label="القيمة السوقية*" value={metricMoney(marketValue)} tone="neutral" />}
    </div>
  </article>
);

const InsightCard = ({ insight }: { insight: DashboardInsight; key?: React.Key }) => {
  const Icon = insight.tone === 'positive'
    ? TrendingUp
    : insight.tone === 'negative'
      ? TrendingDown
      : insight.tone === 'warning'
        ? AlertTriangle
        : Sparkles;
  return (
    <div className={cn('rounded-2xl border p-4', toneStyles[insight.tone])}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-black">{insight.title}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#aaa398]">{insight.detail}</p>
        </div>
      </div>
    </div>
  );
};

const ActivityRow = ({ activity, onOpen }: {
  activity: DashboardActivity;
  onOpen: (activity: DashboardActivity) => void;
  key?: React.Key;
}) => (
  <button
    type="button"
    onClick={() => onOpen(activity)}
    className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-white/[0.055] px-4 py-4 text-right transition-colors last:border-b-0 hover:bg-white/[0.025] active:bg-white/[0.05]"
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="truncate text-xs font-black text-[#f5f1e8]">{activity.operationType}</span>
        <span className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black',
          activity.status === 'تمت التسوية'
            ? 'bg-emerald-500/10 text-emerald-300'
            : 'bg-white/[0.05] text-[#8f897e]',
        )}>{activity.status}</span>
      </div>
      <p className="mt-1 truncate text-[10px] text-[#78736a]">{activity.description}</p>
      <p className="mt-1 text-[10px] font-bold text-[#8f897e]">{activity.date}</p>
    </div>
    <div className="flex items-center gap-2 self-center">
      <span className="font-mono text-sm font-black tabular-nums text-[#ddd8cc]">
        {activity.amount ? `${money(activity.amount)} ج.م` : '—'}
      </span>
      <ChevronLeft className="h-4 w-4 text-[#5e5a52]" aria-hidden="true" />
    </div>
  </button>
);

export const DashboardView = React.memo(({ refreshData }: { refreshData: () => void }) => {
  const data = useDashboardMetrics();
  const {
    isUpdatingPrice,
    setEditingEntry,
    setView,
    goldPrice,
    setGoldPrice,
    goldSpread,
    setGoldBuyPrice,
    silverPrice,
    setSilverPrice,
    silverSpread,
    setSilverBuyPrice,
  } = useAppStore(useShallow(state => ({
    isUpdatingPrice: state.isUpdatingPrice,
    setEditingEntry: state.setEditingEntry,
    setView: state.setView,
    goldPrice: state.goldPrice,
    setGoldPrice: state.setGoldPrice,
    goldSpread: state.goldSpread,
    setGoldBuyPrice: state.setGoldBuyPrice,
    silverPrice: state.silverPrice,
    setSilverPrice: state.setSilverPrice,
    silverSpread: state.silverSpread,
    setSilverBuyPrice: state.setSilverBuyPrice,
  })));

  const [goldPriceDraft, setGoldPriceDraft] = React.useState(String(goldPrice));
  const [silverPriceDraft, setSilverPriceDraft] = React.useState(String(silverPrice));
  const [priceSaveState, setPriceSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [priceSaveMessage, setPriceSaveMessage] = React.useState('');

  React.useEffect(() => setGoldPriceDraft(String(goldPrice)), [goldPrice]);
  React.useEffect(() => setSilverPriceDraft(String(silverPrice)), [silverPrice]);

  const saveOfficialPrices = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextGoldPrice = Number(goldPriceDraft);
    const nextSilverPrice = Number(silverPriceDraft);
    const user = auth.currentUser;

    if (!user || !Number.isFinite(nextGoldPrice) || nextGoldPrice <= 0 || !Number.isFinite(nextSilverPrice) || nextSilverPrice <= 0) {
      setPriceSaveState('error');
      setPriceSaveMessage('أدخل سعر ذهب وفضة صحيحين أكبر من صفر.');
      return;
    }

    const nextGoldBuyPrice = Math.max(0, nextGoldPrice - goldSpread);
    const nextSilverBuyPrice = Math.max(0, nextSilverPrice - silverSpread);
    setPriceSaveState('saving');
    setPriceSaveMessage('');

    try {
      await setDoc(doc(db, 'settings', user.uid), {
        goldPrice: nextGoldPrice,
        goldBuyPrice: nextGoldBuyPrice,
        goldSpread,
        silverPrice: nextSilverPrice,
        silverBuyPrice: nextSilverBuyPrice,
        silverSpread,
      }, { merge: true });
      setGoldPrice(nextGoldPrice);
      setGoldBuyPrice(nextGoldBuyPrice);
      setSilverPrice(nextSilverPrice);
      setSilverBuyPrice(nextSilverBuyPrice);
      setPriceSaveState('saved');
      setPriceSaveMessage('تم حفظ الأسعار واعتمادها في الفواتير والتقييمات.');
    } catch (error) {
      console.error('Failed to save official metal prices:', error);
      setPriceSaveState('error');
      setPriceSaveMessage('تعذر حفظ الأسعار. جرّب مرة أخرى.');
    }
  };

  const openActivity = (activity: DashboardActivity) => {
    if (activity.entry.id) {
      setEditingEntry(activity.entry);
      return;
    }
    setView('journal');
  };

  const snapshot = data.snapshot;

  return (
    <div className="space-y-7 pb-8" dir="rtl">
      <section className="overflow-hidden rounded-[28px] border border-[#c9a84c]/20 bg-[radial-gradient(circle_at_top_left,rgba(201,168,76,0.13),transparent_42%),linear-gradient(145deg,#12151d,#090b10)] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.32)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c9a84c]">Executive overview</p>
            <h2 className="mt-2 text-2xl font-black text-[#f5f1e8]">وضع النشاط الآن</h2>
            <p className="mt-1 text-[11px] font-bold text-[#8f897e]">حتى {data.asOfDate}</p>
          </div>
          <button
            type="button"
            onClick={refreshData}
            disabled={isUpdatingPrice}
            aria-label="تحديث لوحة المؤشرات"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c]/20 bg-[#c9a84c]/10 text-[#c9a84c] transition-transform active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-5 w-5', isUpdatingPrice && 'animate-spin')} />
          </button>
        </div>
        {!data.costBasisAvailable && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/[0.07] p-3 text-[11px] leading-5 text-orange-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            قيم Book Value وCOGS والأرباح غير متاحة حتى يكتمل مصدر التكلفة بنجاح.
          </div>
        )}
      </section>

      <section className="space-y-3" aria-label="الأسعار الرسمية المعتمدة اليوم">
        <SectionHeading title="الأسعار الرسمية المعتمدة اليوم" subtitle="هذه الأسعار هي المستخدمة في الفواتير والتقييمات" icon={Coins} />
        <form onSubmit={saveOfficialPrices} className="rounded-[24px] border border-[#c9a84c]/25 bg-[#0d1017] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black text-[#c9a84c]">سعر الذهب عيار 21</span>
              <div className="relative">
                <input
                  aria-label="سعر الذهب الرسمي عيار 21"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={goldPriceDraft}
                  onChange={(event) => {
                    setGoldPriceDraft(event.target.value);
                    setPriceSaveState('idle');
                  }}
                  className="w-full rounded-2xl border border-[#c9a84c]/25 bg-[#080a0f] px-3 py-3 pl-12 text-center font-mono text-xl font-black tabular-nums text-[#c9a84c] outline-none focus:border-[#c9a84c]"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-[#78736a]">ج.م</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black text-slate-300">سعر جرام الفضة</span>
              <div className="relative">
                <input
                  aria-label="سعر الفضة الرسمي"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={silverPriceDraft}
                  onChange={(event) => {
                    setSilverPriceDraft(event.target.value);
                    setPriceSaveState('idle');
                  }}
                  className="w-full rounded-2xl border border-slate-300/20 bg-[#080a0f] px-3 py-3 pl-12 text-center font-mono text-xl font-black tabular-nums text-slate-200 outline-none focus:border-slate-300/50"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-[#78736a]">ج.م</span>
              </div>
            </label>
          </div>
          <button
            type="submit"
            disabled={priceSaveState === 'saving'}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#c9a84c] px-4 py-3 text-sm font-black text-[#080a0f] transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {priceSaveState === 'saving' ? 'جارٍ حفظ الأسعار...' : 'حفظ واعتماد الأسعار'}
          </button>
          {priceSaveMessage && (
            <p role="status" className={cn('mt-3 text-center text-[11px] font-black', priceSaveState === 'error' ? 'text-red-300' : 'text-emerald-300')}>
              {priceSaveMessage}
            </p>
          )}
        </form>
      </section>

      <section className="space-y-3">
        <SectionHeading title="لقطة النشاط" subtitle="المركز المالي والقيمة الدفترية الحالية" icon={Landmark} />
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="رصيد الخزنة" value={`${money(snapshot.cash)} ج.م`} icon={Banknote} tone={metricTone(snapshot.cash)} featured />
          <KpiCard label="مخزون الذهب" value={weight(snapshot.gold.weight)} secondary={`Book Value: ${metricMoney(snapshot.gold.bookValue)}`} icon={Gem} />
          <KpiCard label="مخزون الفضة" value={weight(snapshot.silver.weight)} secondary={`Book Value: ${metricMoney(snapshot.silver.bookValue)}`} icon={Coins} />
          <KpiCard label="مخزون الإكسسوارات" value={metricMoney(snapshot.accessoriesBookValue)} icon={PackageOpen} featured />
          <KpiCard label="إجمالي المخزون" value={metricMoney(snapshot.totalInventoryBookValue)} icon={Boxes} featured />
          <KpiCard label="إجمالي الأصول" value={metricMoney(snapshot.totalAssets)} icon={Landmark} tone={snapshot.totalAssets.value === null ? 'neutral' : metricTone(snapshot.totalAssets.value)} />
          <KpiCard label="إجمالي الخصوم" value={`${money(snapshot.totalLiabilities)} ج.م`} icon={WalletCards} tone={snapshot.totalLiabilities > 0 ? 'negative' : 'neutral'} />
          <KpiCard label="حقوق الملكية" value={metricMoney(snapshot.equity)} icon={ShieldCheck} tone={snapshot.equity.value === null ? 'neutral' : metricTone(snapshot.equity.value)} featured />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="اليوم" subtitle="الأداء منذ بداية اليوم" icon={CalendarDays} />
        <div className="grid grid-cols-2 gap-3">
          <CompactMetric label="مبيعات اليوم" value={`${money(data.today.sales)} ج.م`} tone="positive" />
          <CompactMetric label="مشتريات اليوم" value={`${money(data.today.purchases)} ج.م`} tone="neutral" />
          <CompactMetric label="مصروفات اليوم" value={`${money(data.today.expenses)} ج.م`} tone={data.today.expenses > 0 ? 'negative' : 'neutral'} />
          <CompactMetric label="مجمل ربح اليوم" value={metricMoney(data.today.grossProfit)} tone={data.today.grossProfit.value === null ? 'neutral' : metricTone(data.today.grossProfit.value)} />
          <div className="col-span-2">
            <KpiCard label="صافي ربح اليوم" value={metricMoney(data.today.netProfit)} icon={CircleDollarSign} tone={data.today.netProfit.value === null ? 'neutral' : metricTone(data.today.netProfit.value)} featured />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="هذا الشهر" subtitle="نتائج التشغيل الشهرية" icon={TrendingUp} />
        <div className="grid grid-cols-2 gap-3">
          <CompactMetric label="Revenue" value={`${money(data.month.revenue)} ج.م`} tone="positive" />
          <CompactMetric label="COGS" value={metricMoney(data.month.cogs)} tone="neutral" />
          <CompactMetric label="Gross Profit" value={metricMoney(data.month.grossProfit)} tone={data.month.grossProfit.value === null ? 'neutral' : metricTone(data.month.grossProfit.value)} />
          <CompactMetric label="Operating Expenses" value={`${money(data.month.operatingExpenses)} ج.م`} tone={data.month.operatingExpenses > 0 ? 'negative' : 'neutral'} />
          <div className="col-span-2">
            <KpiCard label="Net Profit" value={metricMoney(data.month.netProfit)} icon={CircleDollarSign} tone={data.month.netProfit.value === null ? 'neutral' : metricTone(data.month.netProfit.value)} featured />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="المخزون" subtitle="Market Value معلوماتي فقط — الحسابات تعتمد Book Value" icon={Boxes} />
        <div className="space-y-3">
          <InventoryCard title="الذهب (مكافئ عيار 21)" icon={Gem} iconClass="text-[#c9a84c]" weightValue={snapshot.gold.weight} bookValue={snapshot.gold.bookValue} marketValue={snapshot.gold.marketValue} />
          <InventoryCard title="الفضة" icon={Coins} iconClass="text-slate-300" weightValue={snapshot.silver.weight} bookValue={snapshot.silver.bookValue} marketValue={snapshot.silver.marketValue} />
          <InventoryCard title="الإكسسوارات" icon={PackageOpen} iconClass="text-orange-300" bookValue={snapshot.accessoriesBookValue} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="مركز التجار" subtitle="الأرصدة التشغيلية الحالية" icon={Scale} />
        <div className="grid grid-cols-2 gap-3">
          <CompactMetric label="التزام ذهب التجار (21)" value={weight(data.merchant.goldLiability)} tone={data.merchant.goldLiability > 0 ? 'warning' : 'neutral'} />
          <CompactMetric label="التزام فضة التجار" value={weight(data.merchant.silverLiability)} tone={(data.merchant.silverLiability ?? 0) > 0 ? 'warning' : 'neutral'} />
          <div className="col-span-2">
            <KpiCard label="رصيد نقدية التجار" value={`${money(data.merchant.cashBalance)} ج.م`} icon={Banknote} tone={metricTone(data.merchant.cashBalance)} featured />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title="رؤى سريعة" subtitle="ملاحظات مستخرجة من البيانات المسجلة فقط" icon={Sparkles} />
        {data.insights.length > 0 ? (
          <div className="grid gap-3">
            {data.insights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-center text-xs font-bold text-[#78736a]">
            لا توجد بيانات كافية لإصدار رؤى موثوقة حاليًا.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <SectionHeading title="آخر النشاطات" subtitle="آخر 10 عمليات مسجلة" icon={ArrowLeft} />
          <button type="button" onClick={() => setView('journal')} className="shrink-0 text-[10px] font-black text-[#c9a84c]">
            عرض اليومية
          </button>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0d1017] shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
          {data.recentActivity.length > 0
            ? data.recentActivity.map(activity => <ActivityRow key={activity.id} activity={activity} onOpen={openActivity} />)
            : <div className="p-8 text-center text-xs font-bold text-[#78736a]">لا توجد عمليات مسجلة.</div>}
        </div>
      </section>
    </div>
  );
});
DashboardView.displayName = 'DashboardView';
