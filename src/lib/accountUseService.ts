import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, type Firestore } from 'firebase/firestore';
import type { Account, CanonicalAccountDefinition, TransactionRule } from '../types';
import { effectiveAddUseDocumentId } from './accountUseServiceId';
import { findSafeAddUseCandidate, hasEffectiveDuplicate, isProtectedAccountForUses, type AddUseCandidate } from './accountUses';

export const addAccountUse = async (args: { firestore: Firestore; userId: string; account: Account; canonical?: CanonicalAccountDefinition; candidate: AddUseCandidate; rules: TransactionRule[]; accounts: Account[] }) => {
  if (!args.account.id) throw new Error('Account identity is required.');
  if (isProtectedAccountForUses(args.account, args.canonical)) throw new Error('Protected accounts cannot receive new uses.');
  const derived = findSafeAddUseCandidate(args.account, args.candidate.tx, args.rules, args.accounts);
  const candidateMatches = derived
    && derived.side === args.candidate.side
    && derived.counterpartAccountId === args.candidate.counterpartAccountId
    && derived.counterpartName === args.candidate.counterpartName
    && derived.karat === args.candidate.karat
    && derived.multiplier === args.candidate.multiplier
    && derived.category === args.candidate.category;
  if (!candidateMatches || !derived?.counterpartAccountId) throw new Error('Candidate is not a verified safe operational pattern.');
  const snapshot = await getDocs(query(collection(args.firestore, 'transactionRules'), where('userId', '==', args.userId)));
  const current = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as TransactionRule));
  const debit = derived.side === 'debit' ? args.account.name : derived.counterpartName;
  const credit = derived.side === 'credit' ? args.account.name : derived.counterpartName;
  const debitAccountId = derived.side === 'debit' ? args.account.id : derived.counterpartAccountId;
  const creditAccountId = derived.side === 'credit' ? args.account.id : derived.counterpartAccountId;
  const next: TransactionRule & { id: string } = { id: effectiveAddUseDocumentId(args.userId, { tx: derived.tx, debit, credit, debitAccountId, creditAccountId, karat: derived.karat, multiplier: derived.multiplier }), tx: derived.tx, debit, credit, debitAccountId, creditAccountId, karat: derived.karat ?? null, multiplier: derived.multiplier, category: derived.category, userId: args.userId };
  if (hasEffectiveDuplicate(next, [...args.rules, ...current], args.accounts)) throw new Error('This account use already exists.');
  await runTransaction(args.firestore, async transaction => { const target = doc(args.firestore, 'transactionRules', next.id); const existing = await transaction.get(target); if (existing.exists()) throw new Error('This account use already exists.'); transaction.set(target, { ...next, createdAt: serverTimestamp() }); });
  return next;
};
