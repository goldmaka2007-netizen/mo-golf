import { Account, Entry } from '../types';
import { resolveOperationKind } from './engine';

export type EntryIdentityInput = Pick<Entry, 'tx' | 'debit' | 'credit'> & Partial<Entry>;

export type EntryIdentityResolution =
  | { ok: true; value: Pick<Entry, 'operationKind' | 'debitAccountId' | 'creditAccountId'> }
  | { ok: false; message: string };

/** Resolves stable IDs and the centrally-classified operation before a write. */
export const resolveEntryIdentity = (entry: EntryIdentityInput, accounts: Account[]): EntryIdentityResolution => {
  const debitAccount = accounts.find(account => account.name === entry.debit);
  const creditAccount = accounts.find(account => account.name === entry.credit);

  if (!debitAccount?.id) return { ok: false, message: `\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062F \u0645\u0639\u0631\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0646: ${entry.debit || '\u063A\u064A\u0631 \u0645\u062D\u062F\u062F'}. \u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.` };
  if (!creditAccount?.id) return { ok: false, message: `\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062F \u0645\u0639\u0631\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062F\u0627\u0626\u0646: ${entry.credit || '\u063A\u064A\u0631 \u0645\u062D\u062F\u062F'}. \u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.` };

  const operationKind = resolveOperationKind({ ...entry, operationKind: undefined } as Entry);
  return { ok: true, value: { operationKind, debitAccountId: debitAccount.id, creditAccountId: creditAccount.id } };
};