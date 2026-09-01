import { formatWeight } from '../../lib/formatting';
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Entry } from '../../types';
import { CATS, RAW_DATA } from '../../constants';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { 
  calculateArabicWeight, 
  normalizeNumerals, 
  calculateKaratPrice 
} from '../../lib/accounting';
import { FormInput } from '../ui/FormInput';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from '../../lib/goldEquivalent';
import { isQuantityAlignedToStep } from '../../lib/weightedAverageCost';
import { buildOpeningCostConfig } from '../../lib/openingCostConfig';
import { areOperationWritesLocked, rebuildRuntimeInventoryCostTimeline } from '../../lib/costRecalculation';
import { isGoldEquivalentEntry } from '../../utils/accountLogic';
import { AccountSearchSelect } from '../ui/AccountSearchSelect';
import { resolveEntryIdentity } from '../../lib/entryIdentity';
import { validateEntryNumberingPolicy } from '../../lib/entryValidation';
import { OperationSelector } from '../ui/OperationSelector';
import { buildAccountRegistry } from '../../lib/accountRegistry';
import { buildCanonicalPosting } from '../../lib/postingMatrix';
import { validateAccountingPolicy } from '../../lib/accountingPolicy';
import { mergeGoldMerchantSettlementEntryRules } from '../../lib/merchantSettlementEntryOptions';
import { createCentralAccountingEntry } from '../../lib/centralAccountingWriteService';
import { GoldPricingAssistant } from './GoldPricingAssistant';
import {
  createGoldAssistantSession,
  findCashAccount,
  GoldAssistantMode,
  GoldAssistantSession,
  resolveGoldAssistantProducts,
} from '../../lib/goldPricingAssistant';

export const normalizeAccessoryEntryPayload = <T extends { weight?: string; count?: string }>(entry: T, isAccessory: boolean): T => (
  isAccessory ? { ...entry, weight: entry.weight || '0', count: '0' } : entry
);

/** Firestore does not accept undefined field values; keep them out of the persisted document. */
export const sanitizeFirestorePayload = <T extends Record<string, unknown>>(entry: T): T => (
  Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)) as T
);

/** Presentation-only lookup through the existing canonical account resolver. */
export const accountSupportsCount = (registry: ReturnType<typeof buildAccountRegistry>, accountNames: string[]): boolean => {
  return accountNames.some((accountName) => {
    const resolution = registry.resolve(undefined, accountName);
    return resolution.status === 'resolved' && resolution.account.tracksQuantity;
  });
};

export const getNextInvoiceNumber = (
  txType: string,
  entries: Array<Pick<Entry, 'invoiceNumber'>>,
  reservedInvoiceNumber = '',
) => {
  if (!txType) return '';
  let prefix = 'TX';
  if (txType.includes('بيع')) prefix = 'S';
  else if (txType.includes('شراء')) prefix = 'P';

  const invoiceNumbers = [
    ...entries.map(entry => entry.invoiceNumber || ''),
    reservedInvoiceNumber,
  ];
  const maxNum = invoiceNumbers.reduce((max, invoiceNumber) => {
    const match = invoiceNumber.match(new RegExp(`^${prefix}(\\d+)$`));
    const number = match ? Number(match[1]) : 0;
    return number > max ? number : max;
  }, 0);

  return `${prefix}${maxNum + 1}`;
};

interface EntryFormProps {
  onStepChange?: (step: number) => void;
}

export const EntryForm = React.memo(({ onStepChange }: EntryFormProps) => {
  const { 
    setView, 
    user, 
    customRules, 
    accountsDb, 
    accountCategories, 
    transactionRules, 
    setGlobalError, 
    entries, 
    goldPrice, 
    silverPrice,
    openingCostConfig,
    goldSaleTaxStampPerGramEgp,
    pricingConfig,
    bullionCharges,
    coinCharges,
    costCalculationRun,
    canonicalAccounts,
    entryAssistantMode,
    setEntryAssistantMode
  } = useAppStore();
  
  const normalize = normalizeNumerals;
  const normalizeWeightInput = (value: string) => {
    const normalized = normalizeNumerals(value.replace(/[,\u066B]/g, '.'));
    return normalized.startsWith('.') ? `0${normalized}` : normalized;
  };
  const formatWeightOnBlur = () => {
    setFormData(previous => {
      if (!/^\d+(?:\.\d+)?$/.test(previous.weight)) return previous;
      const weight = Number(previous.weight).toFixed(2);
      return {
        ...previous,
        weight,
        arabicWeight: calculateArabicWeight(weight, previous.multiplier, previous.karat),
      };
    });
  };

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [assistantSession, setAssistantSession] = useState<GoldAssistantSession | null>(null);

  useEffect(() => {
    onStepChange?.(step);
  }, [onStepChange, step]);

  useEffect(() => {
    if (!entryAssistantMode) return;
    setAssistantSession(createGoldAssistantSession(entryAssistantMode, goldPrice, Date.now()));
    setStep(2);
    setEntryAssistantMode(null);
  }, [entryAssistantMode, goldPrice, setEntryAssistantMode]);

  const [usageStats, setUsageStats] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const stats = localStorage.getItem('usage_stats');
      if (stats) setUsageStats(JSON.parse(stats));
    } catch (err) {
      console.warn("Usage stats load error", err);
    }
  }, []);

  const incrementUsage = (keys: string[]) => {
    try {
      const newStats = { ...usageStats };
      keys.forEach(k => {
        if (k) newStats[k] = (newStats[k] || 0) + 1;
      });
      setUsageStats(newStats);
      localStorage.setItem('usage_stats', JSON.stringify(newStats));
    } catch (err) {
      console.warn("Usage stats save error", err);
    }
  };

  const sortByUsage = (list: any[], keyGetter: (item: any) => string) => {
    return [...list].sort((a, b) => {
      const valA = usageStats[keyGetter(a)] || 0;
      const valB = usageStats[keyGetter(b)] || 0;
      if (valB !== valA) return valB - valA;
      return keyGetter(a).localeCompare(keyGetter(b), 'ar');
    });
  };
  
  const allRules = useMemo(() => {
    const baseRules = [...RAW_DATA];
    const custom = customRules.map(r => ({ t: r.t, d: r.d, c: r.c, k: r.k || null, m: r.m }));
    let combined = [...baseRules, ...custom];

    if (transactionRules.length > 0) {
      const dbRules = transactionRules.map(r => ({ 
        t: r.tx, 
        debit: r.debit, 
        credit: r.credit, 
        karat: r.karat || null, 
        multiplier: r.multiplier || 1,
        category: r.category
      }));
      combined = [...dbRules.map(r => ({ t: r.t, d: r.debit, c: r.credit, k: r.karat, m: r.multiplier })), ...combined];
    }
    
    return mergeGoldMerchantSettlementEntryRules(combined, accountsDb);
  }, [customRules, transactionRules, accountsDb]);

  const availableOperationTypes = useMemo(() => {
    const operationTypes = new Set<string>();
    CATS.forEach(category => category.items.forEach(item => operationTypes.add(item)));
    transactionRules.forEach(rule => {
      if (rule.category && rule.tx) operationTypes.add(rule.tx);
    });
    return Array.from(operationTypes);
  }, [transactionRules]);

  const initialFormState = {
    tx: '',
    debit: '',
    credit: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    cash: '',
    weight: '',
    count: '',
    notes: '',
    invoiceNumber: '',
    clientName: '',
    clientPhone: '',
    arabicWeight: '',
    karat: null as number | null,
    multiplier: 1,
    marketPrice: undefined as number | undefined,
    debitAccountId: undefined as string | undefined,
    creditAccountId: undefined as string | undefined,
    priceSnapshotLocked: false,
  };

  const [formData, setFormData] = useState(initialFormState);
  const lastSavedInvoiceRef = React.useRef('');
  const debitSearchRef = React.useRef<HTMLInputElement>(null);
  const creditSearchRef = React.useRef<HTMLInputElement>(null);
  const cashRef = React.useRef<HTMLInputElement>(null);
  const weightRef = React.useRef<HTMLInputElement>(null);

  const { editingEntry, setEditingEntry } = useAppStore();

  useEffect(() => {
    if (editingEntry && !editingEntry.id) {
      // Clear any existing draft to ensure a fresh entry for the shortcut
      localStorage.removeItem('entry_form_draft');
      
      setFormData(prev => ({
        ...prev,
        ...editingEntry,
        date: editingEntry.date || format(new Date(), 'yyyy-MM-dd'),
        invoiceNumber: generateInvoiceNumber(editingEntry.tx || ''),
        priceSnapshotLocked: false,
      }));
      
      // Force step 2 (Account Selection) if tx is provided (Shortcut clicked)
      if (editingEntry.tx) {
        setStep(2);
      }
      
      // Clear it so it doesn't interfere with next entries
      setEditingEntry(null);
    }
  }, [editingEntry, setEditingEntry]);

  useEffect(() => {
    if (step === 2 && formData.tx) {
      if (!formData.debit) debitSearchRef.current?.focus();
      else if (formData.debit && !formData.credit) creditSearchRef.current?.focus();
    }
  }, [step, formData.tx, formData.debit, formData.credit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (step === 1 && formData.tx) setStep(2);
      else if (step === 2 && formData.debit && formData.credit) setStep(3);
      else if (step === 3) handleSave();
    }
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem('entry_form_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        const dataToCheck = parsed.formData || parsed;
        if (dataToCheck.date === format(new Date(), 'yyyy-MM-dd')) {
          setFormData(prev => ({ ...prev, ...dataToCheck }));
          if (parsed.step) setStep(Number(parsed.step) || 1);
        }
      } catch (e) {
        localStorage.removeItem('entry_form_draft');
      }
    }
  }, []);

  useEffect(() => {
    if (step < 4) {
      localStorage.setItem('entry_form_draft', JSON.stringify({ formData, step, savedAt: Date.now() }));
    }
  }, [formData, step]);

  useEffect(() => {
    if (formData.priceSnapshotLocked) return;
    if (formData.tx) {
      let basePrice = 0;
      let mult = formData.multiplier || 1;
      
      // Auto-detect karat/multiplier based on account name
      const accountName = formData.debit || formData.credit;
      const karatMap: Record<string, number> = {
        "خاتم حريمي": 18, "خاتم اطفال": 18, "حلق حريمي": 18, "حلق اطفال": 18, "حلق مكرونة": 18,
        "تونز": 18, "محبس": 18, "دبلة": 18, "اسورة و انسيال": 18, "سلسلة و تعليق": 18,
        "غويش كيمك": 18, "بريمة": 18, "كسر افرنجي": 18,
        "خاتم عربي": 21, "حلق عربي": 21, "سلسلة عربي": 21, "غويش عربي": 21, "كسر عربي": 21, "جنية": 21,
        "سبيكة": 24
      };
      
      const detectedKarat = karatMap[accountName];
      if (detectedKarat) {
        mult = detectedKarat === 18 ? 0.857142857 : detectedKarat === 24 ? 1.142857143 : 1;
        setFormData(p => ({ 
          ...p, 
          karat: detectedKarat, 
          multiplier: mult,
          arabicWeight: calculateArabicWeight(p.weight, mult, detectedKarat)
        }));
      }

      const isGold = formData.tx.includes('ذهب') || formData.debit.includes('ذهب') || formData.credit.includes('ذهب');
      const isSilver = formData.tx.includes('فضة') || formData.debit.includes('فضة') || formData.credit.includes('فضة');
      if (isGold) basePrice = goldPrice || 0;
      else if (isSilver) { basePrice = silverPrice || 0; mult = 1; }
      if (basePrice > 0) setFormData(prev => ({ ...prev, marketPrice: calculateKaratPrice(basePrice, mult) }));
    }
  }, [formData.tx, formData.debit, formData.credit, formData.priceSnapshotLocked, goldPrice, silverPrice]);

  const generateInvoiceNumber = (txType: string) => {
    return getNextInvoiceNumber(txType, entries, lastSavedInvoiceRef.current);
  };

  const handleTxSelect = (item: string) => {
    setFormData(prev => {
      let inv = prev.invoiceNumber;
      if (!inv) {
        inv = generateInvoiceNumber(item);
      }
      return { ...prev, tx: item, subTx: item === 'قيد افتتاحي' ? '' : prev.subTx, invoiceNumber: inv };
    });
    if (item !== 'قيد افتتاحي') setStep(2);
  };

  const filteredRules = useMemo(() => allRules.filter(r => r.t === formData.tx), [formData.tx, allRules]);
  
  const debits = useMemo(() => {
    const list = Array.from(new Set(filteredRules.map(r => r.d)));
    return sortByUsage(list, i => i);
  }, [filteredRules, usageStats]);

  const credits = useMemo(() => {
    // Get list from rules and ensure unique account names
    const ruleList = filteredRules
      .filter(r => r.d === formData.debit)
      .map(r => ({ c: r.c, k: r.k, m: r.m }));
    
    const uniqueRuleList: typeof ruleList = [];
    const seenNames = new Set();
    
    ruleList.forEach(item => {
      if (!seenNames.has(item.c)) {
        seenNames.add(item.c);
        uniqueRuleList.push(item);
      }
    });

    return sortByUsage(uniqueRuleList, i => i.c);
  }, [formData.debit, filteredRules, usageStats]);

  useEffect(() => {
    if (debits.length === 1 && formData.debit !== debits[0]) setFormData(prev => ({ ...prev, debit: debits[0], credit: '' }));
    if (formData.debit && credits.length === 1 && formData.credit !== credits[0].c) {
      const c = credits[0];
      setFormData(prev => ({ ...prev, credit: c.c, karat: c.k ?? prev.karat, multiplier: c.m || prev.multiplier, arabicWeight: calculateArabicWeight(prev.weight, c.m || 1, c.k ?? prev.karat) }));
    }
  }, [formData.tx, formData.debit, debits, credits]);

  const handleSave = async () => {
    if (isSaving) return;
    if (areOperationWritesLocked(costCalculationRun)) {
      setGlobalError('العمليات مقفلة حتى يكتمل احتساب التكلفة بنجاح.');
      return;
    }

    const entry: Entry = {
      tx: formData.tx || '',
      debit: formData.debit || '',
      credit: formData.credit || '',
      date: formData.date || format(new Date(), 'yyyy-MM-dd'),
      cash: formData.cash || '0',
      weight: formData.weight || '0',
      count: formData.count || '0',
      notes: formData.notes || '',
      invoiceNumber: formData.invoiceNumber || '',
      arabicWeight: formData.arabicWeight || '0',
      multiplier: formData.multiplier || 1,
      karat: formData.karat ?? undefined,
      marketPrice: formData.marketPrice,
      debitAccountId: formData.debitAccountId,
      creditAccountId: formData.creditAccountId,
      clientName: formData.clientName || '',
      clientPhone: formData.clientPhone || '',
      userId: user?.uid || '',
      seq: Date.now(),
    };

    setIsSaving(true);
    try {
      const result = await createCentralAccountingEntry({
        entry,
        context: {
          entries,
          accounts: accountsDb,
          openingCostConfig,
          manualAccountDefinitions: canonicalAccounts,
        },
        actor: { userId: user?.uid || '', userEmail: user?.email || '' },
        source: formData.tx === 'قيد افتتاحي' ? 'setup' : 'user',
      });
      if (result.ok === false) {
        setGlobalError(result.message);
        return;
      }

      lastSavedInvoiceRef.current = String(result.entry.invoiceNumber || '').trim();
      setStep(4);
      localStorage.removeItem('entry_form_draft');
      incrementUsage([formData.tx, formData.debit, formData.credit]);
    } catch (error) {
      console.error('Central save error:', error);
      setGlobalError('فشل تسجيل القيد في قاعدة البيانات. لم يتم حفظ العملية.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setAssistantSession(null);
    setFormData(prev => ({
      ...initialFormState,
      date: prev.date
    }));
    setStep(1);
  };

  const clearDraft = () => {
    localStorage.removeItem('entry_form_draft');
    resetForm();
  };

  const startSameTypeOperation = () => {
    setAssistantSession(null);
    setFormData(prev => ({
      ...initialFormState,
      date: prev.date,
      tx: prev.tx,
      invoiceNumber: generateInvoiceNumber(prev.tx),
    }));
    setStep(2);
  };

  const renderStep1 = () => (
    <div className="animate-in fade-in space-y-4 duration-300">
      <OperationSelector
        availableOperations={availableOperationTypes}
        selected={formData.tx}
        onSelect={handleTxSelect}
      />

      {formData.tx === 'قيد افتتاحي' && (
        <div className="space-y-4 rounded-[20px] border border-[#c99a2e]/45 bg-white p-4 shadow-sm">
          <label className="block text-sm font-bold text-[#8a6519]">نوع القيد الافتتاحي</label>
          <select 
            value={formData.subTx || ''} 
            onChange={(e) => setFormData(p => ({ ...p, subTx: e.target.value }))}
            className="w-full rounded-xl border-2 border-[#15203b]/15 bg-white px-4 py-3 text-[#15203b] outline-none transition-all focus:border-[#c99a2e] focus:ring-1 focus:ring-[#c99a2e]"
          >
            <option value="">عام</option>
            <option value="ذهب">ذهب</option>
            <option value="فضة">فضة</option>
            <option value="ملحقات">ملحقات</option>
            <option value="نقدي">نقدي</option>
            <option value="تاجر">تاجر</option>
            <option value="عميل">عميل</option>
          </select>
          <button 
            onClick={() => setStep(2)}
            className="relative min-h-12 w-full overflow-hidden rounded-xl bg-[#c99a2e] py-3 font-black text-white transition-all hover:bg-[#b48725] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15203b]"
          >
            متابعة
          </button>
        </div>
      )}
    </div>
  );

  const { showClientInfo, showWeightAndCount, showCash, isAccessory } = useMemo(() => {
    const txStr = formData.tx || '';
    const accs = accountCategories?.assets?.["مخزون ملحقات اضافية"] || [];
    const isAcc = accs.includes(formData.debit) || accs.includes(formData.credit);
    
    return {
      showClientInfo: /بيع|شراء|مبيعات|مشتريات|مرتجع/.test(txStr),
      showWeightAndCount: !/ايراد|تصليح|قبض|دفع|مصاريف|مصروفات|م ت|م ا ع|مسحوبات|سحب|ايداع|إيداع|سلفة|مرتب|ايجار|شراء اصل/.test(txStr) && !isAcc,
      showCash: !/تيفيت|تحويل/.test(txStr),
      isAccessory: isAcc
    };
  }, [formData.tx, formData.debit, formData.credit, accountCategories]);

  const accountRegistry = useMemo(
    () => buildAccountRegistry(accountsDb, entries, canonicalAccounts),
    [accountsDb, entries, canonicalAccounts],
  );

  const supportsCount = useMemo(
    () => accountSupportsCount(accountRegistry, [formData.debit, formData.credit].filter(Boolean)),
    [accountRegistry, formData.debit, formData.credit],
  );

  const assistantRules = useMemo(() => {
    if (!assistantSession) return [];
    const tx = assistantSession.mode === 'sale' ? 'بيع ذهب' : 'شراء ذهب';
    const storedRules = transactionRules.filter(rule => rule.tx === tx);
    if (storedRules.length > 0) return storedRules;
    return [
      ...RAW_DATA.filter(rule => rule.t === tx).map(rule => ({
        tx: rule.t,
        debit: rule.d,
        credit: rule.c,
        karat: rule.k,
        multiplier: rule.m,
      })),
      ...customRules.filter(rule => rule.t === tx).map(rule => ({
        tx: rule.t,
        debit: rule.d,
        credit: rule.c,
        karat: rule.k,
        multiplier: rule.m,
      })),
    ];
  }, [assistantSession, customRules, transactionRules]);

  const assistantProducts = useMemo(() => assistantSession
    ? resolveGoldAssistantProducts({
        mode: assistantSession.mode,
        accounts: accountsDb,
        registry: accountRegistry,
        rules: assistantRules,
      })
    : [],
  [accountRegistry, accountsDb, assistantRules, assistantSession]);

  const assistantCashAccount = useMemo(
    () => findCashAccount(accountsDb, accountRegistry),
    [accountRegistry, accountsDb],
  );

  const startGoldAssistant = (mode: GoldAssistantMode) => {
    setAssistantSession(createGoldAssistantSession(mode, goldPrice, Date.now()));
  };

  const handleAssistantReview = (prefill: Partial<Entry>) => {
    setFormData(previous => {
      const multiplier = prefill.multiplier || 1;
      const karat = prefill.karat ?? null;
      const weight = prefill.weight || '';
      return {
        ...previous,
        ...prefill,
        arabicWeight: calculateArabicWeight(weight, multiplier, karat),
        invoiceNumber: previous.invoiceNumber || generateInvoiceNumber(prefill.tx || previous.tx),
        priceSnapshotLocked: true,
      };
    });
    setAssistantSession(null);
    setStep(2);
  };

  // Handle weight/count sync for accessories
  useEffect(() => {
    if (isAccessory) {
      // Sync Weight and Count (1g = 1pc)
      const w = parseFloat(formData.weight) || 0;
      const c = parseFloat(formData.count) || 0;
      if (w !== c) {
        // Prefer count if it was just changed, or weight
        const syncedValue = formData.count ? formData.count : formData.weight;
        if (syncedValue) {
          setFormData(p => ({ ...p, weight: syncedValue, count: syncedValue, arabicWeight: '0' }));
        }
      }
    }
  }, [isAccessory, formData.count, formData.weight, formData.tx, formData.debit, formData.credit]);

  const renderStep2 = () => assistantSession ? (
    <GoldPricingAssistant
      mode={assistantSession.mode}
      session={assistantSession}
      products={assistantProducts}
      cashAccount={assistantCashAccount}
      taxStampSettings={goldSaleTaxStampPerGramEgp}
      pricingConfig={pricingConfig}
      legacyBullionCharges={bullionCharges}
      legacyCoinCharges={coinCharges}
      onCancel={() => setAssistantSession(null)}
      onReview={handleAssistantReview}
    />
  ) : (
    <div className="flex flex-1 flex-col justify-between space-y-2.5 animate-in fade-in">
      {(formData.tx === 'بيع ذهب' || formData.tx === 'شراء ذهب') && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#c9a84c]/35 bg-[#c9a84c]/[0.07] p-3">
          <div>
            <div className="text-xs font-black text-[#f1cf72]">تسعير ذكي اختياري</div>
            <div className="mt-1 text-[9px] font-bold text-[#827c70]">يمكنك متابعة الإدخال اليدوي كما هو.</div>
          </div>
          <button
            type="button"
            disabled={!(goldPrice > 0) || !Number.isFinite(goldPrice)}
            onClick={() => startGoldAssistant(formData.tx === 'بيع ذهب' ? 'sale' : 'purchase')}
            className="min-h-11 shrink-0 rounded-xl bg-[#c9a84c] px-4 text-xs font-black text-[#080a0f] disabled:opacity-40"
          >
            {formData.tx === 'بيع ذهب' ? 'مساعد البيع' : 'مساعد الشراء'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <FormInput 
          label="التاريخ"
          type="date" 
          value={formData.date} 
          onChangeValue={(v) => setFormData(p => ({ ...p, date: v }))} 
          containerClassName="space-y-0.5"
          className="rounded-lg px-2 py-1.5 text-xs"
        />
        <FormInput 
          label="الفاتورة"
          type="text" 
          value={formData.invoiceNumber} 
          onChangeValue={(v) => setFormData(p => ({ ...p, invoiceNumber: v }))} 
          containerClassName="space-y-0.5"
          className="rounded-lg px-2 py-1.5 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 bg-[#11141d]/25 p-2 rounded-xl border border-[#1a1e2a] relative">
        <AccountSearchSelect 
          label="المدين"
          theme="debit"
          compact
          value={formData.debit}
          options={debits as string[]}
          onSelect={(val) => setFormData(p => ({
            ...p,
            debit: val,
            credit: '',
            debitAccountId: undefined,
            creditAccountId: undefined,
            priceSnapshotLocked: false,
          }))}
          inputRef={debitSearchRef}
        />
        <AccountSearchSelect 
          label="الدائن"
          theme="credit"
          compact
          value={formData.credit}
          options={credits as any}
          onSelect={(val, karat, mult) => {
            const activeMult = mult || 1;
            setFormData(p => ({ 
              ...p,
              credit: val,
              creditAccountId: undefined,
              priceSnapshotLocked: false,
              karat: karat || p.karat,
              multiplier: activeMult,
              arabicWeight: calculateArabicWeight(p.weight, activeMult, karat || p.karat)
            }));
          }}
          inputRef={creditSearchRef}
        />
      </div>

      <div className={cn(
        "grid gap-2",
        showCash && showWeightAndCount
          ? "grid-cols-3"
          : showCash && isAccessory
            ? "grid-cols-2"
            : showWeightAndCount
              ? "grid-cols-2"
              : "grid-cols-1",
      )}>
        {showCash && (
          <FormInput 
            ref={cashRef}
            label="المبلغ النقدي"
            type="text" 
            inputMode="numeric"
            value={formData.cash}
            onChangeValue={(v) => setFormData(p => ({ ...p, cash: normalize(v) }))}
            containerClassName="space-y-1"
            labelClassName="text-[#6a9e6a] group-focus-within:text-[#8bc48b]"
            className="border-2 rounded-xl px-2 py-2.5 text-lg font-black text-[#6a9e6a] text-center font-mono focus:border-[#c9a84c] focus:shadow-[0_0_10px_rgba(201,168,76,0.16)]"
          />
        )}
        {(showWeightAndCount || isAccessory) && (
          <>
            {showWeightAndCount && (
              <FormInput 
                ref={weightRef}
                label="الوزن"
                type="text" 
                inputMode="decimal"
                value={formData.weight}
                onChangeValue={(v) => {
                  const w = normalizeWeightInput(v);
                  setFormData(p => ({ ...p, weight: w, arabicWeight: calculateArabicWeight(w, p.multiplier, p.karat) }));
                }}
                onBlur={formatWeightOnBlur}
                containerClassName="space-y-1"
                labelClassName="text-[#c9a84c] group-focus-within:text-[#f2cf76]"
                className="border-2 rounded-xl px-2 py-2.5 text-lg font-black text-[#ddd8cc] text-center font-mono focus:border-[#c9a84c] focus:shadow-[0_0_10px_rgba(201,168,76,0.16)]"
              />
            )}
            <FormInput 
              label="العدد"
              type="text" 
              inputMode="numeric"
              value={formData.count}
              onChangeValue={(v) => setFormData(p => ({ ...p, count: normalize(v) }))}
              containerClassName="space-y-1"
              labelClassName="text-[#c9a84c] group-focus-within:text-[#f2cf76]"
              className="border-2 rounded-xl px-2 py-2.5 text-lg font-black text-[#ddd8cc] text-center font-mono focus:border-[#c9a84c] focus:shadow-[0_0_10px_rgba(201,168,76,0.16)]"
            />
          </>
        )}
      </div>

      {showWeightAndCount && (
        <div className="flex items-center justify-between bg-[#11141d]/30 border border-[#c9a84c22] rounded-lg py-1.5 px-2">
          <span className="text-[8px] text-[#8a8578] font-bold">وزن موحد (٢١) تلقائيًا</span>
          <span className="text-sm font-bold text-[#c9a84c] font-mono">{parseFloat(formData.arabicWeight || '0').toFixed(2)} جم</span>
        </div>
      )}

      <button onClick={() => setStep(3)} className="w-full bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#080a0f] font-bold py-2.5 rounded-xl shadow-lg hover:shadow-[#c9a84c44] transition-all active:scale-95">التالي</button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+12px)] animate-in fade-in">
      {/* Invoice Card */}
      <div className="relative space-y-4 overflow-hidden rounded-[28px] border border-[#c9a84c55] bg-[radial-gradient(circle_at_50%_0%,rgba(201,168,76,0.08),transparent_42%),linear-gradient(160deg,#111a2b,#080c15)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)] sm:p-6">
        {/* Top zigzag or dashed border effect */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjgiIGZpbGw9IiMxYTFlMmEiLz48L3N2Zz4=')] repeat-x" />
        
        {/* Header */}
        <div className="border-b border-[#2a2e3a] pb-4 pt-2 text-center">
          <div>
            <div className="text-xs font-black text-[#c9a84c]">مراجعة نهائية للفواتير</div>
            <h3 className="mt-1 text-3xl font-black tracking-tight text-[#f8fafc]">{formData.tx}</h3>
            <p className="mt-2 text-sm font-mono text-[#aaa79e]">{formData.invoiceNumber} <span className="mx-1 text-[#c9a84c]">•</span> {formData.date}</p>
          </div>
          <div />
        </div>

        {/* Values */}
        <div className="grid grid-cols-2 gap-2 border-b border-[#2a2e3a] pb-4">
          {showCash && (
            <div className="rounded-2xl border border-[#c9a84c44] bg-[#0c1422]/80 p-3">
              <span className="text-sm text-[#8a8578] font-bold">نقدا:</span>
              <span className="text-lg font-mono font-bold text-[#6a9e6a]">{parseFloat(formData.cash || '0').toLocaleString()} <span className="text-xs">ج.م</span></span>
            </div>
          )}
          {showWeightAndCount && (
            <div className="rounded-2xl border border-[#c9a84c44] bg-[#0c1422]/80 p-3">
              <span className="text-sm text-[#8a8578] font-bold">الوزن:</span>
              <span className="text-lg font-mono font-bold text-[#ddd8cc]">{formatWeight(parseFloat(formData.weight || '0'))} <span className="text-xs">ج</span></span>
            </div>
          )}
          {formData.karat !== null && formData.karat !== undefined && (
            <div className="rounded-2xl border border-[#c9a84c44] bg-[#0c1422]/80 p-3">
              <span className="text-sm text-[#8a8578] font-bold">العيار:</span>
              <span className="text-lg font-mono font-bold text-[#ddd8cc]">{formData.karat}</span>
            </div>
          )}
          {formData.marketPrice && formData.marketPrice > 0 ? (
            <div className="rounded-2xl border border-[#c9a84c44] bg-[#0c1422]/80 p-3">
              <span className="text-sm text-[#8a8578] font-bold">سعر الذهب الرسمي:</span>
              <span className="text-sm font-mono font-bold text-[#8a8578]">
                {Math.round(formData.marketPrice).toLocaleString()} <span className="text-xs">ج.م</span>
              </span>
            </div>
          ) : null}
          {supportsCount && (
            <div className="rounded-2xl border border-[#c9a84c44] bg-[#0c1422]/80 p-3">
              <span className="text-sm text-[#8a8578] font-bold">العدد:</span>
              <span className="text-lg font-mono font-bold text-[#ddd8cc]">{formData.count}</span>
            </div>
          )}
        </div>

        {/* Ledger Entries (البيان) */}
        <div>
          <span className="block text-xs text-[#8a8578] font-bold mb-2">البيان:</span>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-[#11141d] p-3 rounded-xl border border-[#1a1e2a] shadow-inner">
              <span className="block text-[9px] text-[#c9a84c] font-bold uppercase mb-1">من حساب (المدين)</span>
              <p className="text-sm font-bold text-[#f8fafc] truncate">{formData.debit}</p>
            </div>
            <div className="bg-[#11141d] p-3 rounded-xl border border-[#1a1e2a] shadow-inner">
              <span className="block text-[9px] text-[#6a9e6a] font-bold uppercase mb-1">إلى حساب (الدائن)</span>
              <p className="text-sm font-bold text-[#f8fafc] truncate">{formData.credit}</p>
            </div>
          </div>
        </div>
        
        {/* Notes Preview if available */}
        {(formData.notes || formData.clientName || formData.clientPhone) && (
          <div className="pt-2 space-y-2">
            {(formData.clientName || formData.clientPhone) && (
              <div className="flex flex-col sm:flex-row sm:justify-between text-sm bg-[#11141d] p-3 rounded-lg border border-[#1a1e2a]">
                <span className="text-[#8a8578] mb-1 sm:mb-0">العميل:</span>
                <span className="text-[#ddd8cc] font-bold">
                  {formData.clientName || 'غير مسجل'} {formData.clientPhone && <span className="text-[#c9a84c]">({formData.clientPhone})</span>}
                </span>
              </div>
            )}
            {formData.notes && (
              <div className="text-xs text-[#8a8578] bg-[#11141d] p-3 rounded-lg border border-[#1a1e2a] leading-relaxed">
                <span className="text-[#c9a84c] font-bold block mb-1">ملاحظات:</span>
                {formData.notes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Fields for Step 3 */}
      <div className="space-y-3 rounded-3xl border border-[#2a2e3a] bg-[#0e1522]/90 p-4">
        <h4 className="text-lg font-black text-[#f1cc68]">بيانات الفاتورة الإضافية <span className="text-sm font-bold text-[#aaa79e]">(اختياري)</span></h4>
        {showClientInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput 
              value={formData.clientName} 
              onChangeValue={(v) => setFormData(p => ({ ...p, clientName: v }))} 
              placeholder="اسم العميل (اختياري)"
              containerClassName="space-y-0"
            />
            <FormInput 
              type="tel" 
              inputMode="tel"
              value={formData.clientPhone} 
              onChangeValue={(v) => setFormData(p => ({ ...p, clientPhone: normalize(v) }))} 
              placeholder="رقم الهاتف (اختياري)"
              containerClassName="space-y-0"
              className="text-center font-mono" 
            />
          </div>
        )}
        <textarea 
          value={formData.notes} 
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} 
          aria-label="ملاحظات (اختياري)"
          className="h-20 w-full resize-none rounded-2xl border border-[#2a2e3a] bg-[#080a0f] p-4 text-sm outline-none transition-all focus:border-[#c9a84c55]"
          placeholder="إضافة ملاحظات (اختياري)..."
        />
      </div>
      
      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => setStep(2)} className="min-h-14 flex-1 rounded-2xl border border-[#c9a84c] bg-[#111827] py-3 font-black text-[#f1cc68] transition-all hover:bg-[#182235] active:scale-95">تعديل</button>
        <button onClick={handleSave} disabled={isSaving} className="min-h-14 flex-[1.8] rounded-2xl bg-green-600 py-3 font-black text-white shadow-[0_4px_20px_rgba(34,197,94,0.3)] transition-all hover:bg-green-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {isSaving ? "جاري الحفظ..." : "تأكيد وحفظ"}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const isCashDebit = (formData.debit || '').includes('خزنة') || (formData.debit || '').includes('الخزنة');
    const isCashCredit = (formData.credit || '').includes('خزنة') || (formData.credit || '').includes('الخزنة');
    const cashImpact = isCashDebit ? `+${formData.cash}` : isCashCredit ? `-${formData.cash}` : '0';
    
    const isGoldDebit = (formData.debit || '').includes('ذهب') || (formData.debit || '').includes('كسر') || (formData.debit || '').includes('خاتم') || (formData.debit || '').includes('حلق') || (formData.debit || '').includes('دبلة') || (formData.debit || '').includes('سلسلة') || (formData.debit || '').includes('سبيكة') || (formData.debit || '').includes('جنية');
    const isGoldCredit = (formData.credit || '').includes('ذهب') || (formData.credit || '').includes('كسر') || (formData.credit || '').includes('خاتم') || (formData.credit || '').includes('حلق') || (formData.credit || '').includes('دبلة') || (formData.credit || '').includes('سلسلة') || (formData.credit || '').includes('سبيكة') || (formData.credit || '').includes('جنية');
    
    const weightImpact = isGoldDebit ? `+${formData.weight}` : isGoldCredit ? `-${formData.weight}` : '0';
    
    return (
      <div className="text-center space-y-6 py-10 animate-in zoom-in">
        <div className="w-20 h-20 bg-green-500/20 rounded-full mx-auto flex items-center justify-center text-green-500">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-[#ddd8cc]">تم الحفظ بنجاح!</h2>
        
        <div className="bg-[#080a0f] border border-[#1a1e2a] rounded-2xl p-6 text-right space-y-4 max-w-sm mx-auto">
          <h4 className="text-[10px] text-[#c9a84c] font-black uppercase tracking-widest border-b border-[#1a1e2a] pb-2">ملخص العملية ( Triple Ledger )</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#5a5548]">التأثير المالي:</span>
              <span className={cn("font-bold font-mono", isCashDebit ? "text-green-500" : isCashCredit ? "text-red-500" : "text-[#ddd8cc]")}>
                {cashImpact} ج.م
              </span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#5a5548]">تحديث الوزن:</span>
              <span className={cn("font-bold font-mono", isGoldDebit ? "text-green-500" : isGoldCredit ? "text-red-500" : "text-[#ddd8cc]")}>
                {weightImpact} جم
              </span>
            </div>
            
            <div className="pt-2 border-t border-[#1a1e2a] space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#5a5548]">من:</span>
                <span className="text-[#ddd8cc] font-bold">{formData.debit}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#5a5548]">إلى:</span>
                <span className="text-[#ddd8cc] font-bold">{formData.credit}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-[#5a5548] font-bold mt-2">فاتورة رقم: {formData.invoiceNumber}</p>
        
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <button onClick={startSameTypeOperation} className="w-full bg-[#1a1e2a] text-[#ddd8cc] border border-[#c9a84c33] hover:border-[#c9a84c66] hover:bg-[#c9a84c11] py-4 rounded-2xl font-bold transition-all active:scale-95">
            عملية جديدة من نفس النوع
          </button>
          <button onClick={resetForm} className="w-full bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#080a0f] py-4 rounded-2xl font-bold shadow-lg hover:shadow-[#c9a84c44] transition-all active:scale-95">
            عملية جديدة
          </button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative overflow-hidden',
        step === 1
          ? 'space-y-5 -mx-4 bg-[radial-gradient(circle_at_85%_0%,rgba(201,154,46,0.13),transparent_34%),radial-gradient(circle_at_0%_32%,rgba(201,154,46,0.07),transparent_28%),#fffdf7] px-4 pb-5'
          : step === 2
            ? 'flex flex-1 flex-col space-y-3 -mx-4 bg-[#0a0d14] px-3 py-3 shadow-xl sm:mx-0 sm:rounded-2xl sm:border sm:border-[#1a1e2a] sm:p-4'
            : 'space-y-5 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 shadow-2xl sm:p-6',
      )}
    >
      {step > 1 && <div className="absolute left-0 top-0 h-1.5 w-full bg-[#1a1e2a]"><motion.div animate={{ width: `${(step / 4) * 100}%` }} className="h-full bg-gradient-to-r from-[#c9a84c] to-[#9a7830]" /></div>}
      
      {step > 1 && <div className={cn("flex justify-between items-center bg-[#11141d]/50 border border-[#1a1e2a]", step === 2 ? "p-2 rounded-xl gap-2" : "p-3 rounded-2xl gap-3")}>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('guide')} className={cn("bg-[#c9a84c0a] border border-[#c9a84c22] rounded-xl text-[10px] font-black text-[#c9a84c] hover:bg-[#c9a84c22] transition-all", step === 2 ? "px-2 py-1.5" : "px-3 py-2")}>دليل العمليات</button>
          {formData.tx && step > 1 && (
            <button onClick={clearDraft} className={cn("bg-red-500/05 border border-red-500/20 rounded-xl text-[10px] font-black text-red-500 hover:bg-red-500/15 transition-all", step === 2 ? "px-2 py-1.5" : "px-3 py-2")}>بدء من جديد</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">{[1,2,3].map(s => <div key={s} className={cn("w-1.5 h-1.5 rounded-full", s === step ? "bg-[#c9a84c]" : s < step ? "bg-green-500" : "bg-[#1a1e2a]")} />)}</div>
          <span className="text-[10px] font-black text-[#5a5548]">الخطوة {step}</span>
        </div>
      </div>}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </motion.div>
  );
});
