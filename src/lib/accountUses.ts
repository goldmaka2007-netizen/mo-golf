import type { Account, CanonicalAccountDefinition, TransactionRule } from '../types';
import { getLedgerAccountGroupId } from './ledgerReport';
import { normalizeCloneAccountName } from './accountCloning';

export interface AccountUse { rule: TransactionRule; side: 'debit' | 'credit'; karat?: number | null; }
export interface AddUseCandidate { tx: string; side: 'debit' | 'credit'; counterpartName: string; counterpartAccountId?: string; karat?: number | null; multiplier: number; category: string; }

const protectedSubTypes = new Set(['inventory_gold','inventory_silver','inventory_accessory','cash','merchant_gold','merchant_silver','capital','retained_earnings','withdrawals','gold_surplus','gold_shortage','silver_surplus','silver_shortage','adjustment','historical']);
const accountClass = (account: Account): string | null => { const subtype = account.canonicalSubType; const group = getLedgerAccountGroupId(account); return !subtype && group === 'unclassified' ? null : `${subtype || group}|${account.type || ''}|${account.metal || ''}|${account.karat || ''}`; };

export const isProtectedAccountForUses = (account: Account, canonical?: CanonicalAccountDefinition): boolean => {
  const subtype = canonical?.entityType || account.canonicalSubType;
  const group = getLedgerAccountGroupId(account);
  return !account.id || account.isActive === false || !accountClass(account) || account.type === 'cash' || account.type === 'merchant' || account.is_inventory === true || account.accountRole === 'system' || account.accountRole === 'revaluation' || account.accountRole === 'sales' || account.accountRole === 'cost_of_sales' || group === 'unclassified' || group === 'equity' || (subtype ? protectedSubTypes.has(subtype) : false) || canonical?.isHistoricalOnly === true || (canonical ? canonical.classificationConflicts.length !== 0 : false);
};
const matchesAccount = (rule: TransactionRule, side: 'debit' | 'credit', account: Account): boolean => (side === 'debit' ? rule.debitAccountId : rule.creditAccountId) === account.id || normalizeCloneAccountName(side === 'debit' ? rule.debit : rule.credit) === normalizeCloneAccountName(account.name);
export const resolveAccountUses = (account: Account, rules: TransactionRule[]): AccountUse[] => rules.flatMap(rule => [ ...(matchesAccount(rule,'debit',account) ? [{ rule, side: 'debit' as const, karat: rule.karat }] : []), ...(matchesAccount(rule,'credit',account) ? [{ rule, side: 'credit' as const, karat: rule.karat }] : []) ]);
const sameIdentity = (name: string, id: string | undefined, account: Account) => (!!id && id === account.id) || normalizeCloneAccountName(name) === normalizeCloneAccountName(account.name);
const signature = (rule: Pick<TransactionRule,'tx'|'debit'|'credit'|'debitAccountId'|'creditAccountId'|'karat'|'multiplier'>, accounts: Account[]) => { const resolve = (name: string, id?: string) => id || accounts.find(item => normalizeCloneAccountName(item.name) === normalizeCloneAccountName(name))?.id || normalizeCloneAccountName(name); return [rule.tx,resolve(rule.debit,rule.debitAccountId),resolve(rule.credit,rule.creditAccountId),rule.karat ?? '',rule.multiplier ?? 1].join('|'); };
export const hasEffectiveDuplicate = (candidate: TransactionRule, rules: TransactionRule[], accounts: Account[]) => rules.some(rule => signature(rule, accounts) === signature(candidate, accounts));
export const findSafeAddUseCandidate = (account: Account, tx: string, rules: TransactionRule[], accounts: Account[]): AddUseCandidate | null => {
  const targetClass = accountClass(account); if (!targetClass || !tx) return null;
  const candidates = rules.flatMap(rule => { if (rule.tx !== tx) return []; for (const side of ['debit','credit'] as const) { const otherSide = side === 'debit' ? 'credit' : 'debit'; const otherName = otherSide === 'debit' ? rule.debit : rule.credit; const otherId = otherSide === 'debit' ? rule.debitAccountId : rule.creditAccountId; const other = accounts.find(item => sameIdentity(otherName, otherId, item)); if (!other || accountClass(other) !== targetClass) continue; const counterpartName = side === 'debit' ? rule.debit : rule.credit; const counterpartId = side === 'debit' ? rule.debitAccountId : rule.creditAccountId; const counterpart = accounts.find(item => sameIdentity(counterpartName, counterpartId, item)); if (counterpartId && !counterpart) continue; return [{ tx, side: otherSide, counterpartName, counterpartAccountId: counterpart?.id || counterpartId, karat: rule.karat, multiplier: rule.multiplier ?? 1, category: rule.category }]; } return []; });
  const distinct = candidates.filter((candidate,index,list) => list.findIndex(item => JSON.stringify(item) === JSON.stringify(candidate)) === index); return distinct.length === 1 ? { ...distinct[0], side: distinct[0].side as 'debit' | 'credit' } : null;
};
