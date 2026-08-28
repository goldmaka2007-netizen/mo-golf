import type { Account, CanonicalAccountDefinition, TransactionRule } from '../types';
import { getLedgerAccountGroupId } from './ledgerReport';
import { normalizeCloneAccountName } from './accountCloning';

export interface AccountUse { rule: TransactionRule; side: 'debit' | 'credit'; karat?: number | null; }
export interface AddUseCandidate { tx: string; side: 'debit' | 'credit'; counterpartName: string; counterpartAccountId?: string; karat?: number | null; multiplier: number; category: string; }

const protectedSubTypes = new Set(['inventory_gold', 'inventory_silver', 'inventory_accessory', 'cash', 'merchant_gold', 'merchant_silver', 'capital', 'retained_earnings', 'withdrawals', 'gold_surplus', 'gold_shortage', 'silver_surplus', 'silver_shortage', 'adjustment', 'historical']);
const accountClass = (account: Account): string | null => { const subtype = account.canonicalSubType; const group = getLedgerAccountGroupId(account); return !subtype && group === 'unclassified' ? null : `${subtype || group}|${account.type || ''}|${account.metal || ''}|${account.karat || ''}`; };

export const isProtectedAccountForUses = (account: Account, canonical?: CanonicalAccountDefinition): boolean => {
  const subtype = canonical?.entityType || account.canonicalSubType;
  const group = getLedgerAccountGroupId(account);
  return !account.id || account.isActive === false || !accountClass(account) || account.type === 'cash' || account.type === 'merchant' || account.is_inventory === true || account.accountRole === 'system' || account.accountRole === 'revaluation' || account.accountRole === 'sales' || account.accountRole === 'cost_of_sales' || group === 'unclassified' || group === 'equity' || (subtype ? protectedSubTypes.has(subtype) : false) || canonical?.isHistoricalOnly === true || (canonical ? canonical.classificationConflicts.length !== 0 : false);
};

const sideName = (rule: TransactionRule, side: 'debit' | 'credit') => side === 'debit' ? rule.debit : rule.credit;
const sideId = (rule: TransactionRule, side: 'debit' | 'credit') => side === 'debit' ? rule.debitAccountId : rule.creditAccountId;
const resolveAccountsByIdentity = (name: string, id: string | undefined, accounts: Account[]): Account[] => id
  ? accounts.filter(account => account.id === id)
  : accounts.filter(account => normalizeCloneAccountName(account.name) === normalizeCloneAccountName(name));
const matchesAccount = (rule: TransactionRule, side: 'debit' | 'credit', account: Account): boolean => resolveAccountsByIdentity(sideName(rule, side), sideId(rule, side), [account]).length === 1;

export const resolveAccountUses = (account: Account, rules: TransactionRule[]): AccountUse[] => rules.flatMap(rule => [
  ...(matchesAccount(rule, 'debit', account) ? [{ rule, side: 'debit' as const, karat: rule.karat }] : []),
  ...(matchesAccount(rule, 'credit', account) ? [{ rule, side: 'credit' as const, karat: rule.karat }] : []),
]);

const signature = (rule: Pick<TransactionRule, 'tx' | 'debit' | 'credit' | 'debitAccountId' | 'creditAccountId' | 'karat' | 'multiplier'>, accounts: Account[]) => {
  const resolve = (name: string, id?: string) => id || (resolveAccountsByIdentity(name, undefined, accounts).length === 1 ? resolveAccountsByIdentity(name, undefined, accounts)[0].id : normalizeCloneAccountName(name));
  return [rule.tx, resolve(rule.debit, rule.debitAccountId), resolve(rule.credit, rule.creditAccountId), rule.karat ?? '', rule.multiplier ?? 1].join('|');
};
export const hasEffectiveDuplicate = (candidate: TransactionRule, rules: TransactionRule[], accounts: Account[]) => rules.some(rule => signature(rule, accounts) === signature(candidate, accounts));

export const findSafeAddUseCandidate = (account: Account, tx: string, rules: TransactionRule[], accounts: Account[]): AddUseCandidate | null => {
  const targetClass = accountClass(account);
  if (!targetClass || !tx) return null;
  const candidates = rules.flatMap(rule => {
    if (rule.tx !== tx) return [];
    for (const sourceSide of ['debit', 'credit'] as const) {
      const managedSide = sourceSide === 'debit' ? 'credit' : 'debit';
      const sourceMatches = resolveAccountsByIdentity(sideName(rule, managedSide), sideId(rule, managedSide), accounts);
      const source = sourceMatches.length === 1 ? sourceMatches[0] : undefined;
      if (!source || accountClass(source) !== targetClass) continue;
      const counterpartMatches = resolveAccountsByIdentity(sideName(rule, sourceSide), sideId(rule, sourceSide), accounts);
      const counterpart = counterpartMatches.length === 1 ? counterpartMatches[0] : undefined;
      if (!counterpart?.id) continue;
      return [{ tx, side: managedSide, counterpartName: counterpart.name, counterpartAccountId: counterpart.id, karat: rule.karat, multiplier: rule.multiplier ?? 1, category: rule.category }];
    }
    return [];
  });
  const distinct = candidates.filter((candidate, index, list) => list.findIndex(item => JSON.stringify(item) === JSON.stringify(candidate)) === index);
  return distinct.length === 1 ? { ...distinct[0], side: distinct[0].side as 'debit' | 'credit' } : null;
};
