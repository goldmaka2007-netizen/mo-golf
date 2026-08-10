import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { Account, CanonicalAccountDefinition, TransactionRule } from '../types';
import {
  accountCloneDocumentId,
  buildAccountClonePlan,
  type AccountClonePlan,
} from './accountCloning';

export interface CreateAccountCloneArgs {
  firestore: Firestore;
  userId: string;
  sourceAccountId: string;
  newName: string;
  operationalRules: TransactionRule[];
}

export interface CreateAccountCloneResult {
  accountId: string;
  ruleCount: number;
  plan: AccountClonePlan;
}

const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The only persisted clone path. The account document is the name reservation;
 * all operational rules and the audit record commit in the same transaction.
 */
export const createAccountClone = async (args: CreateAccountCloneArgs): Promise<CreateAccountCloneResult> => {
  const accountsQuery = query(collection(args.firestore, 'accounts'), where('userId', '==', args.userId));
  const canonicalQuery = query(collection(args.firestore, 'canonicalAccounts'), where('userId', '==', args.userId));
  const [accountsSnapshot, canonicalSnapshot] = await Promise.all([
    getDocs(accountsQuery),
    getDocs(canonicalQuery),
  ]);
  const existingAccounts = accountsSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const canonicalAccounts = canonicalSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as CanonicalAccountDefinition));
  const source = existingAccounts.find(account => account.id === args.sourceAccountId);
  if (!source) throw new Error('الحساب المصدر لم يعد موجودًا. حدّث الصفحة ثم حاول مرة أخرى.');

  const accountId = accountCloneDocumentId(args.userId, args.newName);
  const targetRef = doc(args.firestore, 'accounts', accountId);
  const sourceRef = doc(args.firestore, 'accounts', args.sourceAccountId);

  const plan = await runTransaction(args.firestore, async transaction => {
    const [freshSourceSnapshot, existingTargetSnapshot] = await Promise.all([
      transaction.get(sourceRef),
      transaction.get(targetRef),
    ]);
    if (!freshSourceSnapshot.exists()) throw new Error('الحساب المصدر لم يعد موجودًا.');
    if (existingTargetSnapshot.exists()) {
      throw new Error('اسم الحساب مستخدم بالفعل. لم يتم إنشاء أي حساب إضافي.');
    }

    const freshSource = { id: freshSourceSnapshot.id, ...freshSourceSnapshot.data() } as Account;
    const freshAccounts = existingAccounts.map(account => account.id === freshSource.id ? freshSource : account);
    const nextPlan = buildAccountClonePlan({
      source: freshSource,
      newName: args.newName,
      userId: args.userId,
      ids: { primary: accountId },
      existingAccounts: freshAccounts,
      canonicalAccounts,
      transactionRules: args.operationalRules,
    });

    transaction.set(targetRef, {
      ...clean(nextPlan.account),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    nextPlan.transactionRules.forEach(rule => {
      transaction.set(doc(args.firestore, 'transactionRules', rule.id), {
        ...clean(rule),
        createdAt: serverTimestamp(),
      });
    });
    transaction.set(doc(args.firestore, 'audit_logs', `${accountId}__created`), {
      userId: args.userId,
      action: 'operational_account_clone_created',
      sourceAccountId: args.sourceAccountId,
      createdAccountId: accountId,
      clonedRuleCount: nextPlan.transactionRules.length,
      createdAt: serverTimestamp(),
    });
    return nextPlan;
  });

  return { accountId, ruleCount: plan.transactionRules.length, plan };
};
