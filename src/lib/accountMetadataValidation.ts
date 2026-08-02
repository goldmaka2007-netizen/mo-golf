import type { Account } from '../types';

export type RequiredNewAccountMetadata = Pick<Account, 'canonicalMainType' | 'type' | 'metal' | 'is_inventory'>;
const requiredFields: Array<keyof RequiredNewAccountMetadata> = ['canonicalMainType', 'type', 'metal', 'is_inventory'];

/** Existing records are intentionally not validated here; this guard is creation-only. */
export const validateNewAccountMetadata = (account: Partial<Account>): string[] =>
  requiredFields.filter(field => account[field] === undefined).map(field => `Missing required account metadata: ${field}`);

export const assertNewAccountMetadata = (account: Partial<Account>): void => {
  const errors = validateNewAccountMetadata(account);
  if (errors.length) throw new Error(errors.join('; '));
};