import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  BookOpen,
  LayoutGrid,
  Save,
  FilePlus,
  Code
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  writeBatch 
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { db, OperationType, handleFirestoreError } from '../../firebase';
import { Entry, CustomRule, AnnualOpeningCostConfig } from '../../types';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { formatMinorUnitsToEgpInput, parseEgpToMinorUnits } from '../../lib/openingCostConfig';
import { areOperationWritesLocked } from '../../lib/costRecalculation';

export const SettingsView = React.memo(() => {
  const { setView, customRules, user, entries, accountsDb, setGlobalError, openingCostConfig, setOpeningCostConfig, costCalculationRun } = useAppStore();
  const operationWritesLocked = areOperationWritesLocked(costCalculationRun);
  const [newRule, setNewRule] = useState({ t: '', d: '', c: '', k: '', m: '1' });
  const [openingPriceForm, setOpeningPriceForm] = useState<{
    year: string;
    gold: string;
    silver: string;
    accessories: Record<string, string>;
  }>({ year: String(new Date().getFullYear()), gold: '', silver: '', accessories: {} });
  const [openingPriceError, setOpeningPriceError] = useState('');
  const [isSavingOpeningPrice, setIsSavingOpeningPrice] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'cost' | 'import' | 'accounts'>('rules');

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

  const validateOpeningPriceForm = (): AnnualOpeningCostConfig => {
    const year = Number(openingPriceForm.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error('أدخل سنة صحيحة بين 2000 و 2100.');
    }

    const next: AnnualOpeningCostConfig = { year };
    const gold = openingPriceForm.gold.trim();
    const silver = openingPriceForm.silver.trim();
    const accessoryValues: Record<string, string> = Object.fromEntries(
      (Object.entries(openingPriceForm.accessories) as Array<[string, string]>)
        .map(([accountId, value]) => [accountId, value.trim()])
        .filter(([, value]) => !!value),
    ) as Record<string, string>;
    if (!gold && !silver && Object.keys(accessoryValues).length === 0) {
      throw new Error('أدخل قيمة Opening Cost واحدة على الأقل.');
    }
    if (gold) {
      let goldMinor: number;
      try {
        goldMinor = parseEgpToMinorUnits(gold);
      } catch {
        throw new Error('سعر افتتاح الذهب يجب أن يكون رقمًا صحيحًا أو عشريًا حتى قرشين.');
      }
      if (goldMinor <= 0) throw new Error('سعر افتتاح الذهب يجب أن يكون أكبر من صفر.');
      next.gold21PriceMinorPerGram = goldMinor;
    }
    if (silver) {
      let silverMinor: number;
      try {
        silverMinor = parseEgpToMinorUnits(silver);
      } catch {
        throw new Error('سعر افتتاح الفضة يجب أن يكون رقمًا صحيحًا أو عشريًا حتى قرشين.');
      }
      if (silverMinor <= 0) throw new Error('سعر افتتاح الفضة يجب أن يكون أكبر من صفر.');
      next.silverPriceMinorPerGram = silverMinor;
    }
    if (Object.keys(accessoryValues).length > 0) {
      next.accessoryUnitCostMinorByAccountId = {};
      for (const [accountId, value] of Object.entries(accessoryValues)) {
        let minor: number;
        try {
          minor = parseEgpToMinorUnits(value);
        } catch {
          throw new Error(`تكلفة افتتاح الملحق ${accountId} يجب أن تكون رقمًا حتى قرشين.`);
        }
        if (minor <= 0) throw new Error(`تكلفة افتتاح الملحق ${accountId} يجب أن تكون أكبر من صفر.`);
        next.accessoryUnitCostMinorByAccountId[accountId] = minor;
      }
    }
    return next;
  };

  const persistOpeningCostConfig = async (nextConfig: AnnualOpeningCostConfig[]) => {
    if (!user?.uid) throw new Error('لا يوجد مستخدم نشط لحفظ الإعدادات.');
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
    setIsSavingOpeningPrice(true);
    try {
      const nextRow = validateOpeningPriceForm();
      const nextConfig = sortedOpeningCostConfig.filter(row => Number(row.year) !== nextRow.year);
      await persistOpeningCostConfig([...nextConfig, nextRow]);
      setOpeningPriceForm({ year: String(nextRow.year + 1), gold: '', silver: '', accessories: {} });
    } catch (error) {
      setOpeningPriceError(error instanceof Error ? error.message : 'تعذر حفظ سعر الافتتاح. راجع القيم المدخلة.');
    } finally {
      setIsSavingOpeningPrice(false);
    }
  };

  const handleEditOpeningPrice = (row: AnnualOpeningCostConfig) => {
    setOpeningPriceError('');
    setOpeningPriceForm({
      year: String(row.year),
      gold: formatMinorUnitsToEgpInput(row.gold21PriceMinorPerGram),
      silver: formatMinorUnitsToEgpInput(row.silverPriceMinorPerGram),
      accessories: Object.fromEntries(
        Object.entries(row.accessoryUnitCostMinorByAccountId || {})
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

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.t || !newRule.d || !newRule.c) return;
    try {
      await addDoc(collection(db, 'customRules'), {
        ...newRule,
        k: newRule.k ? parseInt(newRule.k) : null,
        m: parseFloat(newRule.m),
        userId: user.uid
      });
      setNewRule({ t: '', d: '', c: '', k: '', m: '1' });
    } catch (error) {
      console.error("Add Rule Error:", error);
      setGlobalError("فشل إضافة القاعدة. يرجى مراجعة الاتصال.");
    }
  };

  const [deleteRuleConfirmId, setDeleteRuleConfirmId] = useState<string | null>(null);

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customRules', id));
      setDeleteRuleConfirmId(null);
    } catch (error) {
      console.error("Delete Rule Error:", error);
      setGlobalError("فشل حذف القاعدة.");
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

  const [isExportingCode, setIsExportingCode] = useState(false);

  const handleExportCode = async () => {
    setIsExportingCode(true);
    try {
      const response = await fetch('/api/export-code');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gold-app-source-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export Code Error:", error);
      alert("فشل تصدير الكود. تأكد من اتصالك بالإنترنت.");
    } finally {
      setIsExportingCode(false);
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

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "القيود");

    const fileName = mode === 'update' 
      ? 'mecca_gold_backup.xlsx' 
      : `makkah_gold_all_data_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    reader.onload = (event) => {
      if (isExcel) {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];
        const csvLines = json.map(row => row.map(cell => String(cell || "")).join(','));
        setImportText(csvLines.join('\n'));
      } else {
        const text = event.target?.result as string;
        setImportText(text);
      }
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
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
      const lines = importText.split(/\r?\n/).filter(l => l.trim());
      const total = lines.length;
      let success = 0;
      let failed = 0;
      
      setImportProgress({ current: 0, total, success: 0, failed: 0 });

      const firstLine = lines[0];
      let delimiter = ',';
      const counts = {
        ',': (firstLine.match(/,/g) || []).length,
        '\t': (firstLine.match(/\t/g) || []).length,
        ';': (firstLine.match(/;/g) || []).length
      };
      
      if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) delimiter = '\t';
      else if (counts[';'] > counts[','] && counts[';'] > counts['\t']) delimiter = ';';

      for (let i = 0; i < lines.length; i++) {
        try {
          const parts = lines[i].split(delimiter).map(p => p.trim());
          if (parts.length < 4) { failed++; continue; }
          
          const [date, tx, debit, credit, cash, weight, notes, karat, count, arabicWeight, multiplier] = parts;
          
          await addDoc(collection(db, 'entries'), {
            date: date || "",
            tx: tx || "",
            debit: debit || "",
            credit: credit || "",
            cash: cash || "0",
            weight: weight || "0",
            notes: notes || "",
            karat: karat ? parseInt(karat) : null,
            count: count || "0",
            arabicWeight: arabicWeight || "0",
            multiplier: multiplier ? parseFloat(multiplier) : null,
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
            <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#ddd8cc]">أسعار الافتتاح السنوية للتكلفة</h3>
                <p className="text-[11px] text-[#8a8172] leading-6">
                  تُستخدم هذه الأسعار فقط لتحديد تكلفة المخزون الافتتاحي وحساب متوسط التكلفة. لا تُستخدم كتقييم سوقي حالي.
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

              <div className="overflow-x-auto border border-[#1a1e2a] rounded-2xl">
                <table className="w-full text-right text-xs min-w-[620px]">
                  <thead>
                    <tr className="border-b border-[#1a1e2a] [&>th]:p-3 [&>th]:text-[#8a8172]">
                      <th>السنة</th>
                      <th>ذهب 21 بالجنيه</th>
                      <th>فضة بالجنيه</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1e2a] [&>tr>td]:p-3">
                    {sortedOpeningCostConfig.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-[#8a8172]">لا توجد أسعار افتتاح محفوظة بعد.</td>
                      </tr>
                    ) : sortedOpeningCostConfig.map(row => (
                      <tr key={row.year}>
                        <td className="font-mono font-bold text-[#ddd8cc]">{row.year}</td>
                        <td className="font-mono text-[#ddd8cc]">{formatMinorUnitsToEgpInput(row.gold21PriceMinorPerGram) || "-"}</td>
                        <td className="font-mono text-[#ddd8cc]">{formatMinorUnitsToEgpInput(row.silverPriceMinorPerGram) || "-"}</td>
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
                  <div className="text-sm font-bold text-[#ddd8cc]">تصدير كافة البيانات (Excel)</div>
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

              <div className="pb-6 border-b border-[#1a1e2a] space-y-4">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">تصدير الكود البرمجي (ZIP)</div>
                  <div className="text-[10px] text-[#5a5548]">تحميل نسخة كاملة من كود الأبليكشن بصيغة ZIP</div>
                </div>
                <button 
                  onClick={handleExportCode}
                  disabled={isExportingCode}
                  className="w-full py-4 bg-[#1a1e2a] text-[#ddd8cc] rounded-2xl hover:bg-[#1a1e2a]/80 transition-all text-sm font-bold border border-[#1a1e2a] flex items-center justify-center gap-3 active:scale-95"
                >
                  {isExportingCode ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Code className="w-5 h-5 text-[#c9a84c]" />
                  )}
                  {isExportingCode ? 'جاري تجهيز الملف...' : 'تحميل كود الأبليكشن كاملاً'}
                </button>
                <div className="p-3 bg-blue-500/05 border border-blue-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-[#6a8a9e] text-[10px] font-bold">
                    <Info className="w-3 h-3" />
                    <span>للعلم: يمكنك دائماً تحميل الكود من واجهة AI Studio</span>
                  </div>
                  <p className="text-[9px] text-[#5a5548] leading-relaxed pr-5">
                    اضغط على أيقونة الإعدادات (الترس ⚙️) في أعلى يمين شاشة AI Studio، ثم اختر "Download as ZIP" للحصول على النسخة الأصلية دائماً.
                  </p>
                </div>
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
                <div className="text-sm font-bold text-[#ddd8cc]">استيراد بيانات (Excel/CSV)</div>
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="bg-[#080a0f] border-2 border-dashed border-[#1a1e2a] rounded-2xl p-8 text-center group-hover:border-[#c9a84c33] transition-all">
                      <Upload className="w-8 h-8 text-[#5a5548] mx-auto mb-2 group-hover:text-[#c9a84c] transition-colors" />
                      <div className="text-xs text-[#5a5548]">اسحب الملف هنا أو اضغط للاختيار</div>
                      <div className="text-[9px] text-[#5a5548] mt-1">يدعم ملفات Excel و CSV</div>
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
