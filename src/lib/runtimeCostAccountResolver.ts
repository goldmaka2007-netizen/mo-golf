import type { Account, Entry } from '../types';

export const RUNTIME_COST_ACCOUNT_RESOLVER_VERSION = 'runtime-account-metadata-v2' as const;

export interface RuntimeInventoryAccountAliasAudit {
  legacyAccountId: string;
  resolvedStableAccountId: string;
  resolvedAccountName: string;
  evidence: readonly string[];
  resolverVersion: typeof RUNTIME_COST_ACCOUNT_RESOLVER_VERSION;
  addedAt: string;
}

/** Legacy allowlist removed: accounts is the sole runtime identity source. */
export const APPROVED_RUNTIME_INVENTORY_ACCOUNT_ALIAS_AUDIT: readonly RuntimeInventoryAccountAliasAudit[] = [];

export const buildRuntimeStableInventoryIdAliases = (accounts: readonly Account[]): Map<string, string> =>
  new Map(accounts.filter(account => account.is_inventory && account.id).map(account => [account.id!, account.id!]));

export interface RuntimeCostAccountResolutionAudit {
  legacyAccountId: string;
  resolvedStableAccountId: string;
  resolvedAccountName: string;
  taxonomyKey: string;
  evidence: 'exact_versioned_name_and_inventory_metadata';
}

export interface RuntimeCostInputResolution {
  entries: Entry[];
  accounts: Account[];
  audit: RuntimeCostAccountResolutionAudit[];
  errors: string[];
}

export const resolveRuntimeCostAccountInputs = (
  entries: readonly Entry[],
  accounts: readonly Account[],
): RuntimeCostInputResolution => {
  const errors: string[] = [];
  const idsByName = new Map<string, string>();
  const duplicateNames = new Set<string>();
  for (const account of accounts.filter(item => item.is_inventory)) {
    if (!account.id) {
      errors.push(`Inventory account is missing accountId: ${account.name}`);
      continue;
    }
    if (idsByName.has(account.name)) duplicateNames.add(account.name);
    idsByName.set(account.name, account.id);
  }
  for (const name of duplicateNames) errors.push(`Duplicate inventory account name: ${name}`);
  const runtimeAccountIds = new Set(accounts.flatMap(account => account.id ? [account.id] : []));
  const resolvedEntries = entries.map(entry => ({
    ...entry,
    debitAccountId: entry.debitAccountId && runtimeAccountIds.has(entry.debitAccountId) ? entry.debitAccountId : idsByName.get(entry.debit) ?? entry.debitAccountId,
    creditAccountId: entry.creditAccountId && runtimeAccountIds.has(entry.creditAccountId) ? entry.creditAccountId : idsByName.get(entry.credit) ?? entry.creditAccountId,
  }));
  return { entries: resolvedEntries, accounts: accounts.map(account => ({ ...account })), audit: [], errors };
};

export const prepareRuntimeCostAccountInputs = resolveRuntimeCostAccountInputs;
