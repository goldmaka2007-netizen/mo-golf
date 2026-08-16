import type { Account, CanonicalAccountDefinition } from '../types';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from './inventoryCostCatalog';
import { buildRuntimeStableInventoryIdAliases } from './runtimeCostAccountResolver';

const QUANTITY_TRACKED_TAXONOMIES = new Set([
  'gold.direct.coin',
  'gold.direct.bar',
] as const);

/** Stable account IDs from the approved production inventory snapshot. */
const PRODUCTION_TAXONOMY_BY_ACCOUNT_ID = new Map<string, string>([
  ['K3JmA5ool9nXqFUrNqwZ', 'gold.direct.coin'],
  ['3VqSd1NWi2QQLkKl7Nwi', 'gold.direct.bar'],
]);

/** Derive quantity tracking from approved runtime taxonomy, without mutating accounts. */
export const buildRuntimeQuantityTrackedAccountIds = (
  accounts: readonly Account[],
): ReadonlySet<string> => {
  const stableIdByRuntimeId = buildRuntimeStableInventoryIdAliases(accounts);
  const taxonomyByStableId = new Map(
    CURRENT_DATASET_INVENTORY_BINDINGS.map(binding => [binding.inventoryAccountId, binding.taxonomyKey]),
  );
  return new Set(
    accounts
      .map(account => {
        if (!account.id) return undefined;
        return PRODUCTION_TAXONOMY_BY_ACCOUNT_ID.get(account.id)
          ?? (stableIdByRuntimeId.get(account.id)
            ? taxonomyByStableId.get(stableIdByRuntimeId.get(account.id)!)
            : undefined);
      })
      .map((taxonomy, index) => ({ taxonomy, account: accounts[index] }))
      .filter(({ taxonomy, account }) => !!account.id && !!taxonomy && QUANTITY_TRACKED_TAXONOMIES.has(taxonomy as never))
      .map(({ account }) => account.id!),
  );
};

export const accountHasRuntimeQuantityTracking = (
  account: Account | undefined,
  runtimeQuantityTrackedAccountIds: ReadonlySet<string> = new Set(),
): boolean => account?.quantityStep !== undefined
  || (!!account?.id && runtimeQuantityTrackedAccountIds.has(account.id));

export const applyRuntimeQuantityTracking = (
  definition: CanonicalAccountDefinition,
  account: Account | undefined,
  runtimeQuantityTrackedAccountIds: ReadonlySet<string> = new Set(),
): CanonicalAccountDefinition => {
  if (!accountHasRuntimeQuantityTracking(account, runtimeQuantityTrackedAccountIds)) return definition;
  const allowedDimensions = [...new Set([...definition.allowedDimensions, 'quantity' as const])];
  const quantityBalance = definition.normalBalanceByDimension.quantity
    ?? (['liabilities', 'equity', 'revenue'].includes(definition.mainGroup) ? 'credit' : 'debit');
  return {
    ...definition,
    allowedDimensions,
    normalBalanceByDimension: { ...definition.normalBalanceByDimension, quantity: quantityBalance },
    tracksQuantity: true,
    trackingMode: definition.tracksWeight ? 'weight_and_quantity' : 'quantity',
  };
};
