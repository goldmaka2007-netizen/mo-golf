import { formatWeight } from '../../lib/formatting';
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Plus, CheckCircle2, History, X, Save, Scale, Package, ArrowRightLeft, Download, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAppStore } from '../../store';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { cn } from '../../lib/utils';
import { parseWeight } from '../../lib/accounting';
import { getMetricValue, getDynamicAccountNature, getMetricActualValue } from '../../utils/accountLogic';
import { AccountNature, InventoryCheck, OperationType } from '../../types';
import { downloadCsv } from '../../utils/csv';
import { FormInput } from '../ui/FormInput';
import { areOperationWritesLocked } from '../../lib/costRecalculation';
import {
  buildInventoryAdjustmentDraftEntry,
  calculateInventoryCheckDiff,
  effectiveInventoryCheckStatus,
  findAccountByCheck,
  prepareEntryForCentralSave,
  statusForInventoryCheck,
} from '../../lib/inventoryCheckSettlement';

const HistoryCard = React.memo(({
  item,
  editingId,
  editW,
  editC,
  setEditW,
  setEditC,
  startEdit,
  handleQuickUpdate,
  setEditingId,
  createAdjustmentEntry,
  handleDelete,
  updateLoading,
  adjustLoading
}: {
  item: any;
  editingId: string | null;
  editW: string;
  editC: string;
  setEditW: (v: string) => void;
  setEditC: (v: string) => void;
  startEdit: (v: any) => void;
  handleQuickUpdate: (id: string) => void;
  setEditingId: (id: string | null) => void;
  createAdjustmentEntry: (v: any) => void;
  handleDelete: (id: string) => void;
  updateLoading: boolean;
  adjustLoading: string | null;
}) => {
  const { id, check, matchingEntry, isGold, isAcc, status, weightDiff, countDiff } = item;
  const isPosted = status === 'posted';
  
  const calculateDiffColor = (expected: number, actual: number) => {
    const diff = actual - expected;
    if (Math.abs(diff) < 0.001) return 'text-[#6a9e6a]';
    return diff > 0 ? 'text-[#6a8a9e]' : 'text-red-500';
  };

  return (
    <div key={id} className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-5 hover:border-[#c9a84c33] transition-all relative group overflow-hidden">
      <div className={cn(
        "absolute top-0 right-0 w-1.5 h-full transition-all",
        isGold ? "bg-[#c9a84c]" : "bg-[#6a8a9e]"
      )} />
      
      <div className="flex justify-between items-start mb-3 border-b border-[#1a1e2a]/50 pb-3">
        <div className="flex flex-col gap-1">
          <div className="text-base font-bold text-[#c9a84c]">{check.accountId}</div>
          <div className="text-xs text-[#5a5548] font-mono">
             {(() => {
                try {
                  const parts = check.date.split('-');
                  const y = parseInt(parts[0]) || new Date().getFullYear();
                  const m = parseInt(parts[1]) || 1;
                  const d = parseInt(parts[2]) || 1;
                  return format(new Date(y, m - 1, d), 'dd MMMM yyyy (EE)', { locale: ar });
                } catch {
                  return check.date;
                }
              })()} | {check.createdAt && check.createdAt.toDate ? format(check.createdAt.toDate(), 'hh:mm a') : ''}
          </div>
        </div>
        <button disabled={isPosted} onClick={() => handleDelete(check.id!)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-6">
        {!isAcc && (
          <div className="flex-1 space-y-2">
            <div className="text-xs text-[#5a5548] bg-[#1a1e2a] px-2 py-0.5 rounded-lg w-fit">الوزن</div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#ddd8cc]">دفتري: <span className="font-mono">{check.systemWeight.toFixed(2)}</span></span>
              <ArrowRightLeft className="w-4 h-4 text-[#3a3530]" />
              {editingId === check.id ? (
                <input
                  type="number"
                  step="0.01"
                  value={editW}
                  onChange={e => setEditW(e.target.value)}
                  className="w-24 bg-[#080a0f] border border-[#c9a84c] rounded-lg px-2 py-1 text-sm text-[#c9a84c] font-mono outline-none"
                  autoFocus
                />
              ) : (
                <span className="text-[#c9a84c]">فعلي: <span className="font-mono">{check.actualWeight.toFixed(2)}</span></span>
              )}
            </div>
            <div className={cn("text-xs font-bold font-mono text-center pt-1 border-t border-[#1a1e2a]/50", calculateDiffColor(check.systemWeight, editingId === check.id ? (parseFloat(editW) || 0) : check.actualWeight))}>
              الفرق: {((editingId === check.id ? (parseFloat(editW) || 0) : check.actualWeight) - check.systemWeight).toFixed(2)}
            </div>
          </div>
        )}

        {(isAcc || check.systemCount > 0 || check.actualCount > 0) && (
          <div className="flex-1 space-y-2">
            <div className="text-xs text-[#5a5548] bg-[#1a1e2a] px-2 py-0.5 rounded-lg w-fit">العدد / القطع</div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#ddd8cc]">دفتري: <span className="font-mono">{check.systemCount.toFixed(0)}</span></span>
              <ArrowRightLeft className="w-4 h-4 text-[#3a3530]" />
              {editingId === check.id ? (
                <input
                  type="number"
                  step="1"
                  value={editC}
                  onChange={e => setEditC(e.target.value)}
                  className="w-24 bg-[#080a0f] border border-[#c9a84c] rounded-lg px-2 py-1 text-sm text-[#c9a84c] font-mono outline-none"
                />
              ) : (
                <span className="text-[#c9a84c]">فعلي: <span className="font-mono">{check.actualCount.toFixed(0)}</span></span>
              )}
            </div>
            <div className={cn("text-xs font-bold font-mono text-center pt-1 border-t border-[#1a1e2a]/50", calculateDiffColor(check.systemCount, editingId === check.id ? (parseFloat(editC) || 0) : check.actualCount))}>
              الفرق: {((editingId === check.id ? (parseFloat(editC) || 0) : check.actualCount) - check.systemCount).toFixed(0)}
            </div>
          </div>
        )}
      </div>

      {check.notes && (
        <div className="mt-3 pt-3 border-t border-[#1a1e2a]/50 text-xs text-[#5a5548] italic">
          « {check.notes} »
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {editingId === id ? (
          <>
            <button
              onClick={() => handleQuickUpdate(check.id!)}
              disabled={updateLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#6a9e6a] text-[#080a0f] rounded-xl text-xs font-bold hover:bg-[#7aaf7a] transition-all"
            >
              {updateLoading ? 'جاري الحفظ...' : <><Save className="w-4 h-4" /> حفظ التعديل</>}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="px-4 py-2 bg-[#1a1e2a] text-[#5a5548] rounded-xl text-xs font-bold hover:text-[#ddd8cc] transition-all"
            >
              إلغاء
            </button>
          </>
        ) : (
          <>
            {(() => {
              const hasNoDiff = Math.abs(weightDiff) < 0.001 && Math.abs(countDiff) < 0.001;
              return (
                <button
                  onClick={() => createAdjustmentEntry(check)}
                  disabled={adjustLoading === id || isPosted || !!matchingEntry || (hasNoDiff && !matchingEntry)}
                  className={cn(
                    "flex-[2] flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border disabled:opacity-70",
                    (isPosted || !!matchingEntry)
                      ? "bg-[#6a9e6a]/10 text-[#6a9e6a] border-[#6a9e6a]/30 cursor-default" 
                      : hasNoDiff
                        ? "bg-[#1a1e2a] text-[#5a5548] border-transparent cursor-default"
                        : "bg-[#c9a84c]/10 text-[#c9a84c] border-[#c9a84c]/20 hover:bg-[#c9a84c]/20"
                  )}
                >
                  {adjustLoading === id ? (
                    <span className="animate-pulse">جاري...</span>
                  ) : (isPosted || !!matchingEntry) ? (
                    <><CheckCircle2 className="w-4 h-4" /> تم الترحيل</>
                  ) : hasNoDiff ? (
                    "لا يوجد فرق للتسوية"
                  ) : (
                    <><CheckSquare className="w-4 h-4" /> ترحيل كتسوية</>
                  )}
                </button>
              );
            })()}
            {!isPosted && <button
              onClick={() => startEdit(check)}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1a1e2a] text-[#5a5548] rounded-xl text-xs font-bold hover:text-[#ddd8cc] transition-all border border-transparent hover:border-[#3a3a3a]"
            >
              <Plus className="w-4 h-4 rotate-45" /> تعديل
            </button>}
          </>
        )}
      </div>
    </div>
  );
});

export const InventoryCheckView = React.memo(() => {
  const { entries, accountCategories, inventoryChecks, user, accountsDb, setGlobalError, costCalculationRun, openingCostConfig, canonicalAccounts } = useAppStore();
  const operationWritesLocked = areOperationWritesLocked(costCalculationRun);
  
  // UI States
  const [selectedAcc, setSelectedAcc] = useState('');
  const [actualWeight, setActualWeight] = useState('');
  const [actualCount, setActualCount] = useState('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  
  // Loading States
  const [saveLoading, setSaveLoading] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Quick Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editW, setEditW] = useState('');
  const [editC, setEditC] = useState('');
  
  // Combine asset items that can hold physical inventory
  const inventoryAccounts = useMemo(() => {
    // Define helper to get rank for sorting
    const getRank = (accName: string) => {
      const acc = accountsDb.find(a => a.name === accName);
      const nature = acc ? acc.balanceNature : (
        accountCategories?.assets?.['مخزون ذهب']?.includes(accName) ? 'جرام ذهب' :
        accountCategories?.assets?.['مخزون فضة']?.includes(accName) ? 'جرام فضة' : 'قطعة'
      );
      
      if (nature.includes('ذهب')) return 1;
      if (nature.includes('فضة')) return 2;
      return 3; // Pieces/Accessories
    };

    // Priority 1: Accounts from accountsDb
    let accounts: string[] = [];
    if (accountsDb && accountsDb.length > 0) {
      accounts = accountsDb
        .filter(acc => 
          acc.mainType === 'اصول' && 
          (acc.balanceNature.includes('ذهب') || 
           acc.balanceNature.includes('فضة') || 
           acc.balanceNature.includes('قطعة'))
        )
        .map(acc => acc.name);
    } else {
      // Priority 2: Fallback
      const assets = accountCategories?.assets || {};
      if (assets['مخزون ذهب']) accounts.push(...assets['مخزون ذهب']);
      if (assets['مخزون فضة']) accounts.push(...assets['مخزون فضة']);
      if (assets['مخزون ملحقات اضافية']) accounts.push(...assets['مخزون ملحقات اضافية']);
      accounts = Array.from(new Set(accounts));
    }

    return accounts.sort((a, b) => getRank(a) - getRank(b) || a.localeCompare(b));
  }, [accountCategories, accountsDb]);

  // Helper to determine if an account is gold/silver/acc for history rendering
  const getIsGold = useCallback((accName: string) => {
    const acc = accountsDb.find(a => a.name === accName);
    if (acc) return acc.balanceNature.includes('ذهب');
    return (accountCategories?.assets?.['مخزون ذهب'] || []).includes(accName);
  }, [accountsDb, accountCategories]);

  const getIsSilver = useCallback((accName: string) => {
    const acc = accountsDb.find(a => a.name === accName);
    if (acc) return acc.balanceNature.includes('فضة');
    return (accountCategories?.assets?.['مخزون فضة'] || []).includes(accName);
  }, [accountsDb, accountCategories]);

  const getIsAcc = useCallback((accName: string) => {
    const acc = accountsDb.find(a => a.name === accName);
    if (acc) return acc.balanceNature.includes('قطعة');
    return (accountCategories?.assets?.['مخزون ملحقات اضافية'] || []).includes(accName);
  }, [accountsDb, accountCategories]);

  const handleQuickUpdate = useCallback(async (id: string) => {
    const existing = inventoryChecks.find(check => check.id === id);
    if (existing && effectiveInventoryCheckStatus(existing) === 'posted') {
      setGlobalError('لا يمكن تعديل جرد تم ترحيله.');
      return;
    }
    setUpdateLoading(true);
    try {
      const actualWeightValue = parseFloat(editW) || 0;
      const actualCountValue = parseFloat(editC) || 0;
      const diff = calculateInventoryCheckDiff({
        systemWeight: existing?.systemWeight || 0,
        actualWeight: actualWeightValue,
        systemCount: existing?.systemCount || 0,
        actualCount: actualCountValue,
      });
      await updateDoc(doc(db, 'inventory_checks', id), {
        actualWeight: actualWeightValue,
        actualCount: actualCountValue,
        weightDiff: diff.weightDiff,
        countDiff: diff.countDiff,
        status: diff.hasDiff ? 'draft' : 'matched',
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inventory_checks');
    } finally {
      setUpdateLoading(false);
    }
  }, [editW, editC, inventoryChecks, setGlobalError]);

  const startEdit = useCallback((check: InventoryCheck) => {
    setEditingId(check.id!);
    setEditW(check.actualWeight.toString());
    setEditC(check.actualCount.toString());
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const existing = inventoryChecks.find(check => check.id === id);
    if (existing && effectiveInventoryCheckStatus(existing) === 'posted') {
      setGlobalError('لا يمكن حذف جرد تم ترحيله.');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا الجرد؟')) return;
    try {
      await deleteDoc(doc(db, 'inventory_checks', id));
    } catch (error) {
       console.error("Inventory check delete error:", error);
       alert("فشل حذف الجرد.");
    }
  }, [inventoryChecks, setGlobalError]);

  const createAdjustmentEntry = useCallback(async (check: InventoryCheck) => {
    if (operationWritesLocked) {
      setGlobalError('لا يمكن إنشاء تسوية مخزون أثناء تشغيل أو فشل إعادة احتساب التكلفة.');
      return;
    }
    if (!check.id) {
      setGlobalError('لا يمكن ترحيل جرد غير محفوظ.');
      return;
    }
    if (effectiveInventoryCheckStatus(check) === 'posted') {
      setGlobalError('تم ترحيل هذا الجرد من قبل.');
      return;
    }
    setAdjustLoading(check.id || null);
    try {
      const draft = buildInventoryAdjustmentDraftEntry({
        check,
        accountsDb,
        entries,
        userId: user!.uid,
      });
      if (!draft.ok) {
        setGlobalError(draft.message);
        return;
      }
      const prepared = prepareEntryForCentralSave({
        entry: draft.entry,
        entries,
        accountsDb,
        openingCostConfig,
        canonicalAccounts,
      });
      if (!prepared.ok) {
        setGlobalError(prepared.message);
        return;
      }

      const checkRef = doc(db, 'inventory_checks', check.id);
      const entryRef = doc(collection(db, 'entries'));
      const auditRef = doc(collection(db, 'audit_logs'));
      await runTransaction(db, async transaction => {
        const currentCheck = await transaction.get(checkRef);
        if (!currentCheck.exists()) throw new Error('جرد غير موجود.');
        const current = { id: currentCheck.id, ...currentCheck.data() } as InventoryCheck;
        if (effectiveInventoryCheckStatus(current) === 'posted' || current.postedEntryId) {
          throw new Error('تم ترحيل هذا الجرد من قبل.');
        }
        transaction.set(entryRef, {
          ...prepared.entry,
          createdAt: serverTimestamp(),
        });
        transaction.update(checkRef, {
          status: 'posted',
          isResolved: true,
          postedEntryId: entryRef.id,
          postedAt: serverTimestamp(),
          postedBy: user!.uid,
          updatedAt: serverTimestamp(),
        });
        transaction.set(auditRef, {
          action: 'inventory_check_posted',
          collection: 'entries',
          documentId: entryRef.id,
          inventoryCheckId: check.id,
          userId: user!.uid,
          userEmail: user?.email || '',
          timestamp: serverTimestamp(),
        });
      });
      return;

    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'entries');
    } finally {
      setAdjustLoading(null);
    }
  }, [user, operationWritesLocked, setGlobalError, accountsDb, entries, openingCostConfig, canonicalAccounts]);

  const exportHistory = () => {
    if (inventoryChecks.length === 0) return;
    
    const data = inventoryChecks.map(check => ({
      'الحساب': check.accountId,
      'التاريخ': check.date,
      'الوزن الدفتري': check.systemWeight.toFixed(2),
      'الوزن الفعلي': check.actualWeight.toFixed(2),
      'الفرق بالوزن': (check.actualWeight - check.systemWeight).toFixed(2),
      'الالعدد الدفتري': check.systemCount.toFixed(0),
      'العدد الفعلي': check.actualCount.toFixed(0),
      'الفرق بالعدد': (check.actualCount - check.systemCount).toFixed(0),
      'الملاحظات': check.notes || '-'
    }));

    downloadCsv(data, `inventory_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  // Derive system's expected balance for the selected account
  const systemState = useMemo(() => {
    if (!selectedAcc) return { weight: 0, count: 0, type: 'unknown' };
    
    const nature = getDynamicAccountNature(selectedAcc, accountsDb);
    const isGold = [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(nature);
    const isSilver = [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(nature);
    const isAcc = nature === AccountNature.ACC;
    
    let sysW = 0;
    let sysC = 0;
    
    // Choose the correct metric for calculation
    const metric = isGold ? 'gold' : isSilver ? 'silver' : isAcc ? 'accs' : null;
    
    let karatMap: Record<number, number> = {};

    entries.forEach(e => {
      if (metric) {
        // For Inventory Check, we need ACTUAL weight/count to match the scale/physical items
        let val = 0;
        if (metric === 'gold' || metric === 'silver' || metric === 'accs') {
          val = getMetricActualValue(e, metric as any, accountsDb);
        } else {
          val = getMetricValue(e, metric!, accountsDb);
        }
        
        const countValue = isAcc ? (parseWeight(e.weight) || parseFloat(e.count || '0') || 0) : (parseFloat(e.count || '0') || 0);
        
        if (e.debit === selectedAcc) {
          sysW += val;
          sysC += countValue;
          if (isGold && e.karat) karatMap[e.karat] = (karatMap[e.karat] || 0) + parseWeight(e.weight);
        }
        if (e.credit === selectedAcc) {
          sysW -= val;
          sysC -= countValue;
          if (isGold && e.karat) karatMap[e.karat] = (karatMap[e.karat] || 0) - parseWeight(e.weight);
        }
      }
    });

    return { 
      weight: sysW, 
      count: sysC, 
      karats: karatMap,
      type: isGold ? 'gold' : isSilver ? 'silver' : isAcc ? 'acc' : 'unknown'
    };
  }, [selectedAcc, entries, accountsDb]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedAcc) return;
    
    const w = parseFloat(actualWeight || '0');
    const c = parseFloat(actualCount || '0');
    
    if (isNaN(w) && isNaN(c)) return;

    setSaveLoading(true);
    
    const data: InventoryCheck = {
      accountId: selectedAcc,
      accountDbId: findAccountByCheck({ accountId: selectedAcc } as InventoryCheck, accountsDb)?.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      systemWeight: systemState.weight,
      actualWeight: w,
      systemCount: systemState.count,
      actualCount: c,
      weightDiff: w - systemState.weight,
      countDiff: c - systemState.count,
      status: statusForInventoryCheck({
        systemWeight: systemState.weight,
        actualWeight: w,
        systemCount: systemState.count,
        actualCount: c,
      }),
      notes: notes.trim(),
      userId: user.uid,
    };

    // Optimistically update UI
    setActualWeight('');
    setActualCount('');
    setNotes('');
    setShowHistory(true);
    setSaveLoading(false);

    try {
      await addDoc(collection(db, 'inventory_checks'), {
        ...data,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Inventory check save error:", error);
      alert("تنبيه: فشل حفظ الجرد في السيرفر. سيتم المحاولة تلقائياً.");
    }
  };

  const calculateDiffColor = (expected: number, actual: number) => {
    const diff = actual - expected;
    if (Math.abs(diff) < 0.001) return 'text-[#6a9e6a]'; // Perfect match
    return diff > 0 ? 'text-[#6a8a9e]' : 'text-red-500'; // Positive diff (blue-ish), Negative diff (red)
  };

  // Helper to safely parse dates for sorting and display
  const safeParseDate = (dateStr: string | undefined): number => {
    if (!dateStr) return 0;
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.getTime();
      
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        // YYYY-MM-DD
        if (parts[0].length === 4) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
        }
        // DD-MM-YYYY
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
    } catch {
      return 0;
    }
    return 0;
  };

  const checkHistory = React.useMemo(() => {
    return inventoryChecks.map(check => {
      const isGold = getIsGold(check.accountId);
      const isAcc = getIsAcc(check.accountId);
      
      const weightDiff = check.actualWeight - check.systemWeight;
      const countDiff = check.actualCount - check.systemCount;
      const status = effectiveInventoryCheckStatus(check);

      const matchingEntry = entries.find(e => {
        if (check.postedEntryId && e.id === check.postedEntryId) return true;
        if (e.inventoryCheckId && e.inventoryCheckId === check.id) return true;
        if (e.debit !== check.accountId && e.credit !== check.accountId) return false;
        if (e.date < check.date) return false;
        if (check.notes && e.notes && e.notes.includes(check.notes)) return true;
        if (e.notes && e.notes.includes('تسوية جرد آلي:')) return true;
        
        const eWeight = parseWeight(e.weight) || 0;
        const wDiffAbs = Math.abs(weightDiff);
        if ((isGold || getIsSilver(check.accountId)) && wDiffAbs >= 0.001 && Math.abs(eWeight - wDiffAbs) < 0.001) return true;
        
        return false;
      });

      return { 
        id: check.id, 
        date: safeParseDate(check.date), 
        check, 
        matchingEntry, 
        isGold, 
        isAcc, 
        status,
        weightDiff, 
        countDiff 
      };
    }).sort((a, b) => b.date - a.date);
  }, [inventoryChecks, entries, getIsGold, getIsAcc, getIsSilver]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto space-y-6 pb-20 pt-6 px-4"
    >
      <div className="flex items-center justify-between bg-[#0e1018] p-4 rounded-3xl border border-[#c9a84c22]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#c9a84c11] rounded-2xl">
            <ClipboardList className="w-6 h-6 text-[#c9a84c]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#c9a84c]">جرد ومطابقة المخزون</h1>
            <p className="text-sm text-[#ddd8cc]">مراجعة الأرصدة الدفترية مع الأرصدة الفعلية</p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            "p-3 rounded-2xl transition-all",
            showHistory ? "bg-[#c9a84c] text-[#0e1018]" : "bg-[#1a1e2a] text-[#ddd8cc] hover:bg-[#2a2e3a]"
          )}
        >
          {showHistory ? <Plus className="w-5 h-5" /> : <History className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!showHistory ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Account Selector */}
            <div className="bg-[#0e1018] rounded-3xl p-6 border border-[#1a1e2a] space-y-4">
              <label className="text-base font-bold text-[#5a5548] uppercase tracking-wider block">1. اختر الحساب المراد جرده</label>
              <select
                value={selectedAcc}
                onChange={(e) => setSelectedAcc(e.target.value)}
                className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-2xl p-4 text-sm text-[#ddd8cc] focus:border-[#c9a84c] outline-none appearance-none cursor-pointer"
              >
                <option value="">- اختر الحساب -</option>
                {inventoryAccounts.map(acc => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            </div>

            {selectedAcc && (
              <>
                {/* System State Display */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#080a0f] border border-[#1a1e2a] rounded-3xl p-5 relative overflow-hidden group">
                    <Scale className="w-6 h-6 text-[#5a5548] mb-2" />
                    <div className="text-xs font-bold text-[#5a5548] mb-1">الوزن الدفتري</div>
                    <div className="text-2xl font-bold text-[#ddd8cc] font-mono">
                      {formatWeight(systemState.weight)} <span className="text-xs font-sans opacity-50">غ</span>
                      {systemState.type === 'gold' && Object.entries(systemState.karats || {}).map(([k, w]) => (
                        <div key={k} className="text-sm text-[#c9a84c] font-mono bg-[#c9a84c11] px-2 py-0.5 rounded-md mt-1">
                          عيار {k}: {Math.abs(Number(w)).toFixed(2)} غ
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#080a0f] border border-[#1a1e2a] rounded-3xl p-5 relative overflow-hidden group">
                    <Package className="w-6 h-6 text-[#5a5548] mb-2" />
                    <div className="text-xs font-bold text-[#5a5548] mb-1">العدد الدفتري</div>
                    <div className="text-2xl font-bold text-[#ddd8cc] font-mono">
                      {systemState.count.toFixed(0)} <span className="text-xs font-sans opacity-50">ق</span>
                    </div>
                  </div>
                </div>

                {/* Actual Form */}
                <form onSubmit={handleSave} className="bg-[#0e1018] rounded-3xl p-6 border border-[#c9a84c22] space-y-6">
                  <label className="text-base font-bold text-[#c9a84c] uppercase tracking-wider block">2. إدخال الأرصدة الفعلية للمطابقة</label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      label="الوزن الفعلي"
                      type="number"
                      step="0.01"
                      value={actualWeight}
                      onChangeValue={v => setActualWeight(v)}
                      placeholder="0.00"
                      containerClassName="space-y-0 relative"
                      labelClassName="bg-[#0e1018] px-2 relative top-2 right-3 w-fit z-10"
                      className="text-left"
                      dir="ltr"
                    />
                    <FormInput
                      label="العدد الفعلي"
                      type="number"
                      step="1"
                      value={actualCount}
                      onChangeValue={v => setActualCount(v)}
                      placeholder="0"
                      containerClassName="space-y-0 relative"
                      labelClassName="bg-[#0e1018] px-2 relative top-2 right-3 w-fit z-10"
                      className="text-left"
                      dir="ltr"
                    />
                  </div>

                  <FormInput
                    label="ملاحظات الجرد (اختياري)"
                    type="text"
                    value={notes}
                    onChangeValue={v => setNotes(v)}
                    placeholder="أمينة الخزينة، سبب العجز..."
                    containerClassName="space-y-0 relative"
                    labelClassName="bg-[#0e1018] px-2 relative top-2 right-3 w-fit z-10"
                  />

                  {actualWeight !== '' || actualCount !== '' ? (
                    <div className="bg-[#1a1e2a] rounded-2xl p-4 flex justify-between items-center">
                      <div className="text-xs text-[#ddd8cc]">نتائج المطابقة (الفرق)</div>
                      <div className="flex gap-4">
                        {actualWeight !== '' && (
                          <div className={cn("text-base font-bold font-mono", calculateDiffColor(systemState.weight, parseFloat(actualWeight)))}>
                            وزن: {formatWeight(parseFloat(actualWeight) - systemState.weight)}
                          </div>
                        )}
                        {actualCount !== '' && (
                          <div className={cn("text-base font-bold font-mono", calculateDiffColor(systemState.count, parseFloat(actualCount)))}>
                            عدد: {(parseFloat(actualCount) - systemState.count).toFixed(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={saveLoading || (!actualWeight && !actualCount)}
                    className="w-full bg-[#c9a84c] text-[#0e1018] text-lg font-bold py-4 rounded-2xl hover:bg-[#d4b455] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {saveLoading ? <span className="animate-pulse">جاري الحفظ...</span> : <><Save className="w-5 h-5" /> حفظ الجرد</>}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between bg-[#0e1018] p-4 rounded-2xl border border-[#1a1e2a] shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#c9a84c11] flex items-center justify-center">
                  <History className="w-4 h-4 text-[#c9a84c]" />
                </div>
                <h3 className="text-[12px] font-bold text-[#ddd8cc]">سجل عمليات المطابقة والجرد</h3>
              </div>
              
              <button
                onClick={exportHistory}
                disabled={inventoryChecks.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1e2a] hover:bg-[#252a3a] text-[#ddd8cc] rounded-xl text-[10px] font-bold transition-all border border-[#2a2e3a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5 text-[#c9a84c]" />
                تصدير إكسيل
              </button>
            </div>

            {checkHistory.length === 0 ? (
              <div className="text-center py-20 bg-[#0e1018] border border-[#1a1e2a] rounded-3xl">
                <History className="w-10 h-10 text-[#1a1e2a] mx-auto mb-3" />
                <p className="text-sm text-[#5a5548]">لا يوجد سجل جرد ومطابقة مسبق</p>
              </div>
            ) : (
              checkHistory.map(item => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editW={editW}
                  editC={editC}
                  setEditW={setEditW}
                  setEditC={setEditC}
                  startEdit={startEdit}
                  handleQuickUpdate={handleQuickUpdate}
                  setEditingId={setEditingId}
                  createAdjustmentEntry={createAdjustmentEntry}
                  handleDelete={handleDelete}
                  updateLoading={updateLoading}
                  adjustLoading={adjustLoading}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
