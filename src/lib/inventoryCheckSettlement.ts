import { Account, AnnualOpeningCostConfig, CanonicalAccountDefinition, Entry, InventoryCheck } from '../types';
import { normalizeNumerals } from './accounting';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from './goldEquivalent';
import { resolveEntryIdentity } from './entryIdentity';
import { validateEntryNumberingPolicy } from './entryValidation';
import { buildAccountRegistry } from './accountRegistry';
import { buildCanonicalPosting } from './postingMatrix';
import { isGoldEquivalentEntry } from '../utils/accountLogic';
import { isQuantityAlignedToStep } from './weightedAverageCost';
import { buildOpeningCostConfig } from './openingCostConfig';
import { rebuildInventoryCostTimeline } from './inventoryCostEngine';
import { approvedHistoricalInventoryOverlaysForAccounts } from './historicalInventoryOverlay';
import { prepareRuntimeCostAccountInputs } from './runtimeCostAccountResolver';

const EPSILON = 0.001;

export type InventoryCheckStatus = NonNullable<InventoryCheck['status']>;

export interface InventoryCheckDiff {
  weightDiff: number;
  countDiff: number;
  hasWeightDiff: boolean;
  hasCountDiff: boolean;
  hasDiff: boolean;
}

export type PreparedEntryResult = {
  ok: true;
  entry: Entry;
  message?: never;
} | {
  ok: false;
  message: string;
  entry?: never;
};

const numberValue = (value: unknown): number => {
  const parsed = Number(normalizeNumerals(String(value ?? '0')));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateInventoryCheckDiff = (check: Pick<InventoryCheck, 'systemWeight' | 'actualWeight' | 'systemCount' | 'actualCount'>): InventoryCheckDiff => {
  const weightDiff = numberValue(check.actualWeight) - numberValue(check.systemWeight);
  const countDiff = numberValue(check.actualCount) - numberValue(check.systemCount);
  const weightMagnitude = weightDiff < 0 ? -weightDiff : weightDiff;
  const countMagnitude = countDiff < 0 ? -countDiff : countDiff;
  const hasWeightDiff = weightMagnitude >= EPSILON;
  const hasCountDiff = countMagnitude >= EPSILON;
  return { weightDiff, countDiff, hasWeightDiff, hasCountDiff, hasDiff: hasWeightDiff || hasCountDiff };
};
export const statusForInventoryCheck = (check: Pick<InventoryCheck, 'systemWeight' | 'actualWeight' | 'systemCount' | 'actualCount'>): InventoryCheckStatus =>
  calculateInventoryCheckDiff(check).hasDiff ? 'draft' : 'matched';

export const effectiveInventoryCheckStatus = (check: InventoryCheck): InventoryCheckStatus => {
  if (check.status) return check.status;
  if (check.postedEntryId || check.isResolved) return 'posted';
  return statusForInventoryCheck(check);
};

export const findAccountByCheck = (check: InventoryCheck, accounts: Account[]): Account | undefined =>
  accounts.find(account => account.id && account.id === check.accountDbId)
  ?? accounts.find(account => account.name === check.accountId);

const accountName = (account: Account | undefined, fallback: string) => account?.name || fallback;

const accountKarat = (account: Account | undefined): number | undefined => {
  const karat = Number(account?.karat);
  return karat === 18 || karat === 21 || karat === 24 ? karat : undefined;
};

const multiplierForKarat = (karat: number | undefined): number => {
  if (karat === 18) return 18 / 21;
  if (karat === 24) return 24 / 21;
  return 1;
};

const resolveAdjustmentSideAccount = (accounts: Account[], metal: 'gold' | 'silver', direction: 'shortage' | 'surplus'): string => {
  const targetId = metal === 'gold'
    ? (direction === 'shortage' ? 'gold-shortage' : 'gold-surplus')
    : (direction === 'shortage' ? 'silver-shortage' : 'silver-surplus');
  const byId = accounts.find(account => account.id === targetId);
  if (byId) return byId.name;

  const targets = direction === 'shortage'
    ? (metal === 'gold' ? ['\u0639\u062c\u0632-\u0627\u0644\u0630\u0647\u0628', 'عجز-الذهب'] : ['\u0639\u062c\u0632-\u0627\u0644\u0641\u0636\u0629', 'عجز-الفضة'])
    : (metal === 'gold' ? ['\u0632\u064a\u0627\u062f\u0629-\u0627\u0644\u0630\u0647\u0628', 'زيادة-الذهب'] : ['\u0632\u064a\u0627\u062f\u0629-\u0627\u0644\u0641\u0636\u0629', 'زيادة-الفضة']);
  const byName = accounts.find(account => targets.includes(account.name));
  return accountName(byName, targets[0]);
};
export const buildInventoryAdjustmentDraftEntry = (args: {
  check: InventoryCheck;
  accountsDb: Account[];
  entries: Entry[];
  userId: string;
  now?: number;
}): PreparedEntryResult => {
  const { check, accountsDb, entries, userId } = args;
  const diff = calculateInventoryCheckDiff(check);
  if (!diff.hasDiff) return { ok: false, message: 'لا يوجد فرق جرد يستحق الترحيل.' };

  const inventoryAccount = findAccountByCheck(check, accountsDb);
  if (!inventoryAccount) return { ok: false, message: `حساب المخزون غير موجود: ${check.accountId}` };

  const isAccessory = inventoryAccount.type === 'accessory';
  const metal = inventoryAccount.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(inventoryAccount.type || '')
    ? 'gold'
    : inventoryAccount.metal === 'silver' || inventoryAccount.type === 'silver'
      ? 'silver'
      : null;

  if (!isAccessory && !metal) return { ok: false, message: `الحساب ليس ذهبًا أو فضة أو ملحقات: ${inventoryAccount.name}` };

  const direction: 'shortage' | 'surplus' = diff.hasWeightDiff
    ? (diff.weightDiff < 0 ? 'shortage' : 'surplus')
    : (diff.countDiff < 0 ? 'shortage' : 'surplus');
  const weightDiffMagnitude = diff.weightDiff < 0 ? -diff.weightDiff : diff.weightDiff;
  const countDiffMagnitude = diff.countDiff < 0 ? -diff.countDiff : diff.countDiff;

  const counterpart = isAccessory
    ? resolveAdjustmentSideAccount(accountsDb, 'gold', direction)
    : resolveAdjustmentSideAccount(accountsDb, metal!, direction);

  const debit = direction === 'shortage' ? counterpart : inventoryAccount.name;
  const credit = direction === 'shortage' ? inventoryAccount.name : counterpart;
  const karat = metal === 'gold' ? accountKarat(inventoryAccount) : undefined;
  const date = check.date || new Date().toISOString().slice(0, 10);
  const year = date.slice(0, 4);
  const existingForYear = entries.filter(entry => String(entry.invoiceNumber || '').startsWith(`ADJ-${year}-`)).length;
  const sequence = existingForYear + 1;
  const invoiceNumber = `ADJ-${year}-${String(sequence).padStart(4, '0')}`;

  const entry = {
    tx: '\u062a\u0633\u0648\u064a\u0629',
    operationKind: 'adjustment',
    debit,
    credit,
    date,
    cash: '0',
    weight: isAccessory ? countDiffMagnitude.toFixed(0) : weightDiffMagnitude.toFixed(2),
    count: isAccessory ? '0' : countDiffMagnitude.toFixed(2),
    notes: `تسوية جرد: ${check.notes || ''}`.trim(),
    invoiceNumber,
    operationNo: invoiceNumber,
    journalNo: invoiceNumber,
    arabicWeight: '0',
    multiplier: multiplierForKarat(karat),
    userId,
    seq: args.now ?? Date.now(),
    inventoryCheckId: check.id,
  } as Entry;

  if (karat) entry.karat = karat;
  return { ok: true, entry };
};

export const prepareEntryForCentralSave = (args: {
  entry: Entry;
  entries: Entry[];
  accountsDb: Account[];
  openingCostConfig: AnnualOpeningCostConfig[];
  canonicalAccounts: CanonicalAccountDefinition[];
}): PreparedEntryResult => {
  const entry = { ...args.entry };
  const identity = resolveEntryIdentity(entry, args.accountsDb);
  if (identity.ok === false) return { ok: false, message: identity.message };
  Object.assign(entry, identity.value);
  if (args.entry.operationKind) entry.operationKind = args.entry.operationKind;

  const numberingValidation = validateEntryNumberingPolicy(entry);
  if (!numberingValidation.valid) {
    return { ok: false, message: `رفض سياسة ترقيم القيد: ${numberingValidation.issues.map(issue => issue.message).join(' - ')}` };
  }

  if (args.canonicalAccounts.length > 0) {
    const shadowPosting = buildCanonicalPosting(entry, buildAccountRegistry(args.accountsDb, args.entries, args.canonicalAccounts));
    if (!shadowPosting.valid) {
      return { ok: false, message: `رفض Posting Matrix: ${shadowPosting.issues.map(issue => issue.message).join(' - ')}` };
    }
  }

  if (isGoldEquivalentEntry(entry, args.accountsDb) && numberValue(entry.weight) > 0) {
    const calculationKarat = entry.karat ?? inferGoldKaratFromMultiplier(entry.multiplier);
    if (!canCalculateGoldEquivalent21(entry.weight, calculationKarat)) {
      return { ok: false, message: 'وزن الذهب أو العيار غير صالح.' };
    }
    const goldAudit = buildGoldEquivalent21Audit(entry.weight, calculationKarat);
    if (goldAudit) {
      entry.arabicWeight = goldAudit.snapshot.equivalent21;
      entry.goldEquivalent21Snapshot = goldAudit.snapshot;
      if (goldAudit.legacyComparison) entry.goldEquivalent21LegacyComparison = goldAudit.legacyComparison;
    }
  }

  const accessoryAccount = args.accountsDb.find(acc =>
    acc.type === 'accessory'
    && (acc.name === entry.debit || acc.name === entry.credit || acc.id === entry.debitAccountId || acc.id === entry.creditAccountId)
  );
  if (accessoryAccount && !isQuantityAlignedToStep(entry.weight, accessoryAccount.quantityStep ?? 1)) {
    return { ok: false, message: `كمية الملحقات يجب أن تكون من مضاعفات خطوة الصنف (${accessoryAccount.quantityStep ?? 1}).` };
  }

  const pendingEntry = { ...entry, id: '__pending_inventory_check_settlement__' } as Entry;
  const costInputs = prepareRuntimeCostAccountInputs([...args.entries, pendingEntry], args.accountsDb);
  if (costInputs.errors.length > 0) {
    return { ok: false, message: `\u0631\u0641\u0636 \u0631\u0628\u0637 \u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u062e\u0632\u0648\u0646: ${costInputs.errors[0]}` };
  }
  const openingConfig = buildOpeningCostConfig(args.openingCostConfig, args.accountsDb);
  const costValidation = rebuildInventoryCostTimeline(costInputs.entries, costInputs.accounts, openingConfig, {
    historicalInventoryOverlayDirectives: approvedHistoricalInventoryOverlaysForAccounts(costInputs.accounts),
  });
  if (!costValidation.valid) {
    const diagnostic = costValidation.diagnostics[0];
    return { ok: false, message: `رفض محرك التكلفة: ${diagnostic?.code || 'unknown'} - ${diagnostic?.message || 'تعذر اعتماد تكلفة العملية.'}` };
  }

  return { ok: true, entry };
};





