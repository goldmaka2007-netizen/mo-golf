import type { Account } from '../types';
import type {
  InventoryRuntimeBinding,
  InventoryTaxonomyDefinition,
  ResolvedInventoryAccount,
} from './inventoryCostTypes';

export const INVENTORY_COST_TAXONOMY_VERSION = 'makka-inventory-taxonomy-v1' as const;

export const INVENTORY_COST_TAXONOMY: readonly InventoryTaxonomyDefinition[] = [
  { taxonomyKey: 'gold.product.ring_women', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.ring_children', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.earring_women', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.earring_children', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.earring_macaroni', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.tons', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.band', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.mehbes', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.bracelet', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.chain_pendant', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.gouache_kimk', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.borema', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.product.ring_arabic', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 21 },
  { taxonomyKey: 'gold.product.earring_arabic', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 21 },
  { taxonomyKey: 'gold.product.gouache_arabic', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 21 },
  { taxonomyKey: 'gold.product.chain_arabic', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 21 },
  { taxonomyKey: 'gold.raw.scrap_foreign', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 18 },
  { taxonomyKey: 'gold.raw.scrap_arabic', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 21 },
  { taxonomyKey: 'gold.direct.coin', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 21 },
  { taxonomyKey: 'gold.direct.bar', kind: 'gold', unitBasis: 'gold_equivalent21_centigram', karat: 24 },
  { taxonomyKey: 'silver.product.ring', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.product.ring_women', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.product.band', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.product.chain_men', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.product.chain_women', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.product.medal', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.product.clasp', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.raw.scrap', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'silver.direct.bar', kind: 'silver', unitBasis: 'silver_centigram', karat: null },
  { taxonomyKey: 'accessory.tungsten_band', kind: 'accessory', unitBasis: 'accessory_milli_piece', karat: null },
  { taxonomyKey: 'accessory.medical_earring', kind: 'accessory', unitBasis: 'accessory_milli_piece', karat: null },
  { taxonomyKey: 'accessory.silicone', kind: 'accessory', unitBasis: 'accessory_milli_piece', karat: null },
] as const;

/**
 * Approved bindings for the currently imported Makka dataset. The cost engine
 * consumes InventoryRuntimeBinding[] and is not coupled to these identifiers.
 * A future approved metadata registry can supply another binding set without
 * changing WAC logic.
 */
export const CURRENT_DATASET_INVENTORY_BINDINGS: readonly InventoryRuntimeBinding[] = [
  ['seed-account-f7259c51816b3eca60b0', 'gold.product.ring_women'],
  ['seed-account-960d86a1b65899e364b7', 'gold.product.ring_children'],
  ['seed-account-cb5d499baa26a3db6f1c', 'gold.product.earring_women'],
  ['seed-account-6b34c4189c5376f463c7', 'gold.product.earring_children'],
  ['seed-account-7a7da1fd500bce293e8b', 'gold.product.earring_macaroni'],
  ['seed-account-60ed1f8a1341a1ab20be', 'gold.product.tons'],
  ['seed-account-abefcfd780de9b384dc5', 'gold.product.band'],
  ['seed-account-dd24b4d1f062d92a3e80', 'gold.product.mehbes'],
  ['seed-account-d37d8b76e6ed91e88626', 'gold.product.bracelet'],
  ['seed-account-3d2cf6d12174291e9009', 'gold.product.chain_pendant'],
  ['seed-account-888be625b60c2a8405b9', 'gold.product.gouache_kimk'],
  ['seed-account-d6d361a10f6d7735f5a2', 'gold.product.borema'],
  ['seed-account-ea099bf0071894125ad3', 'gold.product.ring_arabic'],
  ['seed-account-ff66eba547be9e799aba', 'gold.product.earring_arabic'],
  ['seed-account-391695330f1733e03bb0', 'gold.product.gouache_arabic'],
  ['seed-account-0979d99c4bdc04a58242', 'gold.product.chain_arabic'],
  ['seed-account-7ac32db4e3484ce2dc22', 'gold.raw.scrap_foreign'],
  ['seed-account-d1216eb4076ccdf40e20', 'gold.raw.scrap_arabic'],
  ['seed-account-87c0acf366b1f0c35e60', 'gold.direct.coin'],
  ['seed-account-8bc82f32572189c8e128', 'gold.direct.bar'],
  ['seed-account-feed1210d025ed84e443', 'silver.product.ring'],
  ['seed-account-5cce856398210bd05927', 'silver.product.ring_women'],
  ['seed-account-585a165916de021adb5a', 'silver.product.band'],
  ['seed-account-277ad17fa191c3353d9c', 'silver.product.chain_men'],
  ['seed-account-733d11dcb5429d9b6bd3', 'silver.product.chain_women'],
  ['seed-account-2a2cf06601c9f559a0df', 'silver.product.medal'],
  ['seed-account-e27e33314fe25b6b461c', 'silver.product.clasp'],
  ['seed-account-2da1e46de570300127c6', 'silver.raw.scrap'],
  ['seed-account-c870314995b4c233c0d7', 'silver.direct.bar'],
  ['seed-account-93c8c8cf9d87c00e1e88', 'accessory.tungsten_band'],
  ['seed-account-8d4a16e5eb12e1278df0', 'accessory.medical_earring'],
  ['seed-account-34b151012e0aaea0e188', 'accessory.silicone'],
].map(([inventoryAccountId, taxonomyKey]) => ({ inventoryAccountId, taxonomyKey })) as InventoryRuntimeBinding[];

export interface InventoryRuntimeCatalog {
  byAccountId: ReadonlyMap<string, ResolvedInventoryAccount>;
  errors: string[];
}

export const buildInventoryRuntimeCatalog = (
  accounts: Account[],
  bindings: readonly InventoryRuntimeBinding[] = CURRENT_DATASET_INVENTORY_BINDINGS,
): InventoryRuntimeCatalog => {
  const definitions = new Map(INVENTORY_COST_TAXONOMY.map(definition => [definition.taxonomyKey, definition]));
  const accountsById = new Map(accounts.filter(account => account.id).map(account => [account.id as string, account]));
  const byAccountId = new Map<string, ResolvedInventoryAccount>();
  const errors: string[] = [];
  const seenBindings = new Set<string>();

  for (const binding of bindings) {
    if (seenBindings.has(binding.inventoryAccountId)) {
      errors.push(`Duplicate inventory runtime binding: ${binding.inventoryAccountId}`);
      continue;
    }
    seenBindings.add(binding.inventoryAccountId);
    const definition = definitions.get(binding.taxonomyKey);
    if (!definition) {
      errors.push(`Unknown inventory taxonomy key: ${binding.taxonomyKey}`);
      continue;
    }
    const account = accountsById.get(binding.inventoryAccountId);
    if (!account) continue;
    const metadataKind = account.type === 'accessory' ? 'accessory' : account.metal;
    if (!account.is_inventory || metadataKind !== definition.kind) {
      errors.push(`Inventory metadata mismatch for ${binding.inventoryAccountId}`);
      continue;
    }
    if (definition.kind === 'gold' && Number(account.karat) !== definition.karat) {
      errors.push(`Inventory karat mismatch for ${binding.inventoryAccountId}`);
      continue;
    }
    byAccountId.set(binding.inventoryAccountId, {
      ...definition,
      inventoryAccountId: binding.inventoryAccountId,
      displayName: account.name,
    });
  }

  for (const account of accounts.filter(item => item.is_inventory)) {
    if (!account.id) {
      errors.push(`Inventory account is missing accountId: ${account.name}`);
    } else if (!byAccountId.has(account.id)) {
      errors.push(`Unknown inventory accountId: ${account.id}`);
    }
  }

  return { byAccountId, errors };
};
