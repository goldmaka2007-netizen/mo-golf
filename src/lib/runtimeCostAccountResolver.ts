import type { Account, Entry } from '../types';
import type { InventoryRuntimeBinding } from './inventoryCostTypes';
import { SEED_ACCOUNTS } from '../migrationData';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
  INVENTORY_COST_TAXONOMY,
} from './inventoryCostCatalog';

export const RUNTIME_COST_ACCOUNT_RESOLVER_VERSION =
  'runtime-cost-account-resolver-v1' as const;

export interface RuntimeInventoryAccountAliasAudit {
  legacyAccountId: string;
  resolvedStableAccountId: string;
  resolvedAccountName: string;
  evidence: readonly string[];
  resolverVersion: typeof RUNTIME_COST_ACCOUNT_RESOLVER_VERSION;
  addedAt: string;
}

/**
 * Explicit audit evidence for the Firestore account that first exposed the
 * runtime/catalog identity mismatch. Historical entries and account documents
 * are not rewritten; the resolver only creates in-memory cost-engine inputs.
 */
export const APPROVED_RUNTIME_INVENTORY_ACCOUNT_ALIAS_AUDIT:
readonly RuntimeInventoryAccountAliasAudit[] = [
  {
    legacyAccountId: '09qdBCNEiu9JxX4N6JnK',
    resolvedStableAccountId: 'seed-account-585a165916de021adb5a',
    resolvedAccountName: 'دبلة فضة',
    evidence: [
      'Firestore accounts document metadata exactly matches the versioned seed metadata: inventory=true, type=silver, metal=silver, karat=null, balanceNature=جرام فضة.',
      'The imported runtime dataset contains 14 exact account-name references from 2026-01-01 through 2026-05-25 and no direct account-id references.',
      'The Phase 4/5 stable inventory taxonomy binds دبلة فضة to silver.product.band and seed-account-585a165916de021adb5a.',
    ],
    resolverVersion: RUNTIME_COST_ACCOUNT_RESOLVER_VERSION,
    addedAt: '2026-07-24T00:00:00+03:00',
  },
] as const;

type ExpectedInventoryAccount = {
  stableAccountId: string;
  taxonomyKey: string;
  seed: Account;
};

const expectedInventoryByName = new Map<string, ExpectedInventoryAccount>(
  SEED_ACCOUNTS
    .filter(account => account.is_inventory)
    .map((account, index) => [
      account.name,
      {
        stableAccountId: CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
        taxonomyKey: CURRENT_DATASET_INVENTORY_BINDINGS[index].taxonomyKey,
        seed: account as Account,
      },
    ]),
);

const normalizedKarat = (value: Account['karat']): number | null => {
  if (value === null || value === undefined || value === 'silver') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const inventoryMetadataMatches = (
  actual: Account,
  expected: ExpectedInventoryAccount,
  requireCanonicalName = true,
): boolean => {
  const definition = INVENTORY_COST_TAXONOMY.find(
    item => item.taxonomyKey === expected.taxonomyKey,
  );
  if (!definition) return false;
  const actualKind = actual.type === 'accessory' ? 'accessory' : actual.metal;
  return (!requireCanonicalName || actual.name === expected.seed.name)
    && actual.mainType === expected.seed.mainType
    && actual.subType === expected.seed.subType
    && actual.balanceNature === expected.seed.balanceNature
    && actual.type === expected.seed.type
    && actual.is_inventory === true
    && actualKind === definition.kind
    && normalizedKarat(actual.karat) === definition.karat;
};

export const buildRuntimeStableInventoryIdAliases = (
  accounts: readonly Account[],
): Map<string, string> => {
  const aliases = new Map<string, string>();
  for (const account of accounts) {
    if (!account.is_inventory || !account.id) continue;
    const stableBinding = CURRENT_DATASET_INVENTORY_BINDINGS.find(binding =>
      binding.inventoryAccountId === account.id);
    if (stableBinding) {
      aliases.set(account.id, stableBinding.inventoryAccountId);
      continue;
    }
    const expected = expectedInventoryByName.get(account.name);
    if (expected && inventoryMetadataMatches(account, expected)) {
      aliases.set(account.id, expected.stableAccountId);
    }
  }
  return aliases;
};

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
  bindings: InventoryRuntimeBinding[];
  audit: RuntimeCostAccountResolutionAudit[];
  errors: string[];
}

/**
 * Resolves legacy Firestore inventory document ids and imported name-only
 * operation sides to stable Phase 5 ids. Resolution is fail-closed and requires
 * a unique exact name plus matching versioned inventory metadata. The returned
 * objects are clones; source Firestore records are never mutated.
 */
export const resolveRuntimeCostAccountInputs = (
  entries: readonly Entry[],
  accounts: readonly Account[],
): RuntimeCostInputResolution => {
  const errors: string[] = [];
  const audit: RuntimeCostAccountResolutionAudit[] = [];
  const stableIdByInventoryName = new Map<string, string>();
  const resolvedIdByRuntimeId = new Map<string, string>();
  const bindings: InventoryRuntimeBinding[] = [];
  const seenStableIds = new Set<string>();

  const resolvedAccounts = accounts.map(account => {
    if (!account.is_inventory) return { ...account };
    const stableBinding = account.id
      ? CURRENT_DATASET_INVENTORY_BINDINGS.find(binding =>
        binding.inventoryAccountId === account.id)
      : undefined;
    if (stableBinding) {
      if (seenStableIds.has(stableBinding.inventoryAccountId)) {
        errors.push(`Duplicate stable runtime inventory accountId: ${stableBinding.inventoryAccountId}`);
        return { ...account };
      }
      seenStableIds.add(stableBinding.inventoryAccountId);
      stableIdByInventoryName.set(account.name, stableBinding.inventoryAccountId);
      resolvedIdByRuntimeId.set(account.id!, stableBinding.inventoryAccountId);
      bindings.push(stableBinding);
      return { ...account };
    }
    if (account.cloneSourceAccountId) return { ...account };
    const expected = expectedInventoryByName.get(account.name);
    if (!expected) {
      errors.push(`Unknown inventory account name: ${account.name}`);
      return { ...account };
    }
    if (!inventoryMetadataMatches(account, expected)) {
      errors.push(`Inventory metadata mismatch for legacy accountId: ${account.id ?? '(missing)'}`);
      return { ...account };
    }
    if (seenStableIds.has(expected.stableAccountId)) {
      errors.push(`Duplicate runtime inventory mapping for stable accountId: ${expected.stableAccountId}`);
      return { ...account };
    }
    seenStableIds.add(expected.stableAccountId);
    stableIdByInventoryName.set(account.name, expected.stableAccountId);
    audit.push({
      legacyAccountId: account.id ?? '(missing)',
      resolvedStableAccountId: expected.stableAccountId,
      resolvedAccountName: account.name,
      taxonomyKey: expected.taxonomyKey,
      evidence: 'exact_versioned_name_and_inventory_metadata',
    });
    resolvedIdByRuntimeId.set(account.id!, expected.stableAccountId);
    bindings.push({ inventoryAccountId: expected.stableAccountId, taxonomyKey: expected.taxonomyKey as InventoryRuntimeBinding['taxonomyKey'] });
    return {
      ...account,
      id: expected.stableAccountId,
      legacySourceAccountId: account.id,
    } as Account;
  });

  const resolvedAccountsWithClones = resolvedAccounts.map(account => {
    if (!account.is_inventory || !account.id || !account.cloneSourceAccountId) return account;
    const resolvedSourceId = resolvedIdByRuntimeId.get(account.cloneSourceAccountId);
    const sourceBinding = bindings.find(binding => binding.inventoryAccountId === resolvedSourceId);
    const sourceExpected = [...expectedInventoryByName.values()].find(item =>
      item.stableAccountId === resolvedSourceId);
    if (!resolvedSourceId || !sourceBinding || !sourceExpected
      || !inventoryMetadataMatches(account, sourceExpected, false)) {
      errors.push(`Inventory clone source is unknown or incompatible: ${account.id}`);
      return account;
    }
    if (bindings.some(binding => binding.inventoryAccountId === account.id)) {
      errors.push(`Duplicate inventory runtime binding: ${account.id}`);
      return account;
    }
    bindings.push({ inventoryAccountId: account.id, taxonomyKey: sourceBinding.taxonomyKey });
    resolvedIdByRuntimeId.set(account.id, account.id);
    stableIdByInventoryName.set(account.name, account.id);
    return { ...account };
  });

  const expectedStableIds = new Set(bindings.map(binding => binding.inventoryAccountId));

  const resolvedEntries = entries.map(entry => {
    const debitStableId = (entry.debitAccountId ? resolvedIdByRuntimeId.get(entry.debitAccountId) : undefined)
      ?? stableIdByInventoryName.get(entry.debit);
    const creditStableId = (entry.creditAccountId ? resolvedIdByRuntimeId.get(entry.creditAccountId) : undefined)
      ?? stableIdByInventoryName.get(entry.credit);
    if (debitStableId && entry.debitAccountId
      && !expectedStableIds.has(entry.debitAccountId)
      && !audit.some(item => item.legacyAccountId === entry.debitAccountId
        && item.resolvedStableAccountId === debitStableId)) {
      errors.push(`Conflicting debit inventory accountId on operation: ${entry.id ?? entry.legacyOperationNo ?? '(unknown)'}`);
    }
    if (creditStableId && entry.creditAccountId
      && !expectedStableIds.has(entry.creditAccountId)
      && !audit.some(item => item.legacyAccountId === entry.creditAccountId
        && item.resolvedStableAccountId === creditStableId)) {
      errors.push(`Conflicting credit inventory accountId on operation: ${entry.id ?? entry.legacyOperationNo ?? '(unknown)'}`);
    }
    return {
      ...entry,
      debitAccountId: debitStableId ?? entry.debitAccountId,
      creditAccountId: creditStableId ?? entry.creditAccountId,
    };
  });

  return {
    entries: resolvedEntries,
    accounts: resolvedAccountsWithClones,
    bindings,
    audit,
    errors: [...new Set(errors)],
  };
};

export interface SupportedInvoiceInventoryAccountCoverage {
  emittedAccountId: string;
  accountName: string;
  resolvedCostAccountId: string;
  taxonomyKey: InventoryRuntimeBinding['taxonomyKey'];
  kind: 'gold' | 'silver' | 'accessory';
}

/**
 * Guardrail comparing every active inventory account the invoice UI can emit
 * with the bindings accepted by the canonical runtime cost resolver.
 */
export const auditSupportedInvoiceInventoryAccountCoverage = (
  accounts: readonly Account[],
): { coverage: SupportedInvoiceInventoryAccountCoverage[]; errors: string[] } => {
  const activeInventory = accounts.filter(account =>
    account.is_inventory && account.isActive !== false && !!account.id);
  const resolution = resolveRuntimeCostAccountInputs([], accounts);
  const stableByLegacy = new Map(resolution.audit.map(item => [
    item.legacyAccountId, item.resolvedStableAccountId,
  ]));
  const coverage = activeInventory.flatMap(account => {
    const resolvedCostAccountId = stableByLegacy.get(account.id!)
      ?? (resolution.bindings.some(binding => binding.inventoryAccountId === account.id)
        ? account.id! : undefined);
    const binding = resolution.bindings.find(item =>
      item.inventoryAccountId === resolvedCostAccountId);
    const definition = binding ? INVENTORY_COST_TAXONOMY.find(item =>
      item.taxonomyKey === binding.taxonomyKey) : undefined;
    if (!resolvedCostAccountId || !binding || !definition) return [];
    return [{
      emittedAccountId: account.id!,
      accountName: account.name,
      resolvedCostAccountId,
      taxonomyKey: binding.taxonomyKey,
      kind: definition.kind,
    }];
  });
  const coveredIds = new Set(coverage.map(item => item.emittedAccountId));
  const missing = activeInventory.filter(account => !coveredIds.has(account.id!))
    .map(account => `Invoice inventory account is not recognized by Cost/WAC: ${account.id}`);
  return { coverage, errors: [...new Set([...resolution.errors, ...missing])] };
};
