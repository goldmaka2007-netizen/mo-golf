import React, { useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Download, FileUp, History, Save, ShieldCheck,
} from 'lucide-react';
import { auth, db, firebaseProjectId, firestoreDatabaseId } from '../../../firebase';
import { useAppStore } from '../../../store';
import { buildOpeningCostConfig } from '../../../lib/openingCostConfig';
import {
  calculateHistoricalPriceTotalMinor,
  createHistoricalCostReviewOverlay,
  effectiveApprovedHistoricalCostOverlays,
  findHistoricalCostReviewItems,
  nextOverlayVersion,
  previewAutomaticInventorySurplusWac,
  previewHistoricalCostOverlay,
  type HistoricalCostOverlayType,
  type HistoricalCostReviewOverlay,
  type HistoricalCostSourceType,
  type HistoricalCostValueBasis,
} from '../../../lib/historicalCostReview';
import {
  exportHistoricalCostReviewCsv,
  importHistoricalCostReviewCsvAsDrafts,
  type HistoricalCostCsvImportResult,
} from '../../../lib/historicalCostCsv';
import { generateId } from '../../../utils/generateId';

const KNOWN_BLOCKING_OPERATION = 'csvref-entry-5e60e797bdd890736a846cf479af173b';
const KNOWN_SURPLUS_OPERATION = 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed';
const KNOWN_ACCOUNT = 'seed-account-d1216eb4076ccdf40e20';

const sourceLabels: Record<HistoricalCostSourceType, string> = {
  original_invoice: 'الفاتورة الأصلية',
  merchant_statement: 'كشف حساب التاجر',
  manual_records: 'دفتر أو سجلات يدوية',
  bank_or_cash_evidence: 'دليل بنكي أو نقدي',
  approved_accounting_estimate: 'تقدير محاسبي معتمد',
  other: 'أخرى',
};

const money = (minor: number | null | undefined): string =>
  minor === null || minor === undefined
    ? 'غير محدد'
    : `${(minor / 100).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`;
const grams = (value: string | number | undefined): string =>
  `${Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 3 })} جم`;

const latestForTarget = (
  overlays: HistoricalCostReviewOverlay[],
  targetOperationId: string,
): HistoricalCostReviewOverlay | undefined => overlays
  .filter(item => item.targetOperationId === targetOperationId)
  .sort((a, b) => b.overlayVersion - a.overlayVersion
    || b.overlayId.localeCompare(a.overlayId))[0];

const latestApprovedForTarget = (
  overlays: HistoricalCostReviewOverlay[],
  targetOperationId: string,
): HistoricalCostReviewOverlay | undefined => overlays
  .filter(item => item.targetOperationId === targetOperationId && item.status === 'approved')
  .sort((a, b) => b.overlayVersion - a.overlayVersion
    || b.overlayId.localeCompare(a.overlayId))[0];

type FormState = {
  pricePerGramEgp: string;
  valueBasis: 'actual_weight' | 'standard21_weight';
  sourceType: HistoricalCostSourceType;
  sourceReference: string;
  approver: string;
  notes: string;
  confidenceNote: string;
  confirmed: boolean;
  surplusResolution: 'genuine' | 'two_sided' | 'duplicate' | 'not_surplus' | 'unresolved';
  sourceInventoryAccountId: string;
};

const emptyForm = (): FormState => ({
  pricePerGramEgp: '',
  valueBasis: 'actual_weight',
  sourceType: 'original_invoice',
  sourceReference: '',
  approver: '',
  notes: '',
  confidenceNote: '',
  confirmed: false,
  surplusResolution: 'genuine',
  sourceInventoryAccountId: '',
});

const downloadText = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const HistoricalCostReviewView: React.FC = () => {
  const {
    entries, accountsDb, user, openingCostConfig, costCalculationRun,
    historicalCostReviewOverlays, requestCostRetry,
  } = useAppStore();
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [diagnosticFilter, setDiagnosticFilter] = useState('all');
  const [onlyUnresolved, setOnlyUnresolved] = useState(true);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof previewHistoricalCostOverlay> | null>(null);
  const [importReview, setImportReview] = useState<HistoricalCostCsvImportResult | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const accountNames = useMemo(
    () => new Map(accountsDb.filter(item => item.id).map(item => [item.id as string, item.name])),
    [accountsDb],
  );
  const allItems = useMemo(
    () => findHistoricalCostReviewItems(entries, accountsDb, costCalculationRun.timeline, costCalculationRun.error ? [costCalculationRun.error] : []),
    [entries, accountsDb, costCalculationRun.timeline],
  );
  const resolvedOpeningConfig = useMemo(
    () => buildOpeningCostConfig(openingCostConfig, accountsDb),
    [openingCostConfig, accountsDb],
  );
  const independentSurplusWacCosts = useMemo(() => {
    const costs = new Map<string, NonNullable<(typeof allItems)[number]['automaticWacCost']>>();
    allItems.filter(item => item.kind === 'inventory_surplus').forEach(item => {
      const cost = item.automaticWacCost ?? previewAutomaticInventorySurplusWac({
        entries,
        accounts: accountsDb,
        overlays: historicalCostReviewOverlays,
        targetOperationId: item.operationId,
        openingConfig: resolvedOpeningConfig,
      });
      if (cost) costs.set(item.operationId, cost);
    });
    return costs;
  }, [allItems, entries, accountsDb, historicalCostReviewOverlays, resolvedOpeningConfig]);
  const activeApproved = useMemo(
    () => effectiveApprovedHistoricalCostOverlays(historicalCostReviewOverlays),
    [historicalCostReviewOverlays],
  );
  const approvedTargets = useMemo(
    () => new Set(activeApproved.map(item => item.targetOperationId)),
    [activeApproved],
  );
  const automaticWacTargets = useMemo(
    () => new Set(independentSurplusWacCosts.keys()),
    [independentSurplusWacCosts],
  );
  const items = useMemo(() => allItems.filter(item => {
    const resolved = approvedTargets.has(item.operationId);
    const commonFilters = (!onlyUnresolved || !resolved)
      && (yearFilter === 'all' || item.operation.date.startsWith(yearFilter))
      && (accountFilter === 'all' || item.inventoryAccountId === accountFilter)
      && (diagnosticFilter === 'all' || item.diagnosticCode === diagnosticFilter);
    if (!commonFilters) return false;
    if (item.kind === 'inventory_surplus') {
      // Normal surpluses stay automatic and hidden. Only the fail-closed
      // exception with no valid pre-operation WAC is presented for review.
      return !automaticWacTargets.has(item.operationId);
    }
    const merchantId = item.operation.creditAccountId ?? '';
    return merchantFilter === 'all' || merchantId === merchantFilter;
  }), [allItems, onlyUnresolved, approvedTargets, automaticWacTargets, merchantFilter, yearFilter, accountFilter, diagnosticFilter]);
  const current = items[Math.min(index, Math.max(0, items.length - 1))];
  const effectiveAutomaticWacCost = current
    ? independentSurplusWacCosts.get(current.operationId) ?? current.automaticWacCost
    : undefined;
  const latest = current ? latestForTarget(historicalCostReviewOverlays, current.operationId) : undefined;
  const latestApproved = current
    ? latestApprovedForTarget(historicalCostReviewOverlays, current.operationId)
    : undefined;
  const years = [...new Set(allItems.map(item => item.operation.date.slice(0, 4)))].sort();
  const merchants = [...new Set(allItems.filter(item => item.kind === 'merchant_receipt')
    .map(item => item.operation.creditAccountId).filter(Boolean))] as string[];
  const reviewAccounts = [...new Set(allItems.map(item => item.inventoryAccountId).filter(Boolean))] as string[];
  const drafts = historicalCostReviewOverlays.filter(item => item.status === 'draft').length;
  const rejected = historicalCostReviewOverlays.filter(item => item.status === 'rejected').length;
  const merchantPending = allItems.filter(item => item.kind === 'merchant_receipt'
    && !approvedTargets.has(item.operationId)).length;
  const surplusTotal = allItems.filter(item => item.kind === 'inventory_surplus').length;
  const surplusWaitingForPriorWac = surplusTotal - automaticWacTargets.size;
  const affectedDates = activeApproved.map(overlay =>
    entries.find(entry => (entry.id || entry.legacyOperationId) === overlay.targetOperationId)?.date,
  ).filter(Boolean) as string[];
  const affectedYears = [...new Set(affectedDates.map(date => date.slice(0, 4)))].sort();
  const reportsAvailable = costCalculationRun.status === 'valid'
    && !!costCalculationRun.timeline?.valid
    && costCalculationRun.timeline.costDataComplete;

  const totalMinor = useMemo(() => {
    if (!current) return null;


    const price = Number(form.pricePerGramEgp);
    if (!Number.isFinite(price) || price <= 0) return null;
    try {
      return calculateHistoricalPriceTotalMinor(
        Math.round(price * 100),
        current.kind === 'merchant_receipt' ? 'standard21_weight' : form.valueBasis,
        current.operation,
      );
    } catch {
      return null;
    }
  }, [current, form.pricePerGramEgp, form.valueBasis]);

  const resetFor = (next: number) => {
    setIndex(Math.max(0, Math.min(next, items.length - 1)));
    setForm(emptyForm());
    setPreview(null);
    setNotice('');
  };

  const overlayType = (): HistoricalCostOverlayType => {
    if (current?.kind === 'merchant_receipt') return 'merchant_receipt_cost';
    if (form.surplusResolution === 'two_sided') return 'inventory_two_sided_correction';
    if (form.surplusResolution === 'duplicate') return 'inventory_duplicate_exclusion';
    if (form.surplusResolution === 'not_surplus') return 'inventory_non_surplus';
    return 'inventory_surplus_cost';
  };

  const makeOverlay = (status: 'draft' | 'approved' | 'rejected'): HistoricalCostReviewOverlay => {
    if (!current || !user) throw new Error('missing_review_context');
    const type = overlayType();
    const costRequired = type === 'merchant_receipt_cost' || type === 'inventory_surplus_cost';
    const now = new Date().toISOString();
    const merchantQuickEntry = current.kind === 'merchant_receipt';
    const quickApprover = auth.currentUser?.displayName
      || auth.currentUser?.email
      || user.uid;
    const editableDraft = latest?.status === 'draft' ? latest : undefined;
    const version = editableDraft?.overlayVersion
      ?? nextOverlayVersion(historicalCostReviewOverlays, current.operationId);
    return createHistoricalCostReviewOverlay({
      overlayId: editableDraft?.overlayId
        ?? generateId(`hcro-${current.operationId}-${version}`),
      overlayVersion: version,
      targetOperationId: current.operationId,
      overlayType: type,
      originalDiagnosticCode: current.diagnosticCode,
      approvedInterpretedCostMinor: costRequired ? totalMinor : null,
      pricePerGramMinor: costRequired
        ? Math.round(Number(form.pricePerGramEgp) * 100) : null,
      valueBasis: type === 'inventory_two_sided_correction'
        ? 'carrying_cost_transfer'
        : type === 'inventory_duplicate_exclusion' || type === 'inventory_non_surplus'
          ? 'exclusion'
          : merchantQuickEntry ? 'standard21_weight' : form.valueBasis,
      sourceType: merchantQuickEntry ? 'merchant_statement' : form.sourceType,
      sourceReference: merchantQuickEntry
        ? `Daily metal price on ${current.operation.date}`
        : form.sourceReference.trim(),
      approver: merchantQuickEntry ? quickApprover : form.approver.trim(),
      createdAt: editableDraft?.createdAt ?? now,
      approvedAt: status === 'approved' ? now : null,
      supersedesOverlayId: editableDraft?.supersedesOverlayId
        ?? latestApproved?.overlayId
        ?? null,
      status,
      sourceInventoryAccountId: type === 'inventory_two_sided_correction'
        ? form.sourceInventoryAccountId : null,
      notes: merchantQuickEntry ? 'Quick approval from historical cost review' : form.notes.trim(),
      confidenceNote: form.confidenceNote.trim(),
      historicalAssignmentConfirmed: status === 'approved'
        ? merchantQuickEntry || form.confirmed
        : false,
      userId: user.uid,
      ownerId: user.uid,
      createdBy: user.uid,
    });
  };

  const persist = async (overlay: HistoricalCostReviewOverlay) => {
    const authenticatedUid = auth.currentUser?.uid;
    if (!authenticatedUid || authenticatedUid !== user?.uid) {
      throw new Error('firebase_authenticated_uid_mismatch');
    }
    if (overlay.userId !== authenticatedUid
      || overlay.ownerId !== authenticatedUid
      || overlay.createdBy !== authenticatedUid) {
      throw new Error('historical_cost_owner_mismatch');
    }
    console.info('[HistoricalCostReview] Firestore write context', {
      projectId: firebaseProjectId,
      databaseId: firestoreDatabaseId,
      uid: authenticatedUid,
      path: `historicalCostReviewOverlays/${overlay.overlayId}`,
      status: overlay.status,
    });
    await setDoc(doc(db, 'historicalCostReviewOverlays', overlay.overlayId), overlay);
  };

  const saveDraft = async () => {
    try {
      const overlay = makeOverlay('draft');
      await persist(overlay);
      setNotice('تم حفظ المسودة. لا تؤثر في Cost Run، ويمكن تعديلها قبل الاعتماد.');
    } catch (error) {
      setNotice(`تعذر حفظ المسودة: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const runPreview = () => {
    try {
      const candidate = makeOverlay('approved');
      const result = previewHistoricalCostOverlay({
        entries,
        accounts: accountsDb,
        overlays: historicalCostReviewOverlays,
        candidate,
        openingConfig: resolvedOpeningConfig,
      });
      setPreview(result);
      setNotice(result.resolvesTargetDiagnostic
        ? 'المعاينة اكتملت بمحرك التكلفة الحقيقي دون حفظ.'
        : 'المعاينة لم تحسم diagnostic المستهدف؛ لن يتم الاعتماد.');
    } catch (error) {
      setPreview(null);
      setNotice(`تعذر إنشاء المعاينة: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const approve = async () => {
    if (!preview?.resolvesTargetDiagnostic) {
      setNotice('يجب تشغيل معاينة ناجحة قبل الاعتماد.');
      return;
    }
    try {
      await persist(preview.overlay);
      requestCostRetry();
      resetFor(index + 1);
      setNotice('تم إنشاء إصدار overlay معتمد. بدأت إعادة الاحتساب الحتمية.');
    } catch (error) {
      setNotice(`تعذر الاعتماد: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const approveMerchantPrice = async () => {
    if (!current || current.kind !== 'merchant_receipt' || totalMinor === null) return;
    try {
      const candidate = makeOverlay('approved');
      const result = previewHistoricalCostOverlay({
        entries,
        accounts: accountsDb,
        overlays: historicalCostReviewOverlays,
        candidate,
        openingConfig: resolvedOpeningConfig,
      });
      if (!result.resolvesTargetDiagnostic) {
        setPreview(result);
        setNotice('تعذر اعتماد هذا السعر لأن سجل التاجر المحدد ما زال غير محسوم.');
        return;
      }
      await persist(candidate);
      requestCostRetry();
      resetFor(index + 1);
      setNotice('تم اعتماد سعر يوم العملية وحساب القيمة على الوزن العربي تلقائيًا.');
    } catch (error) {
      setNotice(`تعذر اعتماد السعر: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const rejectForNow = async () => {
    try {
      const overlay = makeOverlay('rejected');
      await persist(overlay);
      resetFor(index + 1);
      setNotice('تم تسجيل الرفض/التأجيل في سجل المراجعة، وما زالت القوائم محجوبة.');
    } catch (error) {
      setNotice(`تعذر تسجيل القرار: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const exportCsv = () => downloadText(
    `historical-cost-review-${new Date().toISOString().slice(0, 10)}.csv`,
    exportHistoricalCostReviewCsv(entries, accountsDb, costCalculationRun.timeline, costCalculationRun.error ? [costCalculationRun.error] : []),
  );

  const readCsv = async (file: File) => {
    const result = importHistoricalCostReviewCsvAsDrafts({
      text: await file.text(),
      entries,
      accounts: accountsDb,
      overlays: historicalCostReviewOverlays,
      createdAt: new Date().toISOString(),
      createOverlayId: (operationId, row) => generateId(`hcro-csv-${operationId}-${row}`),
      userId: user?.uid,
    });
    setImportReview(result);
  };

  const saveImportedDrafts = async () => {
    if (!importReview || importReview.errors.length || !importReview.drafts.length) return;
    await Promise.all(importReview.drafts.map(persist));
    setNotice(`تم حفظ ${importReview.drafts.length} مسودة من CSV. لم يتم اعتماد أي صف.`);
    setImportReview(null);
  };

  const knownBlockingRecord = entries.find(item => (item.id || item.legacyOperationId) === KNOWN_BLOCKING_OPERATION);
  const knownSurplusRecord = entries.find(item => (item.id || item.legacyOperationId) === KNOWN_SURPLUS_OPERATION);
  const hasKnownBlocking = !!knownBlockingRecord;
  const hasKnownSurplus = allItems.some(item => item.operationId === KNOWN_SURPLUS_OPERATION);
  const hasKnownAccount = allItems.some(item => item.inventoryAccountId === KNOWN_ACCOUNT);

  return <div className="space-y-4 pb-24" dir="rtl">
    <div className="rounded-3xl border border-[#2a2f3d] bg-[#0e1018] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 text-[#c9a84c]" />
        <div>
          <h3 className="text-lg font-black text-[#f5f1e8]">مراجعة بيانات التكلفة التاريخية</h3>
          <p className="mt-1 text-xs leading-6 text-[#9e978a]">تعيينات محاسبية إصدارية؛ العمليات الأصلية لا تُعدّل، ولا تُستخدم أسعار السوق الحالية.</p>
        </div>
      </div>
      <div className={`mt-4 rounded-2xl border p-3 text-sm font-black ${reportsAvailable ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-100'}`}>
        {reportsAvailable ? 'البيانات مكتملة — القوائم المالية متاحة' : 'البيانات غير مكتملة — القوائم المالية محجوبة'}
      </div>
      {drafts > 0 && <div className="mt-2 rounded-xl bg-amber-500/10 p-2 text-xs text-amber-200">توجد مسودات غير معتمدة: {drafts}</div>}
      {affectedYears.length > 0 && <div className="mt-2 rounded-xl bg-sky-500/10 p-2 text-xs text-sky-200">توجد تعديلات تاريخية تتطلب إعادة احتساب: {affectedYears.join('، ')}</div>}
    </div>

    <div className="grid grid-cols-2 gap-2">
      {[
        ['أسعار تجار مطلوبة', merchantPending],
        ['عمليات استلام التجار', allItems.filter(item => item.kind === 'merchant_receipt').length],
        ['زيادات محسوبة تلقائيًا', automaticWacTargets.size],
        ['تم حسابها بـ WAC', automaticWacTargets.size],
        ['استثناءات بلا WAC سابق', surplusWaitingForPriorWac],
        ['أسعار تجار معتمدة', activeApproved.filter(item => item.overlayType === 'merchant_receipt_cost').length],
        ['قرارات أخرى معتمدة', activeApproved.filter(item => item.overlayType !== 'merchant_receipt_cost').length],
        ['مرفوضة أو مؤجلة', rejected + drafts],
        ['أقدم تاريخ متأثر', affectedDates.sort()[0] || '—'],
      ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
        <div className="text-[10px] text-[#8a8172]">{label}</div>
        <div className="mt-1 text-lg font-black text-[#f5f1e8]">{value}</div>
      </div>)}
    </div>

    <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-xs">
      <div className="font-black text-[#ddd8cc]">مراجع اختبارية ثابتة — ليست العائق الحالي</div>
      <div className="mt-2 grid gap-1 text-[#9e978a]">
        <span>{hasKnownBlocking ? '✓' : '—'} عملية Cost Run المعروفة</span>
        <span>{hasKnownSurplus ? '✓' : '—'} سجل الزيادة التاريخية المعروف</span>
        <span>{hasKnownAccount ? '✓' : '—'} حساب المخزون المتأثر</span>
        {knownBlockingRecord && <span className="break-all">مرجع ثابت: {KNOWN_BLOCKING_OPERATION} — {knownBlockingRecord.date} — {knownBlockingRecord.tx}</span>}
        {knownSurplusRecord && <span className="break-all">Surplus: {KNOWN_SURPLUS_OPERATION} — {knownSurplusRecord.date} — {knownSurplusRecord.tx}</span>}
        {costCalculationRun.error && <span className="break-all font-black text-red-200">العائق الحالي: {costCalculationRun.error.code} — {costCalculationRun.error.operationId || 'بدون رقم عملية'}</span>}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
      <select value={merchantFilter} onChange={event => { setMerchantFilter(event.target.value); resetFor(0); }} className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
        <option value="all">كل التجار</option>
        {merchants.map(id => <option key={id} value={id}>{accountNames.get(id) || id}</option>)}
      </select>
      <select value={yearFilter} onChange={event => { setYearFilter(event.target.value); resetFor(0); }} className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
        <option value="all">كل السنوات</option>
        {years.map(year => <option key={year}>{year}</option>)}
      </select>
      <select value={accountFilter} onChange={event => { setAccountFilter(event.target.value); resetFor(0); }} className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
        <option value="all">كل الحسابات</option>
        {reviewAccounts.map(id => <option key={id} value={id}>{accountNames.get(id) || id}</option>)}
      </select>
      <select value={diagnosticFilter} onChange={event => { setDiagnosticFilter(event.target.value); resetFor(0); }} className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
        <option value="all">كل diagnostics</option>
        <option value="unresolved_merchant_cost">استلام تاجر</option>
        <option value="pending_surplus_cost">زيادة بلا WAC سابق</option>
      </select>
      <label className="col-span-2 flex items-center gap-2 text-xs text-[#ddd8cc]">
        <input type="checkbox" checked={onlyUnresolved} onChange={event => { setOnlyUnresolved(event.target.checked); resetFor(0); }} />
        عرض غير المحسوم فقط
      </label>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={exportCsv} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c]/40 p-3 text-xs font-black text-[#c9a84c]"><Download className="h-4 w-4" />تصدير CSV</button>
      <button type="button" onClick={() => importRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c]/40 p-3 text-xs font-black text-[#c9a84c]"><FileUp className="h-4 w-4" />استيراد كمسودات</button>
      <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => {
        const file = event.target.files?.[0];
        if (file) void readCsv(file);
        event.currentTarget.value = '';
      }} />
    </div>

    {importReview && <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-100">
      <div className="font-black">مراجعة الاستيراد قبل الحفظ</div>
      <div className="mt-2">مسودات صالحة: {importReview.drafts.length} — أخطاء: {importReview.errors.length}</div>
      {importReview.errors.slice(0, 8).map(error => <div key={`${error.row}-${error.message}`} className="mt-1">صف {error.row}: {error.message}</div>)}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={!!importReview.errors.length || !importReview.drafts.length} onClick={() => void saveImportedDrafts()} className="rounded-xl bg-sky-200 px-3 py-2 font-black text-sky-950 disabled:opacity-40">حفظ المسودات فقط</button>
        <button type="button" onClick={() => setImportReview(null)} className="rounded-xl border border-sky-200/40 px-3 py-2">إلغاء</button>
      </div>
    </div>}

    {!current ? <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-8 text-center text-sm text-[#9e978a]">لا توجد سجلات مطابقة للفلاتر الحالية.</div> : <>
      <div className="flex items-center justify-between">
        <button type="button" disabled={index <= 0} onClick={() => resetFor(index - 1)} className="rounded-xl border border-[#1a1e2a] p-2 text-[#ddd8cc] disabled:opacity-30"><ChevronRight /></button>
        <span className="text-xs font-black text-[#c9a84c]">{index + 1} / {items.length}</span>
        <button type="button" disabled={index >= items.length - 1} onClick={() => resetFor(index + 1)} className="rounded-xl border border-[#1a1e2a] p-2 text-[#ddd8cc] disabled:opacity-30"><ChevronLeft /></button>
      </div>

      <div className="rounded-3xl border border-[#2a2f3d] bg-[#0e1018] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-black text-[#f5f1e8]">{current.kind === 'merchant_receipt' ? 'استلام ذهب من تاجر' : 'زيادة مخزون محتملة'}</div>
          <span className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] text-red-200">{current.diagnosticCode}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ['Operation ID', current.operationId],
            ['رقم العملية', current.operation.operationNo || current.operation.legacyOperationNo || '—'],
            ['التاريخ', current.operation.date],
            [current.kind === 'merchant_receipt' ? 'التاجر' : 'حساب المخزون', current.kind === 'merchant_receipt' ? accountNames.get(current.operation.creditAccountId || '') || current.operation.credit : accountNames.get(current.inventoryAccountId || '') || current.operation.debit],
            ['مخزون الوجهة', accountNames.get(current.inventoryAccountId || '') || current.inventoryAccountId || '—'],
            ['العيار / المعدن', current.operation.karat || accountsDb.find(item => item.id === current.inventoryAccountId)?.karat || '—'],
            ['الوزن الفعلي', grams(current.operation.weight)],
            ['وزن Standard-21', grams(current.operation.arabicWeight)],
            ['المصنعية الحالية', money(current.operation.workmanshipCostMinor ?? Math.round(Number(current.operation.cash || 0) * 100))],
            ['التسوية النقدية', money(Math.round(Number(current.operation.cash || 0) * 100))],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[#080a0f] p-3">
            <div className="text-[9px] text-[#8a8172]">{label}</div>
            <div className="mt-1 break-all font-bold text-[#ddd8cc]">{value}</div>
          </div>)}
        </div>
        <div className="mt-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-100">{current.diagnosticMessage}</div>
        {(current.operation.notes || current.operation.invoiceNumber) && <div className="mt-2 rounded-xl bg-[#080a0f] p-3 text-xs text-[#9e978a]">المرجع الأصلي: {current.operation.invoiceNumber || '—'} — {current.operation.notes || '—'}</div>}
      </div>

      {current.kind === 'inventory_surplus' && !effectiveAutomaticWacCost && <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <label className="text-xs font-black text-[#ddd8cc]">التصنيف الصحيح</label>
        <select value={form.surplusResolution} onChange={event => { setForm({ ...form, surplusResolution: event.target.value as FormState['surplusResolution'] }); setPreview(null); }} className="mt-2 w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
          <option value="genuine">زيادة مخزون حقيقية بتكلفة يدوية</option>
          <option value="two_sided">تصحيح مخزون ثنائي الأطراف</option>
          <option value="duplicate">خطأ تكرار / استيراد</option>
          <option value="not_surplus">ليست زيادة مخزون</option>
          <option value="unresolved">تركها غير محسومة</option>
        </select>
        {form.surplusResolution === 'two_sided' && <select value={form.sourceInventoryAccountId} onChange={event => { setForm({ ...form, sourceInventoryAccountId: event.target.value }); setPreview(null); }} className="mt-2 w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
          <option value="">اختر حساب المخزون المصدر</option>
          {accountsDb.filter(item => item.is_inventory && item.id !== current.inventoryAccountId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
        <p className="mt-2 text-[10px] leading-5 text-[#8a8172]">التصحيح الثنائي ينقل carrying cost التاريخية حسب WAC دون ربح أو خسارة مصطنعة. التكرار ينشئ exclusion overlay ولا يحذف الأصل.</p>
      </div>}

      {!effectiveAutomaticWacCost && (current.kind === 'merchant_receipt' || form.surplusResolution === 'genuine') && <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <div className="space-y-2">
          <label className="block text-xs font-black text-[#ddd8cc]">سعر تاريخي للجرام</label>
          <input inputMode="decimal" value={form.pricePerGramEgp} onChange={event => { setForm({ ...form, pricePerGramEgp: event.target.value }); setPreview(null); }} placeholder="السعر التاريخي للجرام بالجنيه" className="w-full rounded-xl bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" />
          {current.kind === 'merchant_receipt'
            ? <div className="rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">الوزن العربي المعتمد تلقائيًا — {grams(current.operation.arabicWeight)}</div>
            : <select value={form.valueBasis} onChange={event => { setForm({ ...form, valueBasis: event.target.value as FormState['valueBasis'] }); setPreview(null); }} className="w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
              <option value="actual_weight">الوزن الفعلي — {grams(current.operation.weight)}</option>
              <option value="standard21_weight">وزن Standard-21 — {grams(current.operation.arabicWeight)}</option>
            </select>}
        </div>
        <div className="mt-3 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 p-3">
          <div className="text-[10px] text-[#d8c58d]">إجمالي القيمة الدفترية المحسوبة تلقائيًا</div>
          <div className="mt-1 text-base font-black text-[#f5d77b]">{money(totalMinor)}</div>
          <div className="mt-1 text-[10px] text-[#a99b75]">السعر التاريخي للجرام × الوزن المحدد</div>
        </div>
      </div>}

      {!effectiveAutomaticWacCost && current.kind === 'inventory_surplus' && form.surplusResolution !== 'unresolved' && <div className="space-y-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <select value={form.sourceType} onChange={event => { setForm({ ...form, sourceType: event.target.value as HistoricalCostSourceType }); setPreview(null); }} className="w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
          {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={form.sourceReference} onChange={event => { setForm({ ...form, sourceReference: event.target.value }); setPreview(null); }} placeholder="مرجع المصدر أو ملاحظاته" className="w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]" />
        <input value={form.approver} onChange={event => { setForm({ ...form, approver: event.target.value }); setPreview(null); }} placeholder="اسم المعتمد" className="w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]" />
        <textarea value={form.notes} onChange={event => { setForm({ ...form, notes: event.target.value }); setPreview(null); }} placeholder="ملاحظات القرار" className="min-h-20 w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]" />
        <input value={form.confidenceNote} onChange={event => { setForm({ ...form, confidenceNote: event.target.value }); setPreview(null); }} placeholder="ملاحظة ثقة اختيارية" className="w-full rounded-xl bg-[#080a0f] p-3 text-xs text-[#ddd8cc]" />
        <label className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          <input type="checkbox" className="mt-1" checked={form.confirmed} onChange={event => { setForm({ ...form, confirmed: event.target.checked }); setPreview(null); }} />
          أقر بأن هذه قيمة محاسبية تاريخية معتمدة، وأنها لا تعدل وزن الذهب أو العملية الأصلية.
        </label>
      </div>}

      {effectiveAutomaticWacCost && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
        <div className="flex items-center gap-2 font-black"><CheckCircle2 className="h-4 w-4" />زيادة مخزون محسوبة تلقائيًا من WAC</div>
        <div className="mt-3 grid gap-1">
          <span>تكلفة الزيادة الدفترية: {money(effectiveAutomaticWacCost.costMinor)}</span>
          <span>ربح زيادة المخزون: {money(effectiveAutomaticWacCost.gainMinor)}</span>
          <span>WAC قبل العملية: {money(effectiveAutomaticWacCost.wacBeforeMinorPerDisplayUnit)}</span>
          <span>WAC بعد العملية: {money(effectiveAutomaticWacCost.wacAfterMinorPerDisplayUnit)}</span>
          <span>المصدر: WAC السابق لنفس حساب المخزون — لا يُستخدم سعر السوق.</span>
        </div>
      </div>}

      {preview && <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-100">
        <div className="flex items-center gap-2 font-black"><CheckCircle2 className="h-4 w-4" />معاينة الأثر المحاسبي — Dry Run</div>
        {current.kind === 'merchant_receipt' ? <div className="mt-3 grid gap-1">
          <span>زيادة التكلفة الدفترية للمخزون: {money(preview.recordImpact.inventoryBookCostIncreaseMinor)}</span>
          <span>زيادة القيمة الدفترية لالتزام التاجر: {money(preview.recordImpact.merchantLiabilityBookValueIncreaseMinor)}</span>
          <span>WAC قبل السجل: {money(preview.recordImpact.wacBeforeMinorPerDisplayUnit)}</span>
          <span>WAC بعد السجل: {money(preview.recordImpact.wacAfterMinorPerDisplayUnit)}</span>
          <span>حالة السجل المحدد: {preview.recordImpact.resolved ? 'محسوم' : 'غير محسوم'}</span>
          <span>لا يوجد تغيير في وزن الذهب الأصلي.</span>
        </div> : <div className="mt-3 grid gap-1">
          <span>الوزن المعترف به: {grams((preview.targetResult?.incomingStandardizedQuantityUnits || 0) / 100)}</span>
          <span>التكلفة المعترف بها: {money(preview.targetResult?.incomingTotalCostMinor)}</span>
          <span>Other Income / Adjustment: {money(preview.targetResult?.adjustmentGainMinor)}</span>
          <span>WAC قبل السجل: {money(preview.recordImpact.wacBeforeMinorPerDisplayUnit)}</span>
          <span>WAC بعد السجل: {money(preview.recordImpact.wacAfterMinorPerDisplayUnit)}</span>
          <span>حالة السجل المحدد: {preview.recordImpact.resolved ? 'محسوم' : 'غير محسوم'}</span>
        </div>}
        {preview.officialReportsBlockedByOtherRecords && <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100">تنبيه: هذا السجل محسوم، لكن القوائم الرسمية قد تظل محجوبة بسبب سجلات أخرى غير محسومة.</div>}
        {!preview.officialReportsBlockedByOtherRecords && <div className="mt-2">القوائم الرسمية بعد هذا القرار: {preview.officialReportsAvailable ? 'متاحة' : 'ما زالت محجوبة'}</div>}
        <div className="mt-1">السنوات المتأثرة: {preview.affectedYears.join('، ') || '—'}</div>
      </div>}

      {latest && <details className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-xs text-[#9e978a]">
        <summary className="flex cursor-pointer items-center gap-2 font-black text-[#ddd8cc]"><History className="h-4 w-4" />سجل الإصدارات ({historicalCostReviewOverlays.filter(item => item.targetOperationId === current.operationId).length})</summary>
        <div className="mt-3 space-y-2">{historicalCostReviewOverlays.filter(item => item.targetOperationId === current.operationId).sort((a, b) => b.overlayVersion - a.overlayVersion).map(item => <div key={item.overlayId} className="rounded-xl bg-[#080a0f] p-3">
          <div>v{item.overlayVersion} — {item.status} — {item.overlayType}</div>
          <div className="mt-1 break-all font-mono text-[9px]">{item.auditHash}</div>
          {item.supersedesOverlayId && <div className="mt-1">يستبدل: {item.supersedesOverlayId}</div>}
        </div>)}</div>
      </details>}

      {notice && <div className="rounded-xl bg-[#1a1e2a] p-3 text-xs text-[#ddd8cc]">{notice}</div>}
      {effectiveAutomaticWacCost
        ? <div className="rounded-xl bg-emerald-500/10 p-3 text-center text-xs font-black text-emerald-200">لا يحتاج هذا السجل إلى سعر أو اعتماد يدوي.</div>
        : current.kind === 'merchant_receipt'
          ? <button type="button" disabled={totalMinor === null} onClick={() => void approveMerchantPrice()} className="w-full rounded-xl bg-emerald-600 p-3 text-sm font-black text-white disabled:opacity-30">اعتماد السعر وحساب العملية</button>
          : <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void saveDraft()} className="flex items-center justify-center gap-2 rounded-xl border border-[#c9a84c]/40 p-3 text-xs font-black text-[#c9a84c]"><Save className="h-4 w-4" />حفظ مسودة</button>
        <button type="button" onClick={runPreview} className="flex items-center justify-center gap-2 rounded-xl bg-sky-700 p-3 text-xs font-black text-white"><ShieldCheck className="h-4 w-4" />معاينة الأثر</button>
        <button type="button" disabled={!preview?.resolvesTargetDiagnostic} onClick={() => void approve()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 p-3 text-xs font-black text-white disabled:opacity-30"><CheckCircle2 className="h-4 w-4" />اعتماد ومتابعة</button>
        <button type="button" onClick={() => void rejectForNow()} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 p-3 text-xs font-black text-red-200"><AlertTriangle className="h-4 w-4" />رفض / تأجيل</button>
        <button type="button" onClick={() => resetFor(index + 1)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#1a1e2a] p-3 text-xs font-black text-[#9e978a]"><Clock3 className="h-4 w-4" />تخطي الآن</button>
      </div>}
    </>}
  </div>;
};

export default HistoricalCostReviewView;
