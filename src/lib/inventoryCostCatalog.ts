import type { Account } from '../types';
import type {
  InventoryRuntimeBinding,
  InventoryAccountResolution,
  InventoryCostKind,
  ResolvedInventoryAccount,
} from './inventoryCostTypes';

export const INVENTORY_COST_TAXONOMY_VERSION = 'makka-inventory-taxonomy-v1' as const;

export { INVENTORY_COST_TAXONOMY, CURRENT_DATASET_INVENTORY_BINDINGS } from './legacyInventoryCostDataset';

export interface InventoryRuntimeCatalog {
  byAccountId: ReadonlyMap<string, ResolvedInventoryAccount>;
  invalidAccounts: ReadonlyMap<string, 'missing_inventory_type' | 'unsupported_dimension' | 'unsupported_costing_method' | 'missing_cost_basis'>;
  errors: string[];
}

const legacyKind = (account: Account): InventoryCostKind | undefined => {
  if (account.type === 'accessory') return 'accessory';
  if (account.metal === 'gold' || account.metal === 'silver') return account.metal;
  return undefined;
};

export const resolveInventoryAccount = (account?: Account | null): InventoryAccountResolution => {
  if (!account?.is_inventory) return { status: 'not-inventory' };
  const kind = account.inventoryKind ?? legacyKind(account);
  if (!kind || !account.id) return { status: 'invalid', reason: 'missing_inventory_type' };
  const dimension = account.measurementDimension ?? (kind === 'accessory' ? 'quantity' : 'weight');
  if ((dimension !== 'weight' && dimension !== 'quantity')
    || (kind === 'accessory' ? dimension !== 'quantity' : dimension !== 'weight')) {
    return { status: 'invalid', reason: 'unsupported_dimension' };
  }
  const costingMethod = account.costingMethod ?? 'wac';
  if (costingMethod !== 'wac' && costingMethod !== 'fixed-opening-cost') {
    return { status: 'invalid', reason: 'unsupported_costing_method' };
  }
  const resolved: ResolvedInventoryAccount = {
    inventoryAccountId: account.id,
    displayName: account.name,
    taxonomyKey: `inventory.${kind}.${dimension}.${costingMethod}`,
    kind,
    unitBasis: kind === 'accessory'
      ? 'accessory_milli_piece'
      : kind === 'silver' ? 'silver_centigram' : 'gold_equivalent21_centigram',
    karat: kind === 'gold' ? Number(account.karat ?? 21) as 18 | 21 | 24 : null,
    dimension,
    costingMethod,
  };
  return { status: 'eligible', accountId: account.id, dimension, costingMethod, account: resolved };
};

export const buildInventoryRuntimeCatalog = (
  accounts: Account[],
  _legacyBindings?: readonly InventoryRuntimeBinding[],
): InventoryRuntimeCatalog => {
  const byAccountId = new Map<string, ResolvedInventoryAccount>();
  const invalidAccounts = new Map<string, 'missing_inventory_type' | 'unsupported_dimension' | 'unsupported_costing_method' | 'missing_cost_basis'>();
  const errors: string[] = [];
  for (const account of accounts) {
    const resolution = resolveInventoryAccount(account);
    if (resolution.status === 'eligible') {
      if (byAccountId.has(resolution.accountId)) errors.push(`Duplicate inventory accountId: ${resolution.accountId}`);
      else byAccountId.set(resolution.accountId, resolution.account);
    } else if (resolution.status === 'invalid') {
      invalidAccounts.set(account.id ?? account.name, resolution.reason);
    }
  }
  return { byAccountId, invalidAccounts, errors };
};
