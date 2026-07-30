import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ClipboardPaste,
  PlusCircle,
  Wallet,
  Scale,
  Database,
  X,
  PieChart,
  Settings,
  Calendar,
  TrendingUp,
  BarChart3,
  Book,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Entry } from '../../types';
import { cn } from '../../lib/utils';
import { db, auth } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAppStore } from '../../store';
import { calculateGoldOwnershipPosition, type GoldOwnershipPosition } from '../../lib/engine';
import { buildOperationalProjection } from '../../lib/operationalProjection';
import { formatCashAmount } from '../../lib/accounting';

interface KPICardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subValue?: string;
  color: string;
}

const KPICard = React.memo(({ icon, title, value, subValue, color }: KPICardProps) => (
  <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 flex flex-col items-center text-center shadow-lg group hover:border-[#c9a84c33] transition-all">
    <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-opacity-10", color.replace('text-', 'bg-'))}>
      {React.cloneElement(icon as React.ReactElement, { className: cn("w-6 h-6", color) })}
    </div>
    <div className="text-sm text-[#5a5548] font-bold uppercase mb-1">{title}</div>
    <div className={cn("text-2xl font-black font-mono leading-tight", color)}>{value}</div>
    {subValue && <div className="text-xs text-[#3a3530] mt-0.5">{subValue}</div>}
  </div>
));
interface GoldSummaryCardProps {
  position: GoldOwnershipPosition;
  onClick: () => void;
}

const formatGold21 = (value: number) => `${value.toFixed(2)} جم`;

const GoldSummaryCard = React.memo(({ position, onClick }: GoldSummaryCardProps) => {
  const liabilityContext = position.netGoldLiabilities21 > 0 ? 'على المحل' : position.netGoldLiabilities21 < 0 ? 'لصالح المحل' : 'متوازن';

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[#0e1018] border border-[#c9a84c33] rounded-2xl p-4 text-right shadow-lg transition-all hover:border-[#c9a84c66] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black text-[#8a8172]">صافي ملكية المحل</div>
          <div className="mt-1 text-3xl font-black font-mono leading-tight text-[#c9a84c]">
            {formatGold21(position.netShopGoldOwnership21)}
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c33] bg-[#c9a84c11]">
          <Scale className="h-6 w-6 text-[#c9a84c]" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
        <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2">
          <div className="text-[#5a5548]">مخزون فعلي</div>
          <div className="mt-0.5 font-mono text-[#ddd8cc]">{formatGold21(position.physicalGoldInventory21)}</div>
        </div>
        <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2">
          <div className="flex items-center justify-between gap-2 text-[#5a5548]">
            <span>صافي التزامات</span>
            <span className="rounded-md bg-[#1a1e2a] px-1.5 py-0.5 text-[9px] text-[#c9a84c]">{liabilityContext}</span>
          </div>
          <div className="mt-0.5 font-mono text-[#ddd8cc]">{formatGold21(position.netGoldLiabilities21)}</div>
        </div>
      </div>
    </button>
  );
});

interface PriceCardProps {
  title: string;
  price: number;
  onPriceChange: (val: number) => void;
  colorClass: string;
  onPasteClick?: () => void;
  variant: 'gold' | 'silver';
  isBuyPrice?: boolean;
  spread?: number;
  onSpreadChange?: (val: number) => void;
}

const PriceCard = React.memo(({
  title,
  price,
  onPriceChange,
  colorClass,
  onPasteClick,
  variant,
  isBuyPrice,
  spread,
  onSpreadChange
}: PriceCardProps) => {
  const priceStep = variant === 'gold' ? 5 : 0.5;
  const rangeRadius = variant === 'gold' ? 100 : 20;

  return (
  <div className={cn(
    "bg-[#0e1018] border rounded-2xl p-4 shadow-lg relative overflow-hidden transition-all h-full flex flex-col justify-between",
    variant === 'gold' ? "border-[#c9a84c33] shadow-[0_0_20px_rgba(201,168,76,0.05)]" : "border-[#ddd8cc11] shadow-[0_0_20px_rgba(221,216,204,0.03)]"
  )}>
    <div className={cn("absolute top-0 right-0 w-1.5 h-full", colorClass.replace('text-', 'bg-'))} />

    <div className="flex-1">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border bg-opacity-10 shadow-inner",
          variant === 'gold' ? "bg-[#c9a84c] border-[#c9a84c33]" : "bg-[#ddd8cc] border-[#ddd8cc33]"
        )}>
          <Zap className={cn("w-5 h-5", variant === 'gold' ? "text-[#c9a84c]" : "text-[#ddd8cc]")} />
        </div>
        <div className="text-xs text-[#5a5548] font-black uppercase tracking-widest">{title}</div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`خفض ${title}`}
            onClick={() => onPriceChange(Math.max(0, price - priceStep))}
            className="w-12 h-12 flex items-center justify-center bg-[#080a0f] border border-[#1a1e2a] rounded-xl text-[#5a5548] hover:text-red-400 hover:border-red-400/30 transition-all active:scale-90"
          >
            <TrendingUp className="w-6 h-6 rotate-180" />
          </button>

          <div className="flex-1 relative group">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={priceStep}
              aria-label={title}
              value={price}
              onChange={(e) => onPriceChange(Number(e.target.value) || 0)}
              className={cn(
                "w-full bg-[#080a0f] border rounded-2xl px-4 py-3 text-2xl font-mono font-bold outline-none transition-all text-center",
                variant === 'gold' ? "border-[#c9a84c33] text-[#c9a84c] focus:border-[#c9a84c] shadow-[inset_0_2px_10px_rgba(201,168,76,0.05)]" : "border-[#ddd8cc33] text-[#ddd8cc] focus:border-[#ddd8cc] shadow-[inset_0_2px_10px_rgba(221,216,204,0.03)]"
              )}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-[#5a5548] font-black opacity-30">ج.م</span>
          </div>

          <button
            type="button"
            aria-label={`زيادة ${title}`}
            onClick={() => onPriceChange(price + priceStep)}
            className="w-12 h-12 flex items-center justify-center bg-[#080a0f] border border-[#1a1e2a] rounded-xl text-[#5a5548] hover:text-[#c9a84c] hover:border-[#c9a84c/30] transition-all active:scale-90"
          >
            <PlusCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="px-1">
           <input
             type="range"
             aria-label={`ضبط ${title}`}
             min={Math.max(0, price - rangeRadius)}
             max={price + rangeRadius}
             step={priceStep}
             value={price}
             onChange={(e) => onPriceChange(Number(e.target.value))}
             className={cn(
               "w-full h-1 bg-[#080a0f] rounded-lg appearance-none cursor-pointer",
               variant === 'gold' ? "accent-[#c9a84c]" : "accent-[#ddd8cc]"
             )}
           />
        </div>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t border-[#1a1e2a]/50">
      {!isBuyPrice && spread !== undefined && onSpreadChange && (
        <div className="space-y-2 mb-4">
           <div className="flex items-center justify-between text-[10px] font-black text-[#5a5548] uppercase">
             <span>فرق الشراء (البرييزة)</span>
             <span className={cn("font-mono", variant === 'gold' ? "text-[#c9a84c]" : "text-[#ddd8cc]")}>{spread} ج.م</span>
           </div>
           <input
             type="range"
             min="0"
             max={variant === 'gold' ? 100 : 50}
             step="5"
             value={spread}
             onChange={(e) => onSpreadChange(parseInt(e.target.value))}
             className={cn(
               "w-full h-1 bg-[#080a0f] rounded-lg appearance-none cursor-pointer",
               variant === 'gold' ? "accent-[#c9a84c]" : "accent-[#ddd8cc]"
             )}
           />
        </div>
      )}

      {onPasteClick && (
        <button
          onClick={onPasteClick}
          className="w-full py-2.5 bg-[#1a1e2a] text-[#c9a84c] rounded-xl hover:bg-[#c9a84c22] transition-all shadow-sm border border-[#c9a84c11] flex items-center justify-center gap-2 text-[10px] font-bold"
        >
          <ClipboardPaste className="w-4 h-4" />
          لصق سعر الذهب من واتساب
        </button>
      )}
    </div>
  </div>
  );
});

interface RecentEntryRowProps {
  e: Entry;
  accountCategories: any;
  setEditingEntry: (entry: Partial<Entry>) => void;
}

const RecentEntryRow = React.memo(({ e, accountCategories, setEditingEntry }: RecentEntryRowProps) => {
  const isSilver = (e.tx || '').includes('فضة') || (e.debit || '').includes('فضة') || (e.credit || '').includes('فضة');
  const isAcc = (e.tx || '').includes('ملحقات') || (e.debit || '').includes('ملحقات') || (e.credit || '').includes('ملحقات');
  const unit = isSilver ? "جرام فضة" : isAcc ? "قطعة" : "جرام";

  const cashAccounts = accountCategories?.assets?.["النقدية"] || [];
  let displaySide = `${e.debit} ← ${e.credit}`;
  if (cashAccounts.includes(e.debit)) displaySide = e.credit;
  else if (cashAccounts.includes(e.credit)) displaySide = e.debit;
  else if (e.tx === 'تيفيت') {
    if ((e.debit || '') === 'كسر عربي' || (e.debit || '') === 'كسر افرنجي') displaySide = e.credit;
    else if ((e.credit || '') === 'كسر عربي' || (e.credit || '') === 'كسر افرنجي') displaySide = e.debit;
  }

  const c = parseFloat(e.cash || '0');
  const w = parseFloat(e.weight || '0');
  const pricePerGram = w > 0 ? formatCashAmount(c / w) : '0';

  return (
    <div
      onClick={() => setEditingEntry(e)}
      className="bg-[#0e1018] border border-[#c9a84c11] rounded-2xl p-5 flex justify-between items-center hover:border-[#c9a84c44] transition-all shadow-md cursor-pointer"
    >
      <div className="space-y-1">
        <div className="flex gap-2 items-center">
          <div className="text-base font-bold text-[#c9a84c]">{e.tx}</div>
          {e.invoiceNumber && (
            <div className="text-[10px] font-mono font-bold text-[#6a8a9e] bg-[#6a8a9e11] border border-[#6a8a9e22] px-2 py-0.5 rounded-lg">
              #{e.invoiceNumber}
            </div>
          )}
        </div>
        <div className="text-sm font-bold text-[#ddd8cc]">{displaySide}</div>
        {e.notes && <div className="text-[11px] text-[#5a5548] italic bg-[#080a0f] px-2 py-1 rounded-lg mt-2">{e.notes}</div>}
      </div>
      <div className="text-left space-y-1">
        {e.cash && e.tx !== 'تيفيت' && <div className="text-lg font-bold text-[#c9a84c] font-mono">{formatCashAmount(c)} <span className="text-[10px] font-sans">ج</span></div>}
        <div className="flex flex-col items-end gap-1">
          {e.weight && (
            <div className="text-xs text-[#ddd8cc] font-bold bg-[#1a1e2a] px-2 py-1 rounded-lg">
              {w.toFixed(2)} <span className="text-[10px] opacity-60">{unit}</span>
              {e.karat ? <span className="mr-1 text-[#c9a84c]">(عيار {e.karat})</span> : ''}
            </div>
          )}
          {e.weight && ((e.tx || '').includes('بيع') || (e.tx || '').includes('شراء')) && w > 0 && c > 0 && (
            <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1",
              (e.tx || '').includes('بيع') ? "text-[#c9a84c] bg-[#c9a84c11] border-[#c9a84c22]" : "text-[#6a9e6a] bg-[#6a9e6a11] border-[#6a9e6a22]"
            )}>
              {((e.tx || '').includes('بيع') ? (isAcc ? 'سعر القطعة (بيع): ' : 'سعر الجرام (بيع): ') : (isAcc ? 'سعر القطعة (شراء): ' : 'سعر الجرام (شراء): '))}
              <span className="font-mono">{pricePerGram}</span> ج.م
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const HomeView = React.memo(({
  refreshData
}: {
  refreshData: () => void
}) => {
  const {
    setView,
    entries,
    goldPrice, setGoldPrice,
    goldBuyPrice, setGoldBuyPrice,
    goldSpread, setGoldSpread,
    silverPrice, setSilverPrice,
    silverBuyPrice, setSilverBuyPrice,
    silverSpread, setSilverSpread,
    isUpdatingPrice,
    accountsDb,
    accountCategories,
    setEditingEntry,
    setReportsTab
  } = useAppStore();

  const [showPasteModal, setShowPasteModal] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");

  const updatePricesInFirestoreRef = React.useRef<NodeJS.Timeout | null>(null);

  const updatePricesInFirestore = React.useCallback(async (gPrice: number, gBuy: number, sPrice: number, sBuy: number, gSpread: number, sSpread: number) => {
    if (updatePricesInFirestoreRef.current) clearTimeout(updatePricesInFirestoreRef.current);
    updatePricesInFirestoreRef.current = setTimeout(async () => {
      const user = auth.currentUser;
      if (!user) return;

      const cleanGPrice = Number(gPrice) || goldPrice;
      const cleanGBuy = Number(gBuy) || goldBuyPrice;
      const cleanSPrice = Number(sPrice) || silverPrice;
      const cleanSBuy = Number(sBuy) || silverBuyPrice;
      const cleanGSpread = Number(gSpread) ?? goldSpread;
      const cleanSSpread = Number(sSpread) ?? silverSpread;

      try {
        await setDoc(doc(db, 'settings', user.uid), {
          goldPrice: cleanGPrice,
          goldBuyPrice: cleanGBuy,
          goldSpread: cleanGSpread,
          silverPrice: cleanSPrice,
          silverBuyPrice: cleanSBuy,
          silverSpread: cleanSSpread
        }, { merge: true });
      } catch (error) {
        console.error("Error updating prices in Firestore:", error);
      }
    }, 1000); // 1 second debounce
  }, [goldPrice, goldBuyPrice, silverPrice, silverBuyPrice, goldSpread, silverSpread]);

  const parseGoldPrice = (text: string) => {
    const regex = /(\d{1,2},?\d{3}(\.\d+)?)/g;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      const price = parseFloat(matches[0].replace(/,/g, ''));
      if (price > 1000 && price < 10000) {
        setGoldPrice(price);
        const buyPrice = price - goldSpread;
        setGoldBuyPrice(buyPrice);
        updatePricesInFirestore(price, buyPrice, silverPrice, silverBuyPrice, goldSpread, silverSpread);
        setShowPasteModal(false);
        setPasteText("");
      }
    }
  };

  const today = format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar });
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const todayCount = entries.filter(e => e.date === todayISO).length;

  const goldPosition = useMemo(() => calculateGoldOwnershipPosition(entries, accountsDb), [entries, accountsDb]);
  const operationalProjection = useMemo(() => buildOperationalProjection(entries, accountsDb), [entries, accountsDb]);

  const totals = useMemo(() => {
    let cash = 0;
    const cashAccNames = accountsDb.filter(account => account.type === 'cash').map(account => account.name);
    entries.forEach(entry => {
      const amount = parseFloat(entry.cash || '0');
      if (cashAccNames.includes(entry.debit)) cash += amount;
      if (cashAccNames.includes(entry.credit)) cash -= amount;
    });
    return { cash, silver: operationalProjection.physicalSilverInventoryMovement };
  }, [entries, accountsDb, operationalProjection.physicalSilverInventoryMovement]);

  const reportShortcuts = [
    { id: 'profit-analysis', label: 'تحليل الربحية والمخزون', icon: <BarChart3 className="w-5 h-5 text-[#c9a84c]" />, desc: 'الأرباح الحقيقية بالمتوسط المتحرك' },
    { id: 'final', label: 'التقرير الشامل', icon: <PieChart className="w-5 h-5 text-[#6a8a9e]" />, desc: 'ملخص المركز والمخزون' },
    { id: 'income', label: 'الدخل والأرباح', icon: <TrendingUp className="w-5 h-5 text-[#6a9e6a]" />, desc: 'كشف الأرباح والخسائر' },
    { id: 'ledger', label: 'كشف حساب', icon: <Book className="w-5 h-5 text-[#9e6a6a]" />, desc: 'بحث وتفريغ حساب معين' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[#8a8172]">{today}</div>
            <div className="mt-1 text-[11px] font-bold text-[#c9a84c99]">إجمالي القيود المسجلة: {entries.length}</div>
          </div>
          <button
            type="button"
            onClick={refreshData}
            disabled={isUpdatingPrice}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c22] bg-[#c9a84c11] text-[#c9a84c] transition-all active:scale-95",
              isUpdatingPrice && "animate-spin opacity-60"
            )}
            title="تحديث البيانات من فايربيز"
          >
            <Zap className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <KPICard
            icon={<Wallet className="w-5 h-5" />}
            title="رصيد الخزنة"
            value={`${formatCashAmount(totals.cash)} ج`}
            color="text-[#6a9e6a]"
          />
          <GoldSummaryCard
            position={goldPosition}
            onClick={() => {
              setReportsTab('balance');
              setView('reports');
            }}
          />
          <KPICard
            icon={<Database className="w-5 h-5" />}
            title="المخزون الفعلي — فضة"
            value={`${totals.silver.toFixed(2)} جم`}
            color="text-[#6a8a9e]"
          />
          <KPICard
            icon={<Calendar className="w-5 h-5" />}
            title="عمليات اليوم"
            value={`${todayCount}`}
            subValue={`من ${entries.length} قيد`}
            color="text-[#f5f1e8]"
          />
        </div>
      </section>

      {/* Official daily prices: kept near the top so they are always visible before starting an invoice. */}
      <section className="space-y-3" aria-labelledby="official-daily-prices-title">
        <div className="rounded-2xl border border-[#c9a84c33] bg-gradient-to-l from-[#c9a84c12] to-[#0e1018] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="official-daily-prices-title" className="text-base font-black text-[#f5f1e8]">
                الأسعار الرسمية المعتمدة اليوم
              </h2>
              <p className="mt-1 text-[11px] font-bold leading-5 text-[#8a8172]">
                عدّل سعر الذهب والفضة هنا؛ السعر المحفوظ هو المستخدم تلقائيًا في الفواتير والتقييمات.
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-[#c9a84c33] bg-[#080a0f] px-2.5 py-1.5 text-[10px] font-black text-[#c9a84c]">
              {format(new Date(), 'd MMMM', { locale: ar })}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[#6a9e6a]">
            <span className="h-2 w-2 rounded-full bg-[#6a9e6a]" />
            يتم الحفظ تلقائيًا في حسابك بعد التعديل
          </div>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PriceCard
          title="سعر الذهب الرسمي عيار 21"
          price={goldPrice}
          onPriceChange={(val) => {
            setGoldPrice(val);
            const buyPrice = val - goldSpread;
            setGoldBuyPrice(buyPrice);
            updatePricesInFirestore(val, buyPrice, silverPrice, silverBuyPrice, goldSpread, silverSpread);
          }}
          colorClass="text-[#c9a84c]"
          onPasteClick={() => setShowPasteModal(true)}
          variant="gold"
          spread={goldSpread}
          onSpreadChange={(spread) => {
            setGoldSpread(spread);
            const buyPrice = goldPrice - spread;
            setGoldBuyPrice(buyPrice);
            updatePricesInFirestore(goldPrice, buyPrice, silverPrice, silverBuyPrice, spread, silverSpread);
          }}
        />

        <PriceCard
          title="سعر الفضة الرسمي"
          price={silverPrice}
          onPriceChange={(val) => {
            setSilverPrice(val);
            const buyPrice = val - silverSpread;
            setSilverBuyPrice(buyPrice);
            updatePricesInFirestore(goldPrice, goldBuyPrice, val, buyPrice, goldSpread, silverSpread);
          }}
          colorClass="text-[#ddd8cc]"
          variant="silver"
          spread={silverSpread}
          onSpreadChange={(spread) => {
            setSilverSpread(spread);
            const buyPrice = silverPrice - spread;
            setSilverBuyPrice(buyPrice);
            updatePricesInFirestore(goldPrice, goldBuyPrice, silverPrice, buyPrice, goldSpread, spread);
          }}
        />
      </div>
      </section>
      {/* Quick Actions */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <h3 className="text-xs font-black text-[#c9a84c]">إجراءات سريعة</h3>
          <div className="h-px flex-1 bg-[#1a1e2a]" />
        </div>
        <button
          type="button"
          onClick={() => setView('entry')}
          className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-[#c9a84c] px-4 py-5 text-[#05070b] shadow-[0_12px_30px_rgba(201,168,76,0.22)] transition-all active:scale-[0.99]"
        >
          <PlusCircle className="h-7 w-7" />
          <span className="text-xl font-black">إضافة عملية جديدة</span>
        </button>
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setView('journal')}
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-[#f5f1e8] transition-all active:scale-[0.99]"
          >
            <Calendar className="h-6 w-6 text-[#c9a84c]" />
            <span className="text-xs font-black">فتح اليومية</span>
          </button>
          <button
            type="button"
            onClick={() => setView('story')}
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-[#f5f1e8] transition-all active:scale-[0.99]"
          >
            <Globe className="h-6 w-6 text-[#6a9e6a]" />
            <span className="text-xs font-black">حالة واتساب</span>
          </button>
          <button
            type="button"
            onClick={() => setView('reports')}
            className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-[#f5f1e8] transition-all active:scale-[0.99]"
          >
            <BarChart3 className="h-6 w-6 text-[#6a8a9e]" />
            <span className="text-xs font-black">التقارير</span>
          </button>
        </div>
      </div>

      {/* KPI cards and gold karat toggle */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            icon={<Wallet className="w-4 h-4" />}
            title="رصيد الخزنة"
            value={`${formatCashAmount(totals.cash)} ج`}
            color="text-[#6a9e6a]"
          />
          <KPICard
            icon={<Database className="w-4 h-4" />}
            title="المخزون الفعلي — فضة"
            value={`${totals.silver.toFixed(2)} جم`}
            color="text-[#6a8a9e]"
          />
          <KPICard
            icon={<Scale className="w-4 h-4" />}
            title="التزامات التجار — فضة"
            value={`${operationalProjection.merchantWeightLiabilityMovement.silver.toFixed(2)} جم`}
            color="text-[#9e6a6a]"
          />
          <KPICard
            icon={<Database className="w-4 h-4" />}
            title="صافي ملكية المحل — فضة"
            value={`${(totals.silver - operationalProjection.merchantWeightLiabilityMovement.silver).toFixed(2)} جم`}
            color="text-[#c9a84c]"
          />
        </div>
      </div>

      {/* Recent entries */}
      {entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xs font-bold text-[#3a3530]">آخر القيود</h3>
            <button onClick={() => setView('journal')} className="text-[10px] text-[#c9a84c] font-bold">عرض الكل</button>
          </div>
          <div className="space-y-3">
            {entries.slice(0, 3).map((e) => (
              <RecentEntryRow
                key={e.id}
                e={e}
                accountCategories={accountCategories}
                setEditingEntry={setEditingEntry}
              />
            ))}
          </div>
        </div>
      )}

      {/* Secondary quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setView('journal')}
          className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-[#c9a84c33] transition-all group"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#1a1e2a] bg-[#c9a84c11] group-hover:bg-[#c9a84c22] transition-all">
            <Calendar className="w-6 h-6 text-[#c9a84c]" />
          </div>
          <span className="text-xs font-bold text-[#ddd8cc]">دفتر اليومية</span>
        </button>

        <button
          onClick={() => setView('database')}
          className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-[#6a9e6a33] transition-all group"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#1a1e2a] bg-[#6a9e6a11] group-hover:bg-[#6a9e6a22] transition-all">
            <Database className="w-6 h-6 text-[#6a9e6a]" />
          </div>
          <span className="text-xs font-bold text-[#ddd8cc]">المخزون</span>
        </button>

        <button
          onClick={() => setView('settings')}
          className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-[#9e6a6a33] transition-all group"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#1a1e2a] bg-[#9e6a6a11] group-hover:bg-[#9e6a6a22] transition-all">
            <Settings className="w-6 h-6 text-[#9e6a6a]" />
          </div>
          <span className="text-xs font-bold text-[#ddd8cc]">الإعدادات</span>
        </button>
      </div>

      {/* Quick report shortcuts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-[#3a3530] uppercase tracking-widest">الوصول السريع للتقارير</h3>
          <div className="h-px flex-1 bg-[#1a1e2a] mx-4 opacity-30" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {reportShortcuts.map((rep) => (
            <button
              key={rep.id}
              onClick={() => {
                if (rep.id === 'profit-analysis') {
                  setReportsTab('profit-analysis' as any);
                  setView('reports');
                } else {
                  setReportsTab(rep.id as any);
                  setView('reports');
                }
              }}
              className="bg-gradient-to-br from-[#0e1018] to-[#080a0f] border border-[#1a1e2a] rounded-2xl p-4 flex items-center gap-4 hover:border-[#c9a84c33] transition-all group text-right"
            >
              <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center border border-[#1a1e2a] group-hover:border-[#c9a84c33] transition-all">
                {rep.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#ddd8cc] group-hover:text-[#c9a84c] transition-colors">{rep.label}</div>
                <div className="text-[10px] text-[#5a5548] mt-0.5">{rep.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showPasteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 w-full max-w-md space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-[#c9a84c]">لصق رسالة السعر</h3>
                <button onClick={() => setShowPasteModal(false)} className="text-[#5a5548]"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-[#5a5548]">انسخ رسالة السعر من واتساب أو تليجرام والصقها هنا، وسيقوم النظام باستخراج السعر تلقائيا.</p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="الصق الرسالة هنا..."
                className="w-full h-32 bg-[#080a0f] border border-[#1a1e2a] rounded-2xl p-4 text-base outline-none focus:border-[#c9a84c55] resize-none"
              />
              <button
                onClick={() => parseGoldPrice(pasteText)}
                className="w-full py-4 bg-[#c9a84c] text-[#080a0f] font-bold rounded-2xl"
              >
                استخراج السعر وتحديث البيانات
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});


