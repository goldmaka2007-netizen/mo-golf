import { AccountingOperationKind, AccountTrackingDimension, CanonicalAccountDefinition, Entry } from '../types';
import { getEntryArabicWeight, parseCash, resolveOperationKind } from './engine';
import { AccountRegistry } from './accountRegistry';

export interface PostingPolicy {
  operationKind: AccountingOperationKind;
  requiredDimensions: AccountTrackingDimension[];
  optionalDimensions: AccountTrackingDimension[];
  forbiddenDimensions: AccountTrackingDimension[];
  allowsQuantity: boolean;
  affectsInventory: boolean;
  affectsMerchant: boolean;
}

const all: AccountTrackingDimension[] = ['cash', 'gold', 'silver', 'quantity'];
export const POSTING_MATRIX: Record<AccountingOperationKind, PostingPolicy> = {
  opening: { operationKind: 'opening', requiredDimensions: [], optionalDimensions: all, forbiddenDimensions: [], allowsQuantity: true, affectsInventory: true, affectsMerchant: true },
  purchase: { operationKind: 'purchase', requiredDimensions: [], optionalDimensions: all, forbiddenDimensions: [], allowsQuantity: true, affectsInventory: true, affectsMerchant: true },
  sale: { operationKind: 'sale', requiredDimensions: [], optionalDimensions: all, forbiddenDimensions: [], allowsQuantity: true, affectsInventory: true, affectsMerchant: false },
  transfer: { operationKind: 'transfer', requiredDimensions: [], optionalDimensions: all, forbiddenDimensions: [], allowsQuantity: true, affectsInventory: true, affectsMerchant: true },
  tifeet: { operationKind: 'tifeet', requiredDimensions: ['gold'], optionalDimensions: ['quantity'], forbiddenDimensions: ['cash', 'silver'], allowsQuantity: true, affectsInventory: true, affectsMerchant: false },
  adjustment: { operationKind: 'adjustment', requiredDimensions: [], optionalDimensions: all, forbiddenDimensions: [], allowsQuantity: true, affectsInventory: true, affectsMerchant: true },
  merchant_settlement: { operationKind: 'merchant_settlement', requiredDimensions: [], optionalDimensions: ['cash', 'gold', 'silver'], forbiddenDimensions: ['quantity'], allowsQuantity: false, affectsInventory: false, affectsMerchant: true },
  personal_withdrawal: { operationKind: 'personal_withdrawal', requiredDimensions: [], optionalDimensions: ['cash', 'gold', 'silver'], forbiddenDimensions: ['quantity'], allowsQuantity: false, affectsInventory: true, affectsMerchant: false },
  expense: { operationKind: 'expense', requiredDimensions: ['cash'], optionalDimensions: [], forbiddenDimensions: ['gold', 'silver', 'quantity'], allowsQuantity: false, affectsInventory: false, affectsMerchant: false },
  other: { operationKind: 'other', requiredDimensions: [], optionalDimensions: all, forbiddenDimensions: [], allowsQuantity: true, affectsInventory: true, affectsMerchant: true },
};

export interface PostingValidationIssue {
  code: 'unknown_account' | 'ambiguous_alias' | 'dimension_forbidden' | 'dimension_unsupported' | 'required_dimension_missing' | 'operation_not_allowed' | 'invalid_amount';
  message: string;
  side?: 'debit' | 'credit';
  dimension?: AccountTrackingDimension;
}

export interface CanonicalPostingLeg {
  accountId: string;
  historicalName: string;
  side: 'debit' | 'credit';
  dimension: AccountTrackingDimension;
  amount: number;
  affectsBalance: boolean;
}

export interface CanonicalPostingResult {
  operationId: string;
  operationKind: AccountingOperationKind;
  debitAccountId?: string;
  creditAccountId?: string;
  dimensions: AccountTrackingDimension[];
  values: Record<AccountTrackingDimension, number>;
  inventoryImpact: boolean;
  merchantImpact: boolean;
  legs: CanonicalPostingLeg[];
  issues: PostingValidationIssue[];
  valid: boolean;
}

const entryValues = (entry: Entry, debit?: CanonicalAccountDefinition, credit?: CanonicalAccountDefinition): Record<AccountTrackingDimension, number> => {
  const hasWeight = Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0;
  const metal = debit?.metal === 'gold' || credit?.metal === 'gold' ? 'gold' : debit?.metal === 'silver' || credit?.metal === 'silver' ? 'silver' : hasWeight ? 'gold' : null;
  return {
    cash: Math.abs(parseCash(entry)),
    gold: metal === 'gold' ? Math.abs(getEntryArabicWeight(entry, debit?.metal === 'gold' ? undefined : undefined)) : 0,
    silver: metal === 'silver' ? Math.abs(Number(entry.weight) || 0) : 0,
    quantity: Math.abs(Number(entry.count) || 0),
  };
};

export const getVisiblePostingDimensions = (operationKind: AccountingOperationKind, accounts: CanonicalAccountDefinition[]): AccountTrackingDimension[] => {
  const policy = POSTING_MATRIX[operationKind];
  const owned = new Set(accounts.flatMap(account => account.allowedDimensions));
  return [...new Set([...policy.requiredDimensions, ...policy.optionalDimensions])].filter(dimension => owned.has(dimension) && !policy.forbiddenDimensions.includes(dimension));
};

/** Pure, non-persisting posting engine used by forms and Shadow Mode. */
export const buildCanonicalPosting = (entry: Entry, registry: AccountRegistry): CanonicalPostingResult => {
  const operationKind = resolveOperationKind(entry);
  const policy = POSTING_MATRIX[operationKind];
  const debitResolution = registry.resolve(entry.debitAccountId, entry.debit);
  const creditResolution = registry.resolve(entry.creditAccountId, entry.credit);
  const issues: PostingValidationIssue[] = [];
  ([['debit', debitResolution], ['credit', creditResolution]] as const).forEach(([side, resolution]) => {
    if (resolution.status === 'unknown') issues.push({ code: 'unknown_account', side, message: `${side === 'debit' ? 'الحساب المدين' : 'الحساب الدائن'} غير معروف: ${resolution.value}` });
    if (resolution.status === 'ambiguous') issues.push({ code: 'ambiguous_alias', side, message: `Alias غامض: ${resolution.value}` });
  });
  const debit = debitResolution.status === 'resolved' ? debitResolution.account : undefined;
  const credit = creditResolution.status === 'resolved' ? creditResolution.account : undefined;
  ([['debit', debit], ['credit', credit]] as const).forEach(([side, account]) => {
    if (account && !account.allowedOperationKinds.includes(operationKind)) issues.push({ code: 'operation_not_allowed', side, message: `الحساب ${account.displayName} غير مسموح في عملية ${operationKind}` });
  });
  const values = entryValues(entry, debit, credit);
  const dimensions = (Object.keys(values) as AccountTrackingDimension[]).filter(dimension => values[dimension] > 0);
  dimensions.forEach(dimension => {
    if (policy.forbiddenDimensions.includes(dimension)) issues.push({ code: 'dimension_forbidden', dimension, message: `البُعد ${dimension} ممنوع في عملية ${operationKind}` });
    if (![debit, credit].some(account => account?.allowedDimensions.includes(dimension))) issues.push({ code: 'dimension_unsupported', dimension, message: `لا يملك أي طرف البُعد ${dimension}` });
    if (!Number.isFinite(values[dimension]) || values[dimension] < 0) issues.push({ code: 'invalid_amount', dimension, message: `قيمة غير صحيحة في ${dimension}` });
  });
  policy.requiredDimensions.forEach(dimension => {
    if (values[dimension] <= 0) issues.push({ code: 'required_dimension_missing', dimension, message: `البُعد ${dimension} مطلوب في عملية ${operationKind}` });
  });
  const legs: CanonicalPostingLeg[] = [];
  ([['debit', debit, entry.debit], ['credit', credit, entry.credit]] as const).forEach(([side, account, historicalName]) => {
    if (!account) return;
    dimensions.forEach(dimension => {
      if (!account.allowedDimensions.includes(dimension) || policy.forbiddenDimensions.includes(dimension)) return;
      legs.push({ accountId: account.id, historicalName, side, dimension, amount: values[dimension], affectsBalance: dimension !== 'quantity' });
    });
  });
  return {
    operationId: entry.id || String(entry.seq), operationKind,
    debitAccountId: debit?.id, creditAccountId: credit?.id,
    dimensions, values,
    inventoryImpact: policy.affectsInventory && !![debit, credit].some(account => account?.isInventory),
    merchantImpact: policy.affectsMerchant && !![debit, credit].some(account => account?.isMerchant),
    legs, issues, valid: issues.length === 0,
  };
};
