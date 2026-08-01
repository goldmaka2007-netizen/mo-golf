import { Account, Entry } from '../types';
import { resolveOperationKind } from './engine';

export type EntryIdentityInput = Pick<Entry, 'tx' | 'debit' | 'credit'> & Partial<Entry>;

export type EntryIdentityResolution =
  | { ok: true; value: Pick<Entry, 'operationKind' | 'debitAccountId' | 'creditAccountId'> }
  | { ok: false; message: string };

/** Validates explicitly selected operational IDs before a write; names are display snapshots only. */
export const resolveEntryIdentity = (entry: EntryIdentityInput, accounts: Account[]): EntryIdentityResolution => {
  const debitAccount = accounts.find(account => account.id === entry.debitAccountId);
  const creditAccount = accounts.find(account => account.id === entry.creditAccountId);

  if (!debitAccount?.id) return { ok: false, message: 'تعذر تحديد معرف الحساب المدين. اختر حسابًا تشغيليًا من القائمة.' };
  if (!creditAccount?.id) return { ok: false, message: 'تعذر تحديد معرف الحساب الدائن. اختر حسابًا تشغيليًا من القائمة.' };
  if (debitAccount.name !== entry.debit || creditAccount.name !== entry.credit) {
    return { ok: false, message: 'اسم الحساب لا يطابق accountId المختار. أعد اختيار الحساب من القائمة.' };
  }

  const operationKind = resolveOperationKind({ ...entry, operationKind: undefined } as Entry);
  return { ok: true, value: { operationKind, debitAccountId: debitAccount.id, creditAccountId: creditAccount.id } };
};