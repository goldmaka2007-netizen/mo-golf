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

// A) EntryForm owns a stable Firestore/Operation ID + sequence for the whole draft/retry lifecycle.
{
  const path = 'src/components/views/EntryForm.tsx';
  replaceOnce(path, '  const initialFormState = {\n', '  const createInitialFormState = () => ({\n    id: crypto.randomUUID(),\n    seq: Date.now(),\n', 'EntryForm operation identity factory');
  replaceOnce(path, '    priceSnapshotLocked: false,\n  };\n\n  const [formData, setFormData] = useState(initialFormState);', '    priceSnapshotLocked: false,\n  });\n\n  const [formData, setFormData] = useState(createInitialFormState);', 'EntryForm factory closure');
  replaceOnce(path, "      userId: user?.uid || '',\n      seq: Date.now(),\n", "      userId: user?.uid || '',\n      id: formData.id,\n      seq: formData.seq,\n", 'EntryForm stable create id/seq');
  replaceOnce(path, "    setFormData(prev => ({\n      ...initialFormState,\n      date: prev.date\n    }));", "    setFormData(prev => ({\n      ...createInitialFormState(),\n      date: prev.date\n    }));", 'EntryForm reset identity');
}

// B) Settings may no longer mutate accounting Entries after Cutover.
{
  const path = 'src/components/views/SettingsView.tsx';
  let source = read(path);
  source = source.replace(/\s*collection,\s*\n\s*addDoc,\s*\n/, '\n');
  source = source.replace(/,?\s*writeBatch\s*\n/, '\n');
  source = source.replace("import { parseSettingsEntryCsv } from '../../utils/csvImport';\n", '');
  write(path, source);

  replaceRange(
    path,
    '  const handleDeleteAllData = async () => {',
    '  const [importProgress,',
    `  const handleDeleteAllData = async () => {\n    setGlobalError('بعد Central Accounting Cutover لا يسمح بمسح القيود المحاسبية من الإعدادات. التصحيح يتم من خلال القيد وبسجل مراجعة.');\n  };\n\n  const [importProgress,`,
    'Settings hard-delete fail closed',
  );
  replaceRange(
    path,
    '  const handleRetroactiveInvoiceNumbers = async () => {',
    '  const handleExportData =',
    `  const handleRetroactiveInvoiceNumbers = async () => {\n    setGlobalError('الترقيم الرجعي الذي يعيد كتابة القيود التاريخية متوقف بعد Central Accounting Cutover. أي Migration تاريخي يحتاج مسارًا منفصلًا ومعتمدًا.');\n  };\n\n  const handleExportData =`,
    'Settings retroactive rewrite fail closed',
  );
  replaceRange(
    path,
    '  const handleImport = async () => {',
    '  return (',
    `  const handleImport = async () => {\n    setGlobalError('استيراد قيود CSV المباشر متوقف بعد Central Accounting Cutover. الاستيراد التاريخي يحتاج Migration معتمد ولا يمر من Writer اليومي.');\n  };\n\n  return (`,
    'Settings CSV import fail closed',
  );
}

// C) Central create uses the draft Entry.id as the Operation ID and is replay-idempotent.
{
  const path = 'src/lib/centralAccountingWriteService.ts';
  replaceOnce(
    path,
    "const changedFieldNames = (before: Entry, after: Entry): string[] => {\n",
    `const IDEMPOTENT_BUSINESS_FIELDS: Array<keyof Entry> = [\n  'seq', 'tx', 'subTx', 'debit', 'credit', 'date', 'cash', 'weight', 'count', 'arabicWeight',\n  'karat', 'multiplier', 'notes', 'invoiceNumber', 'clientName', 'clientPhone', 'marketPrice', 'inventoryCheckId',\n];\n\nexport const sameCentralOperationPayload = (before: Entry, after: Entry): boolean => (\n  before.id === after.id\n  && IDEMPOTENT_BUSINESS_FIELDS.every(field => comparable(before[field]) === comparable(after[field]))\n);\n\nconst changedFieldNames = (before: Entry, after: Entry): string[] => {\n`,
    'Central idempotent payload helper',
  );

  replaceRange(
    path,
    'export const createCentralAccountingEntry = async (args: {',
    '/**\n * Saved accounting Entries are corrected in place only through Central',
    `export const createCentralAccountingEntry = async (args: {\n  entry: Entry;\n  context: CentralWriteContext;\n  actor: CentralWriteActor;\n  source?: Extract<CentralWriteSource, 'user' | 'setup'>;\n}): Promise<CentralAccountingPersistenceResult> => {\n  if (!args.entry.id) return { ok: false, message: 'Operation ID مطلوب قبل حفظ أي قيد جديد.' };\n\n  const replay = args.context.entries.find(entry => entry.id === args.entry.id);\n  if (replay) {\n    if (!sameCentralOperationPayload(replay, args.entry)) {\n      return { ok: false, message: 'Operation ID مستخدم بالفعل لعملية مختلفة. تم رفض الحفظ لمنع التكرار.' };\n    }\n    return { ok: true, entryId: replay.id!, entry: replay };\n  }\n\n  const preflight = preparePersistence({\n    entry: args.entry,\n    context: args.context,\n    source: args.source ?? 'user',\n    mode: 'create',\n  });\n  if (!preflight.ready || !preflight.preparedEntry || !preflight.operation) {\n    return { ok: false, message: blockerMessage(preflight.blockers), blockers: preflight.blockers };\n  }\n\n  const entryRef = doc(db, 'entries', args.entry.id);\n  const auditRef = doc(collection(db, 'audit_logs'));\n  const persistedEntry = sanitizeFirestorePayload({\n    ...preflight.preparedEntry,\n    userId: args.actor.userId,\n    createdAt: serverTimestamp(),\n  } as Record<string, unknown>);\n\n  const outcome = await runTransaction(db, async transaction => {\n    const existingSnapshot = await transaction.get(entryRef);\n    if (existingSnapshot.exists()) {\n      const existing = { id: existingSnapshot.id, ...existingSnapshot.data() } as Entry;\n      if (!sameCentralOperationPayload(existing, preflight.preparedEntry!)) {\n        throw new Error('Operation ID conflict: existing persisted operation differs from retry payload.');\n      }\n      return existing;\n    }\n\n    transaction.set(entryRef, persistedEntry);\n    transaction.set(auditRef, {\n      action: 'create',\n      collection: 'entries',\n      documentId: entryRef.id,\n      userId: args.actor.userId,\n      userEmail: args.actor.userEmail || '',\n      canonicalOperationId: preflight.operation!.id,\n      canonicalOperationVersion: preflight.operation!.version,\n      timestamp: serverTimestamp(),\n    });\n    return null;\n  });\n\n  if (outcome) return { ok: true, entryId: outcome.id!, entry: outcome };\n  return {\n    ok: true,\n    entryId: entryRef.id,\n    entry: { ...preflight.preparedEntry, id: entryRef.id, userId: args.actor.userId },\n  };\n};\n\n/**\n * Saved accounting Entries are corrected in place only through Central`,
    'Central create idempotency Cutover',
  );

  replaceRange(
    path,
    'export const createCentralInventoryAdjustment = async (args: {',
    '\n};',
    `export const createCentralInventoryAdjustment = async (args: {\n  entry: Entry;\n  checkId: string;\n  context: CentralWriteContext;\n  actor: CentralWriteActor;\n}): Promise<CentralAccountingPersistenceResult> => {\n  const entryWithId: Entry = {\n    ...args.entry,\n    id: args.entry.id || \`inventory-adjustment-\${args.checkId}\`,\n  };\n  const replay = args.context.entries.find(entry => entry.id === entryWithId.id);\n  if (replay) {\n    if (!sameCentralOperationPayload(replay, entryWithId)) {\n      return { ok: false, message: 'Operation ID مستخدم بالفعل لتسوية مختلفة. تم رفض الترحيل.' };\n    }\n    return { ok: true, entryId: replay.id!, entry: replay };\n  }\n\n  const preflight = preparePersistence({\n    entry: entryWithId,\n    context: args.context,\n    source: 'system',\n    mode: 'create',\n  });\n  if (!preflight.ready || !preflight.preparedEntry || !preflight.operation) {\n    return { ok: false, message: blockerMessage(preflight.blockers), blockers: preflight.blockers };\n  }\n\n  const checkRef = doc(db, 'inventory_checks', args.checkId);\n  const entryRef = doc(db, 'entries', entryWithId.id!);\n  const auditRef = doc(collection(db, 'audit_logs'));\n\n  const outcome = await runTransaction(db, async transaction => {\n    const checkSnapshot = await transaction.get(checkRef);\n    const entrySnapshot = await transaction.get(entryRef);\n    if (!checkSnapshot.exists()) throw new Error('جرد غير موجود.');\n    const check = { id: checkSnapshot.id, ...checkSnapshot.data() } as InventoryCheck;\n\n    if (check.status === 'posted' || check.postedEntryId || check.isResolved) {\n      if (check.postedEntryId === entryRef.id && entrySnapshot.exists()) {\n        const existing = { id: entrySnapshot.id, ...entrySnapshot.data() } as Entry;\n        if (sameCentralOperationPayload(existing, preflight.preparedEntry!)) return existing;\n      }\n      throw new Error('تم ترحيل هذا الجرد من قبل.');\n    }\n    if (entrySnapshot.exists()) throw new Error('Operation ID conflict: inventory adjustment Entry already exists.');\n\n    transaction.set(entryRef, sanitizeFirestorePayload({\n      ...preflight.preparedEntry,\n      userId: args.actor.userId,\n      createdAt: serverTimestamp(),\n    } as Record<string, unknown>));\n    transaction.update(checkRef, {\n      status: 'posted',\n      isResolved: true,\n      postedEntryId: entryRef.id,\n      postedAt: serverTimestamp(),\n      postedBy: args.actor.userId,\n      updatedAt: serverTimestamp(),\n    });\n    transaction.set(auditRef, {\n      action: 'inventory_check_posted',\n      collection: 'entries',\n      documentId: entryRef.id,\n      inventoryCheckId: args.checkId,\n      userId: args.actor.userId,\n      userEmail: args.actor.userEmail || '',\n      canonicalOperationId: preflight.operation!.id,\n      canonicalOperationVersion: preflight.operation!.version,\n      timestamp: serverTimestamp(),\n    });\n    return null;\n  });\n\n  if (outcome) return { ok: true, entryId: outcome.id!, entry: outcome };\n  return {\n    ok: true,\n    entryId: entryRef.id,\n    entry: { ...preflight.preparedEntry, id: entryRef.id, userId: args.actor.userId },\n  };\n};`,
    'Central inventory adjustment idempotency Cutover',
  );
}

// D) Strengthen architecture regression coverage for Settings + stable Operation ID.
{
  const path = 'src/lib/__tests__/centralAccountingWriteCutover.test.ts';
  replaceOnce(
    path,
    "    const inventory = readSource('components/views/InventoryCheckView.tsx');\n    const service = readSource('lib/centralAccountingWriteService.ts');",
    "    const inventory = readSource('components/views/InventoryCheckView.tsx');\n    const settings = readSource('components/views/SettingsView.tsx');\n    const service = readSource('lib/centralAccountingWriteService.ts');",
    'Cutover test Settings source',
  );
  replaceOnce(
    path,
    "    expect(inventory).not.toContain('transaction.set(entryRef');\n    expect(service).toContain(\"doc(collection(db, 'entries'))\");",
    "    expect(inventory).not.toContain('transaction.set(entryRef');\n    expect(settings).not.toMatch(/addDoc\\(collection\\(db, ['\"]entries['\"]\\)/);\n    expect(settings).not.toMatch(/batch\\.(?:delete|update)\\(doc\\(db, ['\"]entries['\"]/);\n    expect(service).toContain(\"doc(db, 'entries', args.entry.id)\");",
    'Cutover test writer sweep',
  );
  replaceOnce(
    path,
    "  it('removes hard-delete controls from the saved Entry correction UI', () => {",
    `  it('uses a stable draft Operation ID and sequence for idempotent create retries', () => {\n    const entryForm = readSource('components/views/EntryForm.tsx');\n    const service = readSource('lib/centralAccountingWriteService.ts');\n    expect(entryForm).toContain('id: crypto.randomUUID()');\n    expect(entryForm).toContain('id: formData.id');\n    expect(entryForm).toContain('seq: formData.seq');\n    expect(service).toContain('sameCentralOperationPayload');\n    expect(service).toContain('Operation ID conflict');\n  });\n\n  it('removes hard-delete controls from the saved Entry correction UI', () => {`,
    'Cutover idempotency test',
  );
}

// E) Architecture sweep must also detect batch hard-delete/update bypasses.
{
  const path = '.github/scripts/phase5b-architecture-sweep.mjs';
  replaceOnce(
    path,
    "  /deleteDoc\\s*\\(\\s*doc\\([^\\n)]*['\"]entries['\"]/s,\n",
    "  /deleteDoc\\s*\\(\\s*doc\\([^\\n)]*['\"]entries['\"]/s,\n  /batch\\.(?:delete|update|set)\\s*\\(\\s*doc\\([^\\n)]*['\"]entries['\"]/s,\n",
    'architecture sweep batch writer pattern',
  );
  replaceOnce(
    path,
    "  if (/deleteDoc\\s*\\(\\s*doc\\([^\\n)]*['\"]entries['\"]/s.test(text)) hardDeletes.push(rel);",
    "  if (/deleteDoc\\s*\\(\\s*doc\\([^\\n)]*['\"]entries['\"]/s.test(text) || /batch\\.delete\\s*\\(\\s*doc\\([^\\n)]*['\"]entries['\"]/s.test(text)) hardDeletes.push(rel);",
    'architecture sweep batch hard delete',
  );
}

console.log('Phase 5B finalization codemod applied.');
