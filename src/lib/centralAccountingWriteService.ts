import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  Account,
  AnnualOpeningCostConfig,
  CanonicalAccountDefinition,
  Entry,
  InventoryCheck,
} from '../types';
import {
  buildCentralAccountingWritePreflight,
  type CentralWriteBlocker,
  type CentralWriteSource,
} from './centralAccountingWritePreflight';

export interface CentralWriteActor {
  userId: string;
  userEmail?: string;
}

export interface CentralWriteContext {
  entries: Entry[];
  accounts: Account[];
  openingCostConfig: AnnualOpeningCostConfig[];
  manualAccountDefinitions?: CanonicalAccountDefinition[];
}

export type CentralAccountingPersistenceResult =
  | { ok: true; entryId: string; entry: Entry }
  | { ok: false; message: string; blockers?: CentralWriteBlocker[] };

const sanitizeFirestorePayload = <T extends Record<string, unknown>>(value: T): T => (
  Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T
);

const blockerMessage = (blockers: CentralWriteBlocker[]): string => (
  blockers.map(blocker => blocker.message).filter(Boolean).join(' — ')
  || 'Central write preflight rejected the operation.'
);

const comparable = (value: unknown): string => {
  if (value === undefined) return '__undefined__';
  if (value === null) return '__null__';
  if (typeof value === 'object' && value && 'toMillis' in (value as Record<string, unknown>)) {
    try {
      return `timestamp:${String((value as { toMillis: () => number }).toMillis())}`;
    } catch {
      return '[timestamp]';
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const changedFieldNames = (before: Entry, after: Entry): string[] => {
  const ignored = new Set(['id', 'modifiedAt', 'modifiedBy', 'modificationReason']);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => !ignored.has(key))
    .filter(key => comparable((before as unknown as Record<string, unknown>)[key]) !== comparable((after as unknown as Record<string, unknown>)[key]))
    .sort();
};

const preparePersistence = (args: {
  entry: Entry;
  context: CentralWriteContext;
  source: CentralWriteSource;
  mode: 'create' | 'update';
}): ReturnType<typeof buildCentralAccountingWritePreflight> => (
  buildCentralAccountingWritePreflight({
    entry: args.entry,
    entries: args.context.entries,
    accounts: args.context.accounts,
    openingCostConfig: args.context.openingCostConfig,
    manualAccountDefinitions: args.context.manualAccountDefinitions,
    source: args.source,
    mode: args.mode,
  })
);

/**
 * The single persistence boundary for new accounting Entries after Cutover.
 * Accounting identity and validation are completed by the pure Central
 * preflight before a Firestore batch is created. There is no legacy fallback.
 */
export const createCentralAccountingEntry = async (args: {
  entry: Entry;
  context: CentralWriteContext;
  actor: CentralWriteActor;
  source?: Extract<CentralWriteSource, 'user' | 'setup'>;
}): Promise<CentralAccountingPersistenceResult> => {
  const preflight = preparePersistence({
    entry: args.entry,
    context: args.context,
    source: args.source ?? 'user',
    mode: 'create',
  });
  if (!preflight.ready || !preflight.preparedEntry || !preflight.operation) {
    return { ok: false, message: blockerMessage(preflight.blockers), blockers: preflight.blockers };
  }

  const entryRef = doc(collection(db, 'entries'));
  const auditRef = doc(collection(db, 'audit_logs'));
  const persistedEntry = sanitizeFirestorePayload({
    ...preflight.preparedEntry,
    userId: args.actor.userId,
    createdAt: serverTimestamp(),
  } as Record<string, unknown>);

  const batch = writeBatch(db);
  batch.set(entryRef, persistedEntry);
  batch.set(auditRef, {
    action: 'create',
    collection: 'entries',
    documentId: entryRef.id,
    userId: args.actor.userId,
    userEmail: args.actor.userEmail || '',
    canonicalOperationId: preflight.operation.id,
    canonicalOperationVersion: preflight.operation.version,
    timestamp: serverTimestamp(),
  });
  await batch.commit();

  return {
    ok: true,
    entryId: entryRef.id,
    entry: { ...preflight.preparedEntry, id: entryRef.id, userId: args.actor.userId },
  };
};

/**
 * Saved accounting Entries are corrected in place only through Central
 * validation. A non-empty reason is mandatory and the audit event stores the
 * changed field names, not a full before/after snapshot.
 */
export const updateCentralAccountingEntry = async (args: {
  entry: Entry;
  context: CentralWriteContext;
  actor: CentralWriteActor;
  reason: string;
}): Promise<CentralAccountingPersistenceResult> => {
  const reason = args.reason.trim();
  if (!reason) return { ok: false, message: 'سبب التعديل مطلوب قبل حفظ تصحيح القيد.' };
  if (!args.entry.id) return { ok: false, message: 'لا يمكن تعديل قيد بدون معرف ثابت.' };

  const existing = args.context.entries.find(entry => entry.id === args.entry.id);
  if (!existing) return { ok: false, message: `القيد المطلوب تعديله غير موجود: ${args.entry.id}` };

  const preflight = preparePersistence({
    entry: args.entry,
    context: args.context,
    source: 'user',
    mode: 'update',
  });
  if (!preflight.ready || !preflight.preparedEntry || !preflight.operation) {
    return { ok: false, message: blockerMessage(preflight.blockers), blockers: preflight.blockers };
  }

  const entryRef = doc(db, 'entries', args.entry.id);
  const auditRef = doc(collection(db, 'audit_logs'));
  const changedFields = changedFieldNames(existing, preflight.preparedEntry);
  const { id: _id, createdAt: _createdAt, ...preparedFields } = preflight.preparedEntry;
  const updatePayload = sanitizeFirestorePayload({
    ...preparedFields,
    modifiedAt: serverTimestamp(),
    modifiedBy: args.actor.userId,
    modificationReason: reason,
  } as Record<string, unknown>);

  const batch = writeBatch(db);
  batch.update(entryRef, updatePayload);
  batch.set(auditRef, {
    action: 'update',
    collection: 'entries',
    documentId: args.entry.id,
    userId: args.actor.userId,
    userEmail: args.actor.userEmail || '',
    reason,
    changedFields,
    canonicalOperationId: preflight.operation.id,
    canonicalOperationVersion: preflight.operation.version,
    timestamp: serverTimestamp(),
  });
  await batch.commit();

  return {
    ok: true,
    entryId: args.entry.id,
    entry: {
      ...preflight.preparedEntry,
      modifiedBy: args.actor.userId,
      modificationReason: reason,
    },
  };
};

/**
 * Inventory adjustment posting stays atomic with InventoryCheck settlement,
 * but the accounting Entry itself is accepted only through the same Central
 * preflight/persistence authority as every other new Entry.
 */
export const createCentralInventoryAdjustment = async (args: {
  entry: Entry;
  checkId: string;
  context: CentralWriteContext;
  actor: CentralWriteActor;
}): Promise<CentralAccountingPersistenceResult> => {
  const preflight = preparePersistence({
    entry: args.entry,
    context: args.context,
    source: 'system',
    mode: 'create',
  });
  if (!preflight.ready || !preflight.preparedEntry || !preflight.operation) {
    return { ok: false, message: blockerMessage(preflight.blockers), blockers: preflight.blockers };
  }

  const checkRef = doc(db, 'inventory_checks', args.checkId);
  const entryRef = doc(collection(db, 'entries'));
  const auditRef = doc(collection(db, 'audit_logs'));

  await runTransaction(db, async transaction => {
    const checkSnapshot = await transaction.get(checkRef);
    if (!checkSnapshot.exists()) throw new Error('جرد غير موجود.');
    const check = { id: checkSnapshot.id, ...checkSnapshot.data() } as InventoryCheck;
    if (check.status === 'posted' || check.postedEntryId || check.isResolved) {
      throw new Error('تم ترحيل هذا الجرد من قبل.');
    }

    transaction.set(entryRef, sanitizeFirestorePayload({
      ...preflight.preparedEntry,
      userId: args.actor.userId,
      createdAt: serverTimestamp(),
    } as Record<string, unknown>));
    transaction.update(checkRef, {
      status: 'posted',
      isResolved: true,
      postedEntryId: entryRef.id,
      postedAt: serverTimestamp(),
      postedBy: args.actor.userId,
      updatedAt: serverTimestamp(),
    });
    transaction.set(auditRef, {
      action: 'inventory_check_posted',
      collection: 'entries',
      documentId: entryRef.id,
      inventoryCheckId: args.checkId,
      userId: args.actor.userId,
      userEmail: args.actor.userEmail || '',
      canonicalOperationId: preflight.operation!.id,
      canonicalOperationVersion: preflight.operation!.version,
      timestamp: serverTimestamp(),
    });
  });

  return {
    ok: true,
    entryId: entryRef.id,
    entry: { ...preflight.preparedEntry, id: entryRef.id, userId: args.actor.userId },
  };
};
