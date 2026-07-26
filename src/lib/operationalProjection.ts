import type { Account, AccountingOperationKind, Entry } from '../types';
import { affectsInventory, parseCash, processInventory, resolveOperationKind } from './engine';
import { isValidAccountingEntry } from './canonicalAccounting';

export type CanonicalRuleStatus = 'legacy_only' | 'operational_only' | 'canonical_balanced' | 'unresolved';

export interface OperationalMovement {
  sourceEntryId: string;
  operationKind: AccountingOperationKind;
  amount: number;
}

export interface UnresolvedCanonicalPosting {
  sourceEntryId: string;
  legacyOperationNo: string;
  rawDebitAccount: string;
  rawCreditAccount: string;
  storedGoldEquivalent21: number;
  debitAccountMetadata?: Account;
  creditAccountMetadata?: Account;
  warning: string;
}

export interface OperationalProjection {
  source: 'canonical_operational_projection';
  cashMovement: number;
  physicalGoldInventoryMovement: number;
  goldEquivalent21Movement: number;
  physicalSilverInventoryMovement: number;
  accessoriesQuantityMovement: number;
  merchantWeightLiabilityMovement: { gold: number; silver: number };
  merchantWorkmanshipCashMovement: number;
  costingEffects: OperationalMovement[];
  warnings: string[];
  unresolvedCanonicalPostings: UnresolvedCanonicalPosting[];
}

export interface CanonicalRuleStatusRow {
  operationType: string;
  operationKind: AccountingOperationKind;
  status: CanonicalRuleStatus;
  documentCount: number;
  reason: string;
}

const normalized = (value: unknown): string => String(value ?? '').trim();
const entryId = (entry: Entry): string => entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '');
export const isTx42 = (entry: Entry): boolean => normalized(entry.legacyOperationNo || entry.invoiceNumber) === 'TX42';

const accountIndex = (accounts: Account[]) => ({
  byId: new Map(accounts.flatMap(account => account.id ? [[account.id, account] as const] : [])),
  byName: new Map(accounts.map(account => [normalized(account.name), account])),
});

const resolveSide = (entry: Entry, side: 'debit' | 'credit', accounts: ReturnType<typeof accountIndex>): Account | undefined => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  return (id ? accounts.byId.get(id) : undefined) ?? accounts.byName.get(normalized(name));
};

export const buildUnresolvedCanonicalPostings = (entries: Entry[], accounts: Account[]): UnresolvedCanonicalPosting[] => {
  const index = accountIndex(accounts);
  return entries.filter(isValidAccountingEntry).filter(isTx42).map(entry => ({
    sourceEntryId: entryId(entry),
    legacyOperationNo: normalized(entry.legacyOperationNo || entry.invoiceNumber),
    rawDebitAccount: entry.debit,
    rawCreditAccount: entry.credit,
    storedGoldEquivalent21: Math.abs(Number(entry.arabicWeight) || 0),
    debitAccountMetadata: resolveSide(entry, 'debit', index),
    creditAccountMetadata: resolveSide(entry, 'credit', index),
    warning: 'TX42 متزن تاريخيًا، لكنه مستبعد من الـcanonical operational posting حتى اعتماد الطرف المقابل.',
  }));
};

/** Operational facts only. This projection is deliberately not journal-shaped
 * and must never be passed to Trial Balance. */
export const buildOperationalProjection = (entries: Entry[], accounts: Account[]): OperationalProjection => {
  const valid = entries.filter(isValidAccountingEntry);
  const index = accountIndex(accounts);
  const inventory = processInventory(valid.filter(entry => !isTx42(entry)), accounts);
  let cashMovement = 0;
  let merchantWorkmanshipCashMovement = 0;
  valid.filter(entry => !isTx42(entry)).forEach(entry => {
    const debit = resolveSide(entry, 'debit', index);
    const credit = resolveSide(entry, 'credit', index);
    const cash = Math.abs(parseCash(entry));
    if (debit?.type === 'cash') cashMovement += cash;
    if (credit?.type === 'cash') cashMovement -= cash;
    if (cash > 0 && (debit?.type === 'merchant' || credit?.type === 'merchant')) {
      merchantWorkmanshipCashMovement += debit?.type === 'merchant' ? -cash : cash;
    }
  });
  const physical = Object.entries(inventory.snapshots).reduce((total, [name, snapshot]) => {
    const account = index.byName.get(name);
    if (account?.metal === 'gold') total.gold += snapshot.weight;
    if (account?.metal === 'gold') total.gold21 += snapshot.arabicWeight;
    if (account?.metal === 'silver' || account?.type === 'silver') total.silver += snapshot.weight;
    if (account?.type === 'accessory') total.quantity += snapshot.count;
    return total;
  }, { gold: 0, gold21: 0, silver: 0, quantity: 0 });
  const merchant = Object.entries(inventory.merchantWeightLiabilities).reduce((total, [name, snapshot]) => {
    const account = index.byName.get(name);
    if (account?.metal === 'silver') total.silver += snapshot.weight;
    if (account?.metal === 'gold') total.gold += snapshot.arabicWeight;
    return total;
  }, { gold: 0, silver: 0 });
  const unresolvedCanonicalPostings = buildUnresolvedCanonicalPostings(valid, accounts);
  return {
    source: 'canonical_operational_projection',
    cashMovement,
    physicalGoldInventoryMovement: physical.gold,
    goldEquivalent21Movement: physical.gold21,
    physicalSilverInventoryMovement: physical.silver,
    accessoriesQuantityMovement: physical.quantity,
    merchantWeightLiabilityMovement: merchant,
    merchantWorkmanshipCashMovement,
    costingEffects: valid.filter(entry => !isTx42(entry) && affectsInventory(entry)).map(entry => ({ sourceEntryId: entryId(entry), operationKind: resolveOperationKind(entry), amount: Math.abs(parseCash(entry)) })),
    warnings: unresolvedCanonicalPostings.map(item => item.warning),
    unresolvedCanonicalPostings,
  };
};

const statusFor = (entry: Entry): Pick<CanonicalRuleStatusRow, 'status' | 'reason'> => {
  if (isTx42(entry)) return { status: 'unresolved', reason: 'الطرف المقابل للـcanonical gold posting غير معتمد.' };
  const kind = resolveOperationKind(entry);
  if (kind === 'sale' || kind === 'purchase') return { status: 'operational_only', reason: 'حركة النقدية والمخزون فقط؛ Revenue/COGS/Clearing غير معتمدة.' };
  if (['transfer', 'tifeet', 'merchant_settlement', 'adjustment'].includes(kind)) return { status: 'operational_only', reason: 'معالجة تشغيلية دون اعتمادها كقيد canonical مزدوج.' };
  return { status: 'legacy_only', reason: 'يظهر في الدفتر التاريخي فقط حتى اعتماد Canonical Double-entry Mapping.' };
};

export const buildCanonicalRuleStatusReport = (entries: Entry[]): CanonicalRuleStatusRow[] => {
  const rows = new Map<string, CanonicalRuleStatusRow>();
  entries.filter(isValidAccountingEntry).forEach(entry => {
    const operationKind = resolveOperationKind(entry);
    const result = statusFor(entry);
    const key = `${entry.tx}\u241f${operationKind}\u241f${result.status}`;
    const row = rows.get(key) ?? { operationType: entry.tx, operationKind, ...result, documentCount: 0 };
    row.documentCount += 1;
    rows.set(key, row);
  });
  return [...rows.values()].sort((a, b) => a.operationKind.localeCompare(b.operationKind) || a.operationType.localeCompare(b.operationType, 'ar'));
};

export const getPhysicalSilverInventory = (entries: Entry[], accounts: Account[]): number =>
  buildOperationalProjection(entries, accounts).physicalSilverInventoryMovement;

export const getMerchantSilverLiability = (entries: Entry[], accounts: Account[]): number =>
  buildOperationalProjection(entries, accounts).merchantWeightLiabilityMovement.silver;

export const getNetShopSilverOwnership = (entries: Entry[], accounts: Account[]): number =>
  getPhysicalSilverInventory(entries, accounts) - getMerchantSilverLiability(entries, accounts);
