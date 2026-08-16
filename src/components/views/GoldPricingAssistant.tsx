import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Link2, RotateCcw, Scale, Sparkles } from 'lucide-react';
import type { Account, Entry } from '../../types';
import { normalizeNumerals } from '../../lib/accounting';
import { formatEgpAmount } from '../../lib/formatting';
import {
  buildGoldAssistantEntryPrefill,
  calculateActualPurchaseValues,
  calculateProposedPurchaseTotal,
  calculateSalePricing,
  changeGoldAssistantProduct,
  createEmptyGoldAssistantState,
  GoldAssistantMode,
  GoldAssistantProduct,
  GoldAssistantSession,
  GoldSaleTaxStampPerGramEgp,
  goldSaleTaxStampRate,
  officialGoldKaratPrice,
  parseAssistantNumber,
  purchaseValuesFromDiscountPerGram,
  purchaseValuesFromDiscountPercent,
  purchaseValuesFromPricePerGram,
  resetGoldAssistantState,
  workmanshipPerGramFromPiece,
  workmanshipPieceFromPerGram,
} from '../../lib/goldPricingAssistant';
import { cn } from '../../lib/utils';

interface GoldPricingAssistantProps {
  mode: GoldAssistantMode;
  session: GoldAssistantSession;
  products: GoldAssistantProduct[];
  cashAccount: Account | null;
  taxStampSettings: GoldSaleTaxStampPerGramEgp;
  onCancel: () => void;
  onReview: (prefill: Partial<Entry>) => void;
}

type WorkmanshipSource = 'perGram' | 'piece';

const normalizeInput = (value: string): string => normalizeNumerals(value.replace(/[،٫]/g, '.'));
const displayNumber = (value: number): string => Number.isFinite(value) ? String(Number(value.toFixed(2))) : '';

const AssistantInput = ({
  label,
  value,
  onChange,
  suffix,
  prominent = false,
  readOnly = false,
}: {
  label: React.ReactNode;
  value: string;
  onChange?: (value: string) => void;
  suffix?: string;
  prominent?: boolean;
  readOnly?: boolean;
}) => (
  <label className="block space-y-1.5">
    <span className="block text-[11px] font-black text-[#b8af9b]">{label}</span>
    <span className={cn(
      'flex min-h-14 items-center rounded-2xl border bg-[#080b12] transition focus-within:border-[#d2ad4a]',
      prominent ? 'border-[#d2ad4a]/70 shadow-[0_0_22px_rgba(210,173,74,0.12)]' : 'border-[#242a36]',
      readOnly && 'bg-[#111722]/70',
    )}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={readOnly}
        onChange={event => onChange?.(normalizeInput(event.target.value))}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 py-3 text-left font-mono text-lg font-black text-[#f5f1e8] outline-none',
          prominent && 'text-3xl text-[#f3cf70]',
          readOnly && 'text-[#aaa18e]',
        )}
        dir="ltr"
      />
      {suffix && <span className="shrink-0 pl-3 text-[10px] font-bold text-[#777165]">{suffix}</span>}
    </span>
  </label>
);

export const GoldPricingAssistant = ({
  mode,
  session,
  products,
  cashAccount,
  taxStampSettings,
  onCancel,
  onReview,
}: GoldPricingAssistantProps) => {
  const [state, setState] = useState(() => createEmptyGoldAssistantState());
  const workmanshipSource = useRef<WorkmanshipSource>('perGram');
  const sale = mode === 'sale';
  const product = state.product;
  const officialPrice = product ? officialGoldKaratPrice(session.gold21PriceSnapshot, product.multiplier) : null;
  const weight = parseAssistantNumber(state.weight);
  const count = parseAssistantNumber(state.count);
  const finalTotal = parseAssistantNumber(state.finalTotal);
  const workmanshipTotal = parseAssistantNumber(state.pieceWorkmanship) ?? 0;
  const workmanshipPerGram = parseAssistantNumber(state.workmanshipPerGram);
  const purchasePricePerGram = parseAssistantNumber(state.purchasePricePerGram);
  const discountPercent = parseAssistantNumber(state.discountPercent);
  const discountPerGram = parseAssistantNumber(state.discountPerGram);

  const salePricing = useMemo(() => product && officialPrice !== null && weight !== null
    ? calculateSalePricing({
        weight,
        officialPrice,
        workmanshipTotal,
        taxStampEnabled: state.taxStampEnabled,
        karat: product.karat,
        taxStampSettings,
      })
    : null,
  [officialPrice, product, state.taxStampEnabled, taxStampSettings, weight, workmanshipTotal]);

  const proposedPurchaseTotal = weight !== null && purchasePricePerGram !== null
    ? calculateProposedPurchaseTotal(weight, purchasePricePerGram)
    : null;
  const actualPurchase = finalTotal !== null && weight !== null && officialPrice !== null
    ? calculateActualPurchaseValues(finalTotal, weight, officialPrice)
    : null;

  const capturedTime = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(session.capturedAt));

  const selectProduct = (accountId: string) => {
    const nextProduct = products.find(item => item.accountId === accountId);
    if (!nextProduct) return;
    const next = changeGoldAssistantProduct(nextProduct);
    const nextOfficialPrice = officialGoldKaratPrice(session.gold21PriceSnapshot, nextProduct.multiplier);
    if (!sale && nextOfficialPrice !== null) {
      next.discountPercent = '0';
      next.discountPerGram = '0';
      next.purchasePricePerGram = displayNumber(nextOfficialPrice);
    }
    workmanshipSource.current = 'perGram';
    setState(next);
  };

  const updateWeight = (value: string) => {
    setState(previous => {
      const next = { ...previous, weight: value };
      const nextWeight = parseAssistantNumber(value);
      if (!(nextWeight && nextWeight > 0)) return next;
      if (workmanshipSource.current === 'perGram') {
        const perGram = parseAssistantNumber(previous.workmanshipPerGram);
        if (perGram !== null) {
          const piece = workmanshipPieceFromPerGram(nextWeight, perGram);
          if (piece !== null) next.pieceWorkmanship = displayNumber(piece);
        }
      } else {
        const piece = parseAssistantNumber(previous.pieceWorkmanship);
        if (piece !== null) {
          const perGram = workmanshipPerGramFromPiece(nextWeight, piece);
          if (perGram !== null) next.workmanshipPerGram = displayNumber(perGram);
        }
      }
      return next;
    });
  };

  const updateWorkmanshipPerGram = (value: string) => {
    workmanshipSource.current = 'perGram';
    setState(previous => {
      const next = { ...previous, workmanshipPerGram: value };
      const parsed = parseAssistantNumber(value);
      const parsedWeight = parseAssistantNumber(previous.weight);
      if (parsed !== null && parsedWeight !== null) {
        const piece = workmanshipPieceFromPerGram(parsedWeight, parsed);
        if (piece !== null) next.pieceWorkmanship = displayNumber(piece);
      }
      return next;
    });
  };

  const updatePieceWorkmanship = (value: string) => {
    workmanshipSource.current = 'piece';
    setState(previous => {
      const next = { ...previous, pieceWorkmanship: value };
      const parsed = parseAssistantNumber(value);
      const parsedWeight = parseAssistantNumber(previous.weight);
      if (parsed !== null && parsedWeight !== null) {
        const perGram = workmanshipPerGramFromPiece(parsedWeight, parsed);
        if (perGram !== null) next.workmanshipPerGram = displayNumber(perGram);
      }
      return next;
    });
  };

  const applyPurchaseLinkedValues = (source: 'percent' | 'discount' | 'price', value: string) => {
    setState(previous => {
      const next = { ...previous };
      if (source === 'percent') next.discountPercent = value;
      if (source === 'discount') next.discountPerGram = value;
      if (source === 'price') next.purchasePricePerGram = value;
      const parsed = parseAssistantNumber(value);
      if (parsed === null || officialPrice === null) return next;
      const linked = source === 'percent'
        ? purchaseValuesFromDiscountPercent(officialPrice, parsed)
        : source === 'discount'
          ? purchaseValuesFromDiscountPerGram(officialPrice, parsed)
          : purchaseValuesFromPricePerGram(officialPrice, parsed);
      if (!linked) return next;
      next.discountPercent = displayNumber(linked.discountPercent);
      next.discountPerGram = displayNumber(linked.discountPerGram);
      next.purchasePricePerGram = displayNumber(linked.purchasePricePerGram);
      return next;
    });
  };

  const validCount = !product?.tracksQuantity || (count !== null && count >= 1);
  const validWeight = weight !== null && Number(weight.toFixed(2)) > 0;
  const workmanshipBlank = !state.workmanshipPerGram.trim() && !state.pieceWorkmanship.trim();
  const validWorkmanship = workmanshipBlank || (
    workmanshipPerGram !== null
    && workmanshipPerGram >= 0
    && workmanshipTotal >= 0
    && weight !== null
    && workmanshipPieceFromPerGram(weight, workmanshipPerGram) !== null
    && Math.abs((workmanshipPieceFromPerGram(weight, workmanshipPerGram) ?? 0) - workmanshipTotal) <= 0.02
  );
  const validPurchaseLinkage = officialPrice !== null
    && discountPercent !== null && discountPercent >= 0 && discountPercent <= 100
    && discountPerGram !== null && discountPerGram >= 0 && discountPerGram <= officialPrice
    && purchasePricePerGram !== null && purchasePricePerGram > 0 && purchasePricePerGram <= officialPrice
    && Math.abs((officialPrice - discountPerGram) - purchasePricePerGram) <= 0.02
    && Math.abs((discountPerGram / officialPrice * 100) - discountPercent) <= 0.02;
  const validPurchaseValues = sale || (
    validPurchaseLinkage
    && proposedPurchaseTotal !== null
  );
  const canReview = !!product
    && !!cashAccount?.id
    && validWeight
    && finalTotal !== null && finalTotal > 0
    && officialPrice !== null && officialPrice > 0
    && validCount
    && (sale ? validWorkmanship : true)
    && validPurchaseValues;

  const handleReset = () => {
    workmanshipSource.current = 'perGram';
    setState(resetGoldAssistantState());
  };

  const handleReview = () => {
    if (!canReview || !product || !cashAccount || officialPrice === null || weight === null || finalTotal === null) return;
    onReview(buildGoldAssistantEntryPrefill({
      mode,
      product,
      cashAccount,
      weight: weight.toFixed(2),
      count: state.count,
      finalTotal: displayNumber(finalTotal),
      officialKaratPrice: officialPrice,
    }));
  };

  return (
    <section className="-mx-1 space-y-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+16px)]" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onCancel} className="flex min-h-11 items-center gap-2 rounded-2xl border border-[#282d39] bg-[#10141d] px-3 text-xs font-black text-[#d8d2c6]">
          <ArrowRight className="h-4 w-4" />
          إدخال يدوي
        </button>
        <div className="text-left">
          <h2 className="text-lg font-black text-[#f3cf70]">{sale ? 'مساعد البيع' : 'مساعد الشراء'}</h2>
          <p className="mt-1 text-[10px] font-bold text-[#8e8778]">السعر ثابت منذ {capturedTime}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-[#292e3a] bg-[linear-gradient(145deg,#111723,#090c12)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <label className="space-y-2">
          <span className="block text-xs font-black text-[#d7cdaF]">المنتج</span>
          <select
            value={product?.accountId ?? ''}
            onChange={event => selectProduct(event.target.value)}
            className="min-h-14 w-full rounded-2xl border border-[#343a48] bg-[#080b12] px-4 text-sm font-black text-[#f5f1e8] outline-none focus:border-[#d2ad4a]"
          >
            <option value="">اختر منتج الذهب</option>
            {products.map(item => <option key={item.accountId} value={item.accountId}>{item.name}</option>)}
          </select>
        </label>
        {product && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[#252b37] bg-[#0b0f17] p-3">
              <span className="block text-[10px] text-[#817a6d]">العيار</span>
              <strong className="mt-1 block text-lg text-[#f3cf70]">{product.karat}</strong>
            </div>
            <div className="rounded-2xl border border-[#252b37] bg-[#0b0f17] p-3">
              <span className="block text-[10px] text-[#817a6d]">السعر الرسمي / جم</span>
              <strong className="mt-1 block text-lg text-[#f5f1e8]">{officialPrice ? formatEgpAmount(officialPrice, 2) : '—'}</strong>
            </div>
          </div>
        )}
      </div>

      {products.length === 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs font-bold leading-6 text-amber-100">
          لا توجد منتجات مؤهلة في قواعد العملية الحالية وAccount Registry.
        </div>
      )}

      {product && (
        <>
          <div className="grid grid-cols-1 gap-3 rounded-3xl border border-[#252b37] bg-[#0d1119] p-4 sm:grid-cols-2">
            <AssistantInput label="الوزن" value={state.weight} onChange={updateWeight} suffix="جم" />
            {product.tracksQuantity && (
              <AssistantInput
                label="العدد"
                value={state.count}
                onChange={value => setState(previous => ({ ...previous, count: value }))}
                suffix="قطعة"
              />
            )}
          </div>

          {sale ? (
            <>
              <div className="rounded-3xl border border-[#252b37] bg-[#0d1119] p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-black text-[#f0cd70]"><Sparkles className="h-4 w-4" /> المصنعية <Link2 className="h-3.5 w-3.5 text-[#777165]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <AssistantInput label="مصنعية الجرام" value={state.workmanshipPerGram} onChange={updateWorkmanshipPerGram} suffix="ج/جم" />
                  <AssistantInput label="مصنعية القطعة" value={state.pieceWorkmanship} onChange={updatePieceWorkmanship} suffix="ج" />
                </div>
              </div>

              {product.karat !== 24 && (
                <div className="rounded-3xl border border-[#252b37] bg-[#0d1119] p-4">
                  <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
                    <span>
                      <strong className="block text-sm text-[#eee8dc]">تفعيل الضريبة والدمغة</strong>
                      <small className="mt-1 block text-[10px] text-[#827b6d]">المعدل: {goldSaleTaxStampRate(product.karat, taxStampSettings)} ج/جم</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={state.taxStampEnabled}
                      onChange={event => setState(previous => ({ ...previous, taxStampEnabled: event.target.checked }))}
                      className="h-6 w-6 accent-[#d2ad4a]"
                    />
                  </label>
                  {state.taxStampEnabled && salePricing && <div className="mt-2 text-xs font-black text-[#d8d2c6]">الإجمالي: {formatEgpAmount(salePricing.taxStampTotal, 2)}</div>}
                </div>
              )}

              <div className="rounded-3xl border border-[#d2ad4a]/30 bg-[#d2ad4a]/[0.06] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#aaa18e]">السعر المقترح</span>
                  <strong className="text-2xl font-black text-[#f3cf70]">{salePricing ? formatEgpAmount(salePricing.suggestedTotal, 2) : '—'}</strong>
                </div>
                <details className="mt-3 rounded-2xl border border-[#282e39] bg-[#090d14] px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-black text-[#aaa18e]">تفاصيل الحسبة</summary>
                  {salePricing && (
                    <div className="mt-3 space-y-2 text-[#d7d1c5]">
                      <div className="flex justify-between"><span>قيمة الذهب</span><span>{formatEgpAmount(salePricing.goldValue, 2)}</span></div>
                      <div className="flex justify-between"><span>المصنعية</span><span>{formatEgpAmount(salePricing.workmanshipTotal, 2)}</span></div>
                      <div className="flex justify-between"><span>الضريبة والدمغة</span><span>{formatEgpAmount(salePricing.taxStampTotal, 2)}</span></div>
                    </div>
                  )}
                </details>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-3xl border border-[#252b37] bg-[#0d1119] p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-black text-[#f0cd70]"><Scale className="h-4 w-4" /> قرار الخصم <Link2 className="h-3.5 w-3.5 text-[#777165]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <AssistantInput label="الخصم %" value={state.discountPercent} onChange={value => applyPurchaseLinkedValues('percent', value)} suffix="%" />
                  <AssistantInput label="الخصم ج/جم" value={state.discountPerGram} onChange={value => applyPurchaseLinkedValues('discount', value)} suffix="ج/جم" />
                </div>
                <div className="mt-3">
                  <AssistantInput label="سعر الشراء / جم" value={state.purchasePricePerGram} onChange={value => applyPurchaseLinkedValues('price', value)} suffix="ج/جم" />
                </div>
              </div>

              <div className="rounded-3xl border border-[#d2ad4a]/30 bg-[#d2ad4a]/[0.06] p-4 text-center">
                <span className="block text-xs font-bold text-[#aaa18e]">إجمالي السعر المقترح</span>
                <strong className="mt-2 block text-3xl font-black text-[#f3cf70]">{proposedPurchaseTotal !== null ? formatEgpAmount(proposedPurchaseTotal, 2) : '—'}</strong>
              </div>
            </>
          )}

          <div className="rounded-[28px] border border-[#d2ad4a]/60 bg-[radial-gradient(circle_at_50%_0%,rgba(210,173,74,0.12),transparent_55%),#0d1119] p-4 shadow-[0_16px_38px_rgba(0,0,0,0.32)]">
            <AssistantInput
              label={sale ? 'السعر المتفق عليه' : 'السعر النهائي المتفق عليه'}
              value={state.finalTotal}
              onChange={value => setState(previous => ({ ...previous, finalTotal: value }))}
              suffix="ج.م"
              prominent
            />
            {!sale && actualPurchase && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#080b12] p-2"><span className="block text-[8px] text-[#777165]">الفعلي / جم</span><strong className="mt-1 block text-xs text-[#eee8dc]">{actualPurchase.purchasePricePerGram}</strong></div>
                <div className="rounded-xl bg-[#080b12] p-2"><span className="block text-[8px] text-[#777165]">الخصم الفعلي</span><strong className="mt-1 block text-xs text-[#eee8dc]">{actualPurchase.discountPerGram}</strong></div>
                <div className="rounded-xl bg-[#080b12] p-2"><span className="block text-[8px] text-[#777165]">نسبة الخصم</span><strong className="mt-1 block text-xs text-[#eee8dc]">{actualPurchase.discountPercent}%</strong></div>
              </div>
            )}
            {sale && salePricing && finalTotal !== null && (
              <div className="mt-3 text-center text-[10px] font-bold text-[#8f887a]">
                الفرق عن المقترح: {formatEgpAmount(finalTotal - salePricing.suggestedTotal, 2)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <button type="button" onClick={handleReset} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#3a404d] bg-[#11161f] text-sm font-black text-[#c8c1b4] active:scale-[0.98]">
              <RotateCcw className="h-4 w-4" /> مسح
            </button>
            <button type="button" disabled={!canReview} onClick={handleReview} className="min-h-14 rounded-2xl bg-gradient-to-l from-[#dfbd5b] to-[#b78925] text-lg font-black text-[#090b10] shadow-lg disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.98]">
              مراجعة
            </button>
          </div>
        </>
      )}
    </section>
  );
};
