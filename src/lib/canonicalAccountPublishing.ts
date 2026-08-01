import { Firestore, doc, runTransaction } from 'firebase/firestore';
import { Account, CanonicalAccountDefinition } from '../types';
import { validateCanonicalAccount } from './accountRegistry';

export interface PublishCanonicalAccountInput {
  db: Firestore;
  definition: CanonicalAccountDefinition;
  userId: string;
  reason: string;
  /** Current accounts snapshot. Only explicit canonicalAccountId links are candidates. */
  operationalAccounts: Account[];
  now?: () => string;
}

export interface PublishCanonicalAccountResult {
  canonicalAccountId: string;
  legacyAccountId: string;
  createdLegacyAccount: boolean;
  idempotent: boolean;
}

const stableId = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `published-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const mainTypeFor = (group: CanonicalAccountDefinition['mainGroup']): string => ({
  assets: 'اصول', liabilities: 'خصوم', equity: 'حقوق ملكية',
  revenue: 'ايرادات', expenses: 'مصروفات',
}[group]);

const operationalTypeFor = (definition: CanonicalAccountDefinition): Account['type'] => {
  if (definition.isMerchant) return 'merchant';
  if (definition.entityType === 'cash') return 'cash';
  if (definition.entityType === 'accessory_inventory') return 'accessory';
  if (definition.entityType === 'silver_inventory') return 'silver';
  if (definition.entityType === 'gold_inventory') return 'gold_product';
  return 'other';
};

const operationalAccountFor = (
  definition: CanonicalAccountDefinition,
  userId: string,
): Omit<Account, 'id'> & Record<string, unknown> => {
  const balanceNature = definition.allowedDimensions.includes('gold')
    ? 'جرام ذهب'
    : definition.allowedDimensions.includes('silver')
      ? 'جرام فضة'
      : definition.allowedDimensions.includes('quantity')
        ? 'قطعة'
        : 'جنية مصري';
  return {
    name: definition.canonicalName,
    mainType: mainTypeFor(definition.mainGroup),
    subType: definition.isInventory ? 'مخزون' : definition.displayName,
    balanceNature,
    userId,
    type: operationalTypeFor(definition),
    karat: definition.metal === 'gold' && definition.karat ? String(definition.karat) as '18' | '21' | '24' : null,
    metal: definition.metal === 'gold' || definition.metal === 'silver' ? definition.metal : null,
    is_inventory: definition.isInventory,
    isActive: definition.isActive,
    ...(definition.tracksQuantity ? { quantityStep: 1 } : {}),
    canonicalAccountId: definition.id,
  };
};

const unique = (values: Array<string | undefined>): string[] => [...new Set(values.filter((value): value is string => !!value))];

/** Publishes a shadow definition by linking it to exactly one operational account. */
export const publishCanonicalAccount = async ({
  db, definition, userId, reason, operationalAccounts, now = () => new Date().toISOString(),
}: PublishCanonicalAccountInput): Promise<PublishCanonicalAccountResult> => {
  const classificationErrors = validateCanonicalAccount(definition);
  if (classificationErrors.length) throw new Error(`لا يمكن نشر حساب ناقص التصنيف: ${classificationErrors.join(' — ')}`);
  if (!userId) throw new Error('لا يمكن النشر بدون مستخدم موثق.');

  const explicitlyLinkedAccounts = operationalAccounts.filter(account => account.canonicalAccountId === definition.id);
  if (explicitlyLinkedAccounts.some(account => !account.id)) throw new Error('يوجد Link تشغيلي بدون accountId صالح.');
  const snapshotIds = unique(explicitlyLinkedAccounts.map(account => account.id));
  if (snapshotIds.length > 1) throw new Error(`تعارض IDs: الحساب Canonical مرتبط بأكثر من حساب تشغيلي (${snapshotIds.join(', ')}).`);

  const canonicalRef = doc(db, 'canonicalAccounts', definition.id);
  const auditRef = doc(db, 'audit_logs', `canonical-publish-${stableId(`${definition.id}:${definition.version}`)}`);

  return runTransaction(db, async transaction => {
    const canonicalSnapshot = await transaction.get(canonicalRef);
    const stored = canonicalSnapshot.exists() ? canonicalSnapshot.data() as CanonicalAccountDefinition : undefined;
    const candidateIds = unique([
      stored?.legacyAccountId,
      definition.legacyAccountId,
      definition.sourceAccountId,
      ...snapshotIds,
    ]);
    if (candidateIds.length > 1) throw new Error(`تعارض IDs: توجد روابط صريحة مختلفة (${candidateIds.join(', ')}). لم يتم تعديل أي حساب.`);

    const legacyAccountId = candidateIds[0] ?? stableId(definition.id);
    const legacyRef = doc(db, 'accounts', legacyAccountId);
    const legacySnapshot = await transaction.get(legacyRef);
    const existingLegacy = legacySnapshot.exists() ? legacySnapshot.data() as Account : undefined;

    if (candidateIds.length && !existingLegacy) {
      throw new Error(`الرابط الصريح accounts/${legacyAccountId} غير موجود. لم يتم إنشاء بديل تلقائي.`);
    }
    if (existingLegacy?.userId !== undefined && existingLegacy.userId !== userId) {
      throw new Error('الحساب التشغيلي المرتبط مملوك لمستخدم آخر. لم يتم تعديل أي حساب.');
    }
    if (existingLegacy?.canonicalAccountId && existingLegacy.canonicalAccountId !== definition.id) {
      throw new Error(`تعارض IDs: accounts/${legacyAccountId} مرتبط بـ ${existingLegacy.canonicalAccountId}. لم يتم تعديل أي حساب.`);
    }

    const alreadyOperational = stored?.approvalStatus === 'approved'
      && stored.legacyAccountId === legacyAccountId
      && existingLegacy?.canonicalAccountId === definition.id;
    if (alreadyOperational && definition.version <= stored.version) {
      return { canonicalAccountId: definition.id, legacyAccountId, createdLegacyAccount: false, idempotent: true };
    }

    const timestamp = now();
    const published: CanonicalAccountDefinition = {
      ...definition,
      userId,
      legacyAccountId,
      reviewStatus: 'reviewed',
      approvalStatus: 'approved',
      approvedAt: stored?.approvedAt ?? timestamp,
      updatedAt: timestamp,
      classificationSource: 'manual',
      classificationConfidence: 1,
      audit: { ...definition.audit, updatedBy: userId, lastReason: reason },
    };

    if (existingLegacy) transaction.update(legacyRef, { canonicalAccountId: definition.id });
    else transaction.set(legacyRef, operationalAccountFor(definition, userId));
    transaction.set(canonicalRef, published);
    transaction.set(auditRef, {
      userId,
      action: 'canonical_account_published',
      canonicalAccountId: definition.id,
      legacyAccountId,
      createdLegacyAccount: !existingLegacy,
      reason,
      createdAt: timestamp,
    });
    return { canonicalAccountId: definition.id, legacyAccountId, createdLegacyAccount: !existingLegacy, idempotent: false };
  });
};

/** One-time admin repair; the exact name only selects the target canonical definition. */
export const repairQaflBarCanonicalAccount = async (
  input: Omit<PublishCanonicalAccountInput, 'definition'> & { canonicalAccounts: CanonicalAccountDefinition[] },
): Promise<PublishCanonicalAccountResult> => {
  const matches = input.canonicalAccounts.filter(account => account.canonicalName === 'قفل بار');
  if (matches.length !== 1) throw new Error(`إصلاح قفل بار متوقف: العدد المطابق بالاسم الدقيق هو ${matches.length}.`);
  return publishCanonicalAccount({ ...input, definition: matches[0] });
};