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
import { normalizeStoryGoldBuySpreadEgp, parseStoryGoldBuySpreadInput, saveStoryGoldBuySpreadEgp } from '../../lib/storyPricing';
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
import { SettingsTabBar, SettingsTab } from './settings/SettingsTabBar';
import { SettingsRulesPanel } from './settings/SettingsRulesPanel';
import { SettingsCostPanel } from './settings/SettingsCostPanel';
import { SettingsImportExportPanel } from './settings/SettingsImportExportPanel';
import { SettingsAccountsPanel } from './settings/SettingsAccountsPanel';
import { SettingsSystemInfo } from './settings/SettingsSystemInfo';

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
    storyGoldBuySpreadEgp,
    setStoryGoldBuySpreadEgp,
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
  const [storySpreadForm, setStorySpreadForm] = useState(() => String(normalizeStoryGoldBuySpreadEgp(storyGoldBuySpreadEgp)));
  const [storySpreadError, setStorySpreadError] = useState('');
  const [storySpreadSuccess, setStorySpreadSuccess] = useState('');
  const [isSavingStorySpread, setIsSavingStorySpread] = useState(false);
  const [pricingConfigForm, setPricingConfigForm] = useState<GoldPricingConfig>(() => normalizeGoldPricingConfig(pricingConfig));
  const [smartMarginForm, setSmartMarginForm] = useState<SmartMarginSettings>(() => normalizeSmartMarginSettings(smartMarginSettings));
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isGeneratingWacAudit, setIsGeneratingWacAudit] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('rules');

  useEffect(() => {
    const normalized = normalizeGoldSaleTaxStampPerGramEgp(goldSaleTaxStampPerGramEgp);
    setSalePricingForm({ rate18: String(normalized[18]), rate21: String(normalized[21]) });
  }, [goldSaleTaxStampPerGramEgp]);
  useEffect(() => setPricingConfigForm(normalizeGoldPricingConfig(pricingConfig)), [pricingConfig]);
  useEffect(() => setSmartMarginForm(normalizeSmartMarginSettings(smartMarginSettings)), [smartMarginSettings]);
  useEffect(() => setStorySpreadForm(String(normalizeStoryGoldBuySpreadEgp(storyGoldBuySpreadEgp))), [storyGoldBuySpreadEgp]);

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
  const saveStorySpread = async () => {
    setStorySpreadError('');
    setStorySpreadSuccess('');
    const next = parseStoryGoldBuySpreadInput(storySpreadForm);
    if (next === null) {
      setStorySpreadError('أدخل فرقاً صحيحاً غير سالب، ويمكن أن يكون صفرًا.');
      return;
    }
    if (!user?.uid) {
      setStorySpreadError('لا يوجد مستخدم نشط لحفظ الإعدادات.');
      return;
    }
    setIsSavingStorySpread(true);
    try {
      await saveStoryGoldBuySpreadEgp(user.uid, next);
      setStoryGoldBuySpreadEgp(next);
      setStorySpreadSuccess('تم حفظ فرق شراء الستوري.');
    } catch {
      setStorySpreadError('تعذر حفظ فرق شراء الستوري.');
    } finally {
      setIsSavingStorySpread(false);
    }
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

      <SettingsTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <AnimatePresence mode="wait">
        {activeTab === 'cost' && (
          <SettingsCostPanel salePricingForm={salePricingForm} salePricingError={salePricingError} salePricingSuccess={salePricingSuccess} isSavingSalePricing={isSavingSalePricing} onSalePricingRateChange={(field,value)=>setSalePricingForm(previous=>({...previous,[field]:normalizeNumerals(value)}))} onSaveSalePricing={handleSaveSalePricing} storySpreadForm={storySpreadForm} storySpreadError={storySpreadError} storySpreadSuccess={storySpreadSuccess} isSavingStorySpread={isSavingStorySpread} onStorySpreadChange={value=>setStorySpreadForm(normalizeNumerals(value))} onSaveStorySpread={saveStorySpread} smartMarginForm={smartMarginForm} onSmartMarginChange={(field,value)=>setSmartMarginForm(previous=>({...previous,[field]:value}))} onSaveSmartMargin={saveSmartMarginSettings} pricingConfigForm={pricingConfigForm} isSavingPricingConfig={isSavingSalePricing} onUnitWorkmanshipChange={(field,unitWeight,mode,value)=>setPricingConfigForm(previous=>({...previous,[field]:{...previous[field],[String(unitWeight)]:{mode,value:Math.max(0,Number(normalizeNumerals(value))||0)}}}))} onJewelryDefaultChange={setJewelryDefault} onPurchaseDefaultChange={setPurchaseDefault} onSavePricingConfig={savePricingConfig} openingPriceForm={openingPriceForm} openingPriceError={openingPriceError} openingPriceSuccess={openingPriceSuccess} isSavingOpeningPrice={isSavingOpeningPrice} sortedOpeningCostConfig={sortedOpeningCostConfig} accessoryAccounts={accessoryAccounts} onOpeningYearChange={value=>setOpeningPriceForm(previous=>({...previous,year:value}))} onOpeningGoldChange={value=>setOpeningPriceForm(previous=>({...previous,gold:value}))} onOpeningSilverChange={value=>setOpeningPriceForm(previous=>({...previous,silver:value}))} onOpeningAccessoryChange={(accountId,value)=>setOpeningPriceForm(previous=>({...previous,accessories:{...previous.accessories,[accountId]:value}}))} onSaveOpeningPrice={handleSaveOpeningPrice} onEditOpeningPrice={handleEditOpeningPrice} onDeleteOpeningPrice={handleDeleteOpeningPrice} />
        )}

        {activeTab === 'import' && (
          <SettingsImportExportPanel importText={importText} importProgress={importProgress} isImporting={isImporting} isDeletingAll={isDeletingAll} isGeneratingWacAudit={isGeneratingWacAudit} showDeleteAllConfirm={showDeleteAllConfirm} onExportNew={() => handleExportData('new')} onExportUpdate={() => handleExportData('update')} onExportWacAudit={handleExportWacAudit} onRequestDeleteAll={() => setShowDeleteAllConfirm(true)} onCancelDeleteAll={() => setShowDeleteAllConfirm(false)} onConfirmDeleteAll={handleDeleteAllData} onFileUpload={handleFileUpload} onImport={handleImport} onRetroactiveInvoiceNumbers={handleRetroactiveInvoiceNumbers} onOpenInventory={() => setView('inventory')} />
        )}

        {activeTab === 'rules' && <SettingsRulesPanel onOpenGuide={() => setView('guide')} />}

        {activeTab === 'accounts' && <SettingsAccountsPanel onOpenGuide={() => setView('guide')} />}
      </AnimatePresence>

      <SettingsSystemInfo email={user?.email} onReload={() => window.location.reload()} />
    </motion.div>
  );
});
