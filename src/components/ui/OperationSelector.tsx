import type { Key } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BadgeDollarSign,
  BanknoteArrowDown,
  BanknoteArrowUp,
  Boxes,
  BriefcaseBusiness,
  CircleDollarSign,
  Coins,
  Gem,
  HandCoins,
  Landmark,
  PackagePlus,
  ReceiptText,
  Scale,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type OperationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type SectionTone = 'emerald' | 'purple' | 'blue' | 'amber' | 'navy' | 'slate';

type OperationSectionDefinition = {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: SectionTone;
  items: OperationItem[];
};

const heroOperations: Array<OperationItem & { tone: 'sale' | 'purchase' }> = [
  { id: 'بيع ذهب', label: 'بيع ذهب', icon: BanknoteArrowDown, tone: 'sale' },
  { id: 'شراء ذهب', label: 'شراء ذهب', icon: ShoppingBag, tone: 'purchase' },
];

const quickOperations: OperationItem[] = [
  { id: 'تيفيت', label: 'تيفيت', icon: Scale },
  { id: 'م ا ع', label: 'مصاريف إدارية وعمومية', icon: BriefcaseBusiness },
  { id: 'مسحوبات', label: 'مسحوبات', icon: ArrowUpFromLine },
  { id: 'م ت', label: 'مصاريف تشغيلية', icon: ReceiptText },
];

const operationSections: OperationSectionDefinition[] = [
  {
    id: 'metals',
    title: 'الذهب والفضة والملحقات',
    icon: Gem,
    tone: 'emerald',
    items: [
      { id: 'بيع فضة', label: 'بيع فضة', icon: Coins },
      { id: 'شراء فضة', label: 'شراء فضة', icon: CircleDollarSign },
      { id: 'بيع ملحقات', label: 'بيع ملحقات', icon: Sparkles },
      { id: 'شراء ملحقات', label: 'شراء ملحقات', icon: PackagePlus },
      { id: 'ايرادات اخري', label: 'إيرادات أخرى', icon: BanknoteArrowUp },
    ],
  },
  {
    id: 'merchants',
    title: 'التجار',
    icon: Store,
    tone: 'purple',
    items: [
      { id: 'حساب تاجر ذهب', label: 'حساب تاجر ذهب', icon: Landmark },
      { id: 'حساب تاجر فضة', label: 'حساب تاجر فضة', icon: WalletCards },
      { id: 'تاجر ذهب', label: 'تاجر ذهب', icon: UserRoundCheck },
      { id: 'تاجر فضة', label: 'تاجر فضة', icon: UsersRound },
      { id: 'حوالة', label: 'حوالة', icon: ArrowLeftRight },
    ],
  },
  {
    id: 'customers',
    title: 'العملاء',
    icon: UsersRound,
    tone: 'blue',
    items: [
      { id: 'قبض من عميل', label: 'قبض من عميل', icon: ArrowDownToLine },
      { id: 'دفع لعميل', label: 'دفع لعميل', icon: HandCoins },
    ],
  },
  {
    id: 'inventory',
    title: 'المخزون والتسويات',
    icon: Boxes,
    tone: 'amber',
    items: [
      { id: 'تسوية', label: 'تسوية', icon: Settings2 },
      { id: 'تحويل', label: 'تحويل', icon: ArrowLeftRight },
    ],
  },
  {
    id: 'finance',
    title: 'العمليات المالية',
    icon: BadgeDollarSign,
    tone: 'navy',
    items: [{ id: 'شراء اصل', label: 'شراء أصل', icon: ShieldCheck }],
  },
  {
    id: 'system',
    title: 'العمليات النظامية',
    icon: Settings2,
    tone: 'slate',
    items: [{ id: 'قيد افتتاحي', label: 'قيد افتتاحي', icon: Landmark }],
  },
];

const toneStyles: Record<SectionTone, { header: string; icon: string; card: string }> = {
  emerald: { header: 'bg-emerald-50 text-emerald-950', icon: 'bg-emerald-100 text-emerald-700', card: 'text-emerald-700' },
  purple: { header: 'bg-purple-50 text-purple-950', icon: 'bg-purple-100 text-purple-700', card: 'text-purple-700' },
  blue: { header: 'bg-sky-50 text-sky-950', icon: 'bg-sky-100 text-sky-700', card: 'text-sky-700' },
  amber: { header: 'bg-amber-50 text-amber-950', icon: 'bg-amber-100 text-amber-700', card: 'text-amber-700' },
  navy: { header: 'bg-indigo-50 text-indigo-950', icon: 'bg-indigo-100 text-indigo-700', card: 'text-indigo-700' },
  slate: { header: 'bg-slate-100 text-slate-950', icon: 'bg-slate-200 text-slate-700', card: 'text-slate-700' },
};

const configuredIds = new Set([
  ...heroOperations.map(item => item.id),
  ...quickOperations.map(item => item.id),
  ...operationSections.flatMap(section => section.items.map(item => item.id)),
]);

const hiddenCreationOperationIds = new Set(['مرتجع ذهب', 'مرتجع فضة']);

function OperationCard({ item, selected, onSelect, tone }: { item: OperationItem; selected: boolean; onSelect: (id: string) => void; tone: string; key?: Key }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-label={item.label}
      aria-pressed={selected}
      className={cn(
        'flex h-[92px] w-[calc((100vw-56px)/3)] min-w-[104px] max-w-[132px] snap-start flex-col items-center justify-center gap-2 rounded-[18px] border bg-white/95 px-2 text-center shadow-[0_8px_24px_rgba(25,35,55,0.07)] transition duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99a2e] focus-visible:ring-offset-2 sm:w-32',
        selected ? 'border-[#c99a2e] ring-2 ring-[#c99a2e]/20' : 'border-[#15203b]/10 hover:border-[#c99a2e]/45',
      )}
    >
      <Icon className={cn('h-7 w-7 shrink-0', tone)} strokeWidth={2.1} aria-hidden="true" />
      <span className="line-clamp-2 text-[15px] font-bold leading-[1.25] text-[#15203b]">{item.label}</span>
    </button>
  );
}

function OperationSection({ section, selected, onSelect }: { section: OperationSectionDefinition; selected: string; onSelect: (id: string) => void; key?: Key }) {
  const HeaderIcon = section.icon;
  const styles = toneStyles[section.tone];
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#15203b]/8 bg-white/75 shadow-[0_12px_32px_rgba(68,51,21,0.05)]">
      <div className={cn('flex min-h-12 items-center gap-2.5 px-3.5 py-2', styles.header)}>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', styles.icon)}>
          <HeaderIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-[18px] font-extrabold leading-tight">{section.title}</h3>
      </div>
      <div className="operation-scroll flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 py-3" dir="rtl">
        {section.items.map(item => (
          <OperationCard key={item.id} item={item} selected={selected === item.id} onSelect={onSelect} tone={styles.card} />
        ))}
      </div>
    </section>
  );
}

export function OperationSelector({ availableOperations, selected, onSelect }: { availableOperations: string[]; selected: string; onSelect: (id: string) => void }) {
  const available = new Set(availableOperations.filter(id => !hiddenCreationOperationIds.has(id)));
  const visibleHero = heroOperations.filter(item => available.has(item.id));
  const visibleQuick = quickOperations.filter(item => available.has(item.id));
  const visibleSections = operationSections
    .map(section => ({ ...section, items: section.items.filter(item => available.has(item.id)) }))
    .filter(section => section.items.length > 0);
  const extraItems: OperationItem[] = availableOperations
    .filter(id => !configuredIds.has(id) && !hiddenCreationOperationIds.has(id))
    .map(id => ({ id, label: id, icon: Settings2 }));

  if (extraItems.length > 0) {
    visibleSections.push({ id: 'extra', title: 'عمليات إضافية', icon: Settings2, tone: 'slate', items: extraItems });
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        {visibleHero.map(item => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-label={item.label}
              aria-pressed={selected === item.id}
              className={cn(
                'flex min-h-[122px] flex-col items-center justify-center gap-2 rounded-[24px] px-3 text-white shadow-lg transition duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99a2e] focus-visible:ring-offset-2',
                item.tone === 'sale'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-emerald-900/20'
                  : 'bg-gradient-to-br from-sky-600 to-blue-800 shadow-blue-900/20',
                selected === item.id && 'ring-4 ring-[#c99a2e]/35',
              )}
            >
              <Icon className="h-10 w-10" strokeWidth={2.15} aria-hidden="true" />
              <span className="text-[22px] font-extrabold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="quick-operations-title">
        <h2 id="quick-operations-title" className="mb-2.5 text-[19px] font-extrabold text-[#15203b]">عمليات سريعة</h2>
        <div className="grid grid-cols-4 gap-2">
          {visibleQuick.map(item => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(item.id)}
                aria-label={item.label}
                aria-pressed={selected === item.id}
                className={cn(
                  'flex min-h-[112px] min-w-0 flex-col items-center justify-start gap-2 rounded-[18px] border border-[#15203b]/10 bg-white/95 px-1.5 py-3 text-[#15203b] shadow-[0_8px_24px_rgba(25,35,55,0.07)] transition duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99a2e] focus-visible:ring-offset-2',
                  selected === item.id && 'border-[#c99a2e] ring-2 ring-[#c99a2e]/20',
                )}
              >
                <Icon className="h-7 w-7 shrink-0 text-[#a97916]" strokeWidth={2.1} aria-hidden="true" />
                <span className="line-clamp-2 text-[13px] font-extrabold leading-[1.3] sm:text-[14px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-3">
        {visibleSections.map(section => (
          <OperationSection key={section.id} section={section} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
