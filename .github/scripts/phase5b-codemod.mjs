import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const replaceOnce = (path, from, to, label) => {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match in ${path}, found ${count}`);
  write(path, source.replace(from, to));
};

const replaceRange = (path, startMarker, endMarker, replacement, label) => {
  const source = read(path);
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found in ${path}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: end marker not found in ${path}`);
  write(path, source.slice(0, start) + replacement + source.slice(end));
};

// 1) The generic adjustment remains resolvable for history but is no longer a writer.
{
  const path = 'src/lib/canonicalOperationCatalog.ts';
  const source = read(path);
  const pattern = /(id: 'inventory\.adjustment\.legacy'[\s\S]*?availability: 'transition_only', userSelectable:) true,/;
  if (!pattern.test(source)) throw new Error('legacy adjustment writable marker not found');
  write(path, source.replace(pattern, '$1 false,'));
}

// 2) New/modified Entries can carry stable Central operation and correction metadata.
replaceOnce(
  'src/types.ts',
  "  operationKind?: AccountingOperationKind;\n",
  "  operationKind?: AccountingOperationKind;\n  /** Stable Central operation contract identity for new/modified Entries after Cutover. */\n  canonicalOperationId?: string;\n  canonicalOperationVersion?: number;\n  /** Latest explicit correction metadata. Full correction history lives in audit_logs. */\n  modifiedAt?: any;\n  modifiedBy?: string;\n  modificationReason?: string;\n",
  'Entry Central metadata',
);

// 3) Promote invoice uniqueness + canonical operation metadata into the Central preflight.
replaceOnce(
  'src/lib/centralAccountingWritePreflight.ts',
  "  | 'update_target_missing'\n  | 'accounting_policy'",
  "  | 'update_target_missing'\n  | 'invoice_number_conflict'\n  | 'accounting_policy'",
  'preflight invoice blocker code',
);
replaceOnce(
  'src/lib/centralAccountingWritePreflight.ts',
  "    operationKind: operation.operationKind,\n    debitAccountId: debit.sourceAccountId,",
  "    operationKind: operation.operationKind,\n    canonicalOperationId: operation.id,\n    canonicalOperationVersion: operation.version,\n    debitAccountId: debit.sourceAccountId,",
  'preflight canonical operation metadata',
);
replaceOnce(
  'src/lib/centralAccountingWritePreflight.ts',
  "\n  const accountingPolicyIssues = validateAccountingPolicy(preparedEntry, accounts);",
  "\n  const normalizedInvoiceNumber = String(preparedEntry.invoiceNumber || '').trim();\n  if (normalizedInvoiceNumber) {\n    const conflict = entries.some(existing =>\n      String(existing.invoiceNumber || '').trim() === normalizedInvoiceNumber\n      && (mode !== 'update' || existing.id !== preparedEntry.id),\n    );\n    if (conflict) {\n      blockers.push({\n        code: 'invoice_number_conflict',\n        message: `Invoice number is already used by another Entry: ${normalizedInvoiceNumber}`,\n      });\n    }\n  }\n\n  const accountingPolicyIssues = validateAccountingPolicy(preparedEntry, accounts);",
  'preflight invoice uniqueness',
);

// 4) Inventory check settlement emits explicit Central system operations.
{
  const path = 'src/lib/inventoryCheckSettlement.ts';
  const source = read(path);
  const pattern = /(const entry = \{\r?\n\s*)tx:\s*[^\r\n]+/;
  if (!pattern.test(source)) throw new Error('inventory adjustment tx line not found');
  write(path, source.replace(pattern, "$1tx: direction === 'shortage' ? 'تسوية عجز' : 'تسوية زيادة',"));
}

// 5) EntryForm delegates save acceptance + persistence to the single Central writer.
{
  const path = 'src/components/views/EntryForm.tsx';
  let source = read(path);
  source = source.replace("import { collection, addDoc, serverTimestamp } from 'firebase/firestore';\n", '');
  source = source.replace("import { db } from '../../firebase';\n", '');
  const importMarker = "import { mergeGoldMerchantSettlementEntryRules } from '../../lib/merchantSettlementEntryOptions';\n";
  if (!source.includes(importMarker)) throw new Error('EntryForm central writer import marker missing');
  source = source.replace(importMarker, importMarker + "import { createCentralAccountingEntry } from '../../lib/centralAccountingWriteService';\n");
  write(path, source);

  replaceRange(
    path,
    '  const handleSave = async () => {',
    '  const resetForm = () => {',
    `  const handleSave = async () => {\n    if (isSaving) return;\n    if (areOperationWritesLocked(costCalculationRun)) {\n      setGlobalError('العمليات مقفلة حتى يكتمل احتساب التكلفة بنجاح.');\n      return;\n    }\n\n    const entry: Entry = {\n      tx: formData.tx || '',\n      debit: formData.debit || '',\n      credit: formData.credit || '',\n      date: formData.date || format(new Date(), 'yyyy-MM-dd'),\n      cash: formData.cash || '0',\n      weight: formData.weight || '0',\n      count: formData.count || '0',\n      notes: formData.notes || '',\n      invoiceNumber: formData.invoiceNumber || '',\n      arabicWeight: formData.arabicWeight || '0',\n      multiplier: formData.multiplier || 1,\n      karat: formData.karat ?? undefined,\n      marketPrice: formData.marketPrice,\n      debitAccountId: formData.debitAccountId,\n      creditAccountId: formData.creditAccountId,\n      clientName: formData.clientName || '',\n      clientPhone: formData.clientPhone || '',\n      userId: user?.uid || '',\n      seq: Date.now(),\n    };\n\n    setIsSaving(true);\n    try {\n      const result = await createCentralAccountingEntry({\n        entry,\n        context: {\n          entries,\n          accounts: accountsDb,\n          openingCostConfig,\n          manualAccountDefinitions: canonicalAccounts,\n        },\n        actor: { userId: user?.uid || '', userEmail: user?.email || '' },\n        source: formData.tx === 'قيد افتتاحي' ? 'setup' : 'user',\n      });\n      if (!result.ok) {\n        setGlobalError(result.message);\n        return;\n      }\n\n      lastSavedInvoiceRef.current = String(result.entry.invoiceNumber || '').trim();\n      setStep(4);\n      localStorage.removeItem('entry_form_draft');\n      incrementUsage([formData.tx, formData.debit, formData.credit]);\n    } catch (error) {\n      console.error('Central save error:', error);\n      setGlobalError('فشل تسجيل القيد في قاعدة البيانات. لم يتم حفظ العملية.');\n    } finally {\n      setIsSaving(false);\n    }\n  };\n\n`,
    'EntryForm handleSave Cutover',
  );
}

// 6) App update goes through Central writer. Hard delete is removed from accounting Entries.
{
  const path = 'src/App.tsx';
  let source = read(path);
  source = source.replace("import { deleteDoc, doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';\n", '');
  source = source.replace("import { db, firebaseProjectId, firestoreDatabaseId, logOut } from './firebase';\n", "import { firebaseProjectId, firestoreDatabaseId, logOut } from './firebase';\n");
  const importMarker = "import { validateAccountingPolicy } from './lib/accountingPolicy';\n";
  if (!source.includes(importMarker)) throw new Error('App central writer import marker missing');
  source = source.replace(importMarker, importMarker + "import type { Entry } from './types';\nimport { updateCentralAccountingEntry } from './lib/centralAccountingWriteService';\n");
  source = source.replace(
    "    editingEntry, setEditingEntry, accountsDb,\n    costCalculationRun, requestCostRetry\n",
    "    editingEntry, setEditingEntry, accountsDb, entries, openingCostConfig, canonicalAccounts,\n    costCalculationRun, requestCostRetry\n",
  );
  source = source.replace("  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);\n", '');
  write(path, source);

  replaceRange(
    path,
    '  const handleDelete = async (id: string) => {',
    '  const handleHardReset = () => {',
    `  const handleUpdate = async (e: React.FormEvent, reason: string) => {\n    e.preventDefault();\n    if (areOperationWritesLocked(costCalculationRun)) {\n      setGlobalError('لا يمكن تعديل العمليات أثناء توقف أو إعادة احتساب التكلفة. أصلح الخطأ من الإعدادات ثم أعد المحاولة.');\n      return;\n    }\n    if (!editingEntry?.id || isUpdatingEntry) return;\n\n    setIsUpdatingEntry(true);\n    try {\n      const result = await updateCentralAccountingEntry({\n        entry: editingEntry as Entry,\n        context: {\n          entries,\n          accounts: accountsDb,\n          openingCostConfig,\n          manualAccountDefinitions: canonicalAccounts,\n        },\n        actor: { userId: user?.uid || '', userEmail: user?.email || '' },\n        reason,\n      });\n      if (!result.ok) {\n        setGlobalError(result.message);\n        return;\n      }\n      setEditingEntry(null);\n    } catch (error) {\n      console.error('Central update error:', error);\n      setGlobalError('فشل تحديث القيد. لم يتم حفظ أي تعديل.');\n    } finally {\n      setIsUpdatingEntry(false);\n    }\n  };\n\n`,
    'App accounting update/delete Cutover',
  );

  source = read(path);
  source = source.replace(
    "              handleDelete={handleDelete}\n              deleteConfirmId={deleteConfirmId}\n              setDeleteConfirmId={setDeleteConfirmId}\n",
    '',
  );
  write(path, source);
}

// 7) Correction UI requires a fresh reason and exposes no hard-delete action.
{
  const path = 'src/components/views/EditingEntryModal.tsx';
  let source = read(path);
  source = source.replace("import { X, Trash2, Save, BarChart3, Printer } from 'lucide-react';", "import { X, Save, BarChart3, Printer } from 'lucide-react';");
  source = source.replace("  handleUpdate: (e: React.FormEvent) => void;\n  handleDelete: (id: string) => void;\n  deleteConfirmId: string | null;\n  setDeleteConfirmId: (id: string | null) => void;\n", "  handleUpdate: (e: React.FormEvent, reason: string) => void;\n");
  source = source.replace("  handleUpdate,\n  handleDelete,\n  deleteConfirmId,\n  setDeleteConfirmId,\n  isUpdating\n", "  handleUpdate,\n  isUpdating\n");
  const storeMarker = "  const { accounts, accountsDb, goldPrice, silverPrice } = useAppStore();\n";
  if (!source.includes(storeMarker)) throw new Error('EditingEntryModal state marker missing');
  source = source.replace(storeMarker, storeMarker + "  const [correctionReason, setCorrectionReason] = React.useState('');\n\n  React.useEffect(() => {\n    setCorrectionReason('');\n  }, [editingEntry?.id]);\n");
  source = source.replace('<form onSubmit={handleUpdate} className="space-y-6">', '<form onSubmit={(event) => handleUpdate(event, correctionReason)} className="space-y-6">');
  write(path, source);

  const reasonBlock = `          <div className="space-y-2">\n            <label className="text-xs text-[#c9a84c] font-bold uppercase tracking-widest px-1">سبب التعديل (إجباري)</label>\n            <textarea\n              value={correctionReason}\n              onChange={(event) => setCorrectionReason(event.target.value)}\n              className="w-full bg-[#080a0f] border border-[#c9a84c33] rounded-2xl p-4 text-base text-[#ddd8cc] outline-none focus:border-[#c9a84c] transition-all h-20 resize-none"\n              placeholder="اكتب سبب تصحيح القيد..."\n              required\n            />\n          </div>\n\n          <div className="flex gap-4 pt-4">\n            <button \n              type="submit" \n              disabled={isUpdating || !correctionReason.trim()}\n              className="flex-1 py-4 bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#080a0f] font-bold rounded-2xl shadow-lg shadow-[#c9a84c22] hover:shadow-[#c9a84c44] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"\n            >\n              {isUpdating ? (\n                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>\n                  <BarChart3 className="w-4 h-4 animate-pulse" />\n                </motion.div>\n              ) : <Save className="w-4 h-4" />}\n              حفظ التصحيح\n            </button>\n          </div>\n`;
  replaceRange(
    path,
    '          <div className="flex gap-4 pt-4">',
    '        </form>',
    reasonBlock,
    'EditingEntryModal correction controls',
  );
}

// 8) Inventory settlement delegates the accounting Entry write to the Central service.
{
  const path = 'src/components/views/InventoryCheckView.tsx';
  let source = read(path);
  source = source.replace("import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, runTransaction } from 'firebase/firestore';", "import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';");
  source = source.replace("  prepareEntryForCentralSave,\n", '');
  const importMarker = "} from '../../lib/inventoryCheckSettlement';\n";
  if (!source.includes(importMarker)) throw new Error('InventoryCheckView central writer import marker missing');
  source = source.replace(importMarker, importMarker + "import { createCentralInventoryAdjustment } from '../../lib/centralAccountingWriteService';\n");
  write(path, source);

  replaceRange(
    path,
    '  const createAdjustmentEntry = useCallback(async (check: InventoryCheck) => {',
    '  const exportHistory = () => {',
    `  const createAdjustmentEntry = useCallback(async (check: InventoryCheck) => {\n    if (operationWritesLocked) {\n      setGlobalError('لا يمكن إنشاء تسوية مخزون أثناء تشغيل أو فشل إعادة احتساب التكلفة.');\n      return;\n    }\n    if (!check.id) {\n      setGlobalError('لا يمكن ترحيل جرد غير محفوظ.');\n      return;\n    }\n    if (effectiveInventoryCheckStatus(check) === 'posted') {\n      setGlobalError('تم ترحيل هذا الجرد من قبل.');\n      return;\n    }\n\n    setAdjustLoading(check.id);\n    try {\n      const draft = buildInventoryAdjustmentDraftEntry({\n        check,\n        accountsDb,\n        entries,\n        userId: user!.uid,\n      });\n      if (!draft.ok) {\n        setGlobalError(draft.message);\n        return;\n      }\n\n      const result = await createCentralInventoryAdjustment({\n        entry: draft.entry,\n        checkId: check.id,\n        context: {\n          entries,\n          accounts: accountsDb,\n          openingCostConfig,\n          manualAccountDefinitions: canonicalAccounts,\n        },\n        actor: { userId: user!.uid, userEmail: user?.email || '' },\n      });\n      if (!result.ok) {\n        setGlobalError(result.message);\n      }\n    } catch (error) {\n      handleFirestoreError(error, OperationType.CREATE, 'entries');\n    } finally {\n      setAdjustLoading(null);\n    }\n  }, [user, operationWritesLocked, setGlobalError, accountsDb, entries, openingCostConfig, canonicalAccounts]);\n\n`,
    'InventoryCheck Central accounting writer',
  );
}

// 9) Phase 5A regression now asserts the approved real-catalog Cutover readiness policy.
{
  const path = 'src/lib/__tests__/centralAccountingWritePreflight.test.ts';
  const source = read(path);
  const start = source.indexOf("  it('keeps the real default gate blocked while a transition-only writer is still selectable'");
  const next = source.indexOf("  it('prepares a current user operation", start);
  if (start < 0 || next < 0) throw new Error('Phase 5A default readiness regression block not found');
  const replacement = `  it('keeps legacy adjustment resolvable for history while the approved default catalog has no transition writer', () => {\n    const candidate = entry();\n    const before = JSON.stringify(candidate);\n    const result = buildCentralAccountingWritePreflight({\n      entry: candidate,\n      entries: [],\n      accounts,\n      openingCostConfig: [],\n      manualAccountDefinitions: approvedDefinitions(accounts),\n      source: 'user',\n    });\n\n    expect(result.ready).toBe(true);\n    expect(result.blockers).toEqual([]);\n    expect(result.coverage.transitionOperationsStillWritable).toEqual([]);\n    expect(JSON.stringify(candidate)).toBe(before);\n  });\n\n`;
  write(path, source.slice(0, start) + replacement + source.slice(next));
}

console.log('Phase 5B deterministic codemod applied successfully.');
