import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, type Firestore } from 'firebase/firestore';
import type { Account, TransactionRule } from '../types';
import { effectiveAddUseDocumentId } from './accountUseServiceId';
import { hasEffectiveDuplicate, type AddUseCandidate } from './accountUses';

export const addAccountUse = async (args: { firestore: Firestore; userId: string; account: Account; candidate: AddUseCandidate; rules: TransactionRule[]; accounts: Account[] }) => {
  if (!args.account.id) throw new Error('الحساب بلا هوية ثابتة.');
  const snapshot = await getDocs(query(collection(args.firestore,'transactionRules'), where('userId','==',args.userId)));
  const current = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as TransactionRule));
  const debit = args.candidate.side === 'debit' ? args.account.name : args.candidate.counterpartName;
  const credit = args.candidate.side === 'credit' ? args.account.name : args.candidate.counterpartName;
  const debitAccountId = args.candidate.side === 'debit' ? args.account.id : args.candidate.counterpartAccountId;
  const creditAccountId = args.candidate.side === 'credit' ? args.account.id : args.candidate.counterpartAccountId;
  const next: TransactionRule & { id: string } = { id: effectiveAddUseDocumentId(args.userId,{ tx: args.candidate.tx, debit, credit, debitAccountId, creditAccountId, karat: args.candidate.karat, multiplier: args.candidate.multiplier }), tx: args.candidate.tx, debit, credit, debitAccountId, creditAccountId, karat: args.candidate.karat ?? null, multiplier: args.candidate.multiplier, category: args.candidate.category, userId: args.userId };
  if (hasEffectiveDuplicate(next,[...args.rules,...current],args.accounts)) throw new Error('هذا الاستخدام موجود بالفعل.');
  await runTransaction(args.firestore, async transaction => { const target = doc(args.firestore,'transactionRules',next.id); const existing = await transaction.get(target); if (existing.exists()) throw new Error('هذا الاستخدام موجود بالفعل.'); transaction.set(target,{ ...next, createdAt: serverTimestamp() }); });
  return next;
};
