import { Account } from '../types';

export interface OperationalAccountOption {
  id: string;
  c: string;
}

/** Builds operation choices exclusively from the operational accounts collection snapshot. */
export const buildOperationalAccountOptions = (
  accounts: Account[],
  preferredNames: Iterable<string> = [],
): OperationalAccountOption[] => {
  const active = accounts.filter((account): account is Account & { id: string } => (
    !!account.id && account.isActive !== false
  ));
  const preferred = new Set(preferredNames);
  const matching = preferred.size ? active.filter(account => preferred.has(account.name)) : [];
  return (matching.length ? matching : active).map(account => ({ id: account.id, c: account.name }));
};