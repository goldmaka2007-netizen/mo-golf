import { Account, AccountTrackingDimension, Entry } from '../types';
import { buildAccountIndex, getEntryArabicWeight, parseCash, resolveAccount, resolveOperationKind } from './engine';
import { AccountRegistry } from './accountRegistry';
import { buildCanonicalPosting, CanonicalPostingResult } from './postingMatrix';

export interface LegacyShadowResult {
  operationId: string;
  operationKind: string;
  debitAccount: string;
  creditAccount: string;
  dimensions: AccountTrackingDimension[];
  values: Record<AccountTrackingDimension, number>;
  inventoryImpact: boolean;
  merchantImpact: boolean;
}

export type ParityDifferenceType = 'account' | 'dimension' | 'value' | 'inventory' | 'merchant' | 'validation';
export interface ParityDifference {
  type: ParityDifferenceType;
  dimension?: AccountTrackingDimension;
  legacyValue?: string | number | boolean;
  canonicalValue?: string | number | boolean;
  reason: string;
}
export interface ParityRow {
  operationId: string;
  operationKind: string;
  legacyResult: LegacyShadowResult;
  canonicalResult: CanonicalPostingResult;
  differences: ParityDifference[];
  severity: 'none' | 'info' | 'warning' | 'error';
  affectedAccount?: string;
  affectedDimension?: AccountTrackingDimension;
  expectedReason?: string;
  knownLegacyIssue: boolean;
  requiresReview: boolean;
  resolutionStatus: 'matched' | 'open' | 'explained';
}

const legacyDimensions = (entry: Entry, accounts: Account[]): AccountTrackingDimension[] => {
  const index = buildAccountIndex(accounts);
  const debit = resolveAccount(entry, 'debit', index);
  const credit = resolveAccount(entry, 'credit', index);
  const result: AccountTrackingDimension[] = [];
  if (parseCash(entry) > 0) result.push('cash');
  if (Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0) {
    if (debit?.metal === 'silver' || credit?.metal === 'silver' || debit?.type === 'silver' || credit?.type === 'silver') result.push('silver');
    else result.push('gold');
  }
  if (Number(entry.count) > 0) result.push('quantity');
  return result;
};
export const buildLegacyShadowResult = (entry: Entry, accounts: Account[]): LegacyShadowResult => {
  const index = buildAccountIndex(accounts);
  const debit = resolveAccount(entry, 'debit', index);
  const credit = resolveAccount(entry, 'credit', index);
  const dimensions = legacyDimensions(entry, accounts);
  return {
    operationId: entry.id || String(entry.seq),
    operationKind: resolveOperationKind(entry),
    debitAccount: debit?.id || entry.debitAccountId || entry.debit,
    creditAccount: credit?.id || entry.creditAccountId || entry.credit,
    dimensions,
    values: {
      cash: Math.abs(parseCash(entry)),
      gold: dimensions.includes('gold') ? Math.abs(getEntryArabicWeight(entry)) : 0,
      silver: dimensions.includes('silver') ? Math.abs(Number(entry.weight) || 0) : 0,
      quantity: Math.abs(Number(entry.count) || 0),
    },
    inventoryImpact: !![debit, credit].some(account => account?.is_inventory),
    merchantImpact: !![debit, credit].some(account => account?.type === 'merchant'),
  };
};

const closeEnough = (left: number, right: number, dimension: AccountTrackingDimension) => Math.abs(left - right) <= (dimension === 'cash' ? 0.005 : 0.000001);
export const buildParityRow = (entry: Entry, accounts: Account[], registry: AccountRegistry): ParityRow => {
  const legacyResult = buildLegacyShadowResult(entry, accounts);
  const canonicalResult = buildCanonicalPosting(entry, registry);
  const differences: ParityDifference[] = [];
  if (canonicalResult.debitAccountId && ![canonicalResult.debitAccountId, registry.byId.get(canonicalResult.debitAccountId)?.sourceAccountId].includes(legacyResult.debitAccount)) differences.push({ type: 'account', legacyValue: legacyResult.debitAccount, canonicalValue: canonicalResult.debitAccountId, reason: 'اختلاف ربط الحساب المدين' });
  if (canonicalResult.creditAccountId && ![canonicalResult.creditAccountId, registry.byId.get(canonicalResult.creditAccountId)?.sourceAccountId].includes(legacyResult.creditAccount)) differences.push({ type: 'account', legacyValue: legacyResult.creditAccount, canonicalValue: canonicalResult.creditAccountId, reason: 'اختلاف ربط الحساب الدائن' });
  (['cash', 'gold', 'silver', 'quantity'] as const).forEach(dimension => {
    const legacyUses = legacyResult.dimensions.includes(dimension);
    const canonicalUses = canonicalResult.dimensions.includes(dimension) && canonicalResult.legs.some(leg => leg.dimension === dimension);
    if (legacyUses !== canonicalUses) differences.push({ type: 'dimension', dimension, legacyValue: legacyUses, canonicalValue: canonicalUses, reason: `اختلاف استخدام بُعد ${dimension}` });
    if ((legacyUses || canonicalUses) && !closeEnough(legacyResult.values[dimension], canonicalResult.values[dimension], dimension)) differences.push({ type: 'value', dimension, legacyValue: legacyResult.values[dimension], canonicalValue: canonicalResult.values[dimension], reason: `اختلاف قيمة ${dimension}` });
  });
  if (legacyResult.inventoryImpact !== canonicalResult.inventoryImpact) differences.push({ type: 'inventory', legacyValue: legacyResult.inventoryImpact, canonicalValue: canonicalResult.inventoryImpact, reason: 'اختلاف تأثير المخزون' });
  if (legacyResult.merchantImpact !== canonicalResult.merchantImpact) differences.push({ type: 'merchant', legacyValue: legacyResult.merchantImpact, canonicalValue: canonicalResult.merchantImpact, reason: 'اختلاف تأثير التاجر' });
  canonicalResult.issues.forEach(issue => differences.push({ type: 'validation', dimension: issue.dimension, canonicalValue: issue.code, reason: issue.message }));
  const severity: ParityRow['severity'] = !differences.length ? 'none' : canonicalResult.issues.some(issue => ['unknown_account', 'ambiguous_alias', 'operation_not_allowed'].includes(issue.code)) ? 'error' : differences.some(item => item.type === 'value' || item.type === 'dimension') ? 'warning' : 'info';
  return {
    operationId: legacyResult.operationId, operationKind: legacyResult.operationKind, legacyResult, canonicalResult, differences, severity,
    affectedAccount: differences.find(item => item.type === 'account') ? `${entry.debit} / ${entry.credit}` : undefined,
    affectedDimension: differences.find(item => item.dimension)?.dimension,
    expectedReason: canonicalResult.issues[0]?.message,
    knownLegacyIssue: false,
    requiresReview: differences.length > 0,
    resolutionStatus: differences.length ? 'open' : 'matched',
  };
};

export interface ParityReport {
  generatedAt: string;
  total: number;
  matched: number;
  open: number;
  errors: number;
  rows: ParityRow[];
}
export const buildParityReport = (entries: Entry[], accounts: Account[], registry: AccountRegistry): ParityReport => {
  const rows = entries.map(entry => buildParityRow(entry, accounts, registry));
  return { generatedAt: new Date().toISOString(), total: rows.length, matched: rows.filter(row => !row.differences.length).length, open: rows.filter(row => row.differences.length).length, errors: rows.filter(row => row.severity === 'error').length, rows };
};
