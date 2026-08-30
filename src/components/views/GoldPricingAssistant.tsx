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
  GoldPricingConfig,
  GoldSaleTaxStampPerGramEgp,
  goldSaleTaxStampRate,
  approvedWeightsForProduct,
  bullionInternalWorkmanshipTotal,
  calculateActualSaleWorkmanship,
  isFixedWeightGoldProduct,
  officialGoldKaratPrice,
  parseAssistantNumber,
  purchaseValuesFromDiscountPerGram,
  purchaseValuesFromDiscountPercent,
  purchaseValuesFromPricePerGram,
  resetGoldAssistantState,
  workmanshipPerGramFromPiece,
  workmanshipPieceFromPerGram,
  workmanshipForUnitWeight,
  totalWeightForAssistant,
  buildGoldPriceBoardRows,
  groupSaleAssistantProducts,
} from '../../lib/goldPricingAssistant';
import { cn } from '../../lib/utils';

interface GoldPricingAssistantProps {
  mode: GoldAssistantMode;
  session: GoldAssistantSession;
  products: GoldAssistantProduct[];
  cashAccount: Account | null;
  taxStampSettings: GoldSaleTaxStampPerGramEgp;
  pricingConfig: GoldPricingConfig;
  legacyBullionCharges: Record<number, number>;
  legacyCoinCharges: Record<number, number>;
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
  pricingConfig,
  legacyBullionCharges,
  legacyCoinCharges,
  onCancel,
  onReview,
}: GoldPricingAssistantProps) => {
  const [state, setState] = useState(() => createEmptyGoldAssistantState());
  const [saleEntryPoint, setSaleEntryPoint] = useState<'bullion' | 'afrangi' | 'arabi'>('bullion');
  const workmanshipSource = useRef<WorkmanshipSource>('perGram');
  const sale = mode === 'sale';
  const saleProductGroups = useMemo(() => groupSaleAssistantProducts(products), [products]);
  const bullionPriceBoard = useMemo(() => buildGoldPriceBoardRows({
    p24Sell: Math.round((session.gold21PriceSnapshot / 21) * 24),
    p21Sell: session.gold21PriceSnapshot,
    pricingConfig,
    legacyBullionCharges,
    legacyCoinCharges,
  }), [legacyBullionCharges, legacyCoinCharges, pricingConfig, session.gold21PriceSnapshot]);
  const product = state.product;
  const officialPrice = product ? officialGoldKaratPrice(session.gold21PriceSnapshot, product.multiplier) : null;
  const unitWeight = parseAssistantNumber(state.weight);
  const count = parseAssistantNumber(state.count);
  const finalTotal = parseAssistantNumber(state.finalTotal);
  const weight = totalWeightForAssistant(product, unitWeight, count);
  const fixedWeight = isFixedWeightGoldProduct(product);
  const workmanshipTotal = bullionInternalWorkmanshipTotal(product, parseAssistantNumber(state.pieceWorkmanship) ?? 0, count);
  const workmanshipPerGram = parseAssistantNumber(state.workmanshipPerGram);
  const purchasePricePerGram = parseAssistantNumber(state.purchasePricePerGram);
  const discountPercent = parseAssistantNumber(state.discountPercent);
  const discountPerGram = parseAssistantNumber(state.discountPerGram);

  const salePricing = useMemo(() => product && officialPrice !== null && weight !== null
    ? calculateSalePricing({
        weight,
        officialPrice,
        workmanshipTotal,
        taxStampEnabled: product.taxonomyKey?.startsWith('gold.product.') ? true : state.taxStampEnabled,
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
    const defaultWorkmanship = nextProduct.taxonomyKey === 'gold.direct.bar'
      ? pricingConfig.bullionWorkmanshipByWeight
      : nextProduct.taxonomyKey === 'gold.direct.coin'
        ? pricingConfig.coinWorkmanshipByWeight
        : null;
    if (sale && !defaultWorkmanship) {
      const saved = pricingConfig.saleWorkmanshipDefaults[nextProduct.pricingKey];
      if (saved) {
        if (saved.mode === 'perGram') next.workmanshipPerGram = displayNumber(saved.value);
        else next.pieceWorkmanship = displayNumber(saved.value);
        workmanshipSource.current = saved.mode === 'perPiece' ? 'piece' : 'perGram';
      }
    }
    const nextOfficialPrice = officialGoldKaratPrice(session.gold21PriceSnapshot, nextProduct.multiplier);
    if (!sale && nextOfficialPrice !== null) {
      const discount = pricingConfig.purchaseDiscountPercent[nextProduct.pricingKey] ?? 0;
      const linked = purchaseValuesFromDiscountPercent(nextOfficialPrice, discount)!;
      next.discountPercent = displayNumber(linked.discountPercent);
      next.discountPerGram = displayNumber(linked.discountPerGram);
      next.purchasePricePerGram = displayNumber(linked.purchasePricePerGram);
    }
    if (!sale || defaultWorkmanship) workmanshipSource.current = 'perGram';
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

  const selectUnitWeight = (value: string) => {
    const selected = parseAssistantNumber(value);
    setState(previous => {
      const next = { ...previous, weight: value };
      if (!product || !selected || !fixedWeight) return next;
      const configured = product.taxonomyKey === 'gold.direct.bar'
        ? pricingConfig.bullionWorkmanshipByWeight[String(selected)]
        : pricingConfig.coinWorkmanshipByWeight[String(selected)];
      const legacy = product.taxonomyKey === 'gold.direct.bar' ? legacyBullionCharges[selected] : legacyCoinCharges[selected];
      const values = workmanshipForUnitWeight(configured ?? (Number.isFinite(legacy) && legacy! >= 0 ? { mode: 'perGram', value: legacy! } : undefined), selected);
      if (sale && values) { next.workmanshipPerGram = displayNumber(values.perGram); next.pieceWorkmanship = displayNumber(values.perPiece); workmanshipSource.current = 'perGram'; }
      return next;
    });
  };

  const updateWorkmanshipPerGram = (value: string) => {
    workmanshipSource.current = 'perGram';
    setState(previous => {
      const next = { ...previous, workmanshipPerGram: value };
      const parsed = parseAssistantNumber(value);
      const parsedWeight = fixedWeight ? parseAssistantNumber(previous.weight) : parseAssistantNumber(previous.weight);
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
      const parsedWeight = fixedWeight ? parseAssistantNumber(previous.weight) : parseAssistantNumber(previous.weight);
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
    && unitWeight !== null
    && workmanshipPieceFromPerGram(fixedWeight ? unitWeight : unitWeight, workmanshipPerGram) !== null
    && Math.abs((workmanshipPieceFromPerGram(fixedWeight ? unitWeight : unitWeight, workmanshipPerGram) ?? 0) - (parseAssistantNumber(state.pieceWorkmanship) ?? 0)) <= 0.02
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

      {sale && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            ['bullion', 'السبائك والجنيهات'],
            ['afrangi', 'منتجات أفرنجي'],
            ['arabi', 'منتجات عربي'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => { setSaleEntryPoint(value); setState(createEmptyGoldAssistantState()); }} className={cn('min-h-12 rounded-2xl border px-3 text-sm font-black', saleEntryPoint === value ? 'border-[#d2ad4a] bg-[#d2ad4a]/15 text-[#f3cf70]' : 'border-[#292e3a] bg-[#10141d] text-[#c8c1b4]')}>
              {label}
            </button>
          ))}
        </div>
      )}

      {sale && saleEntryPoint === 'bullion' ? (
        <div className="rounded-3xl border border-[#d2ad4a]/35 bg-[linear-gradient(145deg,#111723,#090c12)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
          <div className="mb-3"><h3 className="text-base font-black text-[#f3cf70]">أسعار السبائك والجنيهات</h3><p className="mt-1 text-[10px] font-bold text-[#8e8778]">عرض استرشادي للقراءة فقط — لا يبدأ عملية بيع</p></div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {bullionPriceBoard.map(row => <div key={`${row.type}-${row.weight}`} className="flex items-center justify-between rounded-2xl border border-[#252b37] bg-[#0b0f17] px-3 py-3"><span className="text-sm font-black text-[#ddd8cc]">{row.label}</span><strong className="font-mono text-lg text-[#f3cf70]">{formatEgpAmount(row.price, 0)} ج.م</strong></div>)}
          </div>
        </div>
      ) : (
      <div className="rounded-3xl border border-[#292e3a] bg-[linear-gradient(145deg,#111723,#090c12)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <label className="space-y-2">
          <span className="block text-xs font-black text-[#d7cdaF]">المنتج</span>
          <select
            value={product?.accountId ?? ''}
            onChange={event => selectProduct(event.target.value)}
            className="min-h-14 w-full rounded-2xl border border-[#343a48] bg-[#080b12] px-4 text-sm font-black text-[#f5f1e8] outline-none focus:border-[#d2ad4a]"
          >
            <option value="">اختر منتج الذهب</option>
            {(sale ? (saleEntryPoint === 'afrangi' ? saleProductGroups.afrangi : saleProductGroups.arabi) : products).map(item => <option key={item.accountId} value={item.accountId}>{item.name}</option>)}
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
      )}

      {(!sale || saleEntryPoint !== 'bullion') && products.length === 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs font-bold leading-6 text-amber-100">
          لا توجد منتجات مؤهلة في قواعد العملية الحالية وAccount Registry.
        </div>
      )}

      {product && (!sale || saleEntryPoint !== 'bullion') && (
        <>
          <div className="grid grid-cols-1 gap-3 rounded-3xl border border-[#252b37] bg-[#0d1119] p-4 sm:grid-cols-2">
            {fixedWeight ? (
              <label className="block space-y-1.5"><span className="block text-[11px] font-black text-[#b8af9b]">وزن الوحدة</span><select value={state.weight} onChange={event => selectUnitWeight(event.target.value)} className="min-h-14 w-full rounded-2xl border border-[#242a36] bg-[#080b12] px-3 font-mono text-lg font-black text-[#f5f1e8]"><option value="">اختر الوزن</option>{approvedWeightsForProduct(product).map(item => <option key={item} value={item}>{item} جم</option>)}</select></label>
            ) : <AssistantInput label="الوزن" value={state.weight} onChange={updateWeight} suffix="جم" />}
            {product.tracksQuantity && (
              <AssistantInput
                label="العدد"
                value={state.count}
                onChange={value => setState(previous => ({ ...previous, count: value }))}
                suffix="قطعة"
              />
            )}
          </div>
          {fixedWeight && unitWeight !== null && weight !== null && <div className="rounded-2xl border border-[#252b37] bg-[#0b0f17] p-3 text-xs font-bold text-[#d8d2c6]">إجمالي الوزن: {weight} جم</div>}

          {sale ? (
            <>
              <div className="rounded-3xl border border-[#252b37] bg-[#0d1119] p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-black text-[#f0cd70]"><Sparkles className="h-4 w-4" /> المصنعية <Link2 className="h-3.5 w-3.5 text-[#777165]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <AssistantInput label="مصنعية الجرام" value={state.workmanshipPerGram} onChange={updateWorkmanshipPerGram} suffix="ج/جم" />
                  <AssistantInput label="مصنعية القطعة" value={state.pieceWorkmanship} onChange={updatePieceWorkmanship} suffix="ج" />
                </div>
              </div>

              {product.taxonomyKey?.startsWith('gold.product.') && (
                <div className="rounded-3xl border border-[#252b37] bg-[#0d1119] p-4">
                  <div className="flex min-h-12 items-center justify-between gap-4">
                    <span>
                      <strong className="block text-sm text-[#eee8dc]">الضريبة والدمغة مطبقة</strong>
                      <small className="mt-1 block text-[10px] text-[#827b6d]">المعدل: {goldSaleTaxStampRate(product.karat, taxStampSettings)} ج/جم</small>
                    </span>
                  </div>
                  {salePricing && <div className="mt-2 text-xs font-black text-[#d8d2c6]">الإجمالي: {formatEgpAmount(salePricing.taxStampTotal, 2)}</div>}
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
                      {!fixedWeight && <div className="flex justify-between"><span>المصنعية</span><span>{formatEgpAmount(salePricing.workmanshipTotal, 2)}</span></div>}
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
            {sale && salePricing && finalTotal !== null && (() => {
              const actual = calculateActualSaleWorkmanship({ finalTotal, goldValue: salePricing.goldValue, taxStampTotal: salePricing.taxStampTotal, totalWeight: weight ?? 0, unitWeight: unitWeight ?? 0, count: count ?? 1, fixedWeight });
              return actual && <div className={cn('mt-3 rounded-xl p-2 text-center text-xs font-bold', actual.negative ? 'bg-red-500/15 text-red-300' : 'bg-[#080b12] text-[#d8d2c6]')}>{actual.negative && 'تحذير: مصنعية فعلية سالبة. '}المصنعية الفعلية/جم: {actual.perGram} — /قطعة: {actual.perPiece}</div>;
            })()}
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
