import type { Account } from '../types';

/** Runtime-only corrections keyed by immutable Firestore document ID.
 * They deliberately do not write metadata back to Production. */
const overrides: Record<string, Partial<Account>> = {
  CGuSD99FTGDiX3fdfuCc: {
    mainType: 'liabilities',
    subType: 'other_due',
    balanceNature: 'gold',
    canonicalMainType: 'liabilities',
    canonicalSubType: 'other_due',
    merchantDirection: 'payable',
    metal: 'gold',
    is_inventory: false,
  },
  SyBsRKWdl1nwbJDPsXM7: {
    mainType: 'liabilities',
    subType: 'other_due',
    balanceNature: 'cash',
    canonicalMainType: 'liabilities',
    canonicalSubType: 'other_due',
    merchantDirection: 'payable',
    metal: null,
    is_inventory: false,
  },
};

export const applyRuntimeAccountOverride = (account: Account): Account => {
  const override = account.id ? overrides[account.id] : undefined;
  return override ? { ...account, ...override } : account;
};
