import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  ChevronRight, 
  Trash2, 
  Upload, 
  Download, 
  AlertTriangle,
  Loader2,
  CheckCircle2,
  BookOpen,
  LayoutGrid,
  Save,
  FilePlus,
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { AnnualOpeningCostConfig } from '../../types';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { formatMinorUnitsToEgpInput, getAccessoryOpeningCostsMinorByAccountId, getGoldOpeningPriceMinor, getSilverOpeningPriceMinor, mergeAnnualOpeningCostRows, parseEgpToMinorUnits } from '../../lib/openingCostConfig';
import { normalizeNumerals } from '../../lib/accounting';
import { areOperationWritesLocked } from '../../lib/costRecalculation';
import { buildOpeningCostConfig } from '../../lib/openingCostConfig';
import { buildWacAuditCsv, wacAuditFilename } from '../../lib/wacAuditExcel';
import { normalizeSmartMarginSettings, SmartMarginSettings } from '../../lib/dailyJournalSmartDashboard';
import { downloadCsv } from '../../utils/csv';
import { parseSettingsEntryCsv } from '../../utils/csvImport';
import {
  normalizeGoldSaleTaxStampPerGramEgp,
  normalizeGoldPricingConfig,
  GoldPricingConfig,
  APPROVED_BULLION_UNIT_WEIGHTS,
  APPROVED_COIN_UNIT_WEIGHTS,
  SUPPORTED_JEWELRY_TAXONOMY_KEYS,
  SMART_PURCHASE_TAXONOMY_KEYS,
  parseAssistantNumber,
} from '../../lib/goldPricingAssistant';

export const SettingsView = React.memo(() => {
  const {
    setView,
    user,
    entries,
    accountsDb,
    setGlobalError,
    openingCostConfig,
    setOpeningCostConfig,
    goldSaleTaxStampPerGramEgp,
    setGoldSaleTaxStampPerGramEgp,
    pricingConfig,
    setPricingConfig,
    smartMarginSettings,
    setSmartMarginSettings,
    costCalculationRun,
  } = useAppStore();
  const operationWritesLocked = areOperationWritesLocked(costCalculationRun);
  const [openingPriceForm, setOpeningPriceForm] = useState<{
    year: string;
    gold: string;
    silver: string;
    accessories: Record<string, string>;
  }>({ year: String(new Date().getFullYear()), gold: '', silver: '', accessories: {} });
  const [openingPriceError, setOpeningPriceError] = useState('');
  const [openingPriceSuccess, setOpeningPriceSuccess] = useState('');
  const [isSavingOpeningPrice, setIsSavingOpeningPrice] = useState(false);
  const [salePricingForm, setSalePricingForm] = useState(() => {
    const normalized = normalizeGoldSaleTaxStampPerGramEgp(goldSaleTaxStampPerGramEgp);
    return { rate18: String(normalized[18]), rate21: String(normalized[21]) };
  });
  const [salePricingError, setSalePricingError] = useState('');
  const [salePricingSuccess, setSalePricingSuccess] = useState('');
  const [isSavingSalePricing, setIsSavingSalePricing] = useState(false);
  const [pricingConfigForm, setPricingConfigForm] = useState<GoldPricingConfig>(() => normalizeGoldPricingConfig(pricingConfig));
  const [smartMarginForm, setSmartMarginForm] = useState<SmartMarginSettings>(() => normalizeSmartMarginSettings(smartMarginSettings));
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isGeneratingWacAudit, setIsGeneratingWacAudit] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'cost' | 'import' | 'accounts'>('rules');

  useEffect(() => {
    const normalized = normalizeGoldSaleTaxStampPerGramEgp(goldSaleTaxStampPerGramEgp);
    setSalePricingForm({ rate18: String(normalized[18]), rate21: String(normalized[21]) });
  }, [goldSaleTaxStampPerGramEgp]);
  useEffect(() => setPricingConfigForm(normalizeGoldPricingConfig(pricingConfig)), [pricingConfig]);
  useEffect(() => setSmartMarginForm(normalizeSmartMarginSettings(smartMarginSettings)), [smartMarginSettings]);

  const sortedOpeningCostConfig = useMemo(
    () => [...openingCostConfig].sort((a, b) => Number(a.year) - Number(b.year)),
    [openingCostConfig],
  );
  const accessoryAccounts = useMemo(
    () => accountsDb
      .filter(account => account.is_inventory && account.type === 'accessory' && !!account.id)
      .sort((left, right) => left.name.localeCompare(right.name, 'ar')),
    [accountsDb],
  );
  const accessoryAccountIdByLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const account of accessoryAccounts) {
      if (!account.id) continue;
      lookup.set(account.id, account.id);
      lookup.set(account.name, account.id);
    }
    return lookup;
  }, [accessoryAccounts]);

  const toEgpNumber = (value: string): number => Number(normalizeNumerals(value).trim());

  const getAccessoryOpeningQuantities = (year: number): Record<string, number> => {
    const quantities: Record<string, number> = {};
    for (const entry of entries) {
      if (String(entry.date || '').slice(0, 4) !== String(year)) continue;
      const isOpening = entry.operationKind === 'opening' || entry.tx === '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a' || entry.subTx?.startsWith('\u0631\u0635\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a') === true;
      if (!isOpening) continue;
      const account = entry.debitAccountId
        ? accessoryAccounts.find(item => item.id === entry.debitAccountId)
        : accessoryAccounts.find(item => item.name === entry.debit);
      if (!account?.id) continue;
      const quantity = Number(normalizeNumerals(String(entry.weight ?? '0')));
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      if (safeQuantity > 0) quantities[account.id] = (quantities[account.id] || 0) + safeQuantity;
    }
    return quantities;
  };

  const accessoryCostSummary = (row: AnnualOpeningCostConfig): string => {
    const costs = getAccessoryOpeningCostsMinorByAccountId(row);
    const saved = accessoryAccounts.filter(account => account.id && costs[account.id] !== undefined && costs[account.id] !== '');
    const lines = saved.map(account => `${account.name}: ${formatMinorUnitsToEgpInput(costs[account.id!])} \u062c\u0646\u064a\u0647`);
    return [`\u0645\u0644\u062d\u0642\u0627\u062a \u0645\u062d\u0641\u0648\u0638\u0629: ${saved.length}`, ...lines].join('\n');
  };

  const validateOpeningPriceForm = (existingRow?: AnnualOpeningCostConfig): AnnualOpeningCostConfig => {
    const year = Number(openingPriceForm.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error('\u0623\u062f\u062e\u0644 \u0633\u0646\u0629 \u0635\u062d\u064a\u062d\u0629 \u0628\u064a\u0646 2000 \u0648 2100.');
    }

    const draft: AnnualOpeningCostConfig = { year };
    const gold = openingPriceForm.gold.trim();
    const silver = openingPriceForm.silver.trim();
    const accessoryValues: Record<string, string> = Object.fromEntries(
      (Object.entries(openingPriceForm.accessories) as Array<[string, string]>)
        .map(([accountKey, value]) => [accessoryAccountIdByLookup.get(accountKey) ?? accountKey, value.trim()])
        .filter(([, value]) => !!value),
    ) as Record<string, string>;
    if (!gold && !silver && Object.keys(accessoryValues).length === 0 && !existingRow) {
      throw new Error('\u0623\u062f\u062e\u0644 \u0642\u064a\u0645\u0629 Opening Cost \u0648\u0627\u062d\u062f\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.');
    }
    if (gold) {
      let goldMinor: number;
      try {
        goldMinor = parseEgpToMinorUnits(gold);
      } catch {
        throw new Error('\u0633\u0639\u0631 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0645\u0639\u062f\u0646 \u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0631\u0642\u0645\u064b\u0627 \u0635\u062d\u064a\u062d\u064b\u0627 \u0623\u0648 \u0639\u0634\u0631\u064a\u064b\u0627 \u062d\u062a\u0649 \u0642\u0631\u0634\u064a\u0646.');
      }
      if (goldMinor <= 0) throw new Error('\u0633\u0639\u0631 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0630\u0647\u0628 \u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631.');
      draft.gold21PriceEgp = toEgpNumber(gold);
    }
    if (silver) {
      let silverMinor: number;
      try {
        silverMinor = parseEgpToMinorUnits(silver);
      } catch {
        throw new Error('\u0633\u0639\u0631 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0645\u0639\u062f\u0646 \u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0631\u0642\u0645\u064b\u0627 \u0635\u062d\u064a\u062d\u064b\u0627 \u0623\u0648 \u0639\u0634\u0631\u064a\u064b\u0627 \u062d\u062a\u0649 \u0642\u0631\u0634\u064a\u0646.');
      }
      if (silverMinor <= 0) throw new Error('\u0633\u0639\u0631 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0641\u0636\u0629 \u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631.');
      draft.silverPriceEgp = toEgpNumber(silver);
    }
    if (Object.keys(accessoryValues).length > 0) {
      draft.accessoryOpeningCosts = {};
      for (const [accountId, value] of Object.entries(accessoryValues)) {
        const account = accessoryAccounts.find(item => item.id === accountId);
        if (!account) throw new Error(`Accessory opening cost must be saved by a real accountId. Unknown key: ${accountId}`);
        let minor: number;
        try {
          minor = parseEgpToMinorUnits(value);
        } catch {
          throw new Error(`\u062a\u0643\u0644\u0641\u0629 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0645\u0644\u062d\u0642 ${account.name} \u064a\u062c\u0628 \u0623\u0646 \u062a\u0643\u0648\u0646 \u0631\u0642\u0645\u064b\u0627 \u062d\u062a\u0649 \u0642\u0631\u0634\u064a\u0646.`);
        }
        if (minor <= 0) throw new Error(`\u062a\u0643\u0644\u0641\u0629 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0645\u0644\u062d\u0642 ${account.name} \u064a\u062c\u0628 \u0623\u0646 \u062a\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631.`);
        draft.accessoryOpeningCosts[accountId] = toEgpNumber(value);
      }
    }

    const merged = mergeAnnualOpeningCostRows(existingRow, draft);
    const openingQuantities = getAccessoryOpeningQuantities(year);
    const mergedAccessoryCosts = getAccessoryOpeningCostsMinorByAccountId(merged);
    const missing = accessoryAccounts.filter(account =>
      account.id && (openingQuantities[account.id] || 0) > 0 && mergedAccessoryCosts[account.id] === undefined,
    );
    if (missing.length > 0) {
      throw new Error(`\u0623\u062f\u062e\u0644 \u062a\u0643\u0644\u0641\u0629 \u0627\u0641\u062a\u062a\u0627\u062d \u0627\u0644\u0645\u0644\u062d\u0642\u0627\u062a \u0630\u0627\u062a \u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0627\u0641\u062a\u062a\u0627\u062d\u064a: ${missing.map(account => account.name).join('\u060c ')}`);
    }
    return merged;
  };

  const persistOpeningCostConfig = async (nextConfig: AnnualOpeningCostConfig[]) => {
    if (!user?.uid) throw new Error('\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0633\u062a\u062e\u062f\u0645 \u0646\u0634\u0637 \u0644\u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a.');
    const sorted = [...nextConfig].sort((a, b) => Number(a.year) - Number(b.year));
    const previous = openingCostConfig;
    setOpeningCostConfig(sorted);
    try {
      await setDoc(doc(db, 'settings', user.uid), { openingCostConfig: sorted }, { merge: true });
    } catch (error) {
      setOpeningCostConfig(previous);
      throw error;
    }
  };

  const handleSaveOpeningPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpeningPriceError('');
    setOpeningPriceSuccess('');
    setIsSavingOpeningPrice(true);
    try {
      const year = Number(openingPriceForm.year);
      const existingRow = sortedOpeningCostConfig.find(row => Number(row.year) === year);
      const nextRow = validateOpeningPriceForm(existingRow);
      const nextConfig = sortedOpeningCostConfig.filter(row => Number(row.year) !== nextRow.year);
      await persistOpeningCostConfig([...nextConfig, nextRow]);
      setOpeningPriceSuccess(accessoryCostSummary(nextRow));
      setOpeningPriceForm({ year: String(nextRow.year + 1), gold: '', silver: '', accessories: {} });
    } catch (error) {
      setOpeningPriceError(error instanceof Error ? error.message : '\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0633\u0639\u0631 \u0627\u0644\u0627\u0641\u062a\u062a\u0627\u062d. \u0631\u0627\u062c\u0639 \u0627\u0644\u0642\u064a\u0645 \u0627\u0644\u0645\u062f\u062e\u0644\u0629.');
    } finally {
      setIsSavingOpeningPrice(false);
    }
  };

  const handleSaveSalePricing = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalePricingError('');
    setSalePricingSuccess('');
    const rate18 = parseAssistantNumber(salePricingForm.rate18);
    const rate21 = parseAssistantNumber(salePricingForm.rate21);
    if (rate18 === null || rate18 < 0 || rate21 === null || rate21 < 0) {
      setSalePricingError('أدخل معدلًا صحيحًا وغير سالب لكل عيار.');
      return;
    }
    if (!user?.uid) {
      setSalePricingError('لا يوجد مستخدم نشط لحفظ الإعدادات.');
      return;
    }
    const next = normalizeGoldSaleTaxStampPerGramEgp({ 18: rate18, 21: rate21 });
    const previous = normalizeGoldSaleTaxStampPerGramEgp(goldSaleTaxStampPerGramEgp);
    setIsSavingSalePricing(true);
    setGoldSaleTaxStampPerGramEgp(next);
    try {
      await setDoc(doc(db, 'settings', user.uid), { goldSaleTaxStampPerGramEgp: next }, { merge: true });
      setSalePricingSuccess('تم حفظ إعدادات تسعير البيع.');
    } catch (error) {
      setGoldSaleTaxStampPerGramEgp(previous);
      setSalePricingError('تعذر حفظ إعدادات تسعير البيع.');
    } finally {
      setIsSavingSalePricing(false);
    }
  };

  const savePricingConfig = async () => {
    if (!user?.uid) { setSalePricingError('لا يوجد مستخدم نشط لحفظ الإعدادات.'); return; }
    const next = normalizeGoldPricingConfig(pricingConfigForm);
    const previous = pricingConfig;
    setIsSavingSalePricing(true);
    setPricingConfig(next);
    try {
      await setDoc(doc(db, 'settings', user.uid), { pricingConfig: next }, { merge: true });
      setSalePricingSuccess('تم حفظ إعدادات المصنعية والخصم.');
    } catch {
      setPricingConfig(previous);
      setSalePricingError('تعذر حفظ إعدادات المصنعية والخصم.');
    } finally { setIsSavingSalePricing(false); }
  };
  const saveSmartMarginSettings = async () => {
    if (!user?.uid) return;
    const next = normalizeSmartMarginSettings(smartMarginForm);
    const previous = smartMarginSettings;
    setSmartMarginSettings(next);
    try { await setDoc(doc(db, 'settings', user.uid), { smartMarginSettings: next }, { merge: true }); setSalePricingSuccess('تم حفظ حواجز قرار شراء الذهب.'); }
    catch { setSmartMarginSettings(previous); setSalePricingError('تعذر حفظ حواجز قرار شراء الذهب.'); }
  };
  const setJewelryDefault = (key: string, mode: 'perGram' | 'perPiece', value: string) => setPricingConfigForm(previous => ({
    ...previous, saleWorkmanshipDefaults: { ...previous.saleWorkmanshipDefaults, [key]: { mode, value: Math.max(0, Number(normalizeNumerals(value)) || 0) } },
  }));
  const setPurchaseDefault = (key: string, value: string) => setPricingConfigForm(previous => ({
    ...previous, purchaseDiscountPercent: { ...previous.purchaseDiscountPercent, [key]: Math.min(100, Math.max(0, Number(normalizeNumerals(value)) || 0)) },
  }));

  const handleExportWacAudit = async () => {
    if (costCalculationRun.status !== 'valid' || !costCalculationRun.timeline?.valid) {
      setGlobalError('لا يمكن تصدير تقرير WAC قبل اكتمال حساب التكلفة المركزي بنجاح.');
      return;
    }
    setIsGeneratingWacAudit(true);
    try {
      // Let the loading state paint before serializing a large browser-local workbook.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const workbook = buildWacAuditCsv({
        entries,
        accounts: accountsDb,
        openingCostConfig: buildOpeningCostConfig(openingCostConfig, accountsDb),
        inventoryTimeline: costCalculationRun.timeline,
      });
      downloadCsv(workbook.rows, wacAuditFilename());
    } catch (error) {
      setGlobalError(error instanceof Error ? `تعذر تصدير تقرير WAC: ${error.message}` : 'تعذر تصدير تقرير WAC.');
    } finally {
      setIsGeneratingWacAudit(false);
    }
  };

  const handleEditOpeningPrice = (row: AnnualOpeningCostConfig) => {
    const accessoryCosts = getAccessoryOpeningCostsMinorByAccountId(row);
    setOpeningPriceError('');
    setOpeningPriceSuccess('');
    setOpeningPriceForm({
      year: String(row.year),
      gold: formatMinorUnitsToEgpInput(getGoldOpeningPriceMinor(row)),
      silver: formatMinorUnitsToEgpInput(getSilverOpeningPriceMinor(row)),
      accessories: Object.fromEntries(
        Object.entries(accessoryCosts)
          .map(([accountId, value]) => [accountId, formatMinorUnitsToEgpInput(value)]),
      ),
    });
  };
  const handleDeleteOpeningPrice = async (year: number) => {
    if (!window.confirm(`حذف أسعار افتتاح سنة ${year}؟`)) return;
    setOpeningPriceError('');
    setIsSavingOpeningPrice(true);
    try {
      await persistOpeningCostConfig(sortedOpeningCostConfig.filter(row => Number(row.year) !== Number(year)));
    } catch (error) {
      setOpeningPriceError(error instanceof Error ? error.message : 'تعذر حذف سنة الافتتاح.');
    } finally {
      setIsSavingOpeningPrice(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (operationWritesLocked) {
      setGlobalError('لا يمكن حذف العمليات أثناء تشغيل أو فشل إعادة احتساب التكلفة.');
      return;
    }
    setIsDeletingAll(true);
    try {
      const entriesToDelete = [...entries];
      while (entriesToDelete.length > 0) {
        const chunk = entriesToDelete.splice(0, 500);
        const batch = writeBatch(db);
        chunk.forEach(e => {
          batch.delete(doc(db, 'entries', e.id!));
        });
        await batch.commit();
      }
      setShowDeleteAllConfirm(false);
      alert("تم مسح كافة البيانات بنجاح!");
    } catch (error) {
      console.error("Delete All Error:", error);
      setGlobalError("فشل مسح البيانات. يرجى المحاولة لاحقاً.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const [importProgress, setImportProgress] = useState<{ current: number, total: number, success: number, failed: number } | null>(null);

  const handleRetroactiveInvoiceNumbers = async () => {
    if (operationWritesLocked) {
      setGlobalError('لا يمكن تعديل العمليات أثناء تشغيل أو فشل إعادة احتساب التكلفة.');
      return;
    }
    setIsImporting(true);
    
    // 1. Sort all entries to assign sequentially in chronological order
    const sortedEntries = [...entries].sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      if (aTime !== bTime) return aTime - bTime;
      return (a.seq || 0) - (b.seq || 0);
    });

    // 2. Identify entries without an invoice number
    const missingInvoices = sortedEntries.filter(e => !e.invoiceNumber);
    
    if (missingInvoices.length === 0) {
      alert("جميع القيود الحالية مرقمة بالفعل.");
      setIsImporting(false);
      return;
    }

    // 3. Find max existing numbers
    const maxNums: Record<string, number> = {};
    entries.forEach(e => {
      if (e.invoiceNumber) {
        const prefixMatch = e.invoiceNumber.match(/^[A-Za-z]+/);
        if (prefixMatch) {
          const p = prefixMatch[0].toUpperCase();
          const numMatch = e.invoiceNumber.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            if (!maxNums[p] || num > maxNums[p]) {
              maxNums[p] = num;
            }
          }
        }
      }
    });

    try {
      const batch = writeBatch(db);
      const limit = 400; // Keep safely under 500
      let updatedCount = 0;

      for (let i = 0; i < missingInvoices.length; i++) {
        const e = missingInvoices[i];
        if (!e.id) continue;
        
        let prefix = 'TX';
        const txType = e.tx || '';
        if (txType.includes('بيع')) prefix = 'S';
        else if (txType.includes('شراء')) prefix = 'P';
        else if (txType.includes('مصاريف') || txType.includes('مصروف')) prefix = 'E';
        else if (txType.includes('مسحوبات')) prefix = 'W';
        else if (txType.includes('قبض')) prefix = 'R';
        else if (txType.includes('دفع')) prefix = 'D';
        else if (txType.includes('تحويل')) prefix = 'T';
        else if (txType.includes('تيفيت')) prefix = 'M';
        else if (txType.includes('تسوية') || txType.includes('عجز') || txType.includes('زيادة')) prefix = 'ADJ';
        else if (txType.includes('تصليح')) prefix = 'RP';

        if (!maxNums[prefix]) maxNums[prefix] = 0;
        maxNums[prefix]++;
        const newInvoiceNum = `${prefix}${maxNums[prefix]}`;
        
        batch.update(doc(db, 'entries', e.id), { invoiceNumber: newInvoiceNum });
        updatedCount++;

        if (updatedCount >= limit) {
          await batch.commit();
          alert("تم ترقيم عدد كبير من القيود، يرجى الضغط مرة أخرى لاستكمال الباقي");
          setIsImporting(false);
          return;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
      }
      
      alert(`تم إضافة أرقام تسلسلية لـ ${updatedCount} قيد قديم بنجاح!`);
    } catch (error) {
      console.error("Migration error:", error);
      setGlobalError("فشل في ترقيم القيود القديمة.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportData = (mode: 'new' | 'update') => {
    if (entries.length === 0) {
      alert("لا توجد بيانات لتصديرها.");
      return;
    }
    
    const headers = [
      "التاريخ", 
      "رقم الفاتورة",
      "العملية", 
      "مدين", 
      "دائن", 
      "نقداً", 
      "الوزن", 
      "العيار", 
      "الوزن العربي", 
      "العدد", 
      "اسم العميل",
      "رقم التليفون",
      "سعر السوق",
      "المعامل",
      "ملاحظات",
      "معرف العملية"
    ];
    
    const rows = entries.map(e => [
      e.date,
      e.invoiceNumber || "",
      e.tx,
      e.debit,
      e.credit,
      e.cash || "0",
      e.weight || "0",
      e.karat || "",
      e.arabicWeight || "0",
      e.count || "0",
      e.clientName || "",
      e.clientPhone || "",
      e.marketPrice || "",
      e.multiplier || "",
      e.notes || "",
      e.id || ""
    ]);

    const fileName = mode === 'update' 
      ? 'mecca_gold_backup.csv'
      : `makkah_gold_all_data_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsv(rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]]))), fileName, headers);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    const isExcel = false;
    
    reader.onload = (event) => {
      setImportText(event.target?.result as string);
    };
    
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    if (operationWritesLocked) {
      setGlobalError('لا يمكن استيراد عمليات أثناء تشغيل أو فشل إعادة احتساب التكلفة.');
      return;
    }
    setIsImporting(true);
    setImportProgress(null);
    
    try {
      const importedRows = parseSettingsEntryCsv(importText);
      const total = importedRows.length;
      let success = 0;
      let failed = 0;
      
      setImportProgress({ current: 0, total, success: 0, failed: 0 });

      for (let i = 0; i < importedRows.length; i++) {
        try {
          const { date, tx, debit, credit, cash, weight, notes, karat, count, arabicWeight, multiplier } = importedRows[i];
          
          await addDoc(collection(db, 'entries'), {
            date: date || "",
            tx: tx || "",
            debit: debit || "",
            credit: credit || "",
            cash: cash || "0",
            weight: weight || "0",
            notes: notes || "",
            karat: karat === null ? null : parseInt(String(karat), 10),
            count: count || "0",
            arabicWeight: arabicWeight || "0",
            multiplier: multiplier === null ? null : parseFloat(String(multiplier)),
            userId: user.uid,
            createdAt: new Date().toISOString()
          });
          success++;
        } catch (err) {
          failed++;
        }
        setImportProgress({ current: i + 1, total, success, failed });
      }
      setImportText('');
      alert(`اكتمل الاستيراد: ${success} ناجح، ${failed} فشل`);
    } catch (error) {
      alert("حدث خطأ أثناء الاستيراد");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8 pb-20"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[#c9a84c] flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          الإعدادات والنظام
        </h2>
        <button onClick={() => setView('home')} className="p-2 bg-[#1a1e2a] rounded-xl text-[#5a5548]">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        <button
          onClick={() => setActiveTab('rules')}
          className={cn(
            "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
            activeTab === 'rules' ? "bg-[#c9a84c] text-[#080a0f]" : "bg-[#1a1e2a] text-[#5a5548] hover:text-[#ddd8cc]"
          )}
        >
          القواعد المخصصة
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={cn(
            "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
            activeTab === 'accounts' ? "bg-[#c9a84c] text-[#080a0f]" : "bg-[#1a1e2a] text-[#5a5548] hover:text-[#ddd8cc]"
          )}
        >
          شجرة الحسابات
        </button>
        <button
          onClick={() => setActiveTab('cost')}
          className={cn(
            "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
            activeTab === 'cost' ? "bg-[#c9a84c] text-[#080a0f]" : "bg-[#1a1e2a] text-[#5a5548] hover:text-[#ddd8cc]"
          )}
        >
          أسعار افتتاح التكلفة
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={cn(
            "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
            activeTab === 'import' ? "bg-[#c9a84c] text-[#080a0f]" : "bg-[#1a1e2a] text-[#5a5548] hover:text-[#ddd8cc]"
          )}
        >
          استيراد وتصدير
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'cost' && (
          <motion.div
            key="cost"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
            dir="rtl"
          >
            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#f0cc6b]">إعدادات تسعير البيع</h3>
                <p className="text-[11px] leading-6 text-[#8a8172]">
                  ضريبة ودمغة تسعيرية فقط. لا تدخل في Entry أو Opening Cost أو WAC أو COGS.
                </p>
              </div>
              <form onSubmit={handleSaveSalePricing} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-[#c9a84c]">ضريبة ودمغة عيار 18 — ج/جم</span>
                    <input
                      value={salePricingForm.rate18}
                      onChange={event => setSalePricingForm(previous => ({ ...previous, rate18: normalizeNumerals(event.target.value) }))}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-[#c9a84c]">ضريبة ودمغة عيار 21 — ج/جم</span>
                    <input
                      value={salePricingForm.rate21}
                      onChange={event => setSalePricingForm(previous => ({ ...previous, rate21: normalizeNumerals(event.target.value) }))}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
                    />
                  </label>
                </div>
                <button type="submit" disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60">
                  {isSavingSalePricing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ إعدادات التسعير
                </button>
              </form>
              {salePricingError && <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">{salePricingError}</div>}
              {salePricingSuccess && <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-xs font-bold text-green-300">{salePricingSuccess}</div>}
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-6" dir="rtl">
              <h3 className="text-sm font-bold text-[#f0cc6b]">حواجز قرار شراء الذهب</h3>
              <p className="mt-2 text-[11px] leading-6 text-[#8a8172]">تستخدم للتحليل فقط: الحد الأدنى بالجنيه لكل E21 والحد الأدنى كنسبة من متوسط البيع.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[10px] font-bold text-[#c9a84c]">حد أدنى ج/جم E21<input value={smartMarginForm.minimumEgpPerE21} onChange={event => setSmartMarginForm(previous => ({ ...previous, minimumEgpPerE21: Math.max(0, Number(normalizeNumerals(event.target.value)) || 0) }))} inputMode="decimal" className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" /></label>
                <label className="space-y-1 text-[10px] font-bold text-[#c9a84c]">حد أدنى نسبة %<input value={smartMarginForm.minimumPercent} onChange={event => setSmartMarginForm(previous => ({ ...previous, minimumPercent: Math.max(0, Number(normalizeNumerals(event.target.value)) || 0) }))} inputMode="decimal" className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" /></label>
              </div>
              <button type="button" onClick={saveSmartMarginSettings} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f]"><Save className="h-4 w-4" />حفظ حواجز قرار الشراء</button>
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-4 space-y-4" dir="rtl">
              <div><h3 className="text-sm font-bold text-[#f0cc6b]">مصنعية السبائك والجنيهات</h3><p className="text-[11px] leading-6 text-[#8a8172]">قيمة واحدة فقط تُحفظ لكل وزن؛ الإدخال الآخر مشتق مباشرة. لا يتم الحفظ إلا بالزر.</p></div>
              {([['bullionWorkmanshipByWeight', 'سبيكة', APPROVED_BULLION_UNIT_WEIGHTS], ['coinWorkmanshipByWeight', 'جنيه', APPROVED_COIN_UNIT_WEIGHTS]] as const).map(([field, title, weights]) => <div key={field} className="space-y-2"><strong className="text-xs text-[#ddd8cc]">{title}</strong>{weights.map(unitWeight => {
                const saved = pricingConfigForm[field][String(unitWeight)] ?? { mode: 'perGram' as const, value: 0 };
                const perGram = saved.mode === 'perGram' ? saved.value : saved.value / unitWeight;
                const perPiece = saved.mode === 'perPiece' ? saved.value : saved.value * unitWeight;
                const setValue = (mode: 'perGram' | 'perPiece', value: string) => setPricingConfigForm(previous => ({ ...previous, [field]: { ...previous[field], [String(unitWeight)]: { mode, value: Math.max(0, Number(normalizeNumerals(value)) || 0) } } }));
                return <div key={unitWeight} className="grid grid-cols-1 gap-2 rounded-2xl border border-[#252b37] p-3 sm:grid-cols-3"><span className="text-xs font-bold text-[#f0cc6b]">{unitWeight} جم</span><input value={String(Number(perGram.toFixed(2)))} onChange={event => setValue('perGram', event.target.value)} inputMode="decimal" aria-label={`مصنعية ${unitWeight} للجرام`} className="min-w-0 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]"/><input value={String(Number(perPiece.toFixed(2)))} onChange={event => setValue('perPiece', event.target.value)} inputMode="decimal" aria-label={`مصنعية ${unitWeight} للقطعة`} className="min-w-0 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]"/></div>;
              })}</div>)}
              <button type="button" onClick={savePricingConfig} disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60"><Save className="h-4 w-4" />حفظ إعدادات المصنعية</button>
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-4 space-y-4" dir="rtl">
              <div><h3 className="text-sm font-bold text-[#f0cc6b]">مصنعية المشغولات الذهبية</h3><p className="text-[11px] leading-6 text-[#8a8172]">لكل taxonomy قيمة مرجعية واحدة فقط؛ لا تُشتق قيمة ثانية في الإعدادات.</p></div>
              <div className="space-y-2">{SUPPORTED_JEWELRY_TAXONOMY_KEYS.map(key => { const saved = pricingConfigForm.saleWorkmanshipDefaults[key] ?? { mode: 'perGram' as const, value: 0 }; return <div key={key} className="grid grid-cols-1 gap-2 rounded-2xl border border-[#252b37] p-3 sm:grid-cols-[1fr_120px_1fr]"><span className="break-all text-[10px] font-bold text-[#ddd8cc]">{key}</span><select value={saved.mode} onChange={event => setJewelryDefault(key, event.target.value as 'perGram' | 'perPiece', String(saved.value))} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-xs text-[#ddd8cc]"><option value="perGram">EGP/gram</option><option value="perPiece">EGP/piece</option></select><input value={String(saved.value)} onChange={event => setJewelryDefault(key, saved.mode, event.target.value)} inputMode="decimal" className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]" /></div>; })}</div>
              <button type="button" onClick={savePricingConfig} disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60"><Save className="h-4 w-4" />حفظ مصنعية المشغولات</button>
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-4 space-y-4" dir="rtl">
              <div><h3 className="text-sm font-bold text-[#f0cc6b]">خصم الشراء الافتراضي</h3><p className="text-[11px] leading-6 text-[#8a8172]">للمنتجات الأربعة المعتمدة في مساعد الشراء فقط.</p></div>
              {SMART_PURCHASE_TAXONOMY_KEYS.map(key => <label key={key} className="grid grid-cols-1 gap-2 rounded-2xl border border-[#252b37] p-3 sm:grid-cols-[1fr_150px]"><span className="break-all text-[10px] font-bold text-[#ddd8cc]">{key}</span><input value={String(pricingConfigForm.purchaseDiscountPercent[key] ?? 0)} onChange={event => setPurchaseDefault(key, event.target.value)} inputMode="decimal" aria-label={`Default discount ${key}`} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]" /></label>)}
              <button type="button" onClick={savePricingConfig} disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60"><Save className="h-4 w-4" />حفظ خصم الشراء</button>
            </div>

            <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#ddd8cc]">أسعار الافتتاح السنوية للتكلفة</h3>
                <p className="text-[11px] text-[#8a8172] leading-6">
                  تفستخدم هذه الأسعار فقط لتحديد تكلفة المخزون الافتتاحي وحساب متوسط التكلفة. لا تفستخدم كتقييم سوقي حالي.
                </p>
              </div>

              <form onSubmit={handleSaveOpeningPrice} className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr] gap-3 items-end">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">السنة</span>
                  <input value={openingPriceForm.year} onChange={(e) => setOpeningPriceForm(prev => ({ ...prev, year: e.target.value }))} inputMode="numeric" className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" placeholder="2026" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">سعر افتتاح جرام الذهب عيار 21 بالجنيه</span>
                  <input value={openingPriceForm.gold} onChange={(e) => setOpeningPriceForm(prev => ({ ...prev, gold: e.target.value }))} inputMode="decimal" className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" placeholder="4000" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">سعر افتتاح جرام الفضة بالجنيه</span>
                  <input value={openingPriceForm.silver} onChange={(e) => setOpeningPriceForm(prev => ({ ...prev, silver: e.target.value }))} inputMode="decimal" className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" placeholder="60" />
                </label>
                </div>
                <div className="rounded-2xl border border-[#1a1e2a] bg-[#080a0f] p-3">
                  <div className="mb-3 text-[11px] font-black text-[#ddd8cc]">
                    تكلفة الافتتاح للوحدة — ليست سعر بيع
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {accessoryAccounts.map(account => (
                      <label key={account.id} className="space-y-1">
                        <span className="text-[10px] font-bold text-[#c9a84c]">{account.name}</span>
                        <input
                          value={openingPriceForm.accessories[account.id!] || ''}
                          onChange={(event) => setOpeningPriceForm(previous => ({
                            ...previous,
                            accessories: {
                              ...previous.accessories,
                              [account.id!]: event.target.value,
                            },
                          }))}
                          inputMode="decimal"
                          className="w-full rounded-xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
                          placeholder="غير محدد"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={isSavingOpeningPrice} className="px-5 py-3 bg-[#c9a84c] text-[#080a0f] rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {isSavingOpeningPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ
                </button>
              </form>

              {openingPriceError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl p-3 text-xs font-bold">
                  {openingPriceError}
                </div>
              )}
              {openingPriceSuccess && (
                <div className="whitespace-pre-line rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-xs font-bold text-green-300">
                  {openingPriceSuccess}
                </div>
              )}

              <div className="overflow-x-auto border border-[#1a1e2a] rounded-2xl">
                <table className="w-full text-right text-xs min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[#1a1e2a] [&>th]:p-3 [&>th]:text-[#8a8172]">
                      <th>السنة</th>
                      <th>ذهب 21 بالجنيه</th>
                      <th>فضة بالجنيه</th>
                      <th>{'\u0645\u0644\u062d\u0642\u0627\u062a'}</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1e2a] [&>tr>td]:p-3">
                    {sortedOpeningCostConfig.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-[#8a8172]">لا توجد أسعار افتتاح محفوظة بعد.</td>
                      </tr>
                    ) : sortedOpeningCostConfig.map(row => (
                      <tr key={row.year}>
                        <td className="font-mono font-bold text-[#ddd8cc]">{row.year}</td>
                        <td className="font-mono text-[#ddd8cc]">{formatMinorUnitsToEgpInput(getGoldOpeningPriceMinor(row)) || "-"}</td>
                        <td className="font-mono text-[#ddd8cc]">{formatMinorUnitsToEgpInput(getSilverOpeningPriceMinor(row)) || "-"}</td>
                        <td className="text-[#ddd8cc]">
                          {(() => {
                            const accessoryCosts = getAccessoryOpeningCostsMinorByAccountId(row);
                            const savedAccessories = accessoryAccounts.filter(account => account.id && accessoryCosts[account.id] !== undefined && accessoryCosts[account.id] !== '');
                            if (savedAccessories.length === 0) return <span className="text-[#8a8172]">0</span>;
                            return (
                              <details>
                                <summary className="cursor-pointer font-bold text-[#c9a84c]">{savedAccessories.length} {'\u0645\u062d\u0641\u0648\u0638'}</summary>
                                <div className="mt-2 space-y-1">
                                  {savedAccessories.map(account => (
                                    <div key={account.id} className="flex justify-between gap-3 font-mono text-[10px]">
                                      <span className="font-sans text-[#8a8172]">{account.name}</span>
                                      <span>{formatMinorUnitsToEgpInput(accessoryCosts[account.id!])} {'\u062c.\u0645'}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          })()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleEditOpeningPrice(row)} className="px-3 py-2 bg-[#1a1e2a] text-[#c9a84c] rounded-lg text-[10px] font-bold">تعديل</button>
                            <button type="button" onClick={() => handleDeleteOpeningPrice(Number(row.year))} className="px-3 py-2 bg-red-500/10 text-red-300 rounded-lg text-[10px] font-bold">حذف السنة</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'import' && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-6">
              <div className="pb-6 border-b border-[#1a1e2a] space-y-4">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">تصدير كافة البيانات (CSV)</div>
                  <div className="text-[10px] text-[#5a5548]">تحميل نسخة احتياطية من جميع القيود المسجلة</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleExportData('new')}
                    className="flex-1 py-3 bg-[#1a1e2a] text-[#c9a84c] rounded-xl hover:bg-[#c9a84c22] transition-all text-xs font-bold border border-[#c9a84c22] flex items-center justify-center gap-2"
                  >
                    <FilePlus className="w-4 h-4" />
                    تصدير كملف جديد
                  </button>
                  <button 
                    onClick={() => handleExportData('update')}
                    className="flex-1 py-3 bg-[#c9a84c] text-[#080a0f] rounded-xl hover:bg-[#d4b455] transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#c9a84c22]"
                  >
                    <Save className="w-4 h-4" />
                    تحديث نفس الملف
                  </button>
                </div>
                <div className="text-[9px] text-[#5a5548] italic">* عند استبدال الملف في iCloud، اختر "Keep Both" لملف جديد، أو "Replace" لتحديث الملف الحالي.</div>
              </div>

              <div className="pb-6 border-b border-[#1a1e2a] space-y-4" dir="rtl">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">تصدير تقرير WAC الشامل</div>
                  <div className="text-[10px] text-[#5a5548]">سجل كامل لتكلفة المخزون والتجار ومتوسط التكلفة قبل وبعد الحركات</div>
                </div>
                <button
                  type="button"
                  onClick={handleExportWacAudit}
                  disabled={isGeneratingWacAudit}
                  className="w-full py-3 bg-[#1a1e2a] text-[#c9a84c] rounded-xl hover:bg-[#c9a84c22] transition-all text-xs font-bold border border-[#c9a84c22] flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingWacAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isGeneratingWacAudit ? 'جاري تجهيز تقرير WAC...' : 'تصدير تقرير WAC الشامل'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">مسح كافة البيانات</div>
                  <div className="text-[10px] text-[#5a5548]">سيتم حذف جميع القيود المسجلة نهائياً</div>
                </div>
                {!showDeleteAllConfirm ? (
                  <button 
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="p-3 bg-[#9e6a6a11] text-[#9e6a6a] rounded-2xl hover:bg-[#9e6a6a22] transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowDeleteAllConfirm(false)}
                      className="px-4 py-2 bg-[#1a1e2a] text-[#5a5548] rounded-xl text-[10px] font-bold"
                    >
                      إلغاء
                    </button>
                    <button 
                      onClick={handleDeleteAllData}
                      disabled={isDeletingAll}
                      className="px-4 py-2 bg-[#9e6a6a] text-[#080a0f] rounded-xl text-[10px] font-bold flex items-center gap-2"
                    >
                      {isDeletingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                      تأكيد الحذف
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-[#1a1e2a] space-y-4">
                <div className="text-sm font-bold text-[#ddd8cc]">استيراد بيانات CSV</div>
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="bg-[#080a0f] border-2 border-dashed border-[#1a1e2a] rounded-2xl p-8 text-center group-hover:border-[#c9a84c33] transition-all">
                      <Upload className="w-8 h-8 text-[#5a5548] mx-auto mb-2 group-hover:text-[#c9a84c] transition-colors" />
                      <div className="text-xs text-[#5a5548]">اسحب الملف هنا أو اضغط للاختيار</div>
                      <div className="text-[9px] text-[#5a5548] mt-1">يدعم ملفات CSV فقط</div>
                    </div>
                  </div>
                  
                  {importText && (
                    <div className="space-y-3">
                      <div className="text-[10px] text-[#6a9e6a] flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" /> تم تجهيز {importText.split('\n').length} سطر للاستيراد
                      </div>
                      <button 
                        onClick={handleImport}
                        disabled={isImporting}
                        className="w-full py-4 bg-[#c9a84c] text-[#080a0f] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#c9a84c22]"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        بدء عملية الاستيراد الآن
                      </button>
                    </div>
                  )}

                  {importProgress && (
                    <div className="bg-[#080a0f] p-4 rounded-2xl border border-[#1a1e2a] space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-[#c9a84c]">جاري الاستيراد...</span>
                        <span className="text-[#5a5548]">{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1a1e2a] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#c9a84c] transition-all duration-300" 
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-[9px]">
                        <span className="text-[#6a9e6a]">ناجح: {importProgress.success}</span>
                        <span className="text-[#9e6a6a]">فشل: {importProgress.failed}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-6 border-t border-[#1a1e2a]">
                    <h4 className="text-sm font-bold text-[#ddd8cc] mb-2 flex items-center gap-2">
                       صيانة البيانات وتحديث الترقيم
                    </h4>
                    <div className="p-4 bg-[#6a8a9e11] border border-[#6a8a9e22] rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#6a8a9e]">تحديث أرقام الفواتير للقيود السابقة (تلقائي)</div>
                        <div className="text-[10px] text-[#5a5548] mt-1 pr-1">إضافة أرقام تسلسلية ذكية (مثل S1 و P1) لكل القيود السابقة الخالية من الأرقام.</div>
                      </div>
                      <button 
                        onClick={handleRetroactiveInvoiceNumbers}
                        disabled={isImporting}
                        className="px-4 py-2 bg-[#6a8a9e] text-[#080a0f] text-[10px] font-bold rounded-xl hover:bg-[#5a7a8e] transition-all disabled:opacity-50"
                      >
                        {isImporting ? 'جاري التحديث...' : 'بدء التحديث الآن'}
                      </button>
                    </div>

                    <div className="p-4 bg-[#c9a84c11] border border-[#c9a84c22] rounded-2xl flex items-center justify-between mt-4">
                      <div>
                        <div className="text-xs font-bold text-[#c9a84c]">شاشة جرد ومطابقة المخزون</div>
                        <div className="text-[10px] text-[#5a5548] mt-1 pr-1">مطابقة القائمة الدفترية مع الجرد الفعلي للمحلات وحفظها بالسجلات.</div>
                      </div>
                      <button 
                        onClick={() => useAppStore.getState().setView('inventory')}
                        className="px-4 py-2 bg-[#c9a84c] text-[#0e1018] text-[10px] font-bold rounded-xl hover:bg-[#d4b455] transition-all"
                      >
                        فتح الشاشة
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'rules' && (
          <motion.div
            key="rules"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-8 text-center space-y-6">
              <div className="p-4 bg-[#c9a84c11] rounded-2xl w-20 h-20 mx-auto flex items-center justify-center border border-[#c9a84c22]">
                <BookOpen className="w-10 h-10 text-[#c9a84c]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#ddd8cc] mb-2">إدارة قيود الحسابات</h3>
                <p className="text-xs text-[#5a5548] leading-relaxed">
                  يمكنك الآن إدارة جميع القيود المحاسبية وتوجيه الحسابات (المدين والدائن) وعيارات الذهب من شاشة واحدة متكاملة ومنظمة.
                </p>
              </div>
              <button 
                onClick={() => setView('guide')}
                className="w-full py-4 bg-[#c9a84c] text-[#080a0f] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-[#c9a84c11] active:scale-95 transition-all"
              >
                الدخول لمركز إدارة القيود <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'accounts' && (
          <motion.div
            key="accounts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
             <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-8 text-center space-y-6">
              <div className="p-4 bg-[#6a8a9e11] rounded-2xl w-20 h-20 mx-auto flex items-center justify-center border border-[#6a8a9e22]">
                <LayoutGrid className="w-10 h-10 text-[#6a8a9e]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#ddd8cc] mb-2">شجرة الحسابات والدليل</h3>
                <p className="text-xs text-[#5a5548] leading-relaxed">
                  قم بتنظيم حساباتك (أصول، خصوم، إيرادات...) وإضافة حسابات جديدة للعملاء أو الموردين أو التجار بسهولة من خلال الشجرة الهيكلية.
                </p>
              </div>
              <button 
                onClick={() => setView('guide')}
                className="w-full py-4 bg-[#6a8a9e] text-[#080a0f] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-[#6a8a9e11] active:scale-95 transition-all"
              >
                تعديل شجرة الحسابات <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Info */}
      <section className="space-y-4 pt-8">
        <h3 className="text-xs font-bold text-[#5a5548] uppercase tracking-widest px-2">معلومات النظام</h3>
        <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#5a5548]">إصدار التطبيق</span>
            <span className="text-[#ddd8cc] font-mono">v2.4.1-pro</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#5a5548]">تحديث التطبيق</span>
            <button 
              onClick={() => window.location.reload()}
              className="text-[#c9a84c] underline hover:text-[#d4b455] active:scale-95 transition-all text-[10px]"
            >
              تحديث إجباري الآن
            </button>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#5a5548]">حالة الاتصال</span>
            <span className="flex items-center gap-2 text-[#6a9e6a]">
              <div className="w-1.5 h-1.5 bg-[#6a9e6a] rounded-full animate-pulse" />
              متصل بالخادم
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#5a5548]">المستخدم الحالي</span>
            <span className="text-[#ddd8cc]">{user?.email}</span>
          </div>
        </div>
      </section>
    </motion.div>
  );
});
